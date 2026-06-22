import { Button } from "@mukalma/ui/components/button";
import { Textarea } from "@mukalma/ui/components/textarea";
import { cn } from "@mukalma/ui/lib/utils";
import { Bot, Send, UserRound, X } from "lucide-react";
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

function WelcomeMessage({ tenantName }: { tenantName: string }) {
	return (
		<div className="flex items-end gap-2.5 px-1">
			<div className="mb-5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-600">
				<Bot className="h-3.5 w-3.5 text-white" />
			</div>
			<div className="flex max-w-[78%] flex-col items-start gap-1">
				<span className="px-1 font-medium text-[11px] text-zinc-500">
					AI Assistant
				</span>
				<div className="rounded-2xl rounded-tl-sm bg-zinc-800 px-4 py-2.5 text-sm text-zinc-100 leading-relaxed">
					<p>
						👋 Hi there! I&apos;m the AI assistant for{" "}
						<strong className="text-white">{tenantName}</strong>.
					</p>
					<p className="mt-1">How can I help you today?</p>
				</div>
				<span className="px-1 text-[11px] text-zinc-600">Just now</span>
			</div>
		</div>
	);
}

function TypingIndicator() {
	return (
		<div className="flex items-end gap-2.5 px-1">
			<div className="mb-5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-600">
				<Bot className="h-3.5 w-3.5 text-white" />
			</div>
			<div className="flex flex-col items-start gap-1">
				<span className="px-1 font-medium text-[11px] text-zinc-500">
					AI Assistant
				</span>
				<div className="rounded-2xl rounded-tl-sm bg-zinc-800 px-4 py-3">
					<div className="flex items-center gap-1.5">
						<span
							className="h-2 w-2 animate-bounce rounded-full bg-zinc-400"
							style={{ animationDelay: "0ms", animationDuration: "900ms" }}
						/>
						<span
							className="h-2 w-2 animate-bounce rounded-full bg-zinc-400"
							style={{ animationDelay: "150ms", animationDuration: "900ms" }}
						/>
						<span
							className="h-2 w-2 animate-bounce rounded-full bg-zinc-400"
							style={{ animationDelay: "300ms", animationDuration: "900ms" }}
						/>
					</div>
				</div>
			</div>
		</div>
	);
}

