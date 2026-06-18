import { useAuth } from "@clerk/react-router";
import { ForgotPasswordForm } from "@mukalma/ui/composites/forgot-password-form";
import { Navigate } from "react-router";

export default function ForgotPasswordPage() {
	const { isLoaded, isSignedIn } = useAuth();
	if (isLoaded && isSignedIn) {
		return <Navigate to="/dashboard" replace />;
	}
	return (
		<div className="flex min-h-svh items-center justify-center p-4">
			<ForgotPasswordForm />
		</div>
	);
}
