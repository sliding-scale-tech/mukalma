import { useSignIn, useSignUp } from "@clerk/react-router";
import { zodResolver } from "@hookform/resolvers/zod";
import { type SignupInput, signupSchema } from "@mukalma/shared";
import { Button } from "@mukalma/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@mukalma/ui/components/card";
import { Input } from "@mukalma/ui/components/input";
import { Label } from "@mukalma/ui/components/label";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate, useSearchParams } from "react-router";

function GoogleIcon() {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 24 24"
			className="h-4 w-4"
			aria-hidden="true"
		>
			<path
				d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
				fill="#4285F4"
			/>
			<path
				d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
				fill="#34A853"
			/>
			<path
				d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
				fill="#FBBC05"
			/>
			<path
				d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
				fill="#EA4335"
			/>
		</svg>
	);
}

export function AcceptInviteForm() {
	const [searchParams] = useSearchParams();
	const ticket =
		searchParams.get("__clerk_ticket") ?? searchParams.get("ticket");
	const { signIn, fetchStatus: signInStatus } = useSignIn();
	const { signUp, fetchStatus: signUpStatus } = useSignUp();
	const navigate = useNavigate();
	const [error, setError] = useState<string | null>(null);
	const [mode, setMode] = useState<"signup" | "signin">("signup");
	const [googleLoading, setGoogleLoading] = useState(false);
	const [signinLoading, setSigninLoading] = useState(false);

	const form = useForm<SignupInput>({
		resolver: zodResolver(signupSchema),
		defaultValues: { email: "", password: "", confirmPassword: "" },
	});

	useEffect(() => {
		if (!ticket) {
			setError(
				"Missing invitation ticket. Use the link from your invite email.",
			);
		}
	}, [ticket]);

	const finalizeSession = async (resource: typeof signIn | typeof signUp) => {
		await resource.finalize({
			navigate: ({ decorateUrl }) => {
				const url = decorateUrl("/dashboard");
				if (url.startsWith("http")) {
					window.location.href = url;
				} else {
					navigate(url);
				}
			},
		});
	};

	// New account via email + password (form is validated by signupSchema).
	const onSubmit = form.handleSubmit(async (values) => {
		if (!ticket) return;
		setError(null);
		try {
			const { error: createError } = await signUp.create({
				strategy: "ticket",
				ticket,
				emailAddress: values.email,
				password: values.password,
			});
			if (createError) {
				setError(createError.message ?? "Invite acceptance failed");
				return;
			}
			if (signUp.status === "complete") {
				await finalizeSession(signUp);
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : "Invite acceptance failed");
		}
	});

	// Existing account: accept the invite with a ticket sign-in. This must NOT
	// go through the signup-schema-validated form submit, otherwise the empty
	// email/password fields fail validation and nothing happens.
	const handleExistingAccount = async () => {
		if (!ticket) return;
		setError(null);
		setSigninLoading(true);
		try {
			const { error: ticketError } = await signIn.ticket({ ticket });
			if (ticketError) {
				setError(ticketError.message ?? "Invite acceptance failed");
				return;
			}
			if (signIn.status === "complete") {
				await finalizeSession(signIn);
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : "Invite acceptance failed");
		} finally {
			setSigninLoading(false);
		}
	};

	// Google: seed the sign-up with the invitation ticket, then continue with
	// the OAuth redirect. Clerk transfers to sign-in automatically if the
	// Google account already exists.
	const handleGoogle = async () => {
		if (!ticket) return;
		setError(null);
		setGoogleLoading(true);
		try {
			const { error: createError } = await signUp.create({
				strategy: "ticket",
				ticket,
			});
			if (createError) {
				setError(createError.message ?? "Google sign in failed");
				setGoogleLoading(false);
				return;
			}
			await signUp.sso({
				strategy: "oauth_google",
				redirectUrl: `${window.location.origin}/sso-callback`,
				redirectCallbackUrl: `${window.location.origin}/sso-callback`,
			});
		} catch (err) {
			setError(err instanceof Error ? err.message : "Google sign in failed");
			setGoogleLoading(false);
		}
	};

	const isLoading =
		signInStatus === "fetching" ||
		signUpStatus === "fetching" ||
		googleLoading ||
		signinLoading;

	return (
		<Card className="mx-auto w-full max-w-md">
			<CardHeader>
				<CardTitle>Accept invitation</CardTitle>
				<CardDescription>Join your team on Mukalma</CardDescription>
			</CardHeader>
			<CardContent>
				<div className="grid gap-4">
					<Button
						type="button"
						variant="outline"
						onClick={handleGoogle}
						disabled={!ticket || isLoading}
						className="w-full gap-2"
					>
						<GoogleIcon />
						{googleLoading ? "Redirecting…" : "Continue with Google"}
					</Button>

					<div className="relative">
						<div className="absolute inset-0 flex items-center">
							<span className="w-full border-t" />
						</div>
						<div className="relative flex justify-center text-xs uppercase">
							<span className="bg-card px-2 text-muted-foreground">
								or continue with email
							</span>
						</div>
					</div>

					<div className="flex gap-2">
						<Button
							type="button"
							className="flex-1"
							variant={mode === "signup" ? "default" : "outline"}
							onClick={() => {
								setError(null);
								setMode("signup");
							}}
						>
							New account
						</Button>
						<Button
							type="button"
							className="flex-1"
							variant={mode === "signin" ? "default" : "outline"}
							onClick={() => {
								setError(null);
								setMode("signin");
							}}
						>
							Existing account
						</Button>
					</div>

					{mode === "signup" ? (
						<form onSubmit={onSubmit} className="grid gap-4">
							<div className="grid gap-2">
								<Label htmlFor="email">Email</Label>
								<Input id="email" type="email" {...form.register("email")} />
								{form.formState.errors.email && (
									<p className="text-destructive text-sm">
										{form.formState.errors.email.message}
									</p>
								)}
							</div>
							<div className="grid gap-2">
								<Label htmlFor="password">Password</Label>
								<Input
									id="password"
									type="password"
									{...form.register("password")}
								/>
								{form.formState.errors.password && (
									<p className="text-destructive text-sm">
										{form.formState.errors.password.message}
									</p>
								)}
							</div>
							<div className="grid gap-2">
								<Label htmlFor="confirmPassword">Confirm password</Label>
								<Input
									id="confirmPassword"
									type="password"
									{...form.register("confirmPassword")}
								/>
								{form.formState.errors.confirmPassword && (
									<p className="text-destructive text-sm">
										{form.formState.errors.confirmPassword.message}
									</p>
								)}
							</div>
							{error && <p className="text-destructive text-sm">{error}</p>}
							<Button type="submit" disabled={!ticket || isLoading}>
								{isLoading ? "Joining…" : "Create account & join"}
							</Button>
						</form>
					) : (
						<div className="grid gap-4">
							<p className="text-muted-foreground text-sm">
								Already have a Mukalma account with this email? Sign in to
								accept the invitation and join the team.
							</p>
							{error && <p className="text-destructive text-sm">{error}</p>}
							<Button
								type="button"
								onClick={handleExistingAccount}
								disabled={!ticket || isLoading}
							>
								{signinLoading ? "Joining…" : "Sign in & join"}
							</Button>
						</div>
					)}

					<p className="text-center text-sm">
						<Link to="/login" className="text-muted-foreground underline">
							Back to sign in
						</Link>
					</p>
				</div>
			</CardContent>
		</Card>
	);
}