function charDelayMs(contentLength: number): number {
	return Math.min(20, 4000 / Math.max(contentLength, 1));
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

	const animatedIds = useRef<Set<string>>(new Set());
	const [streamingText, setStreamingText] = useState<Map<string, string>>(
		new Map(),
	);
	const hasInitialized = useRef(false);

	useEffect(() => {
		if (hasInitialized.current || messages.length === 0) return;
		hasInitialized.current = true;
		for (const msg of messages) {
			animatedIds.current.add(msg._id);
		}
	}, [messages]);

	useEffect(() => {
		if (!hasInitialized.current) return;
		const lastBot = [...messages].reverse().find((m) => m.senderType === "bot");
		if (!lastBot || animatedIds.current.has(lastBot._id)) return;

		animatedIds.current.add(lastBot._id);
		const { _id, content } = lastBot;
		const delay = charDelayMs(content.length);
		let idx = 1;

		setStreamingText((prev) => new Map(prev).set(_id, content.slice(0, 1)));

		const timer = setInterval(() => {
			idx++;
			if (idx >= content.length) {
				clearInterval(timer);
				setStreamingText((prev) => {
					const next = new Map(prev);
					next.delete(_id);
					return next;
				});
			} else {
				setStreamingText((prev) =>
					new Map(prev).set(_id, content.slice(0, idx)),
				);
			}
		}, delay);

		return () => clearInterval(timer);
	}, [messages]);

	useEffect(() => {
		bottomRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [messages, isAiTyping, streamingText]);

	const handleSend = async () => {
		const trimmed = input.trim();
		if (!trimmed || sending || isAiTyping) return;
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

	const handleClose = () => {
		window.parent.postMessage({ type: "mukalma:close" }, "*");
	};

	const isClosed = threadStatus === "closed";
	const isBlocked = isAiTyping || sending;

	const headerSubtitle =
		threadStatus === "escalated"
			? "Connected to support agent"
			: threadStatus === "closed"
				? "Conversation ended"
				: "Typically replies instantly";

	return (
		<div
			className={cn(
				"flex min-h-0 flex-col bg-zinc-950",
				isEmbed ? "h-full" : "mx-auto h-dvh max-w-lg",
			)}
		>
			{/* ── Header ── */}
			<div className="flex shrink-0 items-center gap-3 border-zinc-800/60 border-b bg-zinc-900 px-4 py-3">
				<div className="relative shrink-0">
					<div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-violet-600">
						{tenant.logoUrl ? (
							<img
								src={tenant.logoUrl}
								alt={tenant.name}
								className="h-10 w-10 object-cover"
							/>
						) : (
							<Bot className="h-5 w-5 text-white" />
						)}
					</div>
					<span
						className={cn(
							"absolute right-0 bottom-0 h-3 w-3 rounded-full ring-2 ring-zinc-900",
							threadStatus === "closed" ? "bg-zinc-500" : "bg-emerald-500",
						)}
					/>
				</div>

				<div className="min-w-0 flex-1">
					<p className="truncate font-semibold text-sm text-white">
						{tenant.name}
					</p>
					<p className="truncate text-xs text-zinc-400">{headerSubtitle}</p>
				</div>

				{isEmbed && (
					<button
						type="button"
						onClick={handleClose}
						aria-label="Close chat"
						className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
					>
						<X className="h-4 w-4" />
					</button>
				)}
			</div>

			{/* ── Messages — flex-1 min-h-0 so it fills remaining space and scrolls ── */}
			<div className="min-h-0 flex-1 overflow-y-auto">
				<div className="space-y-4 px-4 py-5">
					<WelcomeMessage tenantName={tenant.name} />

					{messages.map((msg) => (
						<ChatMessageBubble
							key={msg._id}
							message={msg}
							displayText={streamingText.get(msg._id)}
							isAnimating={streamingText.has(msg._id)}
						/>
					))}

					{isAiTyping && <TypingIndicator />}
					<div ref={bottomRef} />
				</div>
			</div>

			{/* ── Footer ── */}
			<div className="shrink-0 border-zinc-800/60 border-t bg-zinc-900 p-3">
				{isClosed ? (
					<div className="flex flex-col items-center gap-3 py-2">
						<p className="text-sm text-zinc-400">
							This conversation has ended.
						</p>
						<Button
							size="sm"
							onClick={onStartNewConversation}
							className="bg-violet-600 text-white hover:bg-violet-700"
						>
							Start new conversation
						</Button>
					</div>
				) : (
					<div className="space-y-2">
						<div className="flex items-end gap-2">
							<Textarea
								placeholder={isAiTyping ? "AI is thinking…" : "Type a message…"}
								value={input}
								onChange={(e) => setInput(e.target.value)}
								onKeyDown={handleKeyDown}
								rows={1}
								disabled={isBlocked}
								className="max-h-28 min-h-[40px] resize-none border-zinc-700 bg-zinc-800 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
							/>
							<Button
								size="icon"
								onClick={handleSend}
								disabled={isBlocked || !input.trim()}
								className="shrink-0 bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-40"
							>
								<Send className="h-4 w-4" />
							</Button>
						</div>

						{aiEnabled && threadStatus === "open" && (
							<button
								type="button"
								onClick={onRequestEscalation}
								className="flex w-full items-center justify-center gap-1.5 py-0.5 text-xs text-zinc-600 transition-colors hover:text-zinc-400"
							>
								<UserRound className="h-3 w-3" />
								Talk to a human
							</button>
						)}
					</div>
				)}
			</div>
		</div>
	);
}
