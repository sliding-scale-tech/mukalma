import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

export const setWahaSessionName = internalMutation({
	args: {
		tenantId: v.id("tenants"),
		wahaSessionName: v.union(v.string(), v.null()),
	},
	handler: async (ctx, args) => {
		await ctx.db.patch(args.tenantId, {
			wahaSessionName: args.wahaSessionName,
		});
	},
});
