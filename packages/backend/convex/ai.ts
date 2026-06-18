"use node";

import { RAG_SIMILARITY_THRESHOLD } from "@mukalma/shared/constants/embeddings";
import { v } from "convex/values";
import { type ChatMessage, generateChatReply } from "../lib/gemini";
import { buildSystemPrompt } from "../lib/systemPrompt";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";

export const generateReply = internalAction({
	args: {
		threadId: v.id("threads"),
		tenantId: v.id("tenants"),
		triggeringMessageId: v.id("messages"),
	},
	handler: async (ctx, args) => {
		const thread = await ctx.runQuery(internal.threadsInternal.getThreadForAI, {
			threadId: args.threadId,
		});
		if (!thread?.aiEnabled || thread.status !== "open") {
			return;
		}

		const hasNewer = await ctx.runQuery(
			internal.messagesInternal.hasNewerCustomerMessage,
			{
				threadId: args.threadId,
				afterMessageId: args.triggeringMessageId,
			},
		);
		if (hasNewer) {
			return;
		}

		const tenant = await ctx.runQuery(internal.threadsInternal.getTenantById, {
			tenantId: args.tenantId,
		});
		if (!tenant) return;

		await ctx.runMutation(internal.threadsInternal.setAiTyping, {
			threadId: args.threadId,
			isAiTyping: true,
		});

		try {
			const recentMessages = await ctx.runQuery(
				internal.messagesInternal.getRecentForThread,
				{ threadId: args.threadId },
			);

			const lastCustomerMsg = [...recentMessages]
				.reverse()
				.find((m) => m.senderType === "customer");
			const lastCustomerMessage = lastCustomerMsg?.content ?? "";

			const escalationKeywords: string[] =
				tenant.settings.escalationKeywords?.map((k: string) =>
					k.toLowerCase(),
				) ?? [];
			if (
				escalationKeywords.length > 0 &&
				escalationKeywords.some((kw: string) =>
					lastCustomerMessage.toLowerCase().includes(kw),
				)
			) {
				await ctx.runMutation(internal.threadsInternal.escalateThread, {
					threadId: args.threadId,
					tenantId: args.tenantId,
					reason: "Escalation keyword detected",
				});
				return;
			}

			const ragResults = await ctx.runAction(
				internal.embeddingsSearch.searchSimilar,
				{
					tenantId: args.tenantId,
					query: lastCustomerMessage,
				},
			);

			const relevantChunks = ragResults.filter(
				(r: { score: number; text: string }) =>
					r.score >= RAG_SIMILARITY_THRESHOLD,
			);

			if (relevantChunks.length === 0) {
				await ctx.runMutation(internal.threadsInternal.escalateThread, {
					threadId: args.threadId,
					tenantId: args.tenantId,
					reason: "No relevant knowledge base content found",
				});
				return;
			}

			const systemPrompt = buildSystemPrompt({
				tenantName: tenant.name,
				customPrompt: tenant.settings.aiSystemPrompt,
				contextChunks: relevantChunks.map(
					(c: { score: number; text: string }) => c.text,
				),
			});

			const history: ChatMessage[] = recentMessages
				.slice(0, -1)
				.map((m: { senderType: string; content: string }) => ({
					role:
						m.senderType === "customer"
							? ("user" as const)
							: ("model" as const),
					content: m.content,
				}));

			const replyText = await generateChatReply(
				systemPrompt,
				history,
				lastCustomerMessage,
			);

			if (replyText.includes("[ESCALATE]")) {
				await ctx.runMutation(internal.threadsInternal.escalateThread, {
					threadId: args.threadId,
					tenantId: args.tenantId,
					reason: "AI determined it cannot answer from available context",
				});
				return;
			}

			const botMessageId = await ctx.runMutation(
				internal.messagesInternal.insertBotMessage,
				{
					threadId: args.threadId,
					tenantId: args.tenantId,
					content: replyText,
					deliveryStatus:
						thread.channel === "whatsapp" ? ("sent" as const) : undefined,
				},
			);

			if (thread.channel === "whatsapp") {
				await ctx.scheduler.runAfter(0, internal.whatsapp.sendText, {
					threadId: args.threadId,
					tenantId: args.tenantId,
					messageId: botMessageId,
					text: replyText,
				});
			}
		} finally {
			await ctx.runMutation(internal.threadsInternal.setAiTyping, {
				threadId: args.threadId,
				isAiTyping: false,
			});
		}
	},
});
