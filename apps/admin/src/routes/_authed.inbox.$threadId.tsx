import { api } from "@mukalma/backend/convex/_generated/api";
import type { Id } from "@mukalma/backend/convex/_generated/dataModel";
import { Badge } from "@mukalma/ui/components/badge";
import { Button } from "@mukalma/ui/components/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@mukalma/ui/components/select";
import { Skeleton } from "@mukalma/ui/components/skeleton";
import { Textarea } from "@mukalma/ui/components/textarea";
import { ChatMessageBubble } from "@mukalma/ui/composites/chat-message-bubble";
import { useMutation, useQuery } from "convex/react";
import {
	Check,
	CheckCircle2,
	Globe,
	Loader2,
	Mail,
	Pencil,
	RotateCcw,
	Send,
	UserPlus,
	X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router";
import { toast } from "sonner";

const statusBadgeStyle = {
	open: "bg-emerald-500/12 text-emerald-400",
	escalated: "bg-yellow-500/12 text-yellow-400",
	closed: "bg-zinc-500/12 text-zinc-400",
} as const;

export default function InboxThreadPage() {
	const { threadId } = useParams();
	const thread = useQuery(
		api.threads.getById,
		threadId ? { threadId: threadId as Id<"threads"> } : "skip",
	);
	const messages = useQuery(
		api.messages.listForThread,
		threadId ? { threadId: threadId as Id<"threads"> } : "skip",
	);
	const agents = useQuery(api.users.list, threadId ? {} : "skip");
	const markRead = useMutation(api.threads.markRead);
	const sendAgent = useMutation(api.messages.sendAgent);
	const assignToMe = useMutation(api.threads.assignToMe);
	const reassign = useMutation(api.threads.reassign);
	const closeThread = useMutation(api.threads.close);
	const reopenThread = useMutation(api.threads.reopen);
	const renameThread = useMutation(api.threads.rename);

	const [input, setInput] = useState("");
	const [sending, setSending] = useState(false);
	const [editingName, setEditingName] = useState(false);
	const [nameInput, setNameInput] = useState("");
	const bottomRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (threadId && thread && thread.agentUnreadCount > 0) {
			markRead({ threadId: threadId as Id<"threads"> });
		}
	}, [threadId, thread, markRead]);

	useEffect(() => {
		bottomRef.current?.scrollIntoView();
	}, [messages]);

	const handleSend = useCallback(async () => {
		const trimmed = input.trim();
		if (!trimmed || sending || !threadId) return;
		setSending(true);
		setInput("");
		try {
			await sendAgent({
				threadId: threadId as Id<"threads">,
				content: trimmed,
			});
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Failed to send");
			setInput(trimmed);
		} finally {
			setSending(false);
		}
	}, [input, sending, threadId, sendAgent]);

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			handleSend();
		}
	};

	const handleAction = async (label: string, fn: () => Promise<unknown>) => {
		try {
			await fn();
			toast.success(label);
		} catch (err) {
			toast.error(err instanceof Error ? err.message : `${label} failed`);
		}
	};

	if (thread === undefined || messages === undefined) {
		return (
			<div className="flex flex-1 items-center justify-center">
				<Skeleton className="h-48 w-full max-w-md" />
			</div>
		);
	}

	if (!thread) {
		return (
			<div className="flex flex-1 flex-col items-center justify-center py-16 text-center">
				<p className="text-muted-foreground">Thread not found.</p>
			</div>
		);
	}

	const isClosed = thread.status === "closed";
	const badgeClass =
		statusBadgeStyle[thread.status as keyof typeof statusBadgeStyle] ??
		statusBadgeStyle.closed;

	const isWhatsApp = thread.channel === "whatsapp";
	// Only digits = a resolved real phone number; an unresolved @lid JID is
	// WhatsApp's anonymized ID and not worth showing as a "number".
	const realNumber =
		isWhatsApp && thread.externalChatId && /^\d+$/.test(thread.externalChatId)
			? `+${thread.externalChatId}`
			: null;
	// Only show the number separately when the display name is a nickname
	// (i.e. no longer the default "+<number>" we set on thread creation).
	const showRealNumber =
		realNumber !== null && thread.customerDisplayName !== realNumber;

	const startEditName = () => {
		setNameInput(thread.customerDisplayName ?? "");
		setEditingName(true);
	};

	const saveNickname = async () => {
		const trimmed = nameInput.trim();
		if (!trimmed) {
			setEditingName(false);
			return;
		}
		try {
			await renameThread({ threadId: thread._id, displayName: trimmed });
			toast.success("Name updated");
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Rename failed");
		} finally {
			setEditingName(false);
		}
	};

	return (
		<div className="flex h-full flex-col">
			{/* Header */}
			<div className="flex shrink-0 items-center justify-between border-b px-5 py-3">
				<div className="flex items-center gap-3">
					<div className="flex size-8 items-center justify-center rounded-full bg-accent font-semibold text-muted-foreground text-xs">
						{(thread.customerDisplayName ?? "?")[0].toUpperCase()}
					</div>
					<div>
						<div className="flex items-center gap-1.5">
							{editingName ? (
								<>
									<input
										value={nameInput}
										onChange={(e) => setNameInput(e.target.value)}
										onKeyDown={(e) => {
											if (e.key === "Enter") saveNickname();
											if (e.key === "Escape") setEditingName(false);
										}}
										// biome-ignore lint/a11y/noAutofocus: focus follows an explicit edit click
										autoFocus
										className="h-6 w-40 rounded border bg-background px-2 font-semibold text-sm outline-none focus:border-primary"
									/>
									<button
										type="button"
										onClick={saveNickname}
										aria-label="Save name"
										className="text-emerald-500 hover:text-emerald-400"
									>
										<Check className="h-3.5 w-3.5" />
									</button>
									<button
										type="button"
										onClick={() => setEditingName(false)}
										aria-label="Cancel"
										className="text-muted-foreground hover:text-foreground"
									>
										<X className="h-3.5 w-3.5" />
									</button>
								</>
							) : (
								<>
									<span className="font-semibold text-sm">
										{thread.customerDisplayName ?? "Customer"}
									</span>
									{showRealNumber && (
										<span className="text-muted-foreground text-xs">
											{realNumber}
										</span>
									)}
									{isWhatsApp && (
										<button
											type="button"
											onClick={startEditName}
											aria-label="Edit name"
											className="text-muted-foreground/60 transition-colors hover:text-foreground"
										>
											<Pencil className="h-3 w-3" />
										</button>
									)}
								</>
							)}
						</div>
						<div className="mt-0.5 flex flex-wrap items-center gap-1.5">
							<span
								className={`rounded-full px-2 py-0.5 font-medium text-xs ${badgeClass}`}
							>
								{thread.status}
							</span>
							<Badge variant="outline" className="text-xs capitalize">
								{thread.channel}
							</Badge>
							{thread.customerEmail && (
								<Badge variant="outline" className="gap-1 text-xs">
									<Mail className="h-2.5 w-2.5" />
									{thread.customerEmail}
								</Badge>
							)}
							{thread.sourceDomain && (
								<Badge variant="outline" className="gap-1 text-xs">
									<Globe className="h-2.5 w-2.5" />
									{thread.sourceDomain}
								</Badge>
							)}
						</div>
					</div>
				</div>

				<div className="flex items-center gap-2">
					{!isClosed && (
						<>
							<Button
								variant="outline"
								size="sm"
								onClick={() =>
									handleAction("Assigned to you", () =>
										assignToMe({ threadId: thread._id }),
									)
								}
							>
								<UserPlus className="mr-1 h-3 w-3" />
								Assign to me
							</Button>

							{agents && agents.length > 1 && (
								<Select
									onValueChange={(agentId) =>
										handleAction("Reassigned", () =>
											reassign({
												threadId: thread._id,
												agentId: agentId as Id<"users">,
											}),
										)
									}
								>
									<SelectTrigger className="h-8 w-[140px] text-xs">
										<SelectValue placeholder="Reassign..." />
									</SelectTrigger>
									<SelectContent>
										{agents.map((a) => (
											<SelectItem key={a._id} value={a._id}>
												{a.name ?? a.email}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							)}

							<Button
								variant="outline"
								size="sm"
								onClick={() =>
									handleAction("Thread closed", () =>
										closeThread({ threadId: thread._id }),
									)
								}
							>
								<CheckCircle2 className="mr-1 h-3 w-3" />
								Close
							</Button>
						</>
					)}

					{isClosed && (
						<Button
							variant="outline"
							size="sm"
							onClick={() =>
								handleAction("Thread reopened", () =>
									reopenThread({ threadId: thread._id }),
								)
							}
						>
							<RotateCcw className="mr-1 h-3 w-3" />
							Reopen
						</Button>
					)}
				</div>
			</div>

			{/* Messages */}
			<div className="min-h-0 flex-1 overflow-y-auto px-5">
				<div className="space-y-3 py-4">
					{messages.map((msg) => (
						<ChatMessageBubble
							key={msg._id}
							message={{
								_id: msg._id,
								senderType: msg.senderType,
								content: msg.content,
								createdAt: msg.createdAt,
							}}
						/>
					))}
					{thread.isAiTyping && (
						<div className="flex items-center gap-2 px-2 py-1">
							<Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
							<span className="text-muted-foreground text-xs">
								AI is typing…
							</span>
						</div>
					)}
					<div ref={bottomRef} />
				</div>
			</div>

			{/* Reply input */}
			{!isClosed && (
				<div className="shrink-0 border-t p-3.5">
					<div className="flex gap-2">
						<Textarea
							placeholder={
								thread.status === "escalated"
									? "Reply to customer..."
									: "Type a reply..."
							}
							value={input}
							onChange={(e) => setInput(e.target.value)}
							onKeyDown={handleKeyDown}
							rows={2}
							className="max-h-28 min-h-[52px] resize-none text-sm"
							disabled={sending}
						/>
						<Button
							size="icon"
							className="h-[52px] w-[52px] shrink-0"
							onClick={handleSend}
							disabled={!input.trim() || sending}
						>
							{sending ? (
								<Loader2 className="h-4 w-4 animate-spin" />
							) : (
								<Send className="h-4 w-4" />
							)}
						</Button>
					</div>
				</div>
			)}
		</div>
	);
}
