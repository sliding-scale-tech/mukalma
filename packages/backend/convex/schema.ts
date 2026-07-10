import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const tenantSettings = v.object({
	logoUrl: v.optional(v.string()),
	timezone: v.optional(v.string()),
	industry: v.optional(v.string()),
	aiSystemPrompt: v.optional(v.string()),
	escalationKeywords: v.array(v.string()),
	allowedDomains: v.array(v.string()),
	widgetPosition: v.union(v.literal("bottom-right"), v.literal("bottom-left")),
	widgetTheme: v.optional(
		v.object({
			primaryColor: v.optional(v.string()),
			mode: v.optional(
				v.union(v.literal("light"), v.literal("dark"), v.literal("auto")),
			),
		}),
	),
});

export default defineSchema({
	tenants: defineTable({
		slug: v.string(),
		name: v.string(),
		clerkOrgId: v.string(),
		status: v.union(v.literal("active"), v.literal("suspended")),
		wahaSessionName: v.union(v.string(), v.null()),
		lastAssignedAgentId: v.union(v.id("users"), v.null()),
		settings: tenantSettings,
		createdAt: v.number(),
	})
		.index("by_slug", ["slug"])
		.index("by_clerkOrgId", ["clerkOrgId"])
		.index("by_wahaSessionName", ["wahaSessionName"]),

	users: defineTable({
		clerkId: v.string(),
		tokenIdentifier: v.string(),
		email: v.string(),
		name: v.optional(v.string()),
		tenantId: v.id("tenants"),
		role: v.union(v.literal("org_admin"), v.literal("agent")),
		createdAt: v.number(),
	})
		.index("by_clerkId", ["clerkId"])
		.index("by_tokenIdentifier", ["tokenIdentifier"])
		.index("by_tenant", ["tenantId"]),

	threads: defineTable({
		tenantId: v.id("tenants"),
		channel: v.union(v.literal("web"), v.literal("whatsapp")),
		status: v.union(
			v.literal("open"),
			v.literal("escalated"),
			v.literal("closed"),
		),
		aiEnabled: v.boolean(),
		assignedToUserId: v.union(v.id("users"), v.null()),
		customerSessionId: v.union(v.string(), v.null()),
		externalChatId: v.union(v.string(), v.null()),
		customerDisplayName: v.union(v.string(), v.null()),
		// Collected by the widget pre-chat form (web channel).
		customerEmail: v.optional(v.union(v.string(), v.null())),
		// Hostname of the page the widget was embedded on.
		sourceDomain: v.optional(v.union(v.string(), v.null())),
		agentUnreadCount: v.number(),
		isAiTyping: v.boolean(),
		lastMessageAt: v.number(),
		escalatedAt: v.union(v.number(), v.null()),
		closedAt: v.union(v.number(), v.null()),
		createdAt: v.number(),
	})
		.index("by_tenant_and_status", ["tenantId", "status"])
		.index("by_tenant_and_lastMessage", ["tenantId", "lastMessageAt"])
		.index("by_tenant_and_externalChatId", ["tenantId", "externalChatId"])
		.index("by_tenant_and_customerSession", ["tenantId", "customerSessionId"])
		.index("by_assignedTo", ["assignedToUserId"]),

	messages: defineTable({
		threadId: v.id("threads"),
		tenantId: v.id("tenants"),
		senderType: v.union(
			v.literal("customer"),
			v.literal("bot"),
			v.literal("agent"),
			v.literal("system"),
		),
		senderUserId: v.union(v.id("users"), v.null()),
		content: v.string(),
		deliveryStatus: v.union(
			v.literal("sent"),
			v.literal("delivered"),
			v.literal("failed"),
			v.null(),
		),
		readByAgent: v.boolean(),
		metadata: v.union(
			v.object({
				escalationReason: v.optional(v.string()),
			}),
			v.null(),
		),
		createdAt: v.number(),
	})
		.index("by_thread", ["threadId"])
		.index("by_tenant", ["tenantId"]),

	documents: defineTable({
		tenantId: v.id("tenants"),
		storageId: v.id("_storage"),
		name: v.string(),
		mimeType: v.string(),
		sizeBytes: v.number(),
		status: v.union(
			v.literal("processing"),
			v.literal("ready"),
			v.literal("failed"),
		),
		chunkCount: v.number(),
		errorMessage: v.union(v.string(), v.null()),
		uploadedByUserId: v.id("users"),
		createdAt: v.number(),
		// When the current processing attempt started — used to detect
		// documents orphaned in "processing" by a crashed action.
		processingStartedAt: v.optional(v.number()),
	}).index("by_tenant", ["tenantId"]),

	documentChunks: defineTable({
		tenantId: v.id("tenants"),
		documentId: v.id("documents"),
		chunkIndex: v.number(),
		text: v.string(),
		embedding: v.array(v.float64()),
	})
		.vectorIndex("by_embedding", {
			vectorField: "embedding",
			dimensions: 3072,
			filterFields: ["tenantId"],
		})
		.index("by_document", ["documentId"]),

	integrations: defineTable({
		tenantId: v.id("tenants"),
		type: v.union(v.literal("waha"), v.literal("widget")),
		status: v.union(
			v.literal("disconnected"),
			v.literal("connecting"),
			v.literal("connected"),
			v.literal("error"),
		),
		lastSyncAt: v.union(v.number(), v.null()),
		config: v.any(),
	}).index("by_tenant_and_type", ["tenantId", "type"]),

	auditLogs: defineTable({
		tenantId: v.id("tenants"),
		userId: v.union(v.id("users"), v.null()),
		action: v.string(),
		metadata: v.any(),
		createdAt: v.number(),
	}).index("by_tenant", ["tenantId"]),

	customerSessions: defineTable({
		tenantId: v.id("tenants"),
		sessionId: v.string(),
		expiresAt: v.number(),
		createdAt: v.number(),
	}).index("by_sessionId", ["sessionId"]),

	presence: defineTable({
		tenantId: v.id("tenants"),
		userId: v.id("users"),
		lastHeartbeatAt: v.number(),
	})
		.index("by_tenant", ["tenantId"])
		.index("by_user", ["userId"]),
});

export const defaultTenantSettings = {
	escalationKeywords: ["talk to human", "agent", "representative"],
	allowedDomains: [] as string[],
	widgetPosition: "bottom-right" as const,
};
