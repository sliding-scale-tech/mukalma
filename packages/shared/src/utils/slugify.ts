import { isReservedSlug } from "../constants/reservedSlugs";

export const SLUG_REGEX = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

export function slugify(name: string): string {
	return name
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.replace(/-{2,}/g, "-")
		.slice(0, 63);
}

export function isValidSlug(slug: string): boolean {
	return SLUG_REGEX.test(slug) && !isReservedSlug(slug);
}

export function suggestSlug(slug: string): string {
	let candidate = slug;
	let counter = 2;
	while (isReservedSlug(candidate)) {
		candidate = `${slug}-${counter}`;
		counter++;
	}
	return candidate;
}
