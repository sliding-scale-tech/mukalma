import { useSignIn } from "@clerk/react-router";
import { zodResolver } from "@hookform/resolvers/zod";
import {
	type ForgotPasswordInput,
	forgotPasswordSchema,
	type ResetPasswordInput,
	resetPasswordSchema,
} from "@mukalma/shared";
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

export function ForgotPasswordForm() {
	const { signIn, fetchStatus } = useSignIn();
	const navigate = useNavigate();
	const [step, setStep] = useState<"email" | "reset">("email");
	const [error, setError] = useState<string | null>(null);

	const emailForm = useForm<ForgotPasswordInput>({
		resolver: zodResolver(forgotPasswordSchema),
		defaultValues: { email: "" },
	});

	const resetForm = useForm<ResetPasswordInput>({
		resolver: zodResolver(resetPasswordSchema),
		defaultValues: { code: "", password: "", confirmPassword: "" },
	});

	const onSendCode = emailForm.handleSubmit(async (values) => {
		setError(null);
		const { error: createError } = await signIn.create({
			identifier: values.email,
		});
		if (createError) {
			setError(createError.message ?? "Failed to start reset flow");
			return;
		}
		const { error: sendError } = await signIn.resetPasswordEmailCode.sendCode();
		if (sendError) {
			setError(sendError.message ?? "Failed to send reset code");
			return;
		}
		setStep("reset");
	});

	const onReset = resetForm.handleSubmit(async (values) => {
		setError(null);
		const { error: verifyError } =
			await signIn.resetPasswordEmailCode.verifyCode({
				code: values.code,
			});
		if (verifyError) {
			setError(verifyError.message ?? "Invalid code");
			return;
		}
		const { error: submitError } =
			await signIn.resetPasswordEmailCode.submitPassword({
				password: values.password,
			});
		if (submitError) {
			setError(submitError.message ?? "Password reset failed");
			return;
		}
		if (signIn.status === "complete") {
			await signIn.finalize({
				navigate: ({ decorateUrl }) => {
					const url = decorateUrl("/login");
					if (url.startsWith("http")) {
						window.location.href = url;
					} else {
						navigate(url);
					}
				},
			});
		}
	});

	return (
		<Card className="mx-auto w-full max-w-md">
			<CardHeader>
				<CardTitle>Reset password</CardTitle>
				<CardDescription>
					{step === "email"
						? "We will email you a verification code"
						: "Enter the code and your new password"}
				</CardDescription>
			</CardHeader>
			<CardContent>
				{step === "email" ? (
					<form onSubmit={onSendCode} className="grid gap-4">
						<div className="grid gap-2">
							<Label htmlFor="email">Email</Label>
							<Input id="email" type="email" {...emailForm.register("email")} />
						</div>
						{error && <p className="text-destructive text-sm">{error}</p>}
						<Button type="submit" disabled={fetchStatus === "fetching"}>
							Send code
						</Button>
					</form>
				) : (
					<form onSubmit={onReset} className="grid gap-4">
						<div className="grid gap-2">
							<Label htmlFor="code">Code</Label>
							<Input id="code" {...resetForm.register("code")} />
						</div>
						<div className="grid gap-2">
							<Label htmlFor="password">New password</Label>
							<Input
								id="password"
								type="password"
								{...resetForm.register("password")}
							/>
						</div>
						<div className="grid gap-2">
							<Label htmlFor="confirmPassword">Confirm password</Label>
							<Input
								id="confirmPassword"
								type="password"
								{...resetForm.register("confirmPassword")}
							/>
						</div>
						{error && <p className="text-destructive text-sm">{error}</p>}
						<Button type="submit" disabled={fetchStatus === "fetching"}>
							Reset password
						</Button>
					</form>
				)}
				<p className="mt-4 text-center text-sm">
					<Link to="/login" className="text-muted-foreground underline">
						Back to sign in
					</Link>
				</p>
			</CardContent>
		</Card>
	);
}
