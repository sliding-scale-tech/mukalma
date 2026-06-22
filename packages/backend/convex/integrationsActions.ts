"use node";

import { ConvexError } from "convex/values";
import { internal } from "./_generated/api";
import { action } from "./_generated/server";

function getWahaConfig(): { baseUrl: string; apiKey: string } | null {
	const baseUrl = process.env.WAHA_BASE_URL;
	const apiKey = process.env.WAHA_API_KEY;
	if (!baseUrl || !apiKey) return null;
	return { baseUrl, apiKey };
}

async function wahaFetch(
	path: string,
	options: RequestInit = {},
): Promise<Response> {
	const config = getWahaConfig();
	if (!config) {
		throw new ConvexError({
			code: "NOT_CONFIGURED",
			message: "WAHA_BASE_URL or WAHA_API_KEY is not configured",
		});
	}
	return await fetch(`${config.baseUrl}${path}`, {
		...options,
		headers: {
			"Content-Type": "application/json",
			"X-Api-Key": config.apiKey,
			...options.headers,
		},
	});
}

export const startWhatsAppSession = action({
	args: {},
	handler: async (ctx): Promise<{ sessionName: string }> => {
		if (!getWahaConfig()) {
			throw new ConvexError({
				code: "NOT_CONFIGURED",
				message: "WhatsApp integration is not configured on this server",
			});
		}

		const identity = await ctx.auth.getUserIdentity();
		if (!identity)
			throw new ConvexError({
				code: "UNAUTHENTICATED",
				message: "Not authenticated",
			});

		const user = await ctx.runQuery(internal.usersInternal.getUserByTokenId, {
			tokenIdentifier: identity.tokenIdentifier,
		});
		if (user?.role !== "org_admin") {
			throw new ConvexError({ code: "FORBIDDEN", message: "Admin only" });
		}

		const tenant = await ctx.runQuery(internal.threadsInternal.getTenantById, {
			tenantId: user.tenantId,
		});
		if (!tenant)
			throw new ConvexError({ code: "NOT_FOUND", message: "Tenant not found" });

		const sessionName = `tenant-${tenant.slug}`;

		const response = await wahaFetch("/api/sessions/start", {
			method: "POST",
			body: JSON.stringify({
				name: sessionName,
				config: {
					webhooks: [
						{
							url: `${process.env.CONVEX_SITE_URL}/waha/webhook`,
							events: ["message"],
						},
					],
				},
			}),
		});

		if (!response.ok) {
			const body = await response.text();
			throw new ConvexError({
				code: "WAHA_ERROR",
				message: `Failed to start session: ${body}`,
			});
		}

		await ctx.runMutation(internal.integrationsInternal.setWahaSessionName, {
			tenantId: tenant._id,
			wahaSessionName: sessionName,
		});

		return { sessionName };
	},
});

export const getWhatsAppQR = action({
	args: {},
	handler: async (ctx): Promise<{ qr: string | null; status: string }> => {
		if (!getWahaConfig()) return { qr: null, status: "disconnected" };

		const identity = await ctx.auth.getUserIdentity();
		if (!identity)
			throw new ConvexError({
				code: "UNAUTHENTICATED",
				message: "Not authenticated",
			});

		const user = await ctx.runQuery(internal.usersInternal.getUserByTokenId, {
			tokenIdentifier: identity.tokenIdentifier,
		});
		if (!user)
			throw new ConvexError({ code: "NOT_FOUND", message: "User not found" });

		const tenant = await ctx.runQuery(internal.threadsInternal.getTenantById, {
			tenantId: user.tenantId,
		});
		if (!tenant?.wahaSessionName) {
			return { qr: null, status: "disconnected" };
		}

		const response = await wahaFetch(`/api/sessions/${tenant.wahaSessionName}`);

		if (!response.ok) {
			return { qr: null, status: "disconnected" };
		}

		const session = (await response.json()) as {
			status: string;
		};

		if (session.status === "SCAN_QR_CODE") {
			const qrResponse = await wahaFetch(
				`/api/${tenant.wahaSessionName}/auth/qr?format=raw`,
			);
			if (qrResponse.ok) {
				const qrData = (await qrResponse.json()) as { value: string };
				return { qr: qrData.value, status: "scan_qr" };
			}
		}

		if (session.status === "WORKING") {
			return { qr: null, status: "connected" };
		}

		return { qr: null, status: session.status.toLowerCase() };
	},
});

export const checkWhatsAppStatus = action({
	args: {},
	handler: async (ctx): Promise<{ status: string }> => {
		if (!getWahaConfig()) return { status: "disconnected" };

		const identity = await ctx.auth.getUserIdentity();
		if (!identity)
			throw new ConvexError({
				code: "UNAUTHENTICATED",
				message: "Not authenticated",
			});

		const user = await ctx.runQuery(internal.usersInternal.getUserByTokenId, {
			tokenIdentifier: identity.tokenIdentifier,
		});
		if (!user) return { status: "disconnected" };

		const tenant = await ctx.runQuery(internal.threadsInternal.getTenantById, {
			tenantId: user.tenantId,
		});
		if (!tenant?.wahaSessionName) return { status: "disconnected" };

		const response = await wahaFetch(`/api/sessions/${tenant.wahaSessionName}`);

		if (!response.ok) return { status: "disconnected" };

		const session = (await response.json()) as { status: string };
		return {
			status:
				session.status === "WORKING"
					? "connected"
					: session.status.toLowerCase(),
		};
	},
});

export const stopWhatsAppSession = action({
	args: {},
	handler: async (ctx): Promise<{ success: boolean }> => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity)
			throw new ConvexError({
				code: "UNAUTHENTICATED",
				message: "Not authenticated",
			});

		const user = await ctx.runQuery(internal.usersInternal.getUserByTokenId, {
			tokenIdentifier: identity.tokenIdentifier,
		});
		if (user?.role !== "org_admin") {
			throw new ConvexError({ code: "FORBIDDEN", message: "Admin only" });
		}

		const tenant = await ctx.runQuery(internal.threadsInternal.getTenantById, {
			tenantId: user.tenantId,
		});
		if (!tenant?.wahaSessionName) return { success: true };

		await wahaFetch(`/api/sessions/${tenant.wahaSessionName}/stop`, {
			method: "POST",
		});

		await ctx.runMutation(internal.integrationsInternal.setWahaSessionName, {
			tenantId: tenant._id,
			wahaSessionName: null,
		});

		return { success: true };
	},
});
