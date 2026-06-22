import { api } from "@mukalma/backend/convex/_generated/api";
import { Badge } from "@mukalma/ui/components/badge";
import { Button } from "@mukalma/ui/components/button";
import { Input } from "@mukalma/ui/components/input";
import { Label } from "@mukalma/ui/components/label";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "@mukalma/ui/components/sheet";
import { Skeleton } from "@mukalma/ui/components/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@mukalma/ui/components/table";
import { useAction, useQuery } from "convex/react";
import { UserPlus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function UsersPage() {
	const current = useQuery(api.tenants.getCurrent);
	const users = useQuery(api.users.list);
	const onlineAgents = useQuery(api.presence.listOnlineAgents);
	const inviteAgent = useAction(api.usersActions.inviteAgent);

	const [inviteEmail, setInviteEmail] = useState("");
	const [inviting, setInviting] = useState(false);
	const [sheetOpen, setSheetOpen] = useState(false);

	const isAdmin = current?.user.role === "org_admin";
	const onlineIds = new Set(onlineAgents?.map((a) => a._id) ?? []);

	const handleInvite = async () => {
		const email = inviteEmail.trim();
		if (!email) return;
		setInviting(true);
		try {
			await inviteAgent({ email });
			toast.success(`Invitation sent to ${email}`);
			setInviteEmail("");
			setSheetOpen(false);
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Failed to send invite");
		} finally {
			setInviting(false);
		}
	};

	if (current === undefined || users === undefined) {
		return <Skeleton className="h-64 w-full" />;
	}

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="font-semibold text-2xl tracking-tight">Team</h1>
					<p className="text-muted-foreground">
						Manage agents and admins for your organization.
					</p>
				</div>

				{isAdmin && (
					<Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
						<SheetTrigger asChild>
							<Button>
								<UserPlus className="mr-2 h-4 w-4" />
								Invite Agent
							</Button>
						</SheetTrigger>
						<SheetContent>
							<SheetHeader>
								<SheetTitle>Invite Agent</SheetTitle>
								<SheetDescription>
									Send an email invitation to join your team as a support agent.
								</SheetDescription>
							</SheetHeader>
							<div className="space-y-4 py-6">
								<div className="space-y-2">
									<Label htmlFor="invite-email">Email address</Label>
									<Input
										id="invite-email"
										type="email"
										placeholder="agent@example.com"
										value={inviteEmail}
										onChange={(e) => setInviteEmail(e.target.value)}
										onKeyDown={(e) => {
											if (e.key === "Enter") handleInvite();
										}}
									/>
								</div>
							</div>
							<SheetFooter>
								<Button
									onClick={handleInvite}
									disabled={!inviteEmail.trim() || inviting}
								>
									{inviting ? "Sending..." : "Send Invitation"}
								</Button>
							</SheetFooter>
						</SheetContent>
					</Sheet>
				)}
			</div>

			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>Name</TableHead>
						<TableHead>Email</TableHead>
						<TableHead>Role</TableHead>
						<TableHead>Status</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{users.map((user) => (
						<TableRow key={user._id}>
							<TableCell className="font-medium">{user.name ?? "—"}</TableCell>
							<TableCell>{user.email}</TableCell>
							<TableCell>
								<Badge
									variant={user.role === "org_admin" ? "default" : "secondary"}
								>
									{user.role === "org_admin" ? "Admin" : "Agent"}
								</Badge>
							</TableCell>
							<TableCell>
								{onlineIds.has(user._id) ? (
									<Badge variant="default" className="bg-green-600">
										Online
									</Badge>
								) : (
									<Badge variant="outline">Offline</Badge>
								)}
							</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>
		</div>
	);
}
