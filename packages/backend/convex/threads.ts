import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, type QueryCtx, query } from "./_generated/server";
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

const MAX_PINNED_UNREAD = 50;

async function enrichThreadForInbox(ctx: QueryCtx, thread: Doc<"threads">) {
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
}

type InboxFilterArgs = {
	channel?: "web" | "whatsapp";
	assignedToUserId?: Id<"users"> | "unassigned" | "me";
};

function matchesInboxFilters(
	thread: Doc<"threads">,
	args: InboxFilterArgs,
	userId: Id<"users">,
): boolean {
	if (args.channel && thread.channel !== args.channel) return false;
	if (args.assignedToUserId === "unassigned") {
		return thread.assignedToUserId === null;
	}
	if (args.assignedToUserId === "me") {
		return thread.assignedToUserId === userId;
	}
	if (args.assignedToUserId) {
		return thread.assignedToUserId === args.assignedToUserId;
	}
	return true;
}

// Cursor-paginated inbox list, newest activity first. Unread threads are
// served separately by listUnreadForInbox and pinned on top by the client —
// a cursor cannot follow an order that re-sorts whenever a message is read.
export const listForInbox = query({
	args: {
		status: v.optional(
			v.union(v.literal("open"), v.literal("escalated"), v.literal("closed")),
		),
		channel: v.optional(v.union(v.literal("web"), v.literal("whatsapp"))),
		assignedToUserId: v.optional(
			v.union(v.id("users"), v.literal("unassigned"), v.literal("me")),
		),
		paginationOpts: paginationOptsValidator,
	},
	handler: async (ctx, args) => {
		const { tenant, user } = await withTenant(ctx);

		const indexed = args.status
			? ctx.db
					.query("threads")
					.withIndex("by_tenant_status_lastMessage", (q) =>
						q.eq("tenantId", tenant._id).eq("status", args.status!),
					)
			: ctx.db
					.query("threads")
					.withIndex("by_tenant_and_lastMessage", (q) =>
						q.eq("tenantId", tenant._id),
					);

		const result = await indexed
			.order("desc")
			.filter((q) => {
				const clauses = [];
				if (args.channel) {
					clauses.push(q.eq(q.field("channel"), args.channel));
				}
				if (args.assignedToUserId === "unassigned") {
					clauses.push(q.eq(q.field("assignedToUserId"), null));
				} else if (args.assignedToUserId === "me") {
					clauses.push(q.eq(q.field("assignedToUserId"), user._id));
				} else if (args.assignedToUserId) {
					clauses.push(
						q.eq(q.field("assignedToUserId"), args.assignedToUserId),
					);
				}
				if (clauses.length === 0) return true;
				return q.and(...clauses);
			})
			.paginate(args.paginationOpts);

		const page = await Promise.all(
			result.page.map((thread) => enrichThreadForInbox(ctx, thread)),
		);

		return { ...result, page };
	},
});

// Unread threads for the pinned section at the top of the inbox. Bounded and
// unpaginated — the unread set is small by nature.
export const listUnreadForInbox = query({
	args: {
		status: v.optional(
			v.union(v.literal("open"), v.literal("escalated"), v.literal("closed")),
		),
		channel: v.optional(v.union(v.literal("web"), v.literal("whatsapp"))),
		assignedToUserId: v.optional(
			v.union(v.id("users"), v.literal("unassigned"), v.literal("me")),
		),
	},
	handler: async (ctx, args) => {
		const { tenant, user } = await withTenant(ctx);

		const threads = args.status
			? await ctx.db
					.query("threads")
					.withIndex("by_tenant_status_lastMessage", (q) =>
						q.eq("tenantId", tenant._id).eq("status", args.status!),
					)
					.collect()
			: await ctx.db
					.query("threads")
					.withIndex("by_tenant_and_lastMessage", (q) =>
						q.eq("tenantId", tenant._id),
					)
					.collect();

		const unread = threads
			.filter(
				(t) => t.agentUnreadCount > 0 && matchesInboxFilters(t, args, user._id),
			)
			.sort((a, b) => b.lastMessageAt - a.lastMessageAt)
			.slice(0, MAX_PINNED_UNREAD);

		return await Promise.all(
			unread.map((thread) => enrichThreadForInbox(ctx, thread)),
		);
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
