import type { UserIdentity } from "convex/server";
import type { Doc } from "../_generated/dataModel";

export function isOrgAdmin(user: Doc<"users">): boolean {
	return user.role === "org_admin";
}

export function isAgent(user: Doc<"users">): boolean {
	return user.role === "agent";
}

export function isSuperAdmin(identity: UserIdentity): boolean {
	const metadata = identity as UserIdentity & {
		publicMetadata?: { role?: string };
	};
	return metadata.publicMetadata?.role === "super_admin";
}

export function mapClerkRoleToConvexRole(
	clerkRole: string,
): "org_admin" | "agent" {
	return clerkRole === "org:admin" ? "org_admin" : "agent";
}
