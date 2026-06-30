import {
	CHUNK_TOKEN_OVERLAP,
	CHUNK_TOKEN_SIZE,
	EMBEDDING_MODEL,
} from "@mukalma/shared/constants/embeddings";
import { getEncoding } from "js-tiktoken";

const encoding = getEncoding("cl100k_base");

function tokenLen(text: string): number {
	return encoding.encode(text).length;
}

/**
 * Split a long block of text by sentence boundaries. Falls back to hard
 * token slicing for any single "sentence" that is still too large.
 */
function splitLongText(text: string, maxTokens: number): string[] {
	const sentences = text
		.split(/(?<=[.!?])\s+|\n+/)
		.map((s) => s.trim())
		.filter(Boolean);

	const pieces: string[] = [];
	for (const sentence of sentences) {
		if (tokenLen(sentence) <= maxTokens) {
			pieces.push(sentence);
			continue;
		}
		// Sentence itself is huge — hard-split by tokens.
		const tokens = encoding.encode(sentence);
		for (let i = 0; i < tokens.length; i += maxTokens) {
			pieces.push(encoding.decode(tokens.slice(i, i + maxTokens)).trim());
		}
	}
	return pieces;
}

/**
 * Semantic chunker.
 *
 * Splits text on paragraph boundaries first, packs paragraphs into chunks up
 * to CHUNK_TOKEN_SIZE, and carries CHUNK_TOKEN_OVERLAP tokens of context from
 * the previous chunk into the next. This keeps related sentences together and
 * always produces multiple chunks for multi-paragraph documents.
 */
export function chunkText(text: string): string[] {
	const normalized = text
		.replace(/\r\n/g, "\n")
		.replace(/\n{3,}/g, "\n\n")
		.trim();
	if (!normalized) return [];

	// Break into units: paragraphs, then sentence-split any oversized paragraph.
	const paragraphs = normalized
		.split(/\n\s*\n/)
		.map((p) => p.trim())
		.filter(Boolean);

	const units: string[] = [];
	for (const para of paragraphs) {
		if (tokenLen(para) <= CHUNK_TOKEN_SIZE) {
			units.push(para);
		} else {
			units.push(...splitLongText(para, CHUNK_TOKEN_SIZE));
		}
	}

	const chunks: string[] = [];
	let current: string[] = [];
	let currentTokens = 0;

	const flush = () => {
		if (current.length === 0) return;
		chunks.push(current.join("\n\n").trim());
	};

	for (const unit of units) {
		const unitTokens = tokenLen(unit);

		if (currentTokens + unitTokens > CHUNK_TOKEN_SIZE && current.length > 0) {
			flush();
			// Start the next chunk with a tail of the previous one for overlap.
			const prev = current.join("\n\n");
			const prevTokens = encoding.encode(prev);
			const tail = encoding
				.decode(
					prevTokens.slice(
						Math.max(0, prevTokens.length - CHUNK_TOKEN_OVERLAP),
					),
				)
				.trim();
			current = tail ? [tail] : [];
			currentTokens = tail ? tokenLen(tail) : 0;
		}

		current.push(unit);
		currentTokens += unitTokens;
	}
	flush();

	return chunks.filter((chunk) => chunk.trim().length > 0);
}

export { CHUNK_TOKEN_OVERLAP, CHUNK_TOKEN_SIZE, EMBEDDING_MODEL };
