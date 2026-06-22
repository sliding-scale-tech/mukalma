import { mutation, query } from "./_generated/server";
import { withTenant } from "./lib/customFunctions";

const ONLINE_THRESHOLD_MS = 60_000;

export const heartbeat = mutation({
	args: {},
	handler: async (ctx) => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) return;

		const { tenant, user } = await withTenant(ctx);
		const now = Date.now();

		const existing = await ctx.db
			.query("presence")
			.withIndex("by_user", (q) => q.eq("userId", user._id))
			.unique();

		if (existing) {
			await ctx.db.patch(existing._id, { lastHeartbeatAt: now });
		} else {
			await ctx.db.insert("presence", {
				tenantId: tenant._id,
				userId: user._id,
				lastHeartbeatAt: now,
			});
		}
	},
});

export const listOnlineAgents = query({
	args: {},
	handler: async (ctx) => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) return [];

		const { tenant } = await withTenant(ctx);
		const cutoff = Date.now() - ONLINE_THRESHOLD_MS;

		const records = await ctx.db
			.query("presence")
			.withIndex("by_tenant", (q) => q.eq("tenantId", tenant._id))
			.collect();

		const onlineUserIds = records
			.filter((p) => p.lastHeartbeatAt >= cutoff)
			.map((p) => p.userId);

		const users = await Promise.all(onlineUserIds.map((id) => ctx.db.get(id)));

		return users
			.filter((u) => u !== null)
			.map((u) => ({
				_id: u._id,
				name: u.name ?? u.email,
				email: u.email,
				role: u.role,
			}));
	},
});

export const getOnlineCount = query({
	args: {},
	handler: async (ctx) => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) return 0;

		const { tenant } = await withTenant(ctx);
		const cutoff = Date.now() - ONLINE_THRESHOLD_MS;

		const records = await ctx.db
			.query("presence")
			.withIndex("by_tenant", (q) => q.eq("tenantId", tenant._id))
			.collect();

		return records.filter((p) => p.lastHeartbeatAt >= cutoff).length;
	},
});
