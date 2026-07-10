import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

export const getUserByTokenId = internalQuery({
	args: { tokenIdentifier: v.string() },
	handler: async (ctx, args) => {
		return await ctx.db
			.query("users")
			.withIndex("by_tokenIdentifier", (q) =>
				q.eq("tokenIdentifier", args.tokenIdentifier),
			)
			.unique();
	},
});

export const getUserById = internalQuery({
	args: { userId: v.id("users") },
	handler: async (ctx, args) => {
		return await ctx.db.get(args.userId);
	},
});

export const listByTenant = internalQuery({
	args: { tenantId: v.id("tenants") },
	handler: async (ctx, args) => {
		return await ctx.db
			.query("users")
			.withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
			.collect();
	},
});

// Removes a user's Convex row and cleans up everything that referenced them:
// unassigns their threads (back to the unassigned queue, not deleted) and
// drops their presence record. Does not touch Clerk — the caller is
// responsible for removing the organization membership there first.
export const removeUserAndCleanup = internalMutation({
	args: { userId: v.id("users") },
	handler: async (ctx, args) => {
		const assignedThreads = await ctx.db
			.query("threads")
			.withIndex("by_assignedTo", (q) => q.eq("assignedToUserId", args.userId))
			.collect();
		for (const thread of assignedThreads) {
			await ctx.db.patch(thread._id, { assignedToUserId: null });
		}

		const presenceRows = await ctx.db
			.query("presence")
			.withIndex("by_user", (q) => q.eq("userId", args.userId))
			.collect();
		for (const row of presenceRows) {
			await ctx.db.delete(row._id);
		}

		await ctx.db.delete(args.userId);
	},
});
