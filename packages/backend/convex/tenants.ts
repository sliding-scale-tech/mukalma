import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import { getCurrentUser } from "./lib/auth";
import { withAdmin } from "./lib/customFunctions";

export const updateWidgetTheme = mutation({
	args: {
		primaryColor: v.optional(v.string()),
		mode: v.optional(
			v.union(v.literal("light"), v.literal("dark"), v.literal("auto")),
		),
	},
	handler: async (ctx, args) => {
		const { tenant } = await withAdmin(ctx);
		await ctx.db.patch(tenant._id, {
			settings: {
				...tenant.settings,
				widgetTheme: {
					primaryColor: args.primaryColor,
					mode: args.mode,
				},
			},
		});
	},
});

export const getCurrent = query({
	args: {},
	handler: async (ctx) => {
		const user = await getCurrentUser(ctx);
		if (!user) {
			return null;
		}
		const tenant = await ctx.db.get(user.tenantId);
		if (!tenant) {
			return null;
		}
		return { tenant, user };
	},
});

export const getPublicBySlug = query({
	args: { slug: v.string() },
	handler: async (ctx, args) => {
		const tenant = await ctx.db
			.query("tenants")
			.withIndex("by_slug", (q) => q.eq("slug", args.slug))
			.unique();
		if (tenant?.status !== "active") {
			return null;
		}
		return {
			_id: tenant._id,
			name: tenant.name,
			slug: tenant.slug,
			logoUrl: tenant.settings.logoUrl ?? null,
			widgetPosition: tenant.settings.widgetPosition,
			widgetTheme: tenant.settings.widgetTheme ?? null,
		};
	},
});

export const isSlugAvailable = query({
	args: { slug: v.string() },
	handler: async (ctx, args) => {
		const existing = await ctx.db
			.query("tenants")
			.withIndex("by_slug", (q) => q.eq("slug", args.slug))
			.unique();
		return { available: !existing };
	},
});

export const updateSettings = mutation({
	args: {
		name: v.string(),
		logoUrl: v.optional(v.string()),
		aiSystemPrompt: v.optional(v.string()),
		escalationKeywords: v.array(v.string()),
		allowedDomains: v.array(v.string()),
		widgetPosition: v.union(
			v.literal("bottom-right"),
			v.literal("bottom-left"),
		),
		industry: v.optional(v.string()),
		timezone: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const { user, tenant } = await withAdmin(ctx);

		const settings = {
			...tenant.settings,
			logoUrl: args.logoUrl || undefined,
			aiSystemPrompt: args.aiSystemPrompt || undefined,
			escalationKeywords: args.escalationKeywords,
			allowedDomains: args.allowedDomains,
			widgetPosition: args.widgetPosition,
			industry: args.industry,
			timezone: args.timezone,
		};

		await ctx.db.patch(tenant._id, {
			name: args.name,
			settings,
		});

		await ctx.db.insert("auditLogs", {
			tenantId: tenant._id,
			userId: user._id,
			action: "tenant.settings_updated",
			metadata: {},
			createdAt: Date.now(),
		});

		return { success: true };
	},
});
