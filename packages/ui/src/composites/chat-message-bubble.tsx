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

export function ChatMessageBubble({ message }: { message: ChatMessage }) {
	if (message.senderType === "system") {
		return (
			<div className="flex justify-center py-2">
				<span className="text-muted-foreground text-xs italic">
					{message.content}
				</span>
			</div>
		);
	}

	const isCustomer = message.senderType === "customer";

	return (
		<div
			className={cn("flex gap-2", isCustomer ? "justify-end" : "justify-start")}
		>
			{!isCustomer && (
				<div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted">
					{message.senderType === "bot" ? (
						<Bot className="h-4 w-4" />
					) : (
						<Headset className="h-4 w-4" />
					)}
				</div>
			)}
			<div className="flex max-w-[75%] flex-col gap-1">
				{!isCustomer && (
					<span className="text-muted-foreground text-xs">
						{message.senderType === "bot" ? "AI Assistant" : "Support Agent"}
					</span>
				)}
				<div
					className={cn(
						"rounded-2xl px-3 py-2 text-sm",
						isCustomer
							? "rounded-br-sm bg-primary text-primary-foreground"
							: "rounded-bl-sm bg-muted",
					)}
				>
					{message.content.split("\n").map((line, i) => (
						<p key={`${message._id}-${i}`} className={i > 0 ? "mt-1" : ""}>
							{line}
						</p>
					))}
				</div>
				<span
					className={cn(
						"text-muted-foreground text-xs",
						isCustomer ? "text-right" : "text-left",
					)}
				>
					{formatTime(message.createdAt)}
				</span>
			</div>
		</div>
	);
}
