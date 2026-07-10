"use node";

import crypto from "node:crypto";
import { SESSION_TTL_MS } from "@mukalma/shared/constants/session";
import { ConvexError, v } from "convex/values";
import { signSession, verifySession } from "../lib/customerSession";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action } from "./_generated/server";

export const createPublic = action({
	args: {
		tenantSlug: v.string(),
	},
	handler: async (
		ctx,
		args,
	): Promise<{
		sessionId: string;
		token: string;
		expiresAt: number;
		tenantId: Id<"tenants">;
	}> => {
		const tenant = await ctx.runQuery(
			internal.sessionsInternal.getTenantBySlug,
			{ slug: args.tenantSlug },
		);
		if (!tenant) {
			throw new ConvexError({
				code: "TENANT_NOT_FOUND",
				message: "Tenant not found",
			});
		}

		const sessionId = crypto.randomUUID();
		const expiresAt = Date.now() + SESSION_TTL_MS;
		const token = signSession({
			sessionId,
			tenantId: tenant._id,
			expiresAt,
		});

		await ctx.runMutation(internal.sessionsInternal.insertSession, {
			tenantId: tenant._id,
			sessionId,
			expiresAt,
		});

		return { sessionId, token, expiresAt, tenantId: tenant._id };
	},
});

export const refreshPublic = action({
	args: {
		tenantId: v.id("tenants"),
		sessionId: v.string(),
		token: v.string(),
		expiresAt: v.number(),
	},
	handler: async (ctx, args): Promise<{ token: string; expiresAt: number }> => {
		const valid = verifySession(args.token, {
			sessionId: args.sessionId,
			tenantId: args.tenantId,
			expiresAt: args.expiresAt,
		});
		if (!valid) {
			throw new ConvexError({
				code: "INVALID_TOKEN",
				message: "Invalid session token",
			});
		}

		// An expired token cannot be refreshed — otherwise a stolen token
		// would stay valid forever.
		if (args.expiresAt < Date.now()) {
			throw new ConvexError({
				code: "SESSION_EXPIRED",
				message: "Session has expired",
			});
		}

		const newExpiresAt = Date.now() + SESSION_TTL_MS;
		const newToken = signSession({
			sessionId: args.sessionId,
			tenantId: args.tenantId,
			expiresAt: newExpiresAt,
		});

		const { refreshed } = await ctx.runMutation(
			internal.sessionsInternal.refreshSession,
			{
				sessionId: args.sessionId,
				expiresAt: newExpiresAt,
			},
		);
		if (!refreshed) {
			throw new ConvexError({
				code: "INVALID_SESSION",
				message: "Session not found",
			});
		}

		return { token: newToken, expiresAt: newExpiresAt };
	},
});
