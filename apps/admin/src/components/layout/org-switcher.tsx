import { useOrganization, useOrganizationList } from "@clerk/react-router";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuTrigger,
} from "@mukalma/ui/components/dropdown-menu";
import { SidebarMenuButton } from "@mukalma/ui/components/sidebar";
import { Building2, ChevronsUpDown } from "lucide-react";

export function OrgSwitcher() {
	const { organization } = useOrganization();
	const { isLoaded, setActive, userMemberships } = useOrganizationList({
		userMemberships: { infinite: true },
	});

	if (!isLoaded) {
		return null;
	}

	const orgName = organization?.name ?? "No organization";
	const memberships = userMemberships.data ?? [];

	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={
					<SidebarMenuButton
						size="lg"
						className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
					/>
				}
			>
				<div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
					<Building2 className="size-4" />
				</div>
				<div className="grid flex-1 text-left text-sm leading-tight">
					<span className="truncate font-medium">{orgName}</span>
					<span className="truncate text-muted-foreground text-xs">
						Organization
					</span>
				</div>
				{memberships.length > 1 && (
					<ChevronsUpDown className="ml-auto size-4" />
				)}
			</DropdownMenuTrigger>
			{memberships.length > 1 && (
				<DropdownMenuContent className="w-56" align="start">
					<DropdownMenuGroup>
						<DropdownMenuLabel>Organizations</DropdownMenuLabel>
						{memberships.map((membership) => (
							<DropdownMenuItem
								key={membership.organization.id}
								onClick={() =>
									setActive({ organization: membership.organization.id })
								}
							>
								{membership.organization.name}
							</DropdownMenuItem>
						))}
					</DropdownMenuGroup>
				</DropdownMenuContent>
			)}
		</DropdownMenu>
	);
}
