import { api } from "@mukalma/backend/convex/_generated/api";
import { Badge } from "@mukalma/ui/components/badge";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@mukalma/ui/components/card";
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
import {
	AlertTriangle,
	CheckCircle2,
	Clock,
	MessageCircle,
	Plus,
	Users,
} from "lucide-react";
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

export default function DashboardPage() {
	const current = useQuery(api.tenants.getCurrent);
	const stats = useQuery(api.dashboard.getStats);
	const activeThreads = useQuery(api.dashboard.listActiveThreads);
	const navigate = useNavigate();

	if (current === undefined || stats === undefined) {
		return (
			<div className="space-y-6">
				<Skeleton className="h-8 w-48" />
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
					{Array.from({ length: 5 }).map((_, i) => (
						<Skeleton key={`stat-${i}`} className="h-28" />
					))}
				</div>
				<Skeleton className="h-64 w-full" />
			</div>
		);
	}

	return (
		<div className="space-y-8">
			<div>
				<h1 className="font-semibold text-2xl tracking-tight">Dashboard</h1>
				<p className="text-muted-foreground">
					Overview for {current?.tenant?.name ?? "your business"}
				</p>
			</div>

			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
				<StatCard
					title="Open"
					value={stats.open}
					icon={<MessageCircle className="h-4 w-4 text-blue-500" />}
				/>
				<StatCard
					title="Escalated"
					value={stats.escalated}
					icon={<AlertTriangle className="h-4 w-4 text-red-500" />}
				/>
				<StatCard
					title="Closed Today"
					value={stats.closedToday}
					icon={<CheckCircle2 className="h-4 w-4 text-green-500" />}
				/>
				<StatCard
					title="Created Today"
					value={stats.createdToday}
					icon={<Plus className="h-4 w-4 text-purple-500" />}
				/>
				<StatCard
					title="Agents Online"
					value={stats.onlineAgents}
					icon={<Users className="h-4 w-4 text-emerald-500" />}
				/>
			</div>

			<div>
				<h2 className="mb-4 font-semibold text-lg">Active Conversations</h2>
				{activeThreads === undefined ? (
					<Skeleton className="h-64 w-full" />
				) : activeThreads.length === 0 ? (
					<Card>
						<CardContent className="flex flex-col items-center justify-center py-12">
							<MessageCircle className="mb-3 h-10 w-10 text-muted-foreground" />
							<p className="text-muted-foreground">
								No active conversations right now.
							</p>
						</CardContent>
					</Card>
				) : (
					<div className="rounded-md border">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Customer</TableHead>
									<TableHead>Status</TableHead>
									<TableHead>Channel</TableHead>
									<TableHead>Last Message</TableHead>
									<TableHead>Assigned To</TableHead>
									<TableHead className="text-right">Unread</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{activeThreads.map((thread) => (
									<TableRow
										key={thread._id}
										className="cursor-pointer"
										onClick={() => navigate(`/inbox/${thread._id}`)}
									>
										<TableCell className="font-medium">
											{thread.customerDisplayName}
										</TableCell>
										<TableCell>
											<Badge
												variant={
													thread.status === "escalated"
														? "destructive"
														: "default"
												}
											>
												{thread.status}
											</Badge>
										</TableCell>
										<TableCell>
											<Badge variant="outline">{thread.channel}</Badge>
										</TableCell>
										<TableCell>
											<div className="max-w-[200px]">
												<p className="truncate text-sm">
													{thread.lastMessagePreview ?? "—"}
												</p>
												<span className="flex items-center gap-1 text-muted-foreground text-xs">
													<Clock className="h-3 w-3" />
													{formatRelative(thread.lastMessageAt)}
												</span>
											</div>
										</TableCell>
										<TableCell>
											{thread.assignedAgentName ?? (
												<span className="text-muted-foreground">
													Unassigned
												</span>
											)}
										</TableCell>
										<TableCell className="text-right">
											{thread.agentUnreadCount > 0 ? (
												<Badge variant="destructive">
													{thread.agentUnreadCount}
												</Badge>
											) : (
												"0"
											)}
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</div>
				)}
			</div>
		</div>
	);
}

function StatCard({
	title,
	value,
	icon,
}: {
	title: string;
	value: number;
	icon: React.ReactNode;
}) {
	return (
		<Card>
			<CardHeader className="flex flex-row items-center justify-between pb-2">
				<CardTitle className="font-medium text-sm">{title}</CardTitle>
				{icon}
			</CardHeader>
			<CardContent>
				<div className="font-bold text-2xl">{value}</div>
			</CardContent>
		</Card>
	);
}
