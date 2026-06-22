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
			setState({
				sessionId: stored.sessionId,
				token: stored.token,
				expiresAt: stored.expiresAt,
				tenantId: stored.tenantId as Id<"tenants">,
				isReady: true,
			});
			return;
		}

		createSession({ tenantSlug })
			.then((result) => {
				const session: StoredSession = {
					sessionId: result.sessionId,
					token: result.token,
					expiresAt: result.expiresAt,
					tenantId: result.tenantId,
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
