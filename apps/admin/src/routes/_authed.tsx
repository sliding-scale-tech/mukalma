import { useAuth } from "@clerk/react-router";
import { api } from "@mukalma/backend/convex/_generated/api";
import { Separator } from "@mukalma/ui/components/separator";
import {
	SidebarInset,
	SidebarProvider,
	SidebarTrigger,
} from "@mukalma/ui/components/sidebar";
import { Skeleton } from "@mukalma/ui/components/skeleton";
import { TooltipProvider } from "@mukalma/ui/components/tooltip";
import { useQuery } from "convex/react";
import { useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router";

import { AppSidebar } from "../components/layout/app-sidebar";
import { usePresenceHeartbeat } from "../hooks/usePresenceHeartbeat";

export default function AuthedLayout() {
	usePresenceHeartbeat();
	const { isLoaded, isSignedIn } = useAuth();
	const navigate = useNavigate();
	const location = useLocation();
	const current = useQuery(api.tenants.getCurrent, isSignedIn ? {} : "skip");

	useEffect(() => {
		if (!isLoaded) return;
		if (!isSignedIn) {
			navigate("/login", { replace: true });
		}
	}, [isLoaded, isSignedIn, navigate]);

	useEffect(() => {
		if (!isSignedIn || current === undefined) return;
		const onOnboarding = location.pathname === "/onboarding";
		if (!current?.tenant && !onOnboarding) {
			navigate("/onboarding", { replace: true });
		} else if (current?.tenant && onOnboarding) {
			navigate("/dashboard", { replace: true });
		}
	}, [isSignedIn, current, location.pathname, navigate]);

	if (!isLoaded || !isSignedIn || current === undefined) {
		return (
			<div className="flex min-h-svh items-center justify-center p-8">
				<Skeleton className="h-8 w-48" />
			</div>
		);
	}

	if (location.pathname === "/onboarding") {
		return (
			<div className="flex min-h-svh items-center justify-center p-4">
				<Outlet />
			</div>
		);
	}

	return (
		<TooltipProvider>
			<SidebarProvider>
				<AppSidebar />
				<SidebarInset>
					<header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
						<SidebarTrigger className="-ml-1" />
						<Separator orientation="vertical" className="mr-2 h-4" />
					</header>
					<main className="flex-1 p-6">
						<Outlet />
					</main>
				</SidebarInset>
			</SidebarProvider>
		</TooltipProvider>
	);
}
