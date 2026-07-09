import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

export const getTenantBySlug = internalQuery({
	args: { slug: v.string() },
	handler: async (ctx, args) => {
		const tenant = await ctx.db
			.query("tenants")
			.withIndex("by_slug", (q) => q.eq("slug", args.slug))
			.unique();
		if (tenant?.status !== "active") {
			return null;
		}
		return tenant;
	},
});

export const insertSession = internalMutation({
	args: {
		tenantId: v.id("tenants"),
		sessionId: v.string(),
		expiresAt: v.number(),
	},
	handler: async (ctx, args) => {
		await ctx.db.insert("customerSessions", {
			tenantId: args.tenantId,
			sessionId: args.sessionId,
			expiresAt: args.expiresAt,
			createdAt: Date.now(),
		});
	},
});

export const refreshSession = internalMutation({
	args: {
		sessionId: v.string(),
		expiresAt: v.number(),
	},
	handler: async (ctx, args) => {
		const session = await ctx.db
			.query("customerSessions")
			.withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
			.unique();
		if (!session) {
			return { refreshed: false };
		}
		await ctx.db.patch(session._id, { expiresAt: args.expiresAt });
		return { refreshed: true };
	},
});
