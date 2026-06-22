import { z } from "zod";

import { isValidSlug } from "../utils/slugify";

export const onboardingSchema = z.object({
	businessName: z
		.string()
		.min(1, "Business name is required")
		.max(100, "Business name must be 100 characters or less"),
	slug: z
		.string()
		.min(1, "Slug is required")
		.refine((slug) => isValidSlug(slug), {
			message: "Slug is invalid or reserved",
		}),
	industry: z.string().optional(),
	timezone: z.string().optional(),
});

export type OnboardingInput = z.infer<typeof onboardingSchema>;
