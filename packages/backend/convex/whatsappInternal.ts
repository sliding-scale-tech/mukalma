import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

export const updateDeliveryStatus = internalMutation({
	args: {
		messageId: v.id("messages"),
		status: v.union(v.literal("delivered"), v.literal("failed")),
	},
	handler: async (ctx, args) => {
		await ctx.db.patch(args.messageId, { deliveryStatus: args.status });
	},
});
