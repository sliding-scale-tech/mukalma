export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export const SESSION_STORAGE_KEYS = {
	sessionId: "mukalma_session_id",
	token: "mukalma_session_token",
	expiresAt: "mukalma_expires_at",
} as const;
