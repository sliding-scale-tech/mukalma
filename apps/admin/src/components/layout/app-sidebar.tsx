import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarRail,
} from "@mukalma/ui/components/sidebar";
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

import { OrgSwitcher } from "./org-switcher";
import { UserMenu } from "./user-menu";

const navItems = [
	{ title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
	{ title: "Inbox", url: "/inbox", icon: Inbox },
	{ title: "Documents", url: "/documents", icon: FileText },
	{ title: "Integrations", url: "/integrations", icon: Plug },
	{ title: "Users", url: "/users", icon: Users },
	{ title: "Settings", url: "/settings", icon: Settings },
];

const superAdminItems = [
	{ title: "All tenants", url: "/super/tenants", icon: Shield },
];

export function AppSidebar() {
	const location = useLocation();

	return (
		<Sidebar collapsible="icon">
			<SidebarHeader>
				<SidebarMenu>
					<SidebarMenuItem>
						<OrgSwitcher />
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
								</SidebarMenuItem>
							))}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>
				<SidebarGroup>
					<SidebarGroupLabel>Super admin</SidebarGroupLabel>
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
