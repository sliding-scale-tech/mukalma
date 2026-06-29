import { api } from "@mukalma/backend/convex/_generated/api";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuBadge,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarRail,
	SidebarSeparator,
} from "@mukalma/ui/components/sidebar";
import { useQuery } from "convex/react";
import {
	FileText,
	Inbox,
	LayoutDashboard,
	Plug,
	Settings,
	Shield,
	Users,
} from "lucide-react";
import { Link, useLocation } from "react-router";

import { UserMenu } from "./user-menu";

const navItems = [
	{ title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
	{ title: "Inbox", url: "/inbox", icon: Inbox, badge: true },
	{ title: "Documents", url: "/documents", icon: FileText },
	{ title: "Integrations", url: "/integrations", icon: Plug },
	{ title: "Team", url: "/users", icon: Users },
	{ title: "Settings", url: "/settings", icon: Settings },
];

const superAdminItems = [
	{ title: "Super Admin", url: "/super/tenants", icon: Shield },
];

export function AppSidebar() {
	const location = useLocation();
	const stats = useQuery(api.dashboard.getStats);
	const openCount = (stats?.open ?? 0) + (stats?.escalated ?? 0);

	return (
		<Sidebar collapsible="icon">
			<SidebarHeader>
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton
							size="lg"
							render={<Link to="/dashboard" />}
							tooltip="Mukalma"
						>
							<div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary font-bold text-primary-foreground text-sm">
								M
							</div>
							<span className="font-semibold text-base tracking-tight">
								Mukalma
							</span>
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarHeader>
			<SidebarContent>
				<SidebarGroup>
					<SidebarGroupLabel>Platform</SidebarGroupLabel>
					<SidebarGroupContent>
						<SidebarMenu>
							{navItems.map((item) => (
								<SidebarMenuItem key={item.url}>
									<SidebarMenuButton
										render={<Link to={item.url} />}
										isActive={location.pathname.startsWith(item.url)}
										tooltip={item.title}
									>
										<item.icon />
										<span>{item.title}</span>
									</SidebarMenuButton>
									{item.badge && openCount > 0 && (
										<SidebarMenuBadge>{openCount}</SidebarMenuBadge>
									)}
								</SidebarMenuItem>
							))}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>
				<SidebarSeparator />
				<SidebarGroup>
					<SidebarGroupLabel>Admin</SidebarGroupLabel>
					<SidebarGroupContent>
						<SidebarMenu>
							{superAdminItems.map((item) => (
								<SidebarMenuItem key={item.url}>
									<SidebarMenuButton
										render={<Link to={item.url} />}
										isActive={location.pathname.startsWith(item.url)}
										tooltip={item.title}
									>
										<item.icon />
										<span>{item.title}</span>
									</SidebarMenuButton>
								</SidebarMenuItem>
							))}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>
			</SidebarContent>
			<SidebarFooter>
				<SidebarMenu>
					<SidebarMenuItem>
						<UserMenu />
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarFooter>
			<SidebarRail />
		</Sidebar>
	);
}
