import { v } from "convex/values";

import { internalMutation } from "./_generated/server";
import { defaultTenantSettings } from "./schema";

export const insertFromProvisioning = internalMutation({
	args: {
		clerkOrgId: v.string(),
		slug: v.string(),
		businessName: v.string(),
		clerkUserId: v.string(),
		tokenIdentifier: v.string(),
		email: v.string(),
		name: v.string(),
		industry: v.optional(v.string()),
		timezone: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const existing = await ctx.db
			.query("tenants")
			.withIndex("by_slug", (q) => q.eq("slug", args.slug))
			.unique();
		if (existing) {
			return existing._id;
		}

		const now = Date.now();
		const tenantId = await ctx.db.insert("tenants", {
			slug: args.slug,
			name: args.businessName,
			clerkOrgId: args.clerkOrgId,
			status: "active",
			wahaSessionName: `tenant-${args.slug}`,
			lastAssignedAgentId: null,
			settings: {
				...defaultTenantSettings,
				industry: args.industry,
				timezone: args.timezone,
			},
			createdAt: now,
		});

		const existingUser = await ctx.db
			.query("users")
			.withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkUserId))
			.unique();

		if (existingUser) {
			await ctx.db.patch(existingUser._id, {
				tenantId,
				role: "org_admin",
				email: args.email,
				name: args.name,
				tokenIdentifier: args.tokenIdentifier,
			});
		} else {
			await ctx.db.insert("users", {
				clerkId: args.clerkUserId,
				tokenIdentifier: args.tokenIdentifier,
				email: args.email,
				name: args.name,
				tenantId,
				role: "org_admin",
				createdAt: now,
			});
		}

		await ctx.db.insert("auditLogs", {
			tenantId,
			userId: null,
			action: "tenant.created",
			metadata: { slug: args.slug, clerkOrgId: args.clerkOrgId },
			createdAt: now,
		});

		return tenantId;
	},
});
