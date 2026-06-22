import { query } from "./_generated/server";
import { withTenant } from "./lib/customFunctions";

export const list = query({
	args: {},
	handler: async (ctx) => {
		const { tenant } = await withTenant(ctx);
		return await ctx.db
			.query("users")
			.withIndex("by_tenant", (q) => q.eq("tenantId", tenant._id))
			.collect();
	},
});
