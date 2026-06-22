"use node";

import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";

export const sendText = internalAction({
	args: {
		tenantId: v.id("tenants"),
		threadId: v.id("threads"),
		messageId: v.id("messages"),
		text: v.string(),
	},
	handler: async (ctx, args) => {
		const thread = await ctx.runQuery(internal.threadsInternal.getThreadForAI, {
			threadId: args.threadId,
		});
		if (!thread?.externalChatId) return;

		const tenant = await ctx.runQuery(internal.threadsInternal.getTenantById, {
			tenantId: args.tenantId,
		});
		if (!tenant?.wahaSessionName) return;

		const baseUrl = process.env.WAHA_BASE_URL;
		const apiKey = process.env.WAHA_API_KEY;
		if (!baseUrl || !apiKey) {
			throw new Error("WAHA_BASE_URL or WAHA_API_KEY is not configured");
		}

		const chatId = thread.externalChatId.includes("@")
			? thread.externalChatId
			: `${thread.externalChatId}@c.us`;

		const response = await fetch(`${baseUrl}/api/sendText`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"X-Api-Key": apiKey,
			},
			body: JSON.stringify({
				session: tenant.wahaSessionName,
				chatId,
				text: args.text,
			}),
		});

		const status = response.ok ? "delivered" : "failed";
		await ctx.runMutation(internal.whatsappInternal.updateDeliveryStatus, {
			messageId: args.messageId,
			status,
		});
	},
});
