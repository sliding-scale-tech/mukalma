const NAME_KEY = "mukalma_customer_name";
const EMAIL_KEY = "mukalma_customer_email";

export type CustomerDetails = {
	name: string;
	email: string;
};

export function getStoredCustomerDetails(): CustomerDetails | null {
	try {
		const name = localStorage.getItem(NAME_KEY);
		const email = localStorage.getItem(EMAIL_KEY);
		if (!name || !email) return null;
		return { name, email };
	} catch {
		return null;
	}
}

export function storeCustomerDetails(details: CustomerDetails): void {
	try {
		localStorage.setItem(NAME_KEY, details.name);
		localStorage.setItem(EMAIL_KEY, details.email);
	} catch {
		// localStorage unavailable (private mode) — details still reach the
		// backend for this visit, they just won't persist across visits.
	}
}

/**
 * Hostname of the page the widget runs on. In the embed iframe the host
 * page's URL arrives via document.referrer; standalone mode uses our own
 * hostname (the {slug}.domain the customer visited).
 */
export function getSourceDomain(isEmbed: boolean): string | undefined {
	try {
		if (isEmbed && document.referrer) {
			return new URL(document.referrer).hostname;
		}
		return window.location.hostname;
	} catch {
		return undefined;
	}
}
