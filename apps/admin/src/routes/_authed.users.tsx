import { api } from "@mukalma/backend/convex/_generated/api";
import type { Id } from "@mukalma/backend/convex/_generated/dataModel";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@mukalma/ui/components/alert-dialog";
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
import { Loader2, UserMinus, UserPlus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function UsersPage() {
	const current = useQuery(api.tenants.getCurrent);
	const users = useQuery(api.users.list, current?.tenant ? {} : "skip");
	const onlineAgents = useQuery(
		api.presence.listOnlineAgents,
		current?.tenant ? {} : "skip",
	);
	const inviteAgent = useAction(api.usersActions.inviteAgent);
	const removeAgent = useAction(api.usersActions.removeAgent);

	const [inviteEmail, setInviteEmail] = useState("");
	const [inviting, setInviting] = useState(false);
	const [sheetOpen, setSheetOpen] = useState(false);
	const [removeTarget, setRemoveTarget] = useState<{
		id: Id<"users">;
		label: string;
	} | null>(null);
	const [removing, setRemoving] = useState(false);

	const isAdmin = current?.user.role === "org_admin";
	const onlineIds = new Set(onlineAgents?.map((a) => a._id) ?? []);

	const handleRemove = async () => {
		if (!removeTarget) return;
		setRemoving(true);
		try {
			await removeAgent({ userId: removeTarget.id });
			toast.success(`${removeTarget.label} removed from the team`);
			setRemoveTarget(null);
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Failed to remove");
		} finally {
			setRemoving(false);
		}
	};

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
		<div className="flex-1 overflow-y-auto">
			<div className="max-w-4xl space-y-6 p-6 md:p-8">
				<div className="flex items-center justify-between">
					<div>
						<h1 className="font-semibold text-2xl tracking-tight">Team</h1>
						<p className="text-muted-foreground">
							Manage agents and admins for your organization.
						</p>
					</div>

					{isAdmin && (
						<Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
							<Button onClick={() => setSheetOpen(true)}>
								<UserPlus className="mr-2 h-4 w-4" />
								Invite Agent
							</Button>
							<SheetContent>
								<SheetHeader>
									<SheetTitle>Invite Agent</SheetTitle>
									<SheetDescription>
										Send an email invitation to join your team as a support
										agent.
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
							{isAdmin && <TableHead className="text-right">Actions</TableHead>}
						</TableRow>
					</TableHeader>
					<TableBody>
						{users.map((user) => (
							<TableRow key={user._id}>
								<TableCell className="font-medium">
									{user.name ?? "—"}
								</TableCell>
								<TableCell>{user.email}</TableCell>
								<TableCell>
									<Badge
										variant={
											user.role === "org_admin" ? "default" : "secondary"
										}
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
								{isAdmin && (
									<TableCell className="text-right">
										{user._id !== current.user._id && (
											<Button
												variant="ghost"
												size="sm"
												className="text-destructive hover:text-destructive"
												onClick={() =>
													setRemoveTarget({
														id: user._id,
														label: user.name ?? user.email,
													})
												}
											>
												<UserMinus className="mr-1.5 h-3.5 w-3.5" />
												Remove
											</Button>
										)}
									</TableCell>
								)}
							</TableRow>
						))}
					</TableBody>
				</Table>
			</div>

			<AlertDialog
				open={removeTarget !== null}
				onOpenChange={(open) => !open && setRemoveTarget(null)}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Remove {removeTarget?.label}?</AlertDialogTitle>
						<AlertDialogDescription>
							They will immediately lose access to this organization. Any
							conversations assigned to them will be moved back to the
							unassigned queue. This cannot be undone from here — you'll need to
							send a new invitation to add them back.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={removing}>Cancel</AlertDialogCancel>
						<AlertDialogAction
							onClick={(e) => {
								e.preventDefault();
								handleRemove();
							}}
							disabled={removing}
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
						>
							{removing ? (
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
							) : null}
							Remove
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}
