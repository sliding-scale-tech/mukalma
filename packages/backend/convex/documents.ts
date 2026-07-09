import {
	isAllowedMimeType,
	MAX_DOCUMENT_BYTES,
} from "@mukalma/shared/schemas/documents";
import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import { mutation, query } from "./_generated/server";
import { withAdmin, withTenant } from "./lib/customFunctions";

// A document stuck in "processing" longer than this is considered orphaned
// (the processing action crashed or timed out) and may be retried or deleted.
const PROCESSING_STALE_MS = 10 * 60 * 1000;

function isStuckProcessing(document: {
	status: string;
	processingStartedAt?: number | null;
	createdAt: number;
}): boolean {
	if (document.status !== "processing") return false;
	const startedAt = document.processingStartedAt ?? document.createdAt;
	return Date.now() - startedAt > PROCESSING_STALE_MS;
}

function validateDocumentInput(args: {
	name: string;
	mimeType: string;
	sizeBytes: number;
}) {
	if (!args.name.trim()) {
		throw new ConvexError({
			code: "INVALID_NAME",
			message: "File name is required",
		});
	}
	if (!isAllowedMimeType(args.mimeType)) {
		throw new ConvexError({
			code: "INVALID_MIME",
			message: "Unsupported file type. Use PDF, DOCX, TXT, or Markdown.",
		});
	}
	if (args.sizeBytes <= 0 || args.sizeBytes > MAX_DOCUMENT_BYTES) {
		throw new ConvexError({
			code: "INVALID_SIZE",
			message: "File must be 10 MB or smaller",
		});
	}
}

export const generateUploadUrl = mutation({
	args: {},
	handler: async (ctx) => {
		await withAdmin(ctx);
		return await ctx.storage.generateUploadUrl();
	},
});

export const create = mutation({
	args: {
		storageId: v.id("_storage"),
		name: v.string(),
		mimeType: v.string(),
		sizeBytes: v.number(),
	},
	handler: async (ctx, args) => {
		const { user, tenant } = await withAdmin(ctx);
		validateDocumentInput(args);

		const metadata = await ctx.storage.getMetadata(args.storageId);
		if (!metadata) {
			throw new ConvexError({
				code: "STORAGE_NOT_FOUND",
				message: "Uploaded file not found in storage",
			});
		}

		// Validate against what was actually uploaded, not client claims.
		if (metadata.size <= 0 || metadata.size > MAX_DOCUMENT_BYTES) {
			throw new ConvexError({
				code: "INVALID_SIZE",
				message: "File must be 10 MB or smaller",
			});
		}
		if (metadata.contentType && !isAllowedMimeType(metadata.contentType)) {
			throw new ConvexError({
				code: "INVALID_MIME",
				message: "Unsupported file type. Use PDF, DOCX, TXT, or Markdown.",
			});
		}

		const now = Date.now();
		const documentId = await ctx.db.insert("documents", {
			tenantId: tenant._id,
			storageId: args.storageId,
			name: args.name.trim(),
			mimeType: metadata.contentType ?? args.mimeType,
			sizeBytes: metadata.size,
			status: "processing",
			chunkCount: 0,
			errorMessage: null,
			uploadedByUserId: user._id,
			createdAt: now,
			processingStartedAt: now,
		});

		await ctx.db.insert("auditLogs", {
			tenantId: tenant._id,
			userId: user._id,
			action: "document.uploaded",
			metadata: { documentId, name: args.name },
			createdAt: Date.now(),
		});

		await ctx.scheduler.runAfter(0, internal.embeddings.processDocument, {
			documentId,
		});

		return { documentId };
	},
});

export const list = query({
	args: {},
	handler: async (ctx) => {
		const { tenant } = await withTenant(ctx);
		const documents = await ctx.db
			.query("documents")
			.withIndex("by_tenant", (q) => q.eq("tenantId", tenant._id))
			.collect();

		return documents.sort((a, b) => b.createdAt - a.createdAt);
	},
});

export const remove = mutation({
	args: { documentId: v.id("documents") },
	handler: async (ctx, args) => {
		const { user, tenant } = await withAdmin(ctx);
		const document = await ctx.db.get(args.documentId);

		if (!document || document.tenantId !== tenant._id) {
			throw new ConvexError({
				code: "NOT_FOUND",
				message: "Document not found",
			});
		}

		if (document.status === "processing" && !isStuckProcessing(document)) {
			throw new ConvexError({
				code: "PROCESSING",
				message: "Document is still processing",
			});
		}

		// Chunk rows are large (embeddings) — clean them up in scheduled pages
		// instead of one unbounded transaction.
		await ctx.scheduler.runAfter(
			0,
			internal.documentsInternal.deleteAllChunks,
			{
				documentId: args.documentId,
			},
		);
		await ctx.storage.delete(document.storageId);
		await ctx.db.delete(args.documentId);

		await ctx.db.insert("auditLogs", {
			tenantId: tenant._id,
			userId: user._id,
			action: "document.deleted",
			metadata: { documentId: args.documentId, name: document.name },
			createdAt: Date.now(),
		});

		return { success: true };
	},
});

export const retryProcessing = mutation({
	args: { documentId: v.id("documents") },
	handler: async (ctx, args) => {
		const { user, tenant } = await withAdmin(ctx);
		const document = await ctx.db.get(args.documentId);

		if (!document || document.tenantId !== tenant._id) {
			throw new ConvexError({
				code: "NOT_FOUND",
				message: "Document not found",
			});
		}

		if (document.status === "processing" && !isStuckProcessing(document)) {
			throw new ConvexError({
				code: "INVALID_STATUS",
				message: "Document is still processing",
			});
		}

		// processDocument clears old chunks itself before inserting new ones.
		await ctx.runMutation(internal.documentsInternal.markProcessing, {
			documentId: args.documentId,
		});

		await ctx.db.insert("auditLogs", {
			tenantId: tenant._id,
			userId: user._id,
			action: "document.retry",
			metadata: { documentId: args.documentId, name: document.name },
			createdAt: Date.now(),
		});

		await ctx.scheduler.runAfter(0, internal.embeddings.processDocument, {
			documentId: args.documentId,
		});

		return { success: true };
	},
});
