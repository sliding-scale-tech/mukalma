import { useSignUp } from "@clerk/react-router";
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
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router";

export function SignupForm() {
	const { signUp, fetchStatus } = useSignUp();
	const navigate = useNavigate();
	const [error, setError] = useState<string | null>(null);
	const [pendingVerification, setPendingVerification] = useState(false);
	const [code, setCode] = useState("");

	const form = useForm<SignupInput>({
		resolver: zodResolver(signupSchema),
		defaultValues: { email: "", password: "", confirmPassword: "" },
	});

	const onSubmit = form.handleSubmit(async (values) => {
		setError(null);
		const { error: createError } = await signUp.password({
			emailAddress: values.email,
			password: values.password,
		});
		if (createError) {
			setError(createError.message ?? "Sign up failed");
			return;
		}
		const { error: sendError } = await signUp.verifications.sendEmailCode();
		if (sendError) {
			setError(sendError.message ?? "Failed to send verification code");
			return;
		}
		setPendingVerification(true);
	});

	const onVerify = async () => {
		setError(null);
		const { error: verifyError } = await signUp.verifications.verifyEmailCode({
			code,
		});
		if (verifyError) {
			setError(verifyError.message ?? "Verification failed");
			return;
		}
		if (signUp.status === "complete") {
			await signUp.finalize({
				navigate: ({ decorateUrl }) => {
					const url = decorateUrl("/onboarding");
					if (url.startsWith("http")) {
						window.location.href = url;
					} else {
						navigate(url);
					}
				},
			});
		}
	};

	if (pendingVerification) {
		return (
			<Card className="mx-auto w-full max-w-md">
				<CardHeader>
					<CardTitle>Verify your email</CardTitle>
					<CardDescription>Enter the code sent to your email</CardDescription>
				</CardHeader>
				<CardContent className="grid gap-4">
					<div className="grid gap-2">
						<Label htmlFor="code">Verification code</Label>
						<Input
							id="code"
							value={code}
							onChange={(e) => setCode(e.target.value)}
						/>
					</div>
					{error && <p className="text-destructive text-sm">{error}</p>}
					<Button onClick={onVerify} disabled={fetchStatus === "fetching"}>
						Verify email
					</Button>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card className="mx-auto w-full max-w-md">
			<CardHeader>
				<CardTitle>Create your account</CardTitle>
				<CardDescription>
					For business owners starting with Mukalma
				</CardDescription>
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
					<Button
						type="submit"
						disabled={form.formState.isSubmitting || fetchStatus === "fetching"}
					>
						{form.formState.isSubmitting ? "Creating..." : "Create account"}
					</Button>
					<p className="text-center text-muted-foreground text-sm">
						Already have an account?{" "}
						<Link to="/login" className="underline">
							Sign in
						</Link>
					</p>
				</form>
			</CardContent>
		</Card>
	);
}
