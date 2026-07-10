import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import { mutation, query } from "./_generated/server";
import { withAdmin, withTenant } from "./lib/customFunctions";
import { requireCustomerSession } from "./lib/sessionAuth";

// --- Public (customer widget) ---

export const getOrCreatePublic = mutation({
	args: {
		tenantId: v.id("tenants"),
		sessionId: v.string(),
		customerName: v.optional(v.string()),
		customerEmail: v.optional(v.string()),
		sourceDomain: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const { tenant } = await requireCustomerSession(ctx, args);

		const customerName = args.customerName?.trim().slice(0, 100) || undefined;
		const customerEmail =
			args.customerEmail?.trim().toLowerCase().slice(0, 200) || undefined;
		const sourceDomain = args.sourceDomain?.trim().slice(0, 200) || undefined;

		const existing = await ctx.db
			.query("threads")
			.withIndex("by_tenant_and_customerSession", (q) =>
				q.eq("tenantId", tenant._id).eq("customerSessionId", args.sessionId),
			)
			.collect();

		const openThread = existing.find((t) => t.status !== "closed");
		if (openThread) {
			// Backfill details on returning visits (e.g. an older thread created
			// before the pre-chat form, or details updated by the customer).
			const patch: Record<string, string> = {};
			if (customerName && customerName !== openThread.customerDisplayName) {
				patch.customerDisplayName = customerName;
			}
			if (customerEmail && customerEmail !== openThread.customerEmail) {
				patch.customerEmail = customerEmail;
			}
			if (sourceDomain && sourceDomain !== openThread.sourceDomain) {
				patch.sourceDomain = sourceDomain;
			}
			if (Object.keys(patch).length > 0) {
				await ctx.db.patch(openThread._id, patch);
			}
			return {
				threadId: openThread._id,
				status: openThread.status,
				aiEnabled: openThread.aiEnabled,
				isAiTyping: openThread.isAiTyping,
			};
		}

		const now = Date.now();
		const threadId = await ctx.db.insert("threads", {
			tenantId: tenant._id,
			channel: "web",
			status: "open",
			aiEnabled: true,
			assignedToUserId: null,
			customerSessionId: args.sessionId,
			externalChatId: null,
			customerDisplayName: customerName ?? null,
			customerEmail: customerEmail ?? null,
			sourceDomain: sourceDomain ?? null,
			agentUnreadCount: 0,
			isAiTyping: false,
			lastMessageAt: now,
			escalatedAt: null,
			closedAt: null,
			createdAt: now,
		});

		return {
			threadId,
			status: "open" as const,
			aiEnabled: true,
			isAiTyping: false,
		};
	},
});

export const getPublicThread = query({
	args: {
		tenantId: v.id("tenants"),
		sessionId: v.string(),
		threadId: v.id("threads"),
	},
	handler: async (ctx, args) => {
		await requireCustomerSession(ctx, args);

		const thread = await ctx.db.get(args.threadId);
		if (!thread || thread.customerSessionId !== args.sessionId) {
			return null;
		}
		return {
			threadId: thread._id,
			status: thread.status,
			aiEnabled: thread.aiEnabled,
			isAiTyping: thread.isAiTyping,
		};
	},
});

export const requestEscalationPublic = mutation({
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
		if (thread.status === "closed") {
			throw new ConvexError({ code: "CLOSED", message: "Thread is closed" });
		}
		if (thread.status === "escalated") {
			return { alreadyEscalated: true };
		}

		await ctx.runMutation(internal.threadsInternal.escalateThread, {
			threadId: args.threadId,
			tenantId: args.tenantId,
			reason: "Customer requested human agent",
		});

		return { alreadyEscalated: false };
	},
});

// --- Admin (Clerk auth) ---

const INBOX_PAGE_SIZE = 20;

export const listForInbox = query({
	args: {
		status: v.optional(
			v.union(v.literal("open"), v.literal("escalated"), v.literal("closed")),
		),
		channel: v.optional(v.union(v.literal("web"), v.literal("whatsapp"))),
		assignedToUserId: v.optional(
			v.union(v.id("users"), v.literal("unassigned"), v.literal("me")),
		),
		limit: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const { tenant, user } = await withTenant(ctx);

		const threads = args.status
			? await ctx.db
					.query("threads")
					.withIndex("by_tenant_and_status", (q) =>
						q.eq("tenantId", tenant._id).eq("status", args.status!),
					)
					.collect()
			: await ctx.db
					.query("threads")
					.withIndex("by_tenant_and_lastMessage", (q) =>
						q.eq("tenantId", tenant._id),
					)
					.collect();

		let filtered = [...threads];

		if (args.channel) {
			filtered = filtered.filter((t) => t.channel === args.channel);
		}

		if (args.assignedToUserId === "unassigned") {
			filtered = filtered.filter((t) => t.assignedToUserId === null);
		} else if (args.assignedToUserId === "me") {
			filtered = filtered.filter((t) => t.assignedToUserId === user._id);
		} else if (args.assignedToUserId) {
			filtered = filtered.filter(
				(t) => t.assignedToUserId === args.assignedToUserId,
			);
		}

		// Unread conversations first, newest activity first within each group —
		// a new customer message bumps both, so it jumps straight to the top.
		filtered.sort((a, b) => {
			const aUnread = a.agentUnreadCount > 0 ? 1 : 0;
			const bUnread = b.agentUnreadCount > 0 ? 1 : 0;
			if (aUnread !== bUnread) return bUnread - aUnread;
			return b.lastMessageAt - a.lastMessageAt;
		});

		const limit = Math.max(args.limit ?? INBOX_PAGE_SIZE, 1);
		const hasMore = filtered.length > limit;
		const pageThreads = filtered.slice(0, limit);

		const threadsWithPreview = await Promise.all(
			pageThreads.map(async (thread) => {
				const lastMessage = await ctx.db
					.query("messages")
					.withIndex("by_thread", (q) => q.eq("threadId", thread._id))
					.order("desc")
					.first();

				let assignedAgentName: string | null = null;
				if (thread.assignedToUserId) {
					const agent = await ctx.db.get(thread.assignedToUserId);
					assignedAgentName = agent?.name ?? agent?.email ?? null;
				}

				return {
					...thread,
					lastMessagePreview: lastMessage?.content.slice(0, 100) ?? null,
					lastMessageSenderType: lastMessage?.senderType ?? null,
					assignedAgentName,
				};
			}),
		);

		return { threads: threadsWithPreview, hasMore };
	},
});

