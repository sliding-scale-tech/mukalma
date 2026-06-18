import { api } from "@mukalma/backend/convex/_generated/api";
import { useMutation } from "convex/react";
import { useEffect } from "react";

const HEARTBEAT_INTERVAL_MS = 30_000;

export function usePresenceHeartbeat() {
	const heartbeat = useMutation(api.presence.heartbeat);

	useEffect(() => {
		heartbeat();
		const id = setInterval(() => heartbeat(), HEARTBEAT_INTERVAL_MS);
		return () => clearInterval(id);
	}, [heartbeat]);
}
