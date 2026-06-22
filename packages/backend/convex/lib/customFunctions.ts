import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import {
	getCurrentUser,
	requireAuth,
	requireTenant,
	requireUser,
} from "./auth";
import { isOrgAdmin, isSuperAdmin } from "./rbac";

type Ctx = QueryCtx | MutationCtx;

export async function withIdentity(ctx: Ctx) {
	const identity = await requireAuth(ctx);
	const user = await getCurrentUser(ctx);
	return { identity, user };
}

export async function withUser(ctx: Ctx) {
	const identity = await requireAuth(ctx);
	const user = await requireUser(ctx);
	return { identity, user };
}

export async function withTenant(ctx: Ctx) {
	const { user, tenant } = await requireTenant(ctx);
	const identity = await requireAuth(ctx);
	return { identity, user, tenant };
}

export async function withAdmin(ctx: Ctx) {
	const { user, tenant, identity } = await withTenant(ctx);
	if (!isOrgAdmin(user)) {
		throw new Error("Org admin access required");
	}
	return { identity, user, tenant };
}

export async function withSuperAdmin(ctx: Ctx) {
	const identity = await requireAuth(ctx);
	if (!isSuperAdmin(identity)) {
		throw new Error("Super admin access required");
	}
	return { identity };
}

export type { Doc };
