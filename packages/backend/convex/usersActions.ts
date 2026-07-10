"use node";

import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import { action } from "./_generated/server";

export const inviteAgent = action({
	args: {
		email: v.string(),
	},
	handler: async (ctx, args) => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) {
			throw new ConvexError({
				code: "UNAUTHENTICATED",
				message: "Not authenticated",
			});
		}

		const user = await ctx.runQuery(internal.usersInternal.getUserByTokenId, {
			tokenIdentifier: identity.tokenIdentifier,
		});
		if (user?.role !== "org_admin") {
			throw new ConvexError({
				code: "FORBIDDEN",
				message: "Only admins can invite agents",
			});
		}

		const tenant = await ctx.runQuery(internal.threadsInternal.getTenantById, {
			tenantId: user.tenantId,
		});
		if (!tenant) {
			throw new ConvexError({
				code: "NOT_FOUND",
				message: "Tenant not found",
			});
		}

		const secretKey = process.env.CLERK_SECRET_KEY;
		if (!secretKey) {
			throw new Error("CLERK_SECRET_KEY is not configured");
		}

		const response = await fetch(
			`https://api.clerk.com/v1/organizations/${tenant.clerkOrgId}/invitations`,
			{
				method: "POST",
				headers: {
					Authorization: `Bearer ${secretKey}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					email_address: args.email,
					role: "org:member",
					redirect_url: `${process.env.ADMIN_APP_URL ?? "http://localhost:5173"}/accept-invite`,
				}),
			},
		);

		if (!response.ok) {
			const body = await response.text();
			throw new ConvexError({
				code: "CLERK_ERROR",
				message: `Failed to send invitation: ${body}`,
			});
		}

		await ctx.runMutation(internal.auditLogsInternal.insert, {
			tenantId: user.tenantId,
			userId: user._id,
			action: "user.invited",
			metadata: { email: args.email },
		});

		return { success: true };
	},
});

export const removeAgent = action({
	args: {
		userId: v.id("users"),
	},
	handler: async (ctx, args) => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) {
			throw new ConvexError({
				code: "UNAUTHENTICATED",
				message: "Not authenticated",
			});
		}

		const caller = await ctx.runQuery(internal.usersInternal.getUserByTokenId, {
			tokenIdentifier: identity.tokenIdentifier,
		});
		if (caller?.role !== "org_admin") {
			throw new ConvexError({
				code: "FORBIDDEN",
				message: "Only admins can remove agents",
			});
		}

		const target = await ctx.runQuery(internal.usersInternal.getUserById, {
			userId: args.userId,
		});
		if (!target || target.tenantId !== caller.tenantId) {
			throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });
		}
		if (target._id === caller._id) {
			throw new ConvexError({
				code: "CANNOT_REMOVE_SELF",
				message: "You cannot remove yourself",
			});
		}

		if (target.role === "org_admin") {
			const tenantUsers = await ctx.runQuery(
				internal.usersInternal.listByTenant,
				{
					tenantId: caller.tenantId,
				},
			);
			const adminCount = tenantUsers.filter(
				(u) => u.role === "org_admin",
			).length;
			if (adminCount <= 1) {
				throw new ConvexError({
					code: "LAST_ADMIN",
					message: "Cannot remove the only admin — promote another user first",
				});
			}
		}

		const tenant = await ctx.runQuery(internal.threadsInternal.getTenantById, {
			tenantId: caller.tenantId,
		});
		if (!tenant) {
			throw new ConvexError({ code: "NOT_FOUND", message: "Tenant not found" });
		}

		const secretKey = process.env.CLERK_SECRET_KEY;
		if (!secretKey) {
			throw new Error("CLERK_SECRET_KEY is not configured");
		}

		// Remove org membership in Clerk — this is what actually revokes the
		// agent's access (their JWT will no longer carry this org). We do not
		// delete their Clerk user account, only their membership in this org.
		const response = await fetch(
			`https://api.clerk.com/v1/organizations/${tenant.clerkOrgId}/memberships/${target.clerkId}`,
			{
				method: "DELETE",
				headers: { Authorization: `Bearer ${secretKey}` },
			},
		);

		// 404 = already removed on Clerk's side (e.g. retry after a partial
		// failure) — treat as success rather than blocking cleanup.
		if (!response.ok && response.status !== 404) {
			const body = await response.text();
			throw new ConvexError({
				code: "CLERK_ERROR",
				message: `Failed to remove agent: ${body}`,
			});
		}

		await ctx.runMutation(internal.usersInternal.removeUserAndCleanup, {
			userId: target._id,
		});

		await ctx.runMutation(internal.auditLogsInternal.insert, {
			tenantId: caller.tenantId,
			userId: caller._id,
			action: "user.removed",
			metadata: { removedUserId: target._id, email: target.email },
		});

		return { success: true };
	},
});
