import { useAuth } from "@clerk/react-router";
import { api } from "@mukalma/backend/convex/_generated/api";
import {
	SidebarInset,
	SidebarProvider,
	SidebarTrigger,
} from "@mukalma/ui/components/sidebar";
import { Skeleton } from "@mukalma/ui/components/skeleton";
import { TooltipProvider } from "@mukalma/ui/components/tooltip";
import { useQuery } from "convex/react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router";

import { AppSidebar } from "../components/layout/app-sidebar";
import { usePresenceHeartbeat } from "../hooks/usePresenceHeartbeat";

function ThemeToggle() {
	const { theme, setTheme } = useTheme();
	return (
		<button
			type="button"
			onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
			className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
			aria-label="Toggle theme"
		>
			<Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
			<Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
		</button>
	);
}

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
			<div className="flex min-h-svh flex-col items-center justify-center bg-auth-grid p-4">
				<div className="mb-8 flex items-center gap-2.5">
					<div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary font-bold text-primary-foreground text-sm">
						M
					</div>
					<span className="font-semibold text-lg tracking-tight">Mukalma</span>
				</div>
				<Outlet />
			</div>
		);
	}

	return (
		<TooltipProvider>
			<SidebarProvider>
				<AppSidebar />
				<SidebarInset>
					<header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
						<SidebarTrigger className="-ml-1" />
						<div className="ml-auto">
							<ThemeToggle />
						</div>
					</header>
					<div className="flex flex-1 flex-col overflow-hidden">
						<Outlet />
					</div>
				</SidebarInset>
			</SidebarProvider>
		</TooltipProvider>
	);
}
