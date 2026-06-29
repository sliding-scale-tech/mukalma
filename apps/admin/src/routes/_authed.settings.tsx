import { api } from "@mukalma/backend/convex/_generated/api";
import { Skeleton } from "@mukalma/ui/components/skeleton";
import { SettingsForm } from "@mukalma/ui/composites/onboarding-wizard";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";

export default function SettingsPage() {
	const current = useQuery(api.tenants.getCurrent);
	const updateSettings = useMutation(api.tenants.updateSettings);

	if (current === undefined) {
		return (
			<div className="flex-1 overflow-y-auto">
				<div className="max-w-2xl p-6 md:p-8">
					<Skeleton className="h-64 w-full" />
				</div>
			</div>
		);
	}

	if (!current?.tenant) {
		return (
			<div className="flex-1 overflow-y-auto">
				<div className="p-6 md:p-8">
					<p className="text-muted-foreground">Complete onboarding first.</p>
				</div>
			</div>
		);
	}

	const { tenant } = current;

	return (
		<div className="flex-1 overflow-y-auto">
			<div className="max-w-2xl space-y-6 p-6 md:p-8">
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
		</div>
	);
}
