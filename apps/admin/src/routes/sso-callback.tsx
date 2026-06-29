import { useAuth, useClerk } from "@clerk/react-router";
import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";

export default function SsoCallbackPage() {
	const { handleRedirectCallback } = useClerk();
	const { isLoaded, isSignedIn } = useAuth();
	const navigate = useNavigate();
	const [error, setError] = useState<string | null>(null);
	const called = useRef(false);

	// Call handleRedirectCallback once to let Clerk finalize the OAuth session.
	useEffect(() => {
		if (called.current) return;
		called.current = true;

		handleRedirectCallback({
			signInForceRedirectUrl: "/dashboard",
			signUpForceRedirectUrl: "/onboarding",
		}).catch((err: unknown) => {
			setError(err instanceof Error ? err.message : "Authentication failed");
		});
	}, [handleRedirectCallback]);

	// Fallback: if Clerk has established a session but hasn't navigated us away
	// (can happen when the routerPush ref isn't ready in time), redirect manually.
	useEffect(() => {
		if (isLoaded && isSignedIn) {
			navigate("/dashboard", { replace: true });
		}
	}, [isLoaded, isSignedIn, navigate]);

	return (
		<div className="flex min-h-svh flex-col items-center justify-center gap-4 p-4">
			<div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary font-bold text-primary-foreground text-sm">
				M
			</div>
			{error ? (
				<div className="text-center">
					<p className="font-medium text-destructive">Sign in failed</p>
					<p className="mt-1 text-muted-foreground text-sm">{error}</p>
					<button
						type="button"
						onClick={() => navigate("/login")}
						className="mt-4 text-primary text-sm underline"
					>
						Back to login
					</button>
				</div>
			) : (
				<div className="flex items-center gap-2 text-muted-foreground">
					<Loader2 className="h-4 w-4 animate-spin" />
					<span className="text-sm">Signing you in…</span>
				</div>
			)}
		</div>
	);
}
