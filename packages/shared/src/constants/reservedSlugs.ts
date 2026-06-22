export const RESERVED_SLUGS = [
	"admin",
	"www",
	"api",
	"app",
	"mail",
	"staging",
	"widget",
	"cdn",
] as const;

export type ReservedSlug = (typeof RESERVED_SLUGS)[number];

export function isReservedSlug(slug: string): boolean {
	return (RESERVED_SLUGS as readonly string[]).includes(slug);
}
