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
