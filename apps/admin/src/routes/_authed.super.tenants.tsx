import { useUser } from "@clerk/react-router";
import { api } from "@mukalma/backend/convex/_generated/api";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@mukalma/ui/components/card";
import { Skeleton } from "@mukalma/ui/components/skeleton";
import { useQuery } from "convex/react";
import { useEffect } from "react";
import { useNavigate } from "react-router";

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
		return <Skeleton className="h-32 w-full" />;
	}

	return (
		<div className="space-y-6">
			<div>
				<h1 className="font-semibold text-2xl tracking-tight">All tenants</h1>
				<p className="text-muted-foreground">Super-admin tenant overview</p>
			</div>
			{tenants === undefined ? (
				<Skeleton className="h-32 w-full" />
			) : (
				<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
					{tenants.map((tenant) => (
						<Card key={tenant._id}>
							<CardHeader>
								<CardTitle>{tenant.name}</CardTitle>
							</CardHeader>
							<CardContent className="text-muted-foreground text-sm">
								<p>Slug: {tenant.slug}</p>
								<p>Status: {tenant.status}</p>
							</CardContent>
						</Card>
					))}
				</div>
			)}
		</div>
	);
}
