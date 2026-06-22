import { cn } from "@mukalma/ui/lib/utils";
import { Bot, Headset } from "lucide-react";

export type ChatMessage = {
	_id: string;
	senderType: "customer" | "bot" | "agent" | "system";
	content: string;
	createdAt: number;
};

function formatTime(ts: number): string {
	return new Date(ts).toLocaleTimeString([], {
		hour: "2-digit",
		minute: "2-digit",
	});
}

export function ChatMessageBubble({
	message,
	displayText,
	isAnimating,
}: {
	message: ChatMessage;
	displayText?: string;
	isAnimating?: boolean;
}) {
	if (message.senderType === "system") {
		return (
			<div className="flex justify-center py-1">
				<span className="rounded-full bg-zinc-800 px-3 py-1 text-xs text-zinc-400">
					{message.content}
				</span>
			</div>
		);
	}

	const isCustomer = message.senderType === "customer";
	const text = displayText ?? message.content;

	return (
		<div
			className={cn(
				"flex items-end gap-2.5 px-1",
				isCustomer ? "flex-row-reverse" : "flex-row",
			)}
		>
			{!isCustomer && (
				<div className="mb-5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-600">
					{message.senderType === "bot" ? (
						<Bot className="h-3.5 w-3.5 text-white" />
					) : (
						<Headset className="h-3.5 w-3.5 text-white" />
					)}
				</div>
			)}

			<div
				className={cn(
					"flex max-w-[78%] flex-col gap-1",
					isCustomer ? "items-end" : "items-start",
				)}
			>
				{!isCustomer && (
					<span className="px-1 font-medium text-[11px] text-zinc-500">
						{message.senderType === "bot" ? "AI Assistant" : "Support Agent"}
					</span>
				)}
				<div
					className={cn(
						"rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
						isCustomer
							? "rounded-tr-sm bg-violet-600 text-white"
							: "rounded-tl-sm bg-zinc-800 text-zinc-100",
					)}
				>
					{text.split("\n").map((line, i) => (
						<p key={`${message._id}-${i}`} className={i > 0 ? "mt-1" : ""}>
							{line || " "}
						</p>
					))}
					{isAnimating && (
						<span className="ml-0.5 inline-block h-3.5 w-0.5 animate-pulse bg-current align-middle opacity-70" />
					)}
				</div>
				<span className="px-1 text-[11px] text-zinc-600">
					{formatTime(message.createdAt)}
				</span>
			</div>
		</div>
	);
}
