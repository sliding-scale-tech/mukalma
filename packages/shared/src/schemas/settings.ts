import { z } from "zod";

export const widgetPositionSchema = z.enum(["bottom-right", "bottom-left"]);

export const settingsSchema = z.object({
	name: z.string().min(1, "Business name is required").max(100),
	logoUrl: z.string().url("Enter a valid URL").optional().or(z.literal("")),
	aiSystemPrompt: z.string().max(2000).optional(),
	escalationKeywords: z.array(z.string().min(1)).min(1),
	allowedDomains: z.array(z.string().min(1)),
	widgetPosition: widgetPositionSchema,
	industry: z.string().optional(),
	timezone: z.string().optional(),
});

export type SettingsInput = z.infer<typeof settingsSchema>;

export function parseCommaSeparated(value: string): string[] {
	return value
		.split(",")
		.map((s) => s.trim())
		.filter(Boolean);
}
