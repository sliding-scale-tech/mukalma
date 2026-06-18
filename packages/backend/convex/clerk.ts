import { v } from "convex/values";

import { internalMutation } from "./_generated/server";
import { mapClerkRoleToConvexRole } from "./lib/rbac";

export const syncUser = internalMutation({
	args: {
		type: v.string(),
		data: v.any(),
	},
	handler: async (ctx, args) => {
		const { type, data } = args;

		if (type === "user.created" || type === "user.updated") {
			const clerkId = data.id as string;
			const email =
				(data.email_addresses as Array<{ email_address: string }>)?.[0]
					?.email_address ?? "";
			const name = [data.first_name, data.last_name]
				.filter(Boolean)
				.join(" ")
				.trim();

			const existing = await ctx.db
				.query("users")
				.withIndex("by_clerkId", (q) => q.eq("clerkId", clerkId))
				.unique();

			if (existing) {
				await ctx.db.patch(existing._id, {
					email,
					name: name || existing.name,
				});
			}
			return;
		}

		if (type === "user.deleted") {
			const clerkId = data.id as string;
			const existing = await ctx.db
				.query("users")
				.withIndex("by_clerkId", (q) => q.eq("clerkId", clerkId))
				.unique();
			if (existing) {
				await ctx.db.delete(existing._id);
			}
			return;
		}

		if (type === "organizationMembership.created") {
			const clerkUserId = data.public_user_data?.user_id as string;
			const clerkOrgId = data.organization?.id as string;
			const clerkRole = data.role as string;

			if (!clerkUserId || !clerkOrgId) {
				return;
			}

			const tenant = await ctx.db
				.query("tenants")
				.withIndex("by_clerkOrgId", (q) => q.eq("clerkOrgId", clerkOrgId))
				.unique();
			if (!tenant) {
				return;
			}

			const email = data.public_user_data?.identifier ?? "";
			const name = [
				data.public_user_data?.first_name,
				data.public_user_data?.last_name,
			]
				.filter(Boolean)
				.join(" ")
				.trim();

			const role = mapClerkRoleToConvexRole(clerkRole);
			const existing = await ctx.db
				.query("users")
				.withIndex("by_clerkId", (q) => q.eq("clerkId", clerkUserId))
				.unique();

			if (existing) {
				await ctx.db.patch(existing._id, {
					tenantId: tenant._id,
					role,
					email: email || existing.email,
					name: name || existing.name,
				});
			} else {
				await ctx.db.insert("users", {
					clerkId: clerkUserId,
					tokenIdentifier: `clerk|${clerkUserId}`,
					email,
					name: name || undefined,
					tenantId: tenant._id,
					role,
					createdAt: Date.now(),
				});
			}
			return;
		}

		if (type === "organizationMembership.deleted") {
			const clerkUserId = data.public_user_data?.user_id as string;
			const clerkOrgId = data.organization?.id as string;

			if (!clerkUserId || !clerkOrgId) {
				return;
			}

			const tenant = await ctx.db
				.query("tenants")
				.withIndex("by_clerkOrgId", (q) => q.eq("clerkOrgId", clerkOrgId))
				.unique();
			if (!tenant) {
				return;
			}

			const existing = await ctx.db
				.query("users")
				.withIndex("by_clerkId", (q) => q.eq("clerkId", clerkUserId))
				.unique();

			if (existing && existing.tenantId === tenant._id) {
				await ctx.db.delete(existing._id);
			}
		}
	},
});
