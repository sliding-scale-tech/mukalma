"use node";

import { RAG_TOP_K } from "@mukalma/shared/constants/embeddings";
import { v } from "convex/values";
import { createQueryEmbedding } from "../lib/gemini";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalAction } from "./_generated/server";

type SearchResult = {
	_id: Id<"documentChunks">;
	score: number;
	text: string;
	documentId: Id<"documents">;
	chunkIndex: number;
};

export const searchSimilar = internalAction({
	args: {
		tenantId: v.id("tenants"),
		query: v.string(),
		limit: v.optional(v.number()),
	},
	handler: async (ctx, args): Promise<SearchResult[]> => {
		const vector = await createQueryEmbedding(args.query);
		const results = await ctx.vectorSearch("documentChunks", "by_embedding", {
			vector,
			limit: args.limit ?? RAG_TOP_K,
			filter: (q) => q.eq("tenantId", args.tenantId),
		});

		const chunks: Doc<"documentChunks">[] = await ctx.runQuery(
			internal.documentsInternal.getChunksByIds,
			{
				ids: results.map((result) => result._id),
			},
		);

		const chunkById = new Map<Id<"documentChunks">, Doc<"documentChunks">>(
			chunks.map((chunk) => [chunk._id, chunk]),
		);

		// Drop chunks that were deleted between the vector search and hydration
		// (or that somehow have empty text) so they never reach the prompt.
		return results.flatMap((result) => {
			const chunk = chunkById.get(result._id);
			if (!chunk || !chunk.text.trim()) return [];
			return [
				{
					_id: result._id,
					score: result._score,
					text: chunk.text,
					documentId: chunk.documentId,
					chunkIndex: chunk.chunkIndex,
				},
			];
		});
	},
});
