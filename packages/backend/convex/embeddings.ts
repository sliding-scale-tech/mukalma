"use node";

import { v } from "convex/values";
import { chunkText } from "../lib/chunking";
import { createEmbeddings } from "../lib/gemini";
import { extractTextFromBlob } from "../lib/textExtraction";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import type { ActionCtx } from "./_generated/server";
import { internalAction } from "./_generated/server";

// Each chunk row carries a 3072-dim float64 embedding (~50 KB serialized), so
// inserts are split into small batches to stay under Convex mutation limits.
const CHUNK_INSERT_BATCH = 20;

async function deleteAllChunksNow(ctx: ActionCtx, documentId: Id<"documents">) {
	let hasMore = true;
	while (hasMore) {
		const result = await ctx.runMutation(
			internal.documentsInternal.deleteChunksPage,
			{ documentId },
		);
		hasMore = result.hasMore;
	}
}

export const processDocument = internalAction({
	args: { documentId: v.id("documents") },
	handler: async (ctx, args) => {
		const document = await ctx.runQuery(
			internal.documentsInternal.getDocumentForProcessing,
			{ documentId: args.documentId },
		);

		if (!document) {
			return;
		}

		if (document.status !== "processing") {
			return;
		}

		try {
			const blob = await ctx.storage.get(document.storageId);
			if (!blob) {
				throw new Error("Stored file not found");
			}

			const text = await extractTextFromBlob(blob, document.mimeType);
			if (!text) {
				throw new Error("No extractable text found in document");
			}

			console.log(
				`[embeddings] "${document.name}" extractedChars=${text.length} preview="${text.slice(0, 200).replace(/\n/g, " ")}"`,
			);

			const textChunks = chunkText(text);
			console.log(
				`[embeddings] "${document.name}" chunks=${textChunks.length}`,
			);
			if (textChunks.length === 0) {
				throw new Error("No extractable text found in document");
			}

			const embeddings = await createEmbeddings(textChunks);
			if (embeddings.length !== textChunks.length) {
				throw new Error("Embedding count mismatch");
			}

			await deleteAllChunksNow(ctx, args.documentId);

			const allChunks = textChunks.map((text, chunkIndex) => ({
				chunkIndex,
				text,
				embedding: embeddings[chunkIndex] ?? [],
			}));
			for (let i = 0; i < allChunks.length; i += CHUNK_INSERT_BATCH) {
				await ctx.runMutation(internal.documentsInternal.insertChunks, {
					tenantId: document.tenantId,
					documentId: args.documentId,
					chunks: allChunks.slice(i, i + CHUNK_INSERT_BATCH),
				});
			}

			await ctx.runMutation(internal.documentsInternal.markReady, {
				documentId: args.documentId,
				chunkCount: textChunks.length,
			});
		} catch (error) {
			await deleteAllChunksNow(ctx, args.documentId);
			await ctx.runMutation(internal.documentsInternal.markFailed, {
				documentId: args.documentId,
				errorMessage:
					error instanceof Error ? error.message : "Document processing failed",
			});
		}
	},
});
