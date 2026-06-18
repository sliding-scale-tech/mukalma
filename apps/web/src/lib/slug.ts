export function getSlugFromHostname(): string | null {
	const hostname = window.location.hostname;

	// {slug}.localhost or {slug}.mukalma.co
	const parts = hostname.split(".");
	if (parts.length < 2) {
		return null;
	}

	const slug = parts[0];
	if (!slug || slug === "www" || slug === "admin" || slug === "cdn") {
		return null;
	}

	return slug;
}

export function getSlugFromSearchParams(): string | null {
	const params = new URLSearchParams(window.location.search);
	return params.get("slug");
}
