import { api } from "@mukalma/backend/convex/_generated/api";
import { Skeleton } from "@mukalma/ui/components/skeleton";
import { usePaginatedQuery, useQuery } from "convex/react";
import { Globe, Inbox, Loader2, MessageCircle } from "lucide-react";
import { useState } from "react";
import { Outlet, useMatch, useNavigate } from "react-router";

type StatusFilter = "all" | "open" | "escalated" | "closed";

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

const statusBorderColor = {
	open: "border-l-emerald-500",
	escalated: "border-l-yellow-500",
	closed: "border-l-zinc-600",
} as const;

const statusBadgeStyle = {
	open: "bg-emerald-500/12 text-emerald-400",
	escalated: "bg-yellow-500/12 text-yellow-400",
	closed: "bg-zinc-500/12 text-zinc-400",
} as const;

const INBOX_PAGE_SIZE = 20;

export default function InboxPage() {
	const match = useMatch("/inbox/:threadId");
	const selectedId = match?.params.threadId;
	const navigate = useNavigate();
	const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
	const current = useQuery(api.tenants.getCurrent);
	const filterArgs = statusFilter === "all" ? {} : { status: statusFilter };

	// Cursor-paginated read threads (newest activity first). Loading more
	// appends via a stable Convex cursor — no offset drift, no list remount.
	const {
		results: pagedThreads,
		status: pageStatus,
		loadMore,
	} = usePaginatedQuery(
		api.threads.listForInbox,
		current?.tenant ? filterArgs : "skip",
		{ initialNumItems: INBOX_PAGE_SIZE },
	);

	// Unread threads are pinned on top, outside the cursor's ordering.
	const unread = useQuery(
		api.threads.listUnreadForInbox,
		current?.tenant ? filterArgs : "skip",
	);

	const unreadIds = new Set((unread ?? []).map((t) => t._id));
	const threads =
		unread === undefined && pageStatus === "LoadingFirstPage"
			? undefined
			: [
					...(unread ?? []),
					...pagedThreads.filter((t) => !unreadIds.has(t._id)),
				];

	const stats = useQuery(api.dashboard.getStats, current?.tenant ? {} : "skip");
	const openCount =
		stats !== undefined ? stats.open + stats.escalated : undefined;

	const handleFilterChange = (filter: StatusFilter) => {
		setStatusFilter(filter);
	};

	return (
		<div className="flex flex-1 overflow-hidden">
			{/* Thread list */}
			<div className="flex w-80 min-w-80 flex-col border-r bg-sidebar">
				<div className="border-b p-4">
					<div className="mb-3 flex items-center justify-between">
						<h2 className="font-semibold text-base tracking-tight">Inbox</h2>
						{openCount !== undefined && openCount > 0 && (
							<span className="rounded-full bg-primary/15 px-2 py-0.5 font-semibold text-primary text-xs">
								{openCount} open
							</span>
						)}
					</div>
					{/* Status filter tabs */}
					<div className="flex gap-1">
						{(
							[
								{ value: "all", label: "All" },
								{ value: "open", label: "Open" },
								{ value: "escalated", label: "Escalated" },
								{ value: "closed", label: "Closed" },
							] as const
						).map((f) => (
							<button
								key={f.value}
								type="button"
								onClick={() => handleFilterChange(f.value)}
								className={`rounded-md px-2.5 py-1 font-medium text-xs transition-colors ${
									statusFilter === f.value
										? "bg-accent text-foreground"
										: "text-muted-foreground hover:bg-accent/60"
								}`}
							>
								{f.label}
							</button>
						))}
					</div>
				</div>

				<div className="flex-1 overflow-y-auto">
					{threads === undefined ? (
						<div className="space-y-2 p-3">
							{Array.from({ length: 5 }).map((_, i) => (
								<Skeleton key={`skel-${i}`} className="h-16 w-full" />
							))}
						</div>
					) : threads.length === 0 ? (
						<div className="flex flex-col items-center justify-center py-16 text-center">
							<Inbox className="mb-2 h-8 w-8 text-muted-foreground/40" />
							<p className="text-muted-foreground text-sm">No conversations.</p>
						</div>
					) : (
						<>
							{threads.map((thread) => {
								const isSelected = thread._id === selectedId;
								const border =
									statusBorderColor[
										thread.status as keyof typeof statusBorderColor
									] ?? "border-l-zinc-600";
								return (
									<button
										key={thread._id}
										type="button"
										onClick={() => navigate(`/inbox/${thread._id}`)}
										className={`flex w-full gap-3 border-border/30 border-b border-l-2 p-3.5 text-left transition-colors ${border} ${
											isSelected ? "bg-accent" : "hover:bg-accent/50"
										}`}
									>
										<div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent font-semibold text-muted-foreground text-xs">
											{(thread.customerDisplayName ?? "?")[0].toUpperCase()}
										</div>
										<div className="min-w-0 flex-1">
											<div className="flex items-center justify-between gap-2">
												<span
													className={`truncate text-sm ${isSelected || (thread.agentUnreadCount > 0) ? "font-semibold" : "font-medium"}`}
												>
													{thread.customerDisplayName ??
														thread.customerSessionId ??
														"Customer"}
												</span>
												<span className="shrink-0 text-muted-foreground/60 text-xs">
													{formatRelative(thread.lastMessageAt)}
												</span>
											</div>
											{thread.sourceDomain && (
												<p className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-muted-foreground/70">
													<Globe className="h-2.5 w-2.5 shrink-0" />
													{thread.sourceDomain}
												</p>
											)}
											<div className="mt-0.5 flex items-center gap-1.5">
												<p className="flex-1 truncate text-muted-foreground text-xs">
													{thread.lastMessagePreview ?? "No messages yet"}
												</p>
												{thread.agentUnreadCount > 0 && (
													<span className="inline-flex min-w-[16px] items-center justify-center rounded-full bg-primary px-1 py-0.5 font-bold text-[10px] text-primary-foreground">
														{thread.agentUnreadCount}
													</span>
												)}
											</div>
										</div>
									</button>
								);
							})}
							{pageStatus === "CanLoadMore" && (
								<button
									type="button"
									onClick={() => loadMore(INBOX_PAGE_SIZE)}
									className="w-full py-3 text-center font-medium text-muted-foreground text-xs transition-colors hover:bg-accent/50 hover:text-foreground"
								>
									Load more conversations
								</button>
							)}
							{pageStatus === "LoadingMore" && (
								<div className="flex items-center justify-center py-3">
									<Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
								</div>
							)}
						</>
					)}
				</div>
			</div>

			{/* Thread detail */}
			<div className="flex flex-1 flex-col overflow-hidden">
				{selectedId ? (
					<Outlet />
				) : (
					<div className="flex flex-1 flex-col items-center justify-center gap-3">
						<MessageCircle className="h-10 w-10 text-muted-foreground/30" />
						<p className="text-muted-foreground text-sm">
							Select a conversation to view
						</p>
					</div>
				)}
			</div>
		</div>
	);
}
