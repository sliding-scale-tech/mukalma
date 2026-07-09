import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation } from "./_generated/server";

export const upsertThreadAndInsertMessage = internalMutation({
	args: {
		wahaSessionName: v.string(),
		phone: v.string(),
		content: v.string(),
	},
	handler: async (ctx, args) => {
		const tenant = await ctx.db
			.query("tenants")
			.withIndex("by_wahaSessionName", (q) =>
				q.eq("wahaSessionName", args.wahaSessionName),
			)
			.first();
		if (tenant?.status !== "active") {
			return;
		}

		const externalChatId = args.phone;

		const existingThread = await ctx.db
			.query("threads")
			.withIndex("by_tenant_and_externalChatId", (q) =>
				q.eq("tenantId", tenant._id).eq("externalChatId", externalChatId),
			)
			.collect();

		let thread = existingThread.find((t) => t.status !== "closed");
		const now = Date.now();

		if (!thread) {
			const threadId = await ctx.db.insert("threads", {
				tenantId: tenant._id,
				channel: "whatsapp",
				status: "open",
				aiEnabled: true,
				assignedToUserId: null,
				customerSessionId: null,
				externalChatId,
				customerDisplayName: `+${args.phone}`,
				agentUnreadCount: 0,
				isAiTyping: false,
				lastMessageAt: now,
				escalatedAt: null,
				closedAt: null,
				createdAt: now,
			});
			thread = (await ctx.db.get(threadId))!;
		}

		const messageId = await ctx.db.insert("messages", {
			threadId: thread._id,
			tenantId: tenant._id,
			senderType: "customer",
			senderUserId: null,
			content: args.content,
			deliveryStatus: null,
			readByAgent: false,
			metadata: null,
			createdAt: now,
		});

		await ctx.db.patch(thread._id, {
			lastMessageAt: now,
			agentUnreadCount: thread.agentUnreadCount + 1,
		});

		if (thread.aiEnabled && thread.status === "open") {
			await ctx.scheduler.runAfter(2000, internal.ai.generateReply, {
				threadId: thread._id,
				tenantId: tenant._id,
				triggeringMessageId: messageId,
			});
		}
	},
});
