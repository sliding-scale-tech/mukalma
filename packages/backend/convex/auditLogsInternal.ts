import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

export const insert = internalMutation({
	args: {
		tenantId: v.id("tenants"),
		userId: v.id("users"),
		action: v.string(),
		metadata: v.any(),
	},
	handler: async (ctx, args) => {
		await ctx.db.insert("auditLogs", {
			tenantId: args.tenantId,
			userId: args.userId,
			action: args.action,
			metadata: args.metadata,
			createdAt: Date.now(),
		});
	},
});
