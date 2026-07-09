import { httpRouter } from "convex/server";

import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";

const http = httpRouter();

http.route({
	path: "/clerk/webhook",
	method: "POST",
	handler: httpAction(async (ctx, request) => {
		const svixId = request.headers.get("svix-id");
		const svixTimestamp = request.headers.get("svix-timestamp");
		const svixSignature = request.headers.get("svix-signature");

		if (!svixId || !svixTimestamp || !svixSignature) {
			return new Response("Missing svix headers", { status: 400 });
		}

		const body = await request.text();

		try {
			await ctx.runAction(internal.httpActions.processClerkWebhook, {
				body,
				svixId,
				svixTimestamp,
				svixSignature,
			});
		} catch {
			return new Response("Invalid signature", { status: 400 });
		}

		return new Response(null, { status: 200 });
	}),
});

http.route({
	path: "/waha/webhook",
	method: "POST",
	handler: httpAction(async (ctx, request) => {
		const apiKey = request.headers.get("x-api-key");

		// Reject unauthenticated calls — otherwise anyone with the deployment
		// URL can inject fake WhatsApp messages into tenant inboxes.
		const expectedKey = process.env.WAHA_API_KEY;
		if (!expectedKey || apiKey !== expectedKey) {
			return new Response("Unauthorized", { status: 401 });
		}

		const body = await request.text();

		try {
			await ctx.runAction(internal.httpActions.processWahaWebhook, {
				body,
				apiKey: apiKey ?? "",
			});
		} catch {
			return new Response("Processing failed", { status: 500 });
		}

		return new Response(null, { status: 200 });
	}),
});

export default http;
