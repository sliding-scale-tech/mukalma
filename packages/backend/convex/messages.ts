import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import { mutation, query } from "./_generated/server";
import { withTenant } from "./lib/customFunctions";
import { requireCustomerSession } from "./lib/sessionAuth";

// --- Public (customer widget) ---

export const listPublic = query({
	args: {
		tenantId: v.id("tenants"),
		sessionId: v.string(),
		threadId: v.id("threads"),
	},
	handler: async (ctx, args) => {
		await requireCustomerSession(ctx, args);

		const thread = await ctx.db.get(args.threadId);
		if (!thread || thread.customerSessionId !== args.sessionId) {
			throw new ConvexError({ code: "NOT_FOUND", message: "Thread not found" });
		}

		const messages = await ctx.db
			.query("messages")
			.withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
			.collect();

		return messages.map((m) => ({
			_id: m._id,
			senderType: m.senderType,
			content: m.content,
			createdAt: m.createdAt,
		}));
	},
});

export const sendCustomer = mutation({
	args: {
		tenantId: v.id("tenants"),
		sessionId: v.string(),
		threadId: v.id("threads"),
		content: v.string(),
	},
	handler: async (ctx, args) => {
		await requireCustomerSession(ctx, args);

		const thread = await ctx.db.get(args.threadId);
		if (!thread || thread.customerSessionId !== args.sessionId) {
			throw new ConvexError({ code: "NOT_FOUND", message: "Thread not found" });
		}
		if (thread.status === "closed") {
			throw new ConvexError({ code: "CLOSED", message: "Thread is closed" });
		}

		const trimmed = args.content.trim();
		if (!trimmed) {
			throw new ConvexError({
				code: "EMPTY",
				message: "Message cannot be empty",
			});
		}

		const now = Date.now();
		const messageId = await ctx.db.insert("messages", {
			threadId: args.threadId,
			tenantId: args.tenantId,
			senderType: "customer",
			senderUserId: null,
			content: trimmed,
			deliveryStatus: null,
			readByAgent: false,
			metadata: null,
			createdAt: now,
		});

		await ctx.db.patch(args.threadId, {
			lastMessageAt: now,
			agentUnreadCount: thread.agentUnreadCount + 1,
		});

		if (thread.aiEnabled && thread.status === "open") {
			await ctx.scheduler.runAfter(2000, internal.ai.generateReply, {
				threadId: args.threadId,
				tenantId: args.tenantId,
				triggeringMessageId: messageId,
			});
		}

		return { messageId };
	},
});

// --- Admin (Clerk auth) ---

export const listForThread = query({
	args: { threadId: v.id("threads") },
	handler: async (ctx, args) => {
		const { tenant } = await withTenant(ctx);
		const thread = await ctx.db.get(args.threadId);
		if (!thread || thread.tenantId !== tenant._id) {
			throw new ConvexError({ code: "NOT_FOUND", message: "Thread not found" });
		}

		const messages = await ctx.db
			.query("messages")
			.withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
			.collect();

		return messages;
	},
});

export const sendAgent = mutation({
	args: {
		threadId: v.id("threads"),
		content: v.string(),
	},
	handler: async (ctx, args) => {
		const { tenant, user } = await withTenant(ctx);
		const thread = await ctx.db.get(args.threadId);
		if (!thread || thread.tenantId !== tenant._id) {
			throw new ConvexError({ code: "NOT_FOUND", message: "Thread not found" });
		}
		if (thread.status === "closed") {
			throw new ConvexError({ code: "CLOSED", message: "Thread is closed" });
		}

		const trimmed = args.content.trim();
		if (!trimmed) {
			throw new ConvexError({
				code: "EMPTY",
				message: "Message cannot be empty",
			});
		}

		const now = Date.now();
		const messageId = await ctx.db.insert("messages", {
			threadId: args.threadId,
			tenantId: tenant._id,
			senderType: "agent",
			senderUserId: user._id,
			content: trimmed,
			deliveryStatus: thread.channel === "whatsapp" ? "sent" : null,
			readByAgent: true,
			metadata: null,
			createdAt: now,
		});

		await ctx.db.patch(args.threadId, { lastMessageAt: now });

		// Deliver via WhatsApp if applicable (wired in Phase 8)
		if (thread.channel === "whatsapp" && thread.externalChatId) {
			await ctx.scheduler.runAfter(0, internal.whatsapp.sendText, {
				tenantId: tenant._id,
				threadId: args.threadId,
				messageId,
				text: trimmed,
			});
		}

		return { messageId };
	},
});
