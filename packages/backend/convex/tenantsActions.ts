"use node";

import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { ActionCtx } from "./_generated/server";
import { action, internalAction } from "./_generated/server";

const SLUG_REGEX = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;
const RESERVED = new Set([
	"admin",
	"www",
	"api",
	"app",
	"mail",
	"staging",
	"widget",
	"cdn",
]);

async function provisionOrganization(
	ctx: ActionCtx,
	args: {
		clerkUserId: string;
		tokenIdentifier: string;
		email: string;
		name: string;
		businessName: string;
		slug: string;
		industry?: string;
		timezone?: string;
	},
) {
	if (!SLUG_REGEX.test(args.slug) || RESERVED.has(args.slug)) {
		throw new ConvexError({
			code: "INVALID_SLUG",
			message: "Slug is invalid or reserved",
		});
	}

	const secretKey = process.env.CLERK_SECRET_KEY;
	if (!secretKey) {
		throw new Error("CLERK_SECRET_KEY is not configured");
	}

	const response = await fetch("https://api.clerk.com/v1/organizations", {
		method: "POST",
		headers: {
			Authorization: `Bearer ${secretKey}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			name: args.businessName,
			created_by: args.clerkUserId,
		}),
	});

	if (!response.ok) {
		const body = await response.text();
		throw new Error(`Clerk org creation failed: ${response.status} ${body}`);
	}

	const org = (await response.json()) as { id: string };

	await ctx.runMutation(internal.tenantsInternal.insertFromProvisioning, {
		clerkOrgId: org.id,
		slug: args.slug,
		businessName: args.businessName,
		clerkUserId: args.clerkUserId,
		tokenIdentifier: args.tokenIdentifier,
		email: args.email,
		name: args.name,
		industry: args.industry,
		timezone: args.timezone,
	});

	return { clerkOrgId: org.id, tenantSlug: args.slug };
}

export const createFromOnboarding = action({
	args: {
		businessName: v.string(),
		slug: v.string(),
		industry: v.optional(v.string()),
		timezone: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) {
			throw new Error("Not authenticated");
		}

		return await provisionOrganization(ctx, {
			clerkUserId: identity.subject,
			tokenIdentifier: identity.tokenIdentifier,
			email: identity.email ?? "",
			name: identity.name ?? args.businessName,
			businessName: args.businessName,
			slug: args.slug,
			industry: args.industry,
			timezone: args.timezone,
		});
	},
});

export const provisionOrg = internalAction({
	args: {
		clerkUserId: v.string(),
		tokenIdentifier: v.string(),
		email: v.string(),
		name: v.string(),
		businessName: v.string(),
		slug: v.string(),
		industry: v.optional(v.string()),
		timezone: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		return await provisionOrganization(ctx, args);
	},
});
