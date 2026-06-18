import { v } from "convex/values";
import { internalQuery } from "./_generated/server";

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
