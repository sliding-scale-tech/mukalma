import { query } from "./_generated/server";
import { withTenant } from "./lib/customFunctions";

const ONLINE_THRESHOLD_MS = 60_000;

export const getStats = query({
	args: {},
	handler: async (ctx) => {
		const { tenant } = await withTenant(ctx);

		const allThreads = await ctx.db
			.query("threads")
			.withIndex("by_tenant_and_lastMessage", (q) =>
				q.eq("tenantId", tenant._id),
			)
			.collect();

		const todayStart = new Date();
		todayStart.setHours(0, 0, 0, 0);
		const todayMs = todayStart.getTime();

		const open = allThreads.filter((t) => t.status === "open").length;
		const escalated = allThreads.filter((t) => t.status === "escalated").length;
		const closedToday = allThreads.filter(
			(t) => t.status === "closed" && t.closedAt && t.closedAt >= todayMs,
		).length;
		const createdToday = allThreads.filter(
			(t) => t.createdAt >= todayMs,
		).length;

		const now = Date.now();
		const presenceRecords = await ctx.db
			.query("presence")
			.withIndex("by_tenant", (q) => q.eq("tenantId", tenant._id))
			.collect();
		const onlineAgents = presenceRecords.filter(
			(p) => p.lastHeartbeatAt >= now - ONLINE_THRESHOLD_MS,
		).length;

		return { open, escalated, closedToday, createdToday, onlineAgents };
	},
});

export const listActiveThreads = query({
	args: {},
	handler: async (ctx) => {
		const { tenant } = await withTenant(ctx);

		const threads = await ctx.db
			.query("threads")
			.withIndex("by_tenant_and_lastMessage", (q) =>
				q.eq("tenantId", tenant._id),
			)
			.collect();

		const active = threads
			.filter((t) => t.status === "open" || t.status === "escalated")
			.sort((a, b) => b.lastMessageAt - a.lastMessageAt)
			.slice(0, 20);

		const withPreview = await Promise.all(
			active.map(async (thread) => {
				const lastMessage = await ctx.db
					.query("messages")
					.withIndex("by_thread", (q) => q.eq("threadId", thread._id))
					.order("desc")
					.first();

				let assignedAgentName: string | null = null;
				if (thread.assignedToUserId) {
					const agent = await ctx.db.get(thread.assignedToUserId);
					assignedAgentName = agent?.name ?? agent?.email ?? null;
				}

				return {
					_id: thread._id,
					status: thread.status,
					channel: thread.channel,
					customerDisplayName:
						thread.customerDisplayName ??
						thread.customerSessionId ??
						"Customer",
					agentUnreadCount: thread.agentUnreadCount,
					lastMessageAt: thread.lastMessageAt,
					lastMessagePreview: lastMessage?.content.slice(0, 80) ?? null,
					assignedAgentName,
				};
			}),
		);

		return withPreview;
	},
});
