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

export function AcceptInviteForm() {
	const [searchParams] = useSearchParams();
	const ticket =
		searchParams.get("__clerk_ticket") ?? searchParams.get("ticket");
	const { signIn, fetchStatus: signInStatus } = useSignIn();
	const { signUp, fetchStatus: signUpStatus } = useSignUp();
	const navigate = useNavigate();
	const [error, setError] = useState<string | null>(null);
	const [mode, setMode] = useState<"signup" | "signin">("signup");

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

	const onSubmit = form.handleSubmit(async (values) => {
		if (!ticket) return;
		setError(null);
		try {
			if (mode === "signup") {
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
			} else {
				const { error: ticketError } = await signIn.ticket({ ticket });
				if (ticketError) {
					setError(ticketError.message ?? "Invite acceptance failed");
					return;
				}
				if (signIn.status === "complete") {
					await finalizeSession(signIn);
				}
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : "Invite acceptance failed");
		}
	});

	const isLoading = signInStatus === "fetching" || signUpStatus === "fetching";

	return (
		<Card className="mx-auto w-full max-w-md">
			<CardHeader>
				<CardTitle>Accept invitation</CardTitle>
				<CardDescription>Join your team on Mukalma</CardDescription>
			</CardHeader>
			<CardContent>
				<form onSubmit={onSubmit} className="grid gap-4">
					<div className="flex gap-2">
						<Button
							type="button"
							variant={mode === "signup" ? "default" : "outline"}
							onClick={() => setMode("signup")}
						>
							New account
						</Button>
						<Button
							type="button"
							variant={mode === "signin" ? "default" : "outline"}
							onClick={() => setMode("signin")}
						>
							Existing account
						</Button>
					</div>
					{mode === "signup" && (
						<>
							<div className="grid gap-2">
								<Label htmlFor="email">Email</Label>
								<Input id="email" type="email" {...form.register("email")} />
							</div>
							<div className="grid gap-2">
								<Label htmlFor="password">Password</Label>
								<Input
									id="password"
									type="password"
									{...form.register("password")}
								/>
							</div>
							<div className="grid gap-2">
								<Label htmlFor="confirmPassword">Confirm password</Label>
								<Input
									id="confirmPassword"
									type="password"
									{...form.register("confirmPassword")}
								/>
							</div>
						</>
					)}
					{error && <p className="text-destructive text-sm">{error}</p>}
					<Button type="submit" disabled={!ticket || isLoading}>
						{mode === "signup" ? "Create account & join" : "Sign in & join"}
					</Button>
					<p className="text-center text-sm">
						<Link to="/login" className="text-muted-foreground underline">
							Back to sign in
						</Link>
					</p>
				</form>
			</CardContent>
		</Card>
	);
}
