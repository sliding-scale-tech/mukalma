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

export type ChatWidgetTheme = {
	primaryColor?: string;
	mode?: "light" | "dark" | "auto";
};

type ChatWidgetProps = {
	tenant: ChatWidgetTenant;
	theme?: ChatWidgetTheme;
	messages: ChatMessage[];
	threadStatus: "open" | "escalated" | "closed" | null;
	aiEnabled: boolean;
	isAiTyping: boolean;
	onSendMessage: (content: string) => void;
	onRequestEscalation: () => void;
	onStartNewConversation: () => void;
	isEmbed?: boolean;
};

function useSystemDark() {
	const [dark, setDark] = useState(
		() =>
			typeof window !== "undefined" &&
			window.matchMedia("(prefers-color-scheme: dark)").matches,
	);
	useEffect(() => {
		const mq = window.matchMedia("(prefers-color-scheme: dark)");
		const handler = (e: MediaQueryListEvent) => setDark(e.matches);
		mq.addEventListener("change", handler);
		return () => mq.removeEventListener("change", handler);
	}, []);
	return dark;
}

function resolveTheme(theme: ChatWidgetTheme | undefined, systemDark: boolean) {
	const primary = theme?.primaryColor ?? "#7c3aed";
	const mode = theme?.mode ?? "auto";
	const isDark =
		mode === "dark" || (mode === "auto" && systemDark) || mode === undefined;

	return {
		primary,
		isDark,
		vars: {
			"--wp": primary,
			"--wbg": isDark ? "#09090b" : "#ffffff",
			"--wsurf": isDark ? "#18181b" : "#f9fafb",
			"--wborder": isDark ? "rgba(39,39,42,0.7)" : "#e5e7eb",
			"--wtext": isDark ? "#fafafa" : "#09090b",
			"--wmuted": isDark ? "#a1a1aa" : "#6b7280",
			"--wsub": isDark ? "#52525b" : "#9ca3af",
			"--winput": isDark ? "#27272a" : "#f3f4f6",
			"--winput-border": isDark ? "#3f3f46" : "#d1d5db",
			"--wbot-bubble": isDark ? "#27272a" : "#f3f4f6",
			"--wbot-text": isDark ? "#fafafa" : "#09090b",
		} as React.CSSProperties,
	};
}

function BotAvatar({ primary }: { primary: string }) {
	return (
		<div
			className="mb-5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
			style={{ background: primary }}
		>
			<Bot className="h-3.5 w-3.5 text-white" />
		</div>
	);
}

function WelcomeMessage({
	tenantName,
	primary,
}: {
	tenantName: string;
	primary: string;
}) {
	return (
		<div className="flex items-end gap-2.5 px-1">
			<BotAvatar primary={primary} />
			<div className="flex max-w-[78%] flex-col items-start gap-1">
				<span
					className="px-1 font-medium text-[11px]"
					style={{ color: "var(--wmuted)" }}
				>
					AI Assistant
				</span>
				<div
					className="rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm leading-relaxed"
					style={{
						background: "var(--wbot-bubble)",
						color: "var(--wbot-text)",
					}}
				>
					<p>
						👋 Hi there! I&apos;m the AI assistant for{" "}
						<strong>{tenantName}</strong>.
					</p>
					<p className="mt-1">How can I help you today?</p>
				</div>
				<span className="px-1 text-[11px]" style={{ color: "var(--wsub)" }}>
					Just now
				</span>
			</div>
		</div>
	);
}

