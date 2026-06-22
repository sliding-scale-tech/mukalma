import { api } from "@mukalma/backend/convex/_generated/api";
import { Badge } from "@mukalma/ui/components/badge";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@mukalma/ui/components/select";
import { Skeleton } from "@mukalma/ui/components/skeleton";
import { useQuery } from "convex/react";
import { Clock, Inbox, MessageCircle } from "lucide-react";
import { useState } from "react";
import { Outlet, useMatch, useNavigate } from "react-router";

type StatusFilter = "all" | "open" | "escalated" | "closed";
type ChannelFilter = "all" | "web" | "whatsapp";
type AssignFilter = "all" | "me" | "unassigned";

function formatRelative(ts: number): string {
	const diff = Date.now() - ts;
	const mins = Math.floor(diff / 60_000);
	if (mins < 1) return "just now";
	if (mins < 60) return `${mins}m ago`;
	const hrs = Math.floor(mins / 60);
	if (hrs < 24) return `${hrs}h ago`;
	const days = Math.floor(hrs / 24);
	return `${days}d ago`;
}

const statusColors = {
	open: "default",
	escalated: "destructive",
	closed: "secondary",
} as const;

export default function InboxPage() {
	const onThread = useMatch("/inbox/:threadId");
	const navigate = useNavigate();
	const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
	const [channelFilter, setChannelFilter] = useState<ChannelFilter>("all");
	const [assignFilter, setAssignFilter] = useState<AssignFilter>("all");

	// All hooks must run unconditionally — skip the query when viewing a thread
	const threads = useQuery(
		api.threads.listForInbox,
		onThread
			? "skip"
			: {
					status: statusFilter === "all" ? undefined : statusFilter,
					channel: channelFilter === "all" ? undefined : channelFilter,
					assignedToUserId:
						assignFilter === "all"
							? undefined
							: (assignFilter as "me" | "unassigned"),
				},
	);

	// When a thread is selected, render the child route instead of the list
	if (onThread) {
		return <Outlet />;
	}

	return (
		<div className="space-y-6">
			<div>
				<h1 className="font-semibold text-2xl tracking-tight">Inbox</h1>
				<p className="text-muted-foreground">
					Support conversations from all channels.
				</p>
			</div>

			<div className="flex flex-wrap gap-3">
				<Select
					value={statusFilter}
					onValueChange={(v) => setStatusFilter(v as StatusFilter)}
				>
					<SelectTrigger className="w-[140px]">
						<SelectValue placeholder="Status" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All statuses</SelectItem>
						<SelectItem value="open">Open</SelectItem>
						<SelectItem value="escalated">Escalated</SelectItem>
						<SelectItem value="closed">Closed</SelectItem>
					</SelectContent>
				</Select>

				<Select
					value={channelFilter}
					onValueChange={(v) => setChannelFilter(v as ChannelFilter)}
				>
					<SelectTrigger className="w-[140px]">
						<SelectValue placeholder="Channel" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All channels</SelectItem>
						<SelectItem value="web">Web</SelectItem>
						<SelectItem value="whatsapp">WhatsApp</SelectItem>
					</SelectContent>
				</Select>

				<Select
					value={assignFilter}
					onValueChange={(v) => setAssignFilter(v as AssignFilter)}
				>
					<SelectTrigger className="w-[140px]">
						<SelectValue placeholder="Assigned" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All</SelectItem>
						<SelectItem value="me">Assigned to me</SelectItem>
						<SelectItem value="unassigned">Unassigned</SelectItem>
					</SelectContent>
				</Select>
			</div>

			{threads === undefined ? (
				<div className="space-y-3">
					{Array.from({ length: 5 }).map((_, i) => (
						<Skeleton key={`skel-${i}`} className="h-20 w-full" />
					))}
				</div>
			) : threads.length === 0 ? (
				<div className="flex flex-col items-center justify-center py-16 text-center">
					<Inbox className="mb-3 h-10 w-10 text-muted-foreground" />
					<p className="text-muted-foreground">No conversations found.</p>
				</div>
			) : (
				<div className="space-y-2">
					{threads.map((thread) => (
						<button
							key={thread._id}
							type="button"
							onClick={() => navigate(`/inbox/${thread._id}`)}
							className="flex w-full items-start gap-4 rounded-lg border p-4 text-left transition-colors hover:bg-muted/50"
						>
							<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted">
								<MessageCircle className="h-5 w-5 text-muted-foreground" />
							</div>
							<div className="min-w-0 flex-1">
								<div className="flex flex-wrap items-center gap-2">
									<span className="truncate font-medium text-sm">
										{thread.customerDisplayName ??
											thread.customerSessionId ??
											"Customer"}
									</span>
									<Badge
										variant={statusColors[thread.status]}
										className="text-xs"
									>
										{thread.status}
									</Badge>
									<Badge variant="outline" className="text-xs">
										{thread.channel}
									</Badge>
									{thread.agentUnreadCount > 0 && (
										<Badge variant="destructive" className="text-xs">
											{thread.agentUnreadCount}
										</Badge>
									)}
								</div>
								<p className="mt-1 truncate text-muted-foreground text-sm">
									{thread.lastMessagePreview ?? "No messages yet"}
								</p>
								<div className="mt-1 flex items-center gap-3 text-muted-foreground text-xs">
									<span className="flex items-center gap-1">
										<Clock className="h-3 w-3" />
										{formatRelative(thread.lastMessageAt)}
									</span>
									{thread.assignedAgentName && (
										<span>Assigned to {thread.assignedAgentName}</span>
									)}
								</div>
							</div>
						</button>
					))}
				</div>
			)}
		</div>
	);
}
