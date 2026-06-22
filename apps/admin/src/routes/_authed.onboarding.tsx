import { useOrganizationList } from "@clerk/react-router";
import { api } from "@mukalma/backend/convex/_generated/api";
import type { OnboardingInput } from "@mukalma/shared";
import { OnboardingWizard } from "@mukalma/ui/composites/onboarding-wizard";
import { useAction, useConvex } from "convex/react";
import { useNavigate } from "react-router";

export default function OnboardingPage() {
	const navigate = useNavigate();
	const convex = useConvex();
	const createFromOnboarding = useAction(
		api.tenantsActions.createFromOnboarding,
	);
	const { setActive, isLoaded: orgListLoaded } = useOrganizationList({
		userMemberships: { infinite: true },
	});

	const isSlugAvailable = async (slug: string) => {
		const result = await convex.query(api.tenants.isSlugAvailable, { slug });
		return result.available;
	};

	const onSubmit = async (data: OnboardingInput) => {
		return await createFromOnboarding(data);
	};

	const onComplete = async (clerkOrgId: string) => {
		if (orgListLoaded && setActive) {
			await setActive({ organization: clerkOrgId });
		}
		navigate("/dashboard");
	};

	return (
		<OnboardingWizard
			onSubmit={onSubmit}
			isSlugAvailable={isSlugAvailable}
			onComplete={onComplete}
		/>
	);
}
