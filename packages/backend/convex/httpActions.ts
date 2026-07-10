"use node";

import { v } from "convex/values";
import { Webhook } from "svix";

import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";

/**
 * WhatsApp hides sender phone numbers behind "LID" (linked identity) JIDs
 * like 213743476670588@lid. WAHA keeps a LID→phone mapping per session —
 * resolve it so agents see the customer's real number in the inbox.
 * Returns bare digits, or null if the mapping isn't (yet) known.
 */
async function resolveLidToPhone(
	sessionName: string,
	lidJid: string,
): Promise<string | null> {
	const baseUrl = process.env.WAHA_BASE_URL;
	const apiKey = process.env.WAHA_API_KEY;
	if (!baseUrl || !apiKey) return null;
	try {
		const response = await fetch(
			`${baseUrl}/api/${encodeURIComponent(sessionName)}/lids/${encodeURIComponent(lidJid)}`,
			{ headers: { "X-Api-Key": apiKey } },
		);
		if (!response.ok) return null;
		const data = (await response.json()) as { pn?: string | null };
		const digits = data.pn?.replace(/@.*/, "").trim();
		return digits ? digits : null;
	} catch {
		return null;
	}
}

export const processWahaWebhook = internalAction({
	args: {
		body: v.string(),
		apiKey: v.string(),
	},
	handler: async (ctx, args) => {
		// Loosely typed: engines (WEBJS/NOWEB/GOWS) can shape this payload
		// differently. We validate defensively below and log the raw payload
		// on any mismatch instead of crashing or silently dropping the message.
		let payload: {
			event?: string;
			session?: string;
			payload?: {
				from?: string;
				body?: string;
				fromMe?: boolean;
			};
		};
		try {
			payload = JSON.parse(args.body);
		} catch (error) {
			console.error(
				"[waha webhook] invalid JSON body:",
				args.body.slice(0, 500),
			);
			throw error;
		}

		if (payload.event !== "message" || payload.payload?.fromMe) {
			return;
		}

		const sessionName = payload.session;
		const from = payload.payload?.from;
		const messageBody = payload.payload?.body;

		if (!sessionName || !from || !messageBody) {
			// Engine payload shape didn't match what we expect — log it so we
			// can update the parser instead of silently losing the message.
			console.error(
				`[waha webhook] unrecognized payload shape (missing session/from/body): ${JSON.stringify(payload).slice(0, 1000)}`,
			);
			return;
		}

		// chatId is the reply target + thread key; displayName is what agents
		// see. For LID senders, resolve the real phone number when possible;
		// if unresolvable, keep the full @lid JID as chatId so replies still
		// route correctly (a bare LID number + "@c.us" would be undeliverable).
		let chatId = from.replace(/@.*/, "");
		let displayName = `+${chatId}`;
		if (from.endsWith("@lid")) {
			const realPhone = await resolveLidToPhone(sessionName, from);
			if (realPhone) {
				chatId = realPhone;
				displayName = `+${realPhone}`;
			} else {
				chatId = from;
			}
		}

		await ctx.runMutation(internal.wahaInternal.upsertThreadAndInsertMessage, {
			wahaSessionName: sessionName,
			chatId,
			displayName,
			content: messageBody,
		});
	},
});

export const processClerkWebhook = internalAction({
	args: {
		body: v.string(),
		svixId: v.string(),
		svixTimestamp: v.string(),
		svixSignature: v.string(),
	},
	handler: async (ctx, args) => {
		const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
		if (!webhookSecret) {
			throw new Error("CLERK_WEBHOOK_SECRET is not configured");
		}

		const wh = new Webhook(webhookSecret);
		const event = wh.verify(args.body, {
			"svix-id": args.svixId,
			"svix-timestamp": args.svixTimestamp,
			"svix-signature": args.svixSignature,
		}) as { type: string; data: unknown };

		await ctx.runMutation(internal.clerk.syncUser, {
			type: event.type,
			data: event.data,
		});
	},
});
