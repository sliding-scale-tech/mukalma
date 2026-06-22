import { useAuth } from "@clerk/react-router";
import { AcceptInviteForm } from "@mukalma/ui/composites/accept-invite-form";
import { Navigate } from "react-router";

export default function AcceptInvitePage() {
	const { isLoaded, isSignedIn } = useAuth();
	if (isLoaded && isSignedIn) {
		return <Navigate to="/dashboard" replace />;
	}
	return (
		<div className="flex min-h-svh items-center justify-center p-4">
			<AcceptInviteForm />
		</div>
	);
}
