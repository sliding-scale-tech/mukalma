import { api } from "@mukalma/backend/convex/_generated/api";
import type { Id } from "@mukalma/backend/convex/_generated/dataModel";
import { useAction } from "convex/react";
import { useEffect, useRef, useState } from "react";
import {
	clearSession,
	getStoredSession,
	type StoredSession,
	storeSession,
} from "../lib/session";

type SessionState =
	| {
			sessionId: string;
			token: string;
			expiresAt: number;
			tenantId: Id<"tenants">;
			isReady: true;
	  }
	| {
			isReady: false;
	  };

export function useCustomerSession(tenantSlug: string | null): SessionState {
	const [state, setState] = useState<SessionState>({ isReady: false });
	const createSession = useAction(api.sessions.createPublic);
	const initRef = useRef(false);

	useEffect(() => {
		if (!tenantSlug || initRef.current) return;
		initRef.current = true;

		const stored = getStoredSession();
		if (stored) {
			// We have a stored session — use it (tenantId will be fetched from the thread)
			// We don't store tenantId in localStorage, so we need to recreate if we don't have it
			// For simplicity, always create fresh if we can't validate
		}

		createSession({ tenantSlug })
			.then((result) => {
				const session: StoredSession = {
					sessionId: result.sessionId,
					token: result.token,
					expiresAt: result.expiresAt,
				};
				storeSession(session);
				setState({
					sessionId: result.sessionId,
					token: result.token,
					expiresAt: result.expiresAt,
					tenantId: result.tenantId,
					isReady: true,
				});
			})
			.catch(() => {
				clearSession();
			});
	}, [tenantSlug, createSession]);

	return state;
}

export function useSessionCredentials(session: SessionState) {
	if (!session.isReady) return null;
	return {
		tenantId: session.tenantId,
		sessionId: session.sessionId,
	};
}
