import { api } from "@mukalma/backend/convex/_generated/api";
import type { Id } from "@mukalma/backend/convex/_generated/dataModel";
import { Skeleton } from "@mukalma/ui/components/skeleton";
import { ChatWidget } from "@mukalma/ui/composites/chat-widget";
import { useMutation, useQuery } from "convex/react";
import { useCallback, useEffect, useState } from "react";
import { useCustomerSession } from "../hooks/useCustomerSession";
import { getSlugFromSearchParams } from "../lib/slug";

export default function EmbedChatPage() {
	const [slug] = useState(() => getSlugFromSearchParams());
	const tenant = useQuery(
		api.tenants.getPublicBySlug,
		slug ? { slug } : "skip",
	);
	const session = useCustomerSession(slug);

	useEffect(() => {
		document.body.style.overflow = "hidden";
		document.body.style.margin = "0";
	}, []);

	if (!slug || tenant === null) {
		return null;
	}

	if (tenant === undefined || !session.isReady) {
		return (
			<div className="flex h-dvh items-center justify-center">
				<Skeleton className="h-64 w-full" />
			</div>
		);
	}

	return (
		<EmbedChat
			tenantName={tenant.name}
			tenantLogo={tenant.logoUrl}
			tenantId={session.tenantId}
			sessionId={session.sessionId}
		/>
	);
}

function EmbedChat({
	tenantName,
	tenantLogo,
	tenantId,
	sessionId,
}: {
	tenantName: string;
	tenantLogo: string | null;
	tenantId: Id<"tenants">;
	sessionId: string;
}) {
	const getOrCreate = useMutation(api.threads.getOrCreatePublic);
	const sendCustomer = useMutation(api.messages.sendCustomer);
	const requestEscalation = useMutation(api.threads.requestEscalationPublic);

	const [threadId, setThreadId] = useState<Id<"threads"> | null>(null);
	const [threadMeta, setThreadMeta] = useState<{
		status: "open" | "escalated" | "closed";
		aiEnabled: boolean;
		isAiTyping: boolean;
	} | null>(null);

	useEffect(() => {
		getOrCreate({ tenantId, sessionId }).then((result) => {
			setThreadId(result.threadId);
			setThreadMeta({
				status: result.status,
				aiEnabled: result.aiEnabled,
				isAiTyping: result.isAiTyping,
			});
		});
	}, [getOrCreate, tenantId, sessionId]);

	const messages = useQuery(
		api.messages.listPublic,
		threadId ? { tenantId, sessionId, threadId } : "skip",
	);

	const threadData = useQuery(
		api.threads.getPublicThread,
		threadId ? { tenantId, sessionId, threadId } : "skip",
	);

	const currentStatus = threadData?.status ?? threadMeta?.status ?? null;
	const currentAiEnabled =
		threadData?.aiEnabled ?? threadMeta?.aiEnabled ?? true;
	const currentIsAiTyping =
		threadData?.isAiTyping ?? threadMeta?.isAiTyping ?? false;

	const handleSend = useCallback(
		(content: string) => {
			if (!threadId) return;
			sendCustomer({ tenantId, sessionId, threadId, content });
		},
		[sendCustomer, tenantId, sessionId, threadId],
	);

	const handleEscalation = useCallback(() => {
		if (!threadId) return;
		requestEscalation({ tenantId, sessionId, threadId });
	}, [requestEscalation, tenantId, sessionId, threadId]);

	const handleNewConversation = useCallback(() => {
		setThreadId(null);
		setThreadMeta(null);
		getOrCreate({ tenantId, sessionId }).then((result) => {
			setThreadId(result.threadId);
			setThreadMeta({
				status: result.status,
				aiEnabled: result.aiEnabled,
				isAiTyping: result.isAiTyping,
			});
		});
	}, [getOrCreate, tenantId, sessionId]);

	if (!threadId || messages === undefined) {
		return (
			<div className="flex h-dvh items-center justify-center">
				<Skeleton className="h-64 w-full" />
			</div>
		);
	}

	return (
		<div className="h-dvh">
			<ChatWidget
				tenant={{ name: tenantName, logoUrl: tenantLogo }}
				messages={messages}
				threadStatus={currentStatus}
				aiEnabled={currentAiEnabled}
				isAiTyping={currentIsAiTyping}
				onSendMessage={handleSend}
				onRequestEscalation={handleEscalation}
				onStartNewConversation={handleNewConversation}
				isEmbed
			/>
		</div>
	);
}
