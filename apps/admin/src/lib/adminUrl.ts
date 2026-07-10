// Canonical origin for this app. Every post-auth Clerk redirect (sign in,
// sign up, accept invite, OAuth completion) is forced here rather than a
// relative path, so it always lands on the real deployment — regardless of
// which origin (e.g. Clerk's dev-instance handoff) the browser was on right
// before the redirect fires. Falls back to the current origin so local dev
// (no VITE_ADMIN_APP_URL set) keeps working unchanged.
export const ADMIN_APP_URL: string =
	(import.meta.env.VITE_ADMIN_APP_URL as string | undefined) ||
	(typeof window !== "undefined" ? window.location.origin : "");

export function adminPath(path: string): string {
	return `${ADMIN_APP_URL}${path}`;
}
