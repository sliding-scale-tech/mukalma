import { useAuth } from "@clerk/react-router";
import { LoginForm } from "@mukalma/ui/composites/login-form";
import { Navigate } from "react-router";

export default function LoginPage() {
	const { isLoaded, isSignedIn } = useAuth();
	if (isLoaded && isSignedIn) {
		return <Navigate to="/dashboard" replace />;
	}
	return (
		<div className="flex min-h-svh items-center justify-center p-4">
			<LoginForm />
		</div>
	);
}