export const getById = query({
	args: { threadId: v.id("threads") },
	handler: async (ctx, args) => {
		const { tenant } = await withTenant(ctx);
		const thread = await ctx.db.get(args.threadId);
		if (!thread || thread.tenantId !== tenant._id) {
			return null;
		}

		let assignedAgentName: string | null = null;
		if (thread.assignedToUserId) {
			const agent = await ctx.db.get(thread.assignedToUserId);
			assignedAgentName = agent?.name ?? agent?.email ?? null;
		}

		return { ...thread, assignedAgentName };
	},
});

export const markRead = mutation({
	args: { threadId: v.id("threads") },
	handler: async (ctx, args) => {
		const { tenant } = await withTenant(ctx);
		const thread = await ctx.db.get(args.threadId);
		if (!thread || thread.tenantId !== tenant._id) {
			throw new ConvexError({ code: "NOT_FOUND", message: "Thread not found" });
		}
		await ctx.db.patch(args.threadId, { agentUnreadCount: 0 });
	},
});

export const assignToMe = mutation({
	args: { threadId: v.id("threads") },
	handler: async (ctx, args) => {
		const { tenant, user } = await withTenant(ctx);
		const thread = await ctx.db.get(args.threadId);
		if (!thread || thread.tenantId !== tenant._id) {
			throw new ConvexError({ code: "NOT_FOUND", message: "Thread not found" });
		}
		await ctx.db.patch(args.threadId, { assignedToUserId: user._id });
	},
});

export const rename = mutation({
	args: {
		threadId: v.id("threads"),
		displayName: v.string(),
	},
	handler: async (ctx, args) => {
		const { tenant } = await withTenant(ctx);
		const thread = await ctx.db.get(args.threadId);
		if (!thread || thread.tenantId !== tenant._id) {
			throw new ConvexError({ code: "NOT_FOUND", message: "Thread not found" });
		}
		const trimmed = args.displayName.trim().slice(0, 100);
		if (!trimmed) {
			throw new ConvexError({
				code: "EMPTY",
				message: "Name cannot be empty",
			});
		}
		await ctx.db.patch(args.threadId, { customerDisplayName: trimmed });
	},
});

export const reassign = mutation({
	args: {
		threadId: v.id("threads"),
		agentId: v.id("users"),
	},
	handler: async (ctx, args) => {
		const { tenant } = await withAdmin(ctx);
		const thread = await ctx.db.get(args.threadId);
		if (!thread || thread.tenantId !== tenant._id) {
			throw new ConvexError({ code: "NOT_FOUND", message: "Thread not found" });
		}
		const agent = await ctx.db.get(args.agentId);
		if (!agent || agent.tenantId !== tenant._id) {
			throw new ConvexError({ code: "NOT_FOUND", message: "Agent not found" });
		}
		await ctx.db.patch(args.threadId, { assignedToUserId: args.agentId });
	},
});

export const close = mutation({
	args: { threadId: v.id("threads") },
	handler: async (ctx, args) => {
		const { tenant } = await withTenant(ctx);
		const thread = await ctx.db.get(args.threadId);
		if (!thread || thread.tenantId !== tenant._id) {
			throw new ConvexError({ code: "NOT_FOUND", message: "Thread not found" });
		}
		if (thread.status === "closed") {
			throw new ConvexError({
				code: "ALREADY_CLOSED",
				message: "Thread is already closed",
			});
		}
		await ctx.db.patch(args.threadId, {
			status: "closed",
			closedAt: Date.now(),
			aiEnabled: false,
			isAiTyping: false,
		});
	},
});

export const reopen = mutation({
	args: { threadId: v.id("threads") },
	handler: async (ctx, args) => {
		const { tenant } = await withTenant(ctx);
		const thread = await ctx.db.get(args.threadId);
		if (!thread || thread.tenantId !== tenant._id) {
			throw new ConvexError({ code: "NOT_FOUND", message: "Thread not found" });
		}
		if (thread.status !== "closed") {
			throw new ConvexError({
				code: "NOT_CLOSED",
				message: "Thread is not closed",
			});
		}
		await ctx.db.patch(args.threadId, {
			status: "open",
			aiEnabled: true,
			closedAt: null,
			assignedToUserId: null,
		});
	},
});
