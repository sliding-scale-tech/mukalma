import mammoth from "mammoth";
import { extractText, getDocumentProxy } from "unpdf";

const ALLOWED_MIME_TYPES = new Set([
	"application/pdf",
	"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
	"text/plain",
	"text/markdown",
]);

export function isSupportedMimeType(mimeType: string): boolean {
	return ALLOWED_MIME_TYPES.has(mimeType);
}

export async function extractTextFromBlob(
	blob: Blob,
	mimeType: string,
): Promise<string> {
	if (!isSupportedMimeType(mimeType)) {
		throw new Error(`Unsupported file type: ${mimeType}`);
	}

	if (mimeType === "text/plain" || mimeType === "text/markdown") {
		return (await blob.text()).trim();
	}

	const buffer = Buffer.from(await blob.arrayBuffer());

	if (mimeType === "application/pdf") {
		// unpdf (modern pdfjs-dist) instead of pdf-parse: pdf-parse bundles a
		// 2017 pdf.js whose global state corrupts across warm serverless
		// invocations, causing bogus "bad XRef entry" failures on reuse.
		const pdf = await getDocumentProxy(new Uint8Array(buffer));
		const { text } = await extractText(pdf, { mergePages: true });
		return text.trim();
	}

	if (
		mimeType ===
		"application/vnd.openxmlformats-officedocument.wordprocessingml.document"
	) {
		const result = await mammoth.extractRawText({ buffer });
		return result.value.trim();
	}

	throw new Error(`Unsupported file type: ${mimeType}`);
}
