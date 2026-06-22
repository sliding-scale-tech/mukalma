import { useSignIn } from "@clerk/react-router";
import { zodResolver } from "@hookform/resolvers/zod";
import { type LoginInput, loginSchema } from "@mukalma/shared";
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
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router";

export function LoginForm() {
	const { signIn, fetchStatus } = useSignIn();
	const navigate = useNavigate();
	const [error, setError] = useState<string | null>(null);
	const form = useForm<LoginInput>({
		resolver: zodResolver(loginSchema),
		defaultValues: { email: "", password: "" },
	});

	const onSubmit = form.handleSubmit(async (values) => {
		setError(null);
		try {
			const { error: signInError } = await signIn.password({
				emailAddress: values.email,
				password: values.password,
			});
			if (signInError) {
				setError(signInError.message ?? "Sign in failed");
				return;
			}
			if (signIn.status === "complete") {
				await signIn.finalize({
					navigate: ({ decorateUrl }) => {
						const url = decorateUrl("/dashboard");
						if (url.startsWith("http")) {
							window.location.href = url;
						} else {
							navigate(url);
						}
					},
				});
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : "Sign in failed");
		}
	});

	return (
		<Card className="mx-auto w-full max-w-md">
			<CardHeader>
				<CardTitle>Sign in to Mukalma</CardTitle>
				<CardDescription>Access your support dashboard</CardDescription>
			</CardHeader>
			<CardContent>
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
					{error && <p className="text-destructive text-sm">{error}</p>}
					<Button
						type="submit"
						disabled={form.formState.isSubmitting || fetchStatus === "fetching"}
					>
						{form.formState.isSubmitting ? "Signing in..." : "Sign in"}
					</Button>
					<p className="text-center text-muted-foreground text-sm">
						No account?{" "}
						<Link to="/signup" className="underline">
							Sign up
						</Link>
					</p>
					<p className="text-center text-sm">
						<Link
							to="/forgot-password"
							className="text-muted-foreground underline"
						>
							Forgot password?
						</Link>
					</p>
				</form>
			</CardContent>
		</Card>
	);
}
