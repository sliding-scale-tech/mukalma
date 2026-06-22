import { Badge } from "@mukalma/ui/components/badge";
import { Button } from "@mukalma/ui/components/button";
import { ScrollArea } from "@mukalma/ui/components/scroll-area";
import { Textarea } from "@mukalma/ui/components/textarea";
import { cn } from "@mukalma/ui/lib/utils";
import { Loader2, MessageCircle, Send, UserRound } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { type ChatMessage, ChatMessageBubble } from "./chat-message-bubble";

export type ChatWidgetTenant = {
	name: string;
	logoUrl: string | null;
};

type ChatWidgetProps = {
	tenant: ChatWidgetTenant;
	messages: ChatMessage[];
	threadStatus: "open" | "escalated" | "closed" | null;
	aiEnabled: boolean;
	isAiTyping: boolean;
	onSendMessage: (content: string) => void;
	onRequestEscalation: () => void;
	onStartNewConversation: () => void;
	isEmbed?: boolean;
};

function TypingIndicator() {
	return (
		<div className="flex items-center gap-2 px-3 py-2">
			<div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted">
				<Loader2 className="h-4 w-4 animate-spin" />
			</div>
			<span className="text-muted-foreground text-xs">AI is typing…</span>
		</div>
	);
}

export function ChatWidget({
	tenant,
	messages,
	threadStatus,
	aiEnabled,
	isAiTyping,
	onSendMessage,
	onRequestEscalation,
	onStartNewConversation,
	isEmbed,
}: ChatWidgetProps) {
	const [input, setInput] = useState("");
	const [sending, setSending] = useState(false);
	const bottomRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		bottomRef.current?.scrollIntoView();
	}, [messages, isAiTyping]);

	const handleSend = async () => {
		const trimmed = input.trim();
		if (!trimmed || sending) return;
		setSending(true);
		setInput("");
		try {
			onSendMessage(trimmed);
		} finally {
			setSending(false);
		}
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			handleSend();
		}
	};

	const isClosed = threadStatus === "closed";

	return (
		<div
			className={cn(
				"flex flex-col bg-background",
				isEmbed ? "h-full" : "mx-auto h-dvh max-w-lg",
			)}
		>
			{/* Header */}
			<div className="border-b px-4 py-3">
				<div className="flex items-center gap-3">
					{tenant.logoUrl ? (
						<img
							src={tenant.logoUrl}
							alt={tenant.name}
							className="h-8 w-8 rounded-full object-cover"
						/>
					) : (
						<div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
							<MessageCircle className="h-4 w-4 text-primary" />
						</div>
					)}
					<div>
						<h2 className="font-semibold text-sm">{tenant.name}</h2>
						<p className="text-muted-foreground text-xs">
							{threadStatus === "escalated"
								? "Connected to support"
								: "AI-powered support"}
						</p>
					</div>
					{threadStatus && (
						<Badge
							variant={
								threadStatus === "open"
									? "default"
									: threadStatus === "escalated"
										? "secondary"
										: "outline"
							}
							className="ml-auto text-xs"
						>
							{threadStatus}
						</Badge>
					)}
				</div>
			</div>

			{/* Messages */}
			<ScrollArea className="flex-1 px-4">
				<div className="space-y-3 py-4">
					{messages.length === 0 && (
						<div className="flex flex-col items-center justify-center py-12 text-center">
							<MessageCircle className="mb-3 h-10 w-10 text-muted-foreground" />
							<p className="text-muted-foreground text-sm">
								Send a message to start the conversation
							</p>
						</div>
					)}
					{messages.map((msg) => (
						<ChatMessageBubble key={msg._id} message={msg} />
					))}
					{isAiTyping && <TypingIndicator />}
					<div ref={bottomRef} />
				</div>
			</ScrollArea>

			{/* Footer */}
			<div className="border-t p-3">
				{isClosed ? (
					<div className="flex flex-col items-center gap-2 py-2">
						<p className="text-muted-foreground text-sm">
							This conversation has ended.
						</p>
						<Button size="sm" onClick={onStartNewConversation}>
							Start new conversation
						</Button>
					</div>
				) : (
					<>
						{aiEnabled && threadStatus === "open" && (
							<Button
								variant="ghost"
								size="sm"
								className="mb-2 w-full"
								onClick={onRequestEscalation}
							>
								<UserRound className="mr-2 h-4 w-4" />
								Talk to a human
							</Button>
						)}
						<div className="flex gap-2">
							<Textarea
								placeholder="Type a message…"
								value={input}
								onChange={(e) => setInput(e.target.value)}
								onKeyDown={handleKeyDown}
								rows={1}
								className="max-h-24 min-h-[40px] resize-none"
								disabled={sending}
							/>
							<Button
								size="icon"
								onClick={handleSend}
								disabled={!input.trim() || sending}
							>
								<Send className="h-4 w-4" />
							</Button>
						</div>
					</>
				)}
			</div>
		</div>
	);
}
