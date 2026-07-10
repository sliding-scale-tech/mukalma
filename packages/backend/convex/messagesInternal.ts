import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

export const getRecentForThread = internalQuery({
	args: {
		threadId: v.id("threads"),
		limit: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const messages = await ctx.db
			.query("messages")
			.withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
			.order("desc")
			.take(args.limit ?? 20);

		return messages.filter((m) => m.senderType !== "system").reverse();
	},
});

export const getMessageById = internalQuery({
	args: { messageId: v.id("messages") },
	handler: async (ctx, args) => {
		return await ctx.db.get(args.messageId);
	},
});

export const hasNewerCustomerMessage = internalQuery({
	args: {
		threadId: v.id("threads"),
		afterMessageId: v.id("messages"),
	},
	handler: async (ctx, args) => {
		const triggerMsg = await ctx.db.get(args.afterMessageId);
		if (!triggerMsg) return false;

		// Walk newest-first until we find the most recent customer message —
		// bounded scan, not a fixed window that a burst of messages can defeat.
		const latestCustomer = await ctx.db
			.query("messages")
			.withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
			.order("desc")
			.filter((q) => q.eq(q.field("senderType"), "customer"))
			.first();

		return (
			latestCustomer !== null &&
			latestCustomer._id !== triggerMsg._id &&
			latestCustomer.createdAt >= triggerMsg.createdAt
		);
	},
});

export const insertBotMessage = internalMutation({
	args: {
		threadId: v.id("threads"),
		tenantId: v.id("tenants"),
		content: v.string(),
		deliveryStatus: v.optional(
			v.union(v.literal("sent"), v.literal("delivered"), v.literal("failed")),
		),
	},
	handler: async (ctx, args) => {
		const now = Date.now();
		const messageId = await ctx.db.insert("messages", {
			threadId: args.threadId,
			tenantId: args.tenantId,
			senderType: "bot",
			senderUserId: null,
			content: args.content,
			deliveryStatus: args.deliveryStatus ?? null,
			readByAgent: true,
			metadata: null,
			createdAt: now,
		});

		await ctx.db.patch(args.threadId, { lastMessageAt: now });

		return messageId;
	},
});

export const insertSystemMessage = internalMutation({
	args: {
		threadId: v.id("threads"),
		tenantId: v.id("tenants"),
		content: v.string(),
		metadata: v.optional(
			v.object({ escalationReason: v.optional(v.string()) }),
		),
	},
	handler: async (ctx, args) => {
		await ctx.db.insert("messages", {
			threadId: args.threadId,
			tenantId: args.tenantId,
			senderType: "system",
			senderUserId: null,
			content: args.content,
			deliveryStatus: null,
			readByAgent: true,
			metadata: args.metadata ?? null,
			createdAt: Date.now(),
		});
	},
});
