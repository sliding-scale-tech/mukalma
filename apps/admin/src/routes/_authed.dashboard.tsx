import { api } from "@mukalma/backend/convex/_generated/api";
import { Badge } from "@mukalma/ui/components/badge";
import { Button } from "@mukalma/ui/components/button";
import { Skeleton } from "@mukalma/ui/components/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@mukalma/ui/components/table";
import { useQuery } from "convex/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRef, useState } from "react";
import { useNavigate } from "react-router";

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

const statusStyle = {
	open: {
		badge: "bg-emerald-500/12 text-emerald-400 hover:bg-emerald-500/12",
		label: "Open",
	},
	escalated: {
		badge: "bg-yellow-500/12 text-yellow-400 hover:bg-yellow-500/12",
		label: "Escalated",
	},
	closed: {
		badge: "bg-zinc-500/12 text-zinc-400 hover:bg-zinc-500/12",
		label: "Closed",
	},
} as const;

export default function DashboardPage() {
	const current = useQuery(api.tenants.getCurrent);
	// Only fire once getCurrent has returned a real tenant — proves Convex has a valid JWT.
	const stats = useQuery(api.dashboard.getStats, current?.tenant ? {} : "skip");
	// Cursor stack: index = page number, value = cursor that loads that page
	// (null loads page 1). Prev pops, Next pushes the continue cursor.
	const [cursors, setCursors] = useState<(string | null)[]>([null]);
	const cursor = cursors[cursors.length - 1];
	const livePage = useQuery(
		api.dashboard.listActiveThreads,
		current?.tenant ? { cursor } : "skip",
	);
	// Keep showing the previous page while the next one loads so the table
	// doesn't flash a skeleton (and lose scroll) on every page change.
	const lastPage = useRef(livePage);
	if (livePage !== undefined) {
		lastPage.current = livePage;
	}
	const activePage = livePage ?? lastPage.current;
	const activeThreads = activePage?.threads;
	const navigate = useNavigate();

	const today = new Date().toLocaleDateString("en-US", {
		weekday: "long",
		month: "long",
		day: "numeric",
		year: "numeric",
	});

	if (current === undefined || stats === undefined) {
		return (
			<div className="flex-1 overflow-y-auto">
				<div className="max-w-6xl space-y-6 p-6 md:p-8">
					<Skeleton className="h-8 w-48" />
					<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
						{Array.from({ length: 4 }).map((_, i) => (
							<Skeleton key={`stat-${i}`} className="h-28" />
						))}
					</div>
					<Skeleton className="h-64 w-full" />
				</div>
			</div>
		);
	}

	const statCards = [
		{
			label: "Total Today",
			value: stats.createdToday,
			sub: "conversations",
			valueClass: "text-foreground",
		},
		{
			label: "Open",
			value: stats.open,
			sub: "AI handling",
			valueClass: "text-emerald-400",
		},
		{
			label: "Escalated",
			value: stats.escalated,
			sub: "needs human",
			valueClass: "text-yellow-400",
		},
		{
			label: "Closed",
			value: stats.closedToday,
			sub: "resolved today",
			valueClass: "text-foreground",
		},
	];

	return (
		<div className="flex-1 overflow-y-auto">
			<div className="max-w-6xl space-y-6 p-6 md:p-8">
				{/* Page header */}
				<div className="flex items-center justify-between">
					<div>
						<h1 className="font-semibold text-2xl tracking-tight">Dashboard</h1>
						<p className="mt-0.5 text-muted-foreground text-sm">{today}</p>
					</div>
					<div className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1">
						<span className="size-1.5 rounded-full bg-emerald-500" />
						<span className="font-medium text-emerald-500 text-xs">Live</span>
					</div>
				</div>

				{/* Stat cards */}
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
					{statCards.map((card) => (
						<div key={card.label} className="rounded-xl border bg-card p-5">
							<p className="font-semibold text-muted-foreground text-xs uppercase tracking-widest">
								{card.label}
							</p>
							<p
								className={`mt-2 font-bold text-4xl tracking-tight ${card.valueClass}`}
							>
								{card.value}
							</p>
							<p className="mt-1 text-muted-foreground text-xs">{card.sub}</p>
						</div>
					))}
				</div>

				{/* Active conversations */}
				<div className="overflow-hidden rounded-xl border bg-card">
					<div className="flex items-center justify-between border-b px-5 py-3.5">
						<h2 className="font-semibold text-base">Active Conversations</h2>
					</div>

					{activeThreads === undefined ? (
						<div className="p-5">
							<Skeleton className="h-48 w-full" />
						</div>
					) : activeThreads.length === 0 ? (
						<div className="flex flex-col items-center justify-center py-16 text-center">
							<p className="text-muted-foreground text-sm">
								No active conversations right now.
							</p>
						</div>
					) : (
						<Table>
							<TableHeader>
								<TableRow className="border-border/50 border-b">
									<TableHead>Customer</TableHead>
									<TableHead>Channel</TableHead>
									<TableHead>Status</TableHead>
									<TableHead>Assigned</TableHead>
									<TableHead>Last message</TableHead>
									<TableHead className="text-right">Unread</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{activeThreads.map((thread) => {
									const style = statusStyle[thread.status];
									return (
										<TableRow
											key={thread._id}
											className="cursor-pointer border-border/30 hover:bg-accent/60"
											onClick={() => navigate(`/inbox/${thread._id}`)}
										>
											<TableCell className="font-medium">
												{thread.customerDisplayName ?? "Customer"}
											</TableCell>
											<TableCell>
												<Badge variant="outline" className="text-xs capitalize">
													{thread.channel}
												</Badge>
											</TableCell>
											<TableCell>
												<span
													className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium text-xs ${style.badge}`}
												>
													{style.label}
												</span>
											</TableCell>
											<TableCell className="text-muted-foreground text-sm">
												{thread.assignedAgentName ?? (
													<span className="text-muted-foreground/50">
														Unassigned
													</span>
												)}
											</TableCell>
											<TableCell className="text-muted-foreground text-xs">
												{formatRelative(thread.lastMessageAt)}
											</TableCell>
											<TableCell className="text-right">
												{thread.agentUnreadCount > 0 ? (
													<span className="inline-flex min-w-[20px] items-center justify-center rounded-full bg-primary px-1.5 py-0.5 font-semibold text-primary-foreground text-xs">
														{thread.agentUnreadCount}
													</span>
												) : (
													<span className="text-muted-foreground/40 text-xs">
														—
													</span>
												)}
											</TableCell>
										</TableRow>
									);
								})}
							</TableBody>
						</Table>
					)}

					{/* Pagination */}
					{activePage !== undefined &&
						(cursors.length > 1 || !activePage.isDone) && (
							<div className="flex items-center justify-between border-t px-5 py-2.5">
								<span className="text-muted-foreground text-xs">
									Page {cursors.length}
								</span>
								<div className="flex gap-1.5">
									<Button
										variant="outline"
										size="sm"
										onClick={() => setCursors((c) => c.slice(0, -1))}
										disabled={cursors.length === 1}
									>
										<ChevronLeft className="h-3.5 w-3.5" />
										Previous
									</Button>
									<Button
										variant="outline"
										size="sm"
										onClick={() =>
											setCursors((c) => [...c, activePage.continueCursor])
										}
										disabled={activePage.isDone}
									>
										Next
										<ChevronRight className="h-3.5 w-3.5" />
									</Button>
								</div>
							</div>
						)}
				</div>
			</div>
		</div>
	);
}
