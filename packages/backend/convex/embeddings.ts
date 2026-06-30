"use node";

import { v } from "convex/values";
import { chunkText } from "../lib/chunking";
import { createEmbeddings } from "../lib/gemini";
import { extractTextFromBlob } from "../lib/textExtraction";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";

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

			await ctx.runMutation(internal.documentsInternal.deleteChunksByDocument, {
				documentId: args.documentId,
			});

			await ctx.runMutation(internal.documentsInternal.insertChunks, {
				tenantId: document.tenantId,
				documentId: args.documentId,
				chunks: textChunks.map((text, chunkIndex) => ({
					chunkIndex,
					text,
					embedding: embeddings[chunkIndex] ?? [],
				})),
			});

			await ctx.runMutation(internal.documentsInternal.markReady, {
				documentId: args.documentId,
				chunkCount: textChunks.length,
			});
		} catch (error) {
			await ctx.runMutation(internal.documentsInternal.deleteChunksByDocument, {
				documentId: args.documentId,
			});
			await ctx.runMutation(internal.documentsInternal.markFailed, {
				documentId: args.documentId,
				errorMessage:
					error instanceof Error ? error.message : "Document processing failed",
			});
		}
	},
});
