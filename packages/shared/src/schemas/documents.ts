import { z } from "zod";

export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

export const ALLOWED_MIME_TYPES = [
	"application/pdf",
	"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
	"text/plain",
	"text/markdown",
] as const;

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

export function isAllowedMimeType(
	mimeType: string,
): mimeType is AllowedMimeType {
	return (ALLOWED_MIME_TYPES as readonly string[]).includes(mimeType);
}

export const documentCreateSchema = z.object({
	storageId: z.string().min(1, "Storage ID is required"),
	name: z.string().min(1, "File name is required").max(255),
	mimeType: z
		.string()
		.refine(
			isAllowedMimeType,
			"Unsupported file type. Use PDF, DOCX, TXT, or Markdown.",
		),
	sizeBytes: z
		.number()
		.int()
		.positive()
		.max(MAX_DOCUMENT_BYTES, "File must be 10 MB or smaller"),
});

export type DocumentCreateInput = z.infer<typeof documentCreateSchema>;

export function formatFileSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function mimeTypeLabel(mimeType: string): string {
	switch (mimeType) {
		case "application/pdf":
			return "PDF";
		case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
			return "DOCX";
		case "text/plain":
			return "TXT";
		case "text/markdown":
			return "Markdown";
		default:
			return mimeType;
	}
}
