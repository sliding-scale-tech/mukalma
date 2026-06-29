import { useAuth } from "@clerk/react-router";
import { SignupForm } from "@mukalma/ui/composites/signup-form";
import { Navigate, useSearchParams } from "react-router";

export default function SignupPage() {
	const { isLoaded, isSignedIn } = useAuth();
	const [searchParams] = useSearchParams();
	const hasInviteTicket =
		searchParams.has("__clerk_ticket") || searchParams.has("ticket");

	if (hasInviteTicket) {
		return (
			<Navigate to={`/accept-invite?${searchParams.toString()}`} replace />
		);
	}
	if (isLoaded && isSignedIn) {
		return <Navigate to="/dashboard" replace />;
	}
	return (
		<div className="flex min-h-svh flex-col items-center justify-center bg-auth-grid p-4">
			<div className="mb-8 flex items-center gap-2.5">
				<div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary font-bold text-primary-foreground text-sm">
					M
				</div>
				<span className="font-semibold text-lg tracking-tight">Mukalma</span>
			</div>
			<SignupForm />
		</div>
	);
}