function TypingIndicator({ primary }: { primary: string }) {
	return (
		<div className="flex items-end gap-2.5 px-1">
			<BotAvatar primary={primary} />
			<div className="flex flex-col items-start gap-1">
				<span
					className="px-1 font-medium text-[11px]"
					style={{ color: "var(--wmuted)" }}
				>
					AI Assistant
				</span>
				<div
					className="rounded-2xl rounded-tl-sm px-4 py-3"
					style={{ background: "var(--wbot-bubble)" }}
				>
					<div className="flex items-center gap-1.5">
						{[0, 150, 300].map((delay) => (
							<span
								key={delay}
								className="h-2 w-2 animate-bounce rounded-full"
								style={{
									background: "var(--wmuted)",
									animationDelay: `${delay}ms`,
									animationDuration: "900ms",
								}}
							/>
						))}
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
	theme,
	messages,
	threadStatus,
	aiEnabled,
	isAiTyping,
	onSendMessage,
	onRequestEscalation,
	onStartNewConversation,
	isEmbed,
}: ChatWidgetProps) {
	const systemDark = useSystemDark();
	const { primary, vars } = resolveTheme(theme, systemDark);

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
				"flex min-h-0 flex-col",
				isEmbed ? "h-full" : "mx-auto h-dvh max-w-lg",
			)}
			style={{ background: "var(--wbg)", ...vars }}
		>
			{/* Header */}
			<div
				className="flex shrink-0 items-center gap-3 border-b px-4 py-3"
				style={{
					background: "var(--wsurf)",
					borderColor: "var(--wborder)",
				}}
			>
				<div className="relative shrink-0">
					<div
						className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full"
						style={{ background: primary }}
					>
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
						className="absolute right-0 bottom-0 h-3 w-3 rounded-full ring-2"
						style={{
							background:
								threadStatus === "closed" ? "var(--wmuted)" : "#10b981",
							ringColor: "var(--wsurf)",
						}}
					/>
				</div>

				<div className="min-w-0 flex-1">
					<p
						className="truncate font-semibold text-sm"
						style={{ color: "var(--wtext)" }}
					>
						{tenant.name}
					</p>
					<p className="truncate text-xs" style={{ color: "var(--wmuted)" }}>
						{headerSubtitle}
					</p>
				</div>

				{isEmbed && (
					<button
						type="button"
						onClick={handleClose}
						aria-label="Close chat"
						className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors"
						style={{ color: "var(--wmuted)" }}
					>
						<X className="h-4 w-4" />
					</button>
				)}
			</div>

			{/* Messages */}
			<div className="min-h-0 flex-1 overflow-y-auto">
				<div className="space-y-4 px-4 py-5">
					<WelcomeMessage tenantName={tenant.name} primary={primary} />

					{messages.map((msg) => (
						<ChatMessageBubble
							key={msg._id}
							message={msg}
							displayText={streamingText.get(msg._id)}
							isAnimating={streamingText.has(msg._id)}
							primaryColor={primary}
						/>
					))}

					{isAiTyping && <TypingIndicator primary={primary} />}
					<div ref={bottomRef} />
				</div>
			</div>

			{/* Footer */}
			<div
				className="shrink-0 border-t p-3"
				style={{
					background: "var(--wsurf)",
					borderColor: "var(--wborder)",
				}}
			>
				{isClosed ? (
					<div className="flex flex-col items-center gap-3 py-2">
						<p className="text-sm" style={{ color: "var(--wmuted)" }}>
							This conversation has ended.
						</p>
						<Button
							size="sm"
							onClick={onStartNewConversation}
							style={{ background: primary }}
							className="text-white hover:opacity-90"
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
								style={{
									background: "var(--winput)",
									borderColor: "var(--winput-border)",
									color: "var(--wtext)",
								}}
								className="max-h-28 min-h-[40px] resize-none placeholder:text-[var(--wmuted)] focus-visible:ring-1 disabled:cursor-not-allowed disabled:opacity-60"
							/>
							<Button
								size="icon"
								onClick={handleSend}
								disabled={isBlocked || !input.trim()}
								style={{ background: primary }}
								className="shrink-0 text-white hover:opacity-90 disabled:opacity-40"
							>
								<Send className="h-4 w-4" />
							</Button>
						</div>

						{aiEnabled && threadStatus === "open" && (
							<button
								type="button"
								onClick={onRequestEscalation}
								className="flex w-full items-center justify-center gap-1.5 py-0.5 text-xs transition-colors"
								style={{ color: "var(--wsub)" }}
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
