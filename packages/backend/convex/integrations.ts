import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { withAdmin, withTenant } from "./lib/customFunctions";

export const getByType = query({
	args: {
		type: v.union(v.literal("waha"), v.literal("widget")),
	},
	handler: async (ctx, args) => {
		const { tenant } = await withTenant(ctx);
		return await ctx.db
			.query("integrations")
			.withIndex("by_tenant_and_type", (q) =>
				q.eq("tenantId", tenant._id).eq("type", args.type),
			)
			.unique();
	},
});

export const upsert = mutation({
	args: {
		type: v.union(v.literal("waha"), v.literal("widget")),
		status: v.union(
			v.literal("disconnected"),
			v.literal("connecting"),
			v.literal("connected"),
			v.literal("error"),
		),
		config: v.any(),
	},
	handler: async (ctx, args) => {
		const { tenant } = await withAdmin(ctx);

		const existing = await ctx.db
			.query("integrations")
			.withIndex("by_tenant_and_type", (q) =>
				q.eq("tenantId", tenant._id).eq("type", args.type),
			)
			.unique();

		if (existing) {
			await ctx.db.patch(existing._id, {
				status: args.status,
				config: args.config,
				lastSyncAt: Date.now(),
			});
			return existing._id;
		}

		return await ctx.db.insert("integrations", {
			tenantId: tenant._id,
			type: args.type,
			status: args.status,
			config: args.config,
			lastSyncAt: Date.now(),
		});
	},
});
