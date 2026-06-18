"use node";

import { v } from "convex/values";
import { Webhook } from "svix";

import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";

export const processWahaWebhook = internalAction({
	args: {
		body: v.string(),
		apiKey: v.string(),
	},
	handler: async (ctx, args) => {
		const expectedKey = process.env.WAHA_API_KEY;
		if (expectedKey && args.apiKey !== expectedKey) {
			throw new Error("Invalid WAHA API key");
		}

		const payload = JSON.parse(args.body) as {
			event: string;
			session: string;
			payload: {
				from: string;
				body: string;
				fromMe: boolean;
				id: { id: string };
			};
		};

		if (payload.event !== "message" || payload.payload.fromMe) {
			return;
		}

		const sessionName = payload.session;
		const phone = payload.payload.from.replace("@c.us", "");
		const messageBody = payload.payload.body;

		if (!sessionName || !phone || !messageBody) {
			return;
		}

		await ctx.runMutation(internal.wahaInternal.upsertThreadAndInsertMessage, {
			wahaSessionName: sessionName,
			phone,
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
