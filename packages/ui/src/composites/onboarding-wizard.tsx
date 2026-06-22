import { zodResolver } from "@hookform/resolvers/zod";
import {
	type OnboardingInput,
	onboardingSchema,
	slugify,
	suggestSlug,
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
import { Textarea } from "@mukalma/ui/components/textarea";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";

type OnboardingWizardProps = {
	onSubmit: (data: OnboardingInput) => Promise<{ clerkOrgId: string }>;
	isSlugAvailable: (slug: string) => Promise<boolean>;
	onComplete: (clerkOrgId: string) => Promise<void>;
};

export function OnboardingWizard({
	onSubmit,
	isSlugAvailable,
	onComplete,
}: OnboardingWizardProps) {
	const [step, setStep] = useState(0);
	const [error, setError] = useState<string | null>(null);
	const [slugSuggestion, setSlugSuggestion] = useState<string | null>(null);

	const form = useForm<OnboardingInput>({
		resolver: zodResolver(onboardingSchema),
		defaultValues: {
			businessName: "",
			slug: "",
			industry: "",
			timezone: "",
		},
	});

	const businessName = form.watch("businessName");
	const slug = form.watch("slug");

	useEffect(() => {
		if (step === 1 && businessName && !form.getValues("slug")) {
			form.setValue("slug", slugify(businessName));
		}
	}, [businessName, step, form]);

	const handleNext = async () => {
		setError(null);
		if (step === 0) {
			const valid = await form.trigger("businessName");
			if (valid) setStep(1);
			return;
		}
		if (step === 1) {
			const valid = await form.trigger("slug");
			if (!valid) return;
			const available = await isSlugAvailable(slug);
			if (!available) {
				const suggested = suggestSlug(slug);
				setSlugSuggestion(suggested);
				setError(`Slug "${slug}" is taken. Try "${suggested}"?`);
				return;
			}
			setSlugSuggestion(null);
			setStep(2);
			return;
		}
		if (step === 2) {
			setStep(3);
		}
	};

	const handleSubmit = form.handleSubmit(async (values) => {
		setError(null);
		try {
			const result = await onSubmit(values);
			await onComplete(result.clerkOrgId);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Onboarding failed");
		}
	});

	return (
		<Card className="mx-auto w-full max-w-lg">
			<CardHeader>
				<CardTitle>Set up your business</CardTitle>
				<CardDescription>Step {step + 1} of 4</CardDescription>
			</CardHeader>
			<CardContent className="grid gap-4">
				{step === 0 && (
					<div className="grid gap-2">
						<Label htmlFor="businessName">Business name</Label>
						<Input id="businessName" {...form.register("businessName")} />
					</div>
				)}
				{step === 1 && (
					<div className="grid gap-2">
						<Label htmlFor="slug">URL slug</Label>
						<Input id="slug" {...form.register("slug")} />
						{slugSuggestion && (
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={() => {
									form.setValue("slug", slugSuggestion);
									setSlugSuggestion(null);
									setError(null);
								}}
							>
								Use {slugSuggestion}
							</Button>
						)}
					</div>
				)}
				{step === 2 && (
					<div className="grid gap-2 rounded-md border p-4">
						<p className="text-muted-foreground text-sm">
							Your subdomain preview
						</p>
						<p className="font-medium">{slug || "your-slug"}.mukalma.co</p>
					</div>
				)}
				{step === 3 && (
					<div className="grid gap-4">
						<div className="grid gap-2">
							<Label htmlFor="industry">Industry (optional)</Label>
							<Input id="industry" {...form.register("industry")} />
						</div>
						<div className="grid gap-2">
							<Label htmlFor="timezone">Timezone (optional)</Label>
							<Input
								id="timezone"
								placeholder="e.g. Asia/Karachi"
								{...form.register("timezone")}
							/>
						</div>
					</div>
				)}
				{error && <p className="text-destructive text-sm">{error}</p>}
				<div className="flex justify-between gap-2">
					<Button
						type="button"
						variant="outline"
						disabled={step === 0}
						onClick={() => setStep((s) => s - 1)}
					>
						Back
					</Button>
					{step < 3 ? (
						<Button type="button" onClick={handleNext}>
							Next
						</Button>
					) : (
						<Button
							type="button"
							onClick={handleSubmit}
							disabled={form.formState.isSubmitting}
						>
							{form.formState.isSubmitting ? "Creating..." : "Complete setup"}
						</Button>
					)}
				</div>
			</CardContent>
		</Card>
	);
}

export function SettingsForm({
	initial,
	onSave,
}: {
	initial: {
		name: string;
		logoUrl?: string;
		aiSystemPrompt?: string;
		escalationKeywords: string[];
		allowedDomains: string[];
		widgetPosition: "bottom-right" | "bottom-left";
		industry?: string;
		timezone?: string;
	};
	onSave: (values: {
		name: string;
		logoUrl?: string;
		aiSystemPrompt?: string;
		escalationKeywords: string[];
		allowedDomains: string[];
		widgetPosition: "bottom-right" | "bottom-left";
		industry?: string;
		timezone?: string;
	}) => Promise<void>;
}) {
	const [error, setError] = useState<string | null>(null);
	const [keywords, setKeywords] = useState(
		initial.escalationKeywords.join(", "),
	);
	const [domains, setDomains] = useState(initial.allowedDomains.join(", "));
	const [widgetPosition, setWidgetPosition] = useState(initial.widgetPosition);

	const form = useForm({
		defaultValues: {
			name: initial.name,
			logoUrl: initial.logoUrl ?? "",
			aiSystemPrompt: initial.aiSystemPrompt ?? "",
			industry: initial.industry ?? "",
			timezone: initial.timezone ?? "",
		},
	});

	const onSubmit = form.handleSubmit(async (values) => {
		setError(null);
		try {
			await onSave({
				name: values.name,
				logoUrl: values.logoUrl || undefined,
				aiSystemPrompt: values.aiSystemPrompt || undefined,
				escalationKeywords: keywords
					.split(",")
					.map((s) => s.trim())
					.filter(Boolean),
				allowedDomains: domains
					.split(",")
					.map((s) => s.trim())
					.filter(Boolean),
				widgetPosition,
				industry: values.industry || undefined,
				timezone: values.timezone || undefined,
			});
		} catch (err) {
			setError(err instanceof Error ? err.message : "Save failed");
		}
	});

	return (
		<Card>
			<CardHeader>
				<CardTitle>Tenant settings</CardTitle>
			</CardHeader>
			<CardContent>
				<form onSubmit={onSubmit} className="grid max-w-xl gap-4">
					<div className="grid gap-2">
						<Label htmlFor="name">Business name</Label>
						<Input id="name" {...form.register("name")} />
					</div>
					<div className="grid gap-2">
						<Label htmlFor="logoUrl">Logo URL</Label>
						<Input id="logoUrl" {...form.register("logoUrl")} />
					</div>
					<div className="grid gap-2">
						<Label htmlFor="aiSystemPrompt">AI system prompt override</Label>
						<Textarea
							id="aiSystemPrompt"
							{...form.register("aiSystemPrompt")}
						/>
					</div>
					<div className="grid gap-2">
						<Label htmlFor="keywords">
							Escalation keywords (comma-separated)
						</Label>
						<Input
							id="keywords"
							value={keywords}
							onChange={(e) => setKeywords(e.target.value)}
						/>
					</div>
					<div className="grid gap-2">
						<Label htmlFor="domains">
							Allowed widget domains (comma-separated)
						</Label>
						<Input
							id="domains"
							value={domains}
							onChange={(e) => setDomains(e.target.value)}
						/>
					</div>
					<div className="grid gap-2">
						<Label htmlFor="widgetPosition">Widget position</Label>
						<select
							id="widgetPosition"
							className="h-9 rounded-md border px-3 text-sm"
							value={widgetPosition}
							onChange={(e) =>
								setWidgetPosition(
									e.target.value as "bottom-right" | "bottom-left",
								)
							}
						>
							<option value="bottom-right">Bottom right</option>
							<option value="bottom-left">Bottom left</option>
						</select>
					</div>
					{error && <p className="text-destructive text-sm">{error}</p>}
					<Button type="submit" disabled={form.formState.isSubmitting}>
						Save settings
					</Button>
				</form>
			</CardContent>
		</Card>
	);
}
