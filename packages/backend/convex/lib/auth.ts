import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

type AuthCtx = QueryCtx | MutationCtx;

export async function getIdentity(ctx: AuthCtx) {
	return await ctx.auth.getUserIdentity();
}

export async function getCurrentUser(
	ctx: AuthCtx,
): Promise<Doc<"users"> | null> {
	const identity = await getIdentity(ctx);
	if (!identity) {
		return null;
	}

	const byToken = await ctx.db
		.query("users")
		.withIndex("by_tokenIdentifier", (q) =>
			q.eq("tokenIdentifier", identity.tokenIdentifier),
		)
		.unique();
	if (byToken) {
		return byToken;
	}

	return await ctx.db
		.query("users")
		.withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
		.unique();
}

export async function requireAuth(ctx: AuthCtx) {
	const identity = await getIdentity(ctx);
	if (!identity) {
		throw new Error("Not authenticated");
	}
	return identity;
}

export async function requireUser(ctx: AuthCtx): Promise<Doc<"users">> {
	await requireAuth(ctx);
	const user = await getCurrentUser(ctx);
	if (!user) {
		throw new Error("User record not found");
	}
	return user;
}

export async function requireTenant(ctx: AuthCtx): Promise<{
	user: Doc<"users">;
	tenant: Doc<"tenants">;
}> {
	const user = await requireUser(ctx);
	const tenant = await ctx.db.get(user.tenantId);
	if (!tenant) {
		throw new Error("Tenant not found");
	}
	if (tenant.status === "suspended") {
		throw new Error("Tenant is suspended");
	}
	return { user, tenant };
}

export async function getTenantForUser(
	ctx: AuthCtx,
	user: Doc<"users">,
): Promise<Doc<"tenants"> | null> {
	return await ctx.db.get(user.tenantId as Id<"tenants">);
}
