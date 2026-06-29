import { useAuth } from "@clerk/react-router";
import { LoginForm } from "@mukalma/ui/composites/login-form";
import { Navigate } from "react-router";

export default function LoginPage() {
	const { isLoaded, isSignedIn } = useAuth();
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
			<LoginForm />
		</div>
	);
}
