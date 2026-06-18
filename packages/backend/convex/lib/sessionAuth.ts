import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

type SessionArgs = {
	tenantId: Id<"tenants">;
	sessionId: string;
};

export async function requireCustomerSession(
	ctx: QueryCtx | MutationCtx,
	args: SessionArgs,
): Promise<{ tenant: Doc<"tenants">; session: Doc<"customerSessions"> }> {
	const session = await ctx.db
		.query("customerSessions")
		.withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
		.unique();

	if (!session) {
		throw new ConvexError({
			code: "INVALID_SESSION",
			message: "Invalid session",
		});
	}

	if (session.tenantId !== args.tenantId) {
		throw new ConvexError({
			code: "INVALID_SESSION",
			message: "Session tenant mismatch",
		});
	}

	if (session.expiresAt < Date.now()) {
		throw new ConvexError({
			code: "SESSION_EXPIRED",
			message: "Session has expired",
		});
	}

	const tenant = await ctx.db.get(args.tenantId);
	if (tenant?.status !== "active") {
		throw new ConvexError({
			code: "TENANT_INACTIVE",
			message: "Tenant not found or inactive",
		});
	}

	return { tenant, session };
}
