"use node";

import { RAG_SIMILARITY_THRESHOLD } from "@mukalma/shared/constants/embeddings";
import { v } from "convex/values";
import {
	type ChatMessage,
	generateChatReply,
	generateRagReply,
} from "../lib/gemini";
import {
	buildChatSystemPrompt,
	buildRagSystemPrompt,
} from "../lib/systemPrompt";
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

		// Debounce: abort if a newer customer message arrived while we waited.
		const hasNewer = await ctx.runQuery(
			internal.messagesInternal.hasNewerCustomerMessage,
			{
				threadId: args.threadId,
				afterMessageId: args.triggeringMessageId,
			},
		);
		if (hasNewer) return;

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

			// --- Escalation keyword check ---
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

			// Build conversation history (most recent 20 messages, no system msgs).
			const history: ChatMessage[] = recentMessages
				.slice(0, -1)
				.map((m: { senderType: string; content: string }) => ({
					role:
						m.senderType === "customer"
							? ("user" as const)
							: ("model" as const),
					content: m.content,
				}));

			// --- Step 1: Chat model (greetings + general replies) ---
			const chatSystemPrompt = buildChatSystemPrompt({
				tenantName: tenant.name,
				customPrompt: tenant.settings.aiSystemPrompt,
			});

			const chatReply = await generateChatReply(
				chatSystemPrompt,
				history,
				lastCustomerMessage,
			);

			// Chat model handled it — no documents needed.
			if (!chatReply.includes("[NEEDS_DOCS]")) {
				if (chatReply.includes("[ESCALATE]")) {
					await ctx.runMutation(internal.threadsInternal.escalateThread, {
						threadId: args.threadId,
						tenantId: args.tenantId,
						reason: "AI determined it cannot answer",
					});
					return;
				}

				const botMessageId = await ctx.runMutation(
					internal.messagesInternal.insertBotMessage,
					{
						threadId: args.threadId,
						tenantId: args.tenantId,
						content: chatReply,
						deliveryStatus:
							thread.channel === "whatsapp" ? ("sent" as const) : undefined,
					},
				);

				if (thread.channel === "whatsapp") {
					await ctx.scheduler.runAfter(0, internal.whatsapp.sendText, {
						threadId: args.threadId,
						tenantId: args.tenantId,
						messageId: botMessageId,
						text: chatReply,
					});
				}
				return;
			}

			// --- Step 2: RAG model (document retrieval + grounded answer) ---
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

			// Zero relevant chunks with no fallback → escalate immediately.
			if (relevantChunks.length === 0) {
				await ctx.runMutation(internal.threadsInternal.escalateThread, {
					threadId: args.threadId,
					tenantId: args.tenantId,
					reason: "No relevant documents found",
				});
				return;
			}

			const ragSystemPrompt = buildRagSystemPrompt({
				tenantName: tenant.name,
				customPrompt: tenant.settings.aiSystemPrompt,
				contextChunks: relevantChunks.map(
					(c: { score: number; text: string }) => c.text,
				),
			});

			const ragReply = await generateRagReply(
				ragSystemPrompt,
				history,
				lastCustomerMessage,
			);

			if (ragReply.includes("[ESCALATE]")) {
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
					content: ragReply,
					deliveryStatus:
						thread.channel === "whatsapp" ? ("sent" as const) : undefined,
				},
			);

			if (thread.channel === "whatsapp") {
				await ctx.scheduler.runAfter(0, internal.whatsapp.sendText, {
					threadId: args.threadId,
					tenantId: args.tenantId,
					messageId: botMessageId,
					text: ragReply,
				});
			}
		} catch (error) {
			console.error("ai.generateReply failed:", error);
			try {
				await ctx.runMutation(internal.threadsInternal.escalateThread, {
					threadId: args.threadId,
					tenantId: args.tenantId,
					reason: "AI service unavailable",
				});
			} catch {
				// Escalation itself failed — nothing more we can do.
			}
		} finally {
			await ctx.runMutation(internal.threadsInternal.setAiTyping, {
				threadId: args.threadId,
				isAiTyping: false,
			});
		}
	},
});
