import { api } from "@mukalma/backend/convex/_generated/api";
import { Skeleton } from "@mukalma/ui/components/skeleton";
import { SettingsForm } from "@mukalma/ui/composites/onboarding-wizard";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";

export default function SettingsPage() {
	const current = useQuery(api.tenants.getCurrent);
	const updateSettings = useMutation(api.tenants.updateSettings);

	if (current === undefined) {
		return <Skeleton className="h-64 w-full max-w-xl" />;
	}

	if (!current?.tenant) {
		return <p className="text-muted-foreground">Complete onboarding first.</p>;
	}

	const { tenant } = current;

	return (
		<div className="space-y-6">
			<div>
				<h1 className="font-semibold text-2xl tracking-tight">Settings</h1>
				<p className="text-muted-foreground">
					Manage your tenant configuration
				</p>
			</div>
			<SettingsForm
				initial={{
					name: tenant.name,
					logoUrl: tenant.settings.logoUrl,
					aiSystemPrompt: tenant.settings.aiSystemPrompt,
					escalationKeywords: tenant.settings.escalationKeywords,
					allowedDomains: tenant.settings.allowedDomains,
					widgetPosition: tenant.settings.widgetPosition,
					industry: tenant.settings.industry,
					timezone: tenant.settings.timezone,
				}}
				onSave={async (values) => {
					try {
						await updateSettings(values);
						toast.success("Settings saved");
					} catch (err) {
						toast.error(
							err instanceof Error ? err.message : "Failed to save settings",
						);
						throw err;
					}
				}}
			/>
		</div>
	);
}
