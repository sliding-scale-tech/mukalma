import { useUser } from "@clerk/react-router";
import { api } from "@mukalma/backend/convex/_generated/api";
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
import { useEffect } from "react";
import { useNavigate } from "react-router";

const statusStyle = {
	active: "bg-emerald-500/12 text-emerald-400",
	suspended: "bg-red-500/12 text-red-400",
} as const;

export default function SuperTenantsPage() {
	const { user, isLoaded } = useUser();
	const navigate = useNavigate();
	const isSuperAdmin = user?.publicMetadata?.role === "super_admin";
	const tenants = useQuery(api.superAdmin.listAll, isSuperAdmin ? {} : "skip");

	useEffect(() => {
		if (isLoaded && !isSuperAdmin) {
			navigate("/dashboard", { replace: true });
		}
	}, [isLoaded, isSuperAdmin, navigate]);

	if (!isLoaded || !isSuperAdmin) {
		return (
			<div className="flex-1 overflow-y-auto">
				<div className="p-6 md:p-8">
					<Skeleton className="h-32 w-full" />
				</div>
			</div>
		);
	}

	return (
		<div className="flex-1 overflow-y-auto">
			<div className="max-w-5xl space-y-6 p-6 md:p-8">
				<div>
					<h1 className="font-semibold text-2xl tracking-tight">All Tenants</h1>
					<p className="text-muted-foreground">Super-admin tenant overview</p>
				</div>

				{tenants === undefined ? (
					<Skeleton className="h-64 w-full" />
				) : (
					<div className="overflow-hidden rounded-xl border bg-card">
						<Table>
							<TableHeader>
								<TableRow className="border-border/50 border-b">
									<TableHead>Tenant</TableHead>
									<TableHead>Slug</TableHead>
									<TableHead>Status</TableHead>
									<TableHead>Created</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{tenants.map((tenant) => {
									const style =
										statusStyle[tenant.status as keyof typeof statusStyle] ??
										"bg-zinc-500/12 text-zinc-400";
									return (
										<TableRow
											key={tenant._id}
											className="border-border/30 hover:bg-accent/50"
										>
											<TableCell className="font-medium">
												{tenant.name}
											</TableCell>
											<TableCell>
												<code className="rounded bg-muted px-1.5 py-0.5 font-mono text-muted-foreground text-xs">
													{tenant.slug}
												</code>
											</TableCell>
											<TableCell>
												<span
													className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium text-xs capitalize ${style}`}
												>
													{tenant.status}
												</span>
											</TableCell>
											<TableCell className="text-muted-foreground text-sm">
												{new Date(tenant.createdAt).toLocaleDateString()}
											</TableCell>
										</TableRow>
									);
								})}
							</TableBody>
						</Table>
					</div>
				)}
			</div>
		</div>
	);
}
