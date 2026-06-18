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
		<div className="flex min-h-svh items-center justify-center p-4">
			<SignupForm />
		</div>
	);
}
