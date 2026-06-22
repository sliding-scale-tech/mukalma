import { query } from "./_generated/server";
import { withSuperAdmin } from "./lib/customFunctions";

export const listAll = query({
	args: {},
	handler: async (ctx) => {
		await withSuperAdmin(ctx);
		return await ctx.db.query("tenants").collect();
	},
});
