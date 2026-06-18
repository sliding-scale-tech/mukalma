import { useClerk, useUser } from "@clerk/react-router";
import {
	Avatar,
	AvatarFallback,
	AvatarImage,
} from "@mukalma/ui/components/avatar";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@mukalma/ui/components/dropdown-menu";
import { SidebarMenuButton } from "@mukalma/ui/components/sidebar";
import { ChevronsUpDown, LogOut } from "lucide-react";
import { useNavigate } from "react-router";

export function UserMenu() {
	const { user } = useUser();
	const { signOut } = useClerk();
	const navigate = useNavigate();

	const initials =
		user?.fullName
			?.split(" ")
			.map((part) => part[0])
			.join("")
			.slice(0, 2)
			.toUpperCase() ??
		user?.primaryEmailAddress?.emailAddress?.[0]?.toUpperCase() ??
		"?";

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
				<Avatar className="size-8 rounded-lg">
					<AvatarImage src={user?.imageUrl} alt={user?.fullName ?? "User"} />
					<AvatarFallback className="rounded-lg">{initials}</AvatarFallback>
				</Avatar>
				<div className="grid flex-1 text-left text-sm leading-tight">
					<span className="truncate font-medium">
						{user?.fullName ?? "User"}
					</span>
					<span className="truncate text-muted-foreground text-xs">
						{user?.primaryEmailAddress?.emailAddress}
					</span>
				</div>
				<ChevronsUpDown className="ml-auto size-4" />
			</DropdownMenuTrigger>
			<DropdownMenuContent
				className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
				side="bottom"
				align="end"
				sideOffset={4}
			>
				<DropdownMenuGroup>
					<DropdownMenuLabel className="p-0 font-normal">
						<div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
							<Avatar className="size-8 rounded-lg">
								<AvatarImage
									src={user?.imageUrl}
									alt={user?.fullName ?? "User"}
								/>
								<AvatarFallback className="rounded-lg">
									{initials}
								</AvatarFallback>
							</Avatar>
							<div className="grid flex-1 text-left text-sm leading-tight">
								<span className="truncate font-medium">
									{user?.fullName ?? "User"}
								</span>
								<span className="truncate text-muted-foreground text-xs">
									{user?.primaryEmailAddress?.emailAddress}
								</span>
							</div>
						</div>
					</DropdownMenuLabel>
				</DropdownMenuGroup>
				<DropdownMenuSeparator />
				<DropdownMenuGroup>
					<DropdownMenuItem
						onClick={async () => {
							await signOut();
							navigate("/login");
						}}
					>
						<LogOut />
						Sign out
					</DropdownMenuItem>
				</DropdownMenuGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
