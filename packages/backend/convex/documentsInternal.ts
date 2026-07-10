import { v } from "convex/values";

import { internal } from "./_generated/api";
import { internalMutation, internalQuery } from "./_generated/server";

// Chunk rows carry 3072-dim float64 embeddings (~50 KB each as JSON), so all
// chunk reads/writes are paged to stay under Convex per-transaction limits.
const CHUNK_DELETE_BATCH = 100;

export const getChunksByIds = internalQuery({
	args: { ids: v.array(v.id("documentChunks")) },
	handler: async (ctx, args) => {
		const chunks = await Promise.all(args.ids.map((id) => ctx.db.get(id)));
		return chunks.filter(
			(chunk): chunk is NonNullable<typeof chunk> => chunk !== null,
		);
	},
});

export const getDocumentForProcessing = internalQuery({
	args: { documentId: v.id("documents") },
	handler: async (ctx, args) => {
		const document = await ctx.db.get(args.documentId);
		if (!document) {
			return null;
		}
		return document;
	},
});

export const deleteChunksPage = internalMutation({
	args: { documentId: v.id("documents") },
	handler: async (ctx, args) => {
		const chunks = await ctx.db
			.query("documentChunks")
			.withIndex("by_document", (q) => q.eq("documentId", args.documentId))
			.take(CHUNK_DELETE_BATCH);
		for (const chunk of chunks) {
			await ctx.db.delete(chunk._id);
		}
		return {
			deleted: chunks.length,
			hasMore: chunks.length === CHUNK_DELETE_BATCH,
		};
	},
});

// Fire-and-forget full cleanup: deletes one page, reschedules itself until
// every chunk for the document is gone. Used after document removal.
export const deleteAllChunks = internalMutation({
	args: { documentId: v.id("documents") },
	handler: async (ctx, args) => {
		const chunks = await ctx.db
			.query("documentChunks")
			.withIndex("by_document", (q) => q.eq("documentId", args.documentId))
			.take(CHUNK_DELETE_BATCH);
		for (const chunk of chunks) {
			await ctx.db.delete(chunk._id);
		}
		if (chunks.length === CHUNK_DELETE_BATCH) {
			await ctx.scheduler.runAfter(
				0,
				internal.documentsInternal.deleteAllChunks,
				{
					documentId: args.documentId,
				},
			);
		}
	},
});

export const insertChunks = internalMutation({
	args: {
		tenantId: v.id("tenants"),
		documentId: v.id("documents"),
		chunks: v.array(
			v.object({
				chunkIndex: v.number(),
				text: v.string(),
				embedding: v.array(v.float64()),
			}),
		),
	},
	handler: async (ctx, args) => {
		for (const chunk of args.chunks) {
			await ctx.db.insert("documentChunks", {
				tenantId: args.tenantId,
				documentId: args.documentId,
				chunkIndex: chunk.chunkIndex,
				text: chunk.text,
				embedding: chunk.embedding,
			});
		}
		return { inserted: args.chunks.length };
	},
});

export const markReady = internalMutation({
	args: {
		documentId: v.id("documents"),
		chunkCount: v.number(),
	},
	handler: async (ctx, args) => {
		await ctx.db.patch(args.documentId, {
			status: "ready",
			chunkCount: args.chunkCount,
			errorMessage: null,
		});
	},
});

export const markFailed = internalMutation({
	args: {
		documentId: v.id("documents"),
		errorMessage: v.string(),
	},
	handler: async (ctx, args) => {
		await ctx.db.patch(args.documentId, {
			status: "failed",
			errorMessage: args.errorMessage,
		});
	},
});

export const markProcessing = internalMutation({
	args: { documentId: v.id("documents") },
	handler: async (ctx, args) => {
		await ctx.db.patch(args.documentId, {
			status: "processing",
			chunkCount: 0,
			errorMessage: null,
			processingStartedAt: Date.now(),
		});
	},
});
