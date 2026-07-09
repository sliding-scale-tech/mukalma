"use node";

import {
	RAG_FALLBACK_THRESHOLD,
	RAG_MAX_CONTEXT_CHUNKS,
	RAG_SIMILARITY_THRESHOLD,
} from "@mukalma/shared/constants/embeddings";
import { v } from "convex/values";
import {
	type ChatMessage,
	condenseQuery,
	generateChatReply,
	generateRagReply,
	isRetryable,
} from "../lib/gemini";
import {
	buildChatSystemPrompt,
	buildRagSystemPrompt,
} from "../lib/systemPrompt";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";

const NO_INFO_REPLY =
	"I'm sorry, I don't have specific information about that in my knowledge base. If you'd like to speak with a human agent, just type 'agent' and I'll connect you right away.";

const TRANSIENT_ERROR_REPLY =
	"I'm having a little trouble answering right now. Please try again in a moment, or type 'agent' to reach a human.";

function escapeRegExp(text: string): string {
	return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function matchesEscalationKeyword(
	message: string,
	keywords: string[],
): boolean {
	return keywords.some((kw) => {
		const trimmed = kw.trim();
		if (!trimmed) return false;
		// Whole-word match so "agent" doesn't fire on "agents" or mid-sentence
		// mentions like "management".
		return new RegExp(`\\b${escapeRegExp(trimmed)}\\b`, "i").test(message);
	});
}

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
		// The newer message's own scheduled job will answer both.
		const hasNewer = await ctx.runQuery(
			internal.messagesInternal.hasNewerCustomerMessage,
			{
				threadId: args.threadId,
				afterMessageId: args.triggeringMessageId,
			},
		);
		if (hasNewer) return;

		const triggerMessage = await ctx.runQuery(
			internal.messagesInternal.getMessageById,
			{ messageId: args.triggeringMessageId },
		);
		if (!triggerMessage || triggerMessage.senderType !== "customer") {
			return;
		}
		const lastCustomerMessage = triggerMessage.content;

		const tenant = await ctx.runQuery(internal.threadsInternal.getTenantById, {
			tenantId: args.tenantId,
		});
		if (!tenant) return;

		await ctx.runMutation(internal.threadsInternal.setAiTyping, {
			threadId: args.threadId,
			isAiTyping: true,
		});

		// Re-check for a newer customer message and bail out if one arrived
		// while the model was generating — the newer job will answer instead.
		const replyIsStale = async (): Promise<boolean> =>
			await ctx.runQuery(internal.messagesInternal.hasNewerCustomerMessage, {
				threadId: args.threadId,
				afterMessageId: args.triggeringMessageId,
			});

		const sendBotReply = async (content: string) => {
			const botMessageId = await ctx.runMutation(
				internal.messagesInternal.insertBotMessage,
				{
					threadId: args.threadId,
					tenantId: args.tenantId,
					content,
					deliveryStatus:
						thread.channel === "whatsapp" ? ("sent" as const) : undefined,
				},
			);

			if (thread.channel === "whatsapp") {
				await ctx.scheduler.runAfter(0, internal.whatsapp.sendText, {
					threadId: args.threadId,
					tenantId: args.tenantId,
					messageId: botMessageId,
					text: content,
				});
			}
		};

		try {
			// --- Escalation keyword check ---
			const escalationKeywords: string[] =
				tenant.settings.escalationKeywords ?? [];
			if (matchesEscalationKeyword(lastCustomerMessage, escalationKeywords)) {
				await ctx.runMutation(internal.threadsInternal.escalateThread, {
					threadId: args.threadId,
					tenantId: args.tenantId,
					reason: "Escalation keyword detected",
				});
				return;
			}

			const recentMessages = await ctx.runQuery(
				internal.messagesInternal.getRecentForThread,
				{ threadId: args.threadId },
			);

			// Conversation history: everything except the message we are answering
			// (matched by ID, not position — an agent reply may have landed after
			// it during the debounce window). Internal signal tokens are excluded.
			const history: ChatMessage[] = recentMessages
				.filter((m) => m._id !== args.triggeringMessageId)
				.filter(
					(m) =>
						!m.content.includes("[NEEDS_DOCS]") &&
						!m.content.includes("[ESCALATE]"),
				)
				.map((m) => ({
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

				if (await replyIsStale()) return;
				await sendBotReply(chatReply);
				return;
			}

			// --- Step 2: RAG model (document retrieval + grounded answer) ---
			// Condense follow-up questions ("how much does that cost?") into a
			// standalone query so the embedding actually matches the topic.
			const searchQuery = await condenseQuery(history, lastCustomerMessage);

			const ragResults = await ctx.runAction(
				internal.embeddingsSearch.searchSimilar,
				{
					tenantId: args.tenantId,
					query: searchQuery,
				},
			);

			console.log(
				`[RAG] query="${searchQuery.slice(0, 80)}" results=${ragResults.length} scores=${ragResults.map((r: { score: number }) => r.score.toFixed(3)).join(",")}`,
			);

			const relevantChunks = ragResults.filter(
				(r: { score: number }) => r.score >= RAG_SIMILARITY_THRESHOLD,
			);

			// Nothing genuinely relevant — answer honestly without inventing
			// context instead of feeding low-similarity junk to the model.
			if (relevantChunks.length === 0) {
				if (await replyIsStale()) return;
				await sendBotReply(NO_INFO_REPLY);
				return;
			}

			// Use everything above the threshold; pad with near-miss chunks
			// (above the fallback floor) up to the context cap.
			const chunksToUse = ragResults
				.filter((r: { score: number }) => r.score >= RAG_FALLBACK_THRESHOLD)
				.slice(0, Math.max(relevantChunks.length, RAG_MAX_CONTEXT_CHUNKS));

			const ragSystemPrompt = buildRagSystemPrompt({
				tenantName: tenant.name,
				customPrompt: tenant.settings.aiSystemPrompt,
				contextChunks: chunksToUse.map((c: { text: string }) => c.text),
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

			const safeReply = ragReply.includes("[NEEDS_DOCS]")
				? NO_INFO_REPLY
				: ragReply;

			if (await replyIsStale()) return;
			await sendBotReply(safeReply);
		} catch (error) {
			console.error("ai.generateReply failed:", error);
			try {
				if (isRetryable(error)) {
					// Transient provider outage — apologize and keep AI enabled
					// rather than permanently escalating the thread.
					await sendBotReply(TRANSIENT_ERROR_REPLY);
				} else {
					await ctx.runMutation(internal.threadsInternal.escalateThread, {
						threadId: args.threadId,
						tenantId: args.tenantId,
						reason: "AI service unavailable",
					});
				}
			} catch {
				// Recovery itself failed — nothing more we can do.
			}
		} finally {
			await ctx.runMutation(internal.threadsInternal.setAiTyping, {
				threadId: args.threadId,
				isAiTyping: false,
			});
		}
	},
});
