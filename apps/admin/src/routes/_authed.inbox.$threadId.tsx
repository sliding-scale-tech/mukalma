import { api } from "@mukalma/backend/convex/_generated/api";
import type { Id } from "@mukalma/backend/convex/_generated/dataModel";
import { Badge } from "@mukalma/ui/components/badge";
import { Button } from "@mukalma/ui/components/button";
import { ScrollArea } from "@mukalma/ui/components/scroll-area";
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
	ArrowLeft,
	CheckCircle2,
	Loader2,
	RotateCcw,
	Send,
	UserPlus,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { toast } from "sonner";

export default function InboxThreadPage() {
	const { threadId } = useParams();
	const navigate = useNavigate();
	const thread = useQuery(
		api.threads.getById,
		threadId ? { threadId: threadId as Id<"threads"> } : "skip",
	);
	const messages = useQuery(
		api.messages.listForThread,
		threadId ? { threadId: threadId as Id<"threads"> } : "skip",
	);
	const agents = useQuery(api.users.list);
	const markRead = useMutation(api.threads.markRead);
	const sendAgent = useMutation(api.messages.sendAgent);
	const assignToMe = useMutation(api.threads.assignToMe);
	const reassign = useMutation(api.threads.reassign);
	const closeThread = useMutation(api.threads.close);
	const reopenThread = useMutation(api.threads.reopen);

	const [input, setInput] = useState("");
	const [sending, setSending] = useState(false);
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
		return <Skeleton className="h-96 w-full" />;
	}

	if (!thread) {
		return (
			<div className="py-16 text-center">
				<p className="text-muted-foreground">Thread not found.</p>
				<Button
					variant="ghost"
					className="mt-4"
					onClick={() => navigate("/inbox")}
				>
					<ArrowLeft className="mr-2 h-4 w-4" />
					Back to inbox
				</Button>
			</div>
		);
	}

	const isClosed = thread.status === "closed";

	return (
		<div className="flex h-[calc(100vh-8rem)] flex-col">
			{/* Header */}
			<div className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
				<div className="flex items-center gap-3">
					<Button
						variant="ghost"
						size="icon"
						onClick={() => navigate("/inbox")}
					>
						<ArrowLeft className="h-4 w-4" />
					</Button>
					<div>
						<div className="flex flex-wrap items-center gap-2">
							<h2 className="font-semibold text-lg">
								{thread.customerDisplayName ?? "Customer"}
							</h2>
							<Badge
								variant={
									thread.status === "open"
										? "default"
										: thread.status === "escalated"
											? "destructive"
											: "secondary"
								}
							>
								{thread.status}
							</Badge>
							<Badge variant="outline">{thread.channel}</Badge>
						</div>
						{thread.assignedAgentName && (
							<p className="text-muted-foreground text-sm">
								Assigned to {thread.assignedAgentName}
							</p>
						)}
					</div>
				</div>

				<div className="flex flex-wrap items-center gap-2">
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
									<SelectTrigger className="w-[160px]">
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
			<ScrollArea className="flex-1 px-2">
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
						<div className="flex items-center gap-2 px-3 py-2">
							<Loader2 className="h-4 w-4 animate-spin" />
							<span className="text-muted-foreground text-xs">
								AI is typing...
							</span>
						</div>
					)}
					<div ref={bottomRef} />
				</div>
			</ScrollArea>

			{/* Reply input — available for open AND escalated threads */}
			{!isClosed && (
				<div className="border-t pt-4">
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
							className="max-h-32 min-h-[60px] resize-none"
							disabled={sending}
						/>
						<Button
							size="icon"
							className="h-[60px] w-[60px]"
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
