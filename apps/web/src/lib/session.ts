import { SESSION_STORAGE_KEYS } from "@mukalma/shared/constants/session";

export type StoredSession = {
	sessionId: string;
	token: string;
	expiresAt: number;
};

export function getStoredSession(): StoredSession | null {
	try {
		const sessionId = localStorage.getItem(SESSION_STORAGE_KEYS.sessionId);
		const token = localStorage.getItem(SESSION_STORAGE_KEYS.token);
		const expiresAtStr = localStorage.getItem(SESSION_STORAGE_KEYS.expiresAt);

		if (!sessionId || !token || !expiresAtStr) {
			return null;
		}

		const expiresAt = Number(expiresAtStr);
		if (Number.isNaN(expiresAt) || expiresAt < Date.now()) {
			clearSession();
			return null;
		}

		return { sessionId, token, expiresAt };
	} catch {
		return null;
	}
}

export function storeSession(session: StoredSession): void {
	localStorage.setItem(SESSION_STORAGE_KEYS.sessionId, session.sessionId);
	localStorage.setItem(SESSION_STORAGE_KEYS.token, session.token);
	localStorage.setItem(
		SESSION_STORAGE_KEYS.expiresAt,
		String(session.expiresAt),
	);
}

export function clearSession(): void {
	localStorage.removeItem(SESSION_STORAGE_KEYS.sessionId);
	localStorage.removeItem(SESSION_STORAGE_KEYS.token);
	localStorage.removeItem(SESSION_STORAGE_KEYS.expiresAt);
}
