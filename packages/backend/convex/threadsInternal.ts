import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

const ONLINE_THRESHOLD_MS = 60_000;

export const getThreadForAI = internalQuery({
	args: { threadId: v.id("threads") },
	handler: async (ctx, args) => {
		return await ctx.db.get(args.threadId);
	},
});

export const getTenantById = internalQuery({
	args: { tenantId: v.id("tenants") },
	handler: async (ctx, args) => {
		return await ctx.db.get(args.tenantId);
	},
});

export const setAiTyping = internalMutation({
	args: {
		threadId: v.id("threads"),
		isAiTyping: v.boolean(),
	},
	handler: async (ctx, args) => {
		await ctx.db.patch(args.threadId, { isAiTyping: args.isAiTyping });
	},
});

export const escalateThread = internalMutation({
	args: {
		threadId: v.id("threads"),
		tenantId: v.id("tenants"),
		reason: v.string(),
	},
	handler: async (ctx, args) => {
		const now = Date.now();

		await ctx.db.patch(args.threadId, {
			status: "escalated",
			aiEnabled: false,
			isAiTyping: false,
			escalatedAt: now,
		});

		await ctx.db.insert("messages", {
			threadId: args.threadId,
			tenantId: args.tenantId,
			senderType: "system",
			senderUserId: null,
			content: "Connecting you with a support agent. Please wait.",
			deliveryStatus: null,
			readByAgent: true,
			metadata: { escalationReason: args.reason },
			createdAt: now,
		});

		// Round-robin assignment
		const onlineCutoff = now - ONLINE_THRESHOLD_MS;
		const presenceRecords = await ctx.db
			.query("presence")
			.withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
			.collect();

		const onlineAgentIds = presenceRecords
			.filter((p) => p.lastHeartbeatAt >= onlineCutoff)
			.map((p) => p.userId);

		if (onlineAgentIds.length === 0) {
			// No agents online — leave unassigned in queue
			return;
		}

		const tenant = await ctx.db.get(args.tenantId);
		if (!tenant) return;

		const sortedIds = [...onlineAgentIds].sort();
		let nextAgentId: (typeof sortedIds)[0];

		if (!tenant.lastAssignedAgentId) {
			nextAgentId = sortedIds[0]!;
		} else {
			const lastIdx = sortedIds.indexOf(tenant.lastAssignedAgentId);
			if (lastIdx === -1 || lastIdx === sortedIds.length - 1) {
				nextAgentId = sortedIds[0]!;
			} else {
				nextAgentId = sortedIds[lastIdx + 1]!;
			}
		}

		await ctx.db.patch(args.threadId, { assignedToUserId: nextAgentId });
		await ctx.db.patch(tenant._id, { lastAssignedAgentId: nextAgentId });

		await ctx.db.insert("auditLogs", {
			tenantId: args.tenantId,
			userId: null,
			action: "thread.escalated",
			metadata: {
				threadId: args.threadId,
				reason: args.reason,
				assignedTo: nextAgentId,
			},
			createdAt: now,
		});
	},
});
