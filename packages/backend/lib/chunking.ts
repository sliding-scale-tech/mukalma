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

const JOINER = "\n\n";
const JOINER_TOKENS = tokenLen(JOINER);

/**
 * Build the overlap carried into the next chunk from the tail of the
 * previous one. Prefers whole sentences (so chunks don't start mid-word);
 * falls back to a raw token slice when even one sentence exceeds the budget.
 */
function overlapTail(prevChunk: string, maxTokens: number): string {
	const sentences = prevChunk
		.split(/(?<=[.!?])\s+|\n+/)
		.map((s) => s.trim())
		.filter(Boolean);

	const tail: string[] = [];
	let total = 0;
	for (let i = sentences.length - 1; i >= 0; i--) {
		const cost = tokenLen(sentences[i]) + (tail.length > 0 ? 1 : 0);
		if (total + cost > maxTokens) break;
		tail.unshift(sentences[i]);
		total += cost;
	}
	if (tail.length > 0) {
		return tail.join(" ");
	}

	// Even the last sentence is bigger than the overlap budget — hard-slice.
	const tokens = encoding.encode(prevChunk);
	return encoding
		.decode(tokens.slice(Math.max(0, tokens.length - maxTokens)))
		.trim();
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
		// Account for the joiner tokens added between packed units.
		const joinerCost = current.length > 0 ? JOINER_TOKENS : 0;

		if (
			currentTokens + joinerCost + unitTokens > CHUNK_TOKEN_SIZE &&
			current.length > 0
		) {
			flush();
			// Start the next chunk with a sentence-aligned tail of the previous
			// one so context carries over without mid-word fragments.
			const tail = overlapTail(current.join(JOINER), CHUNK_TOKEN_OVERLAP);
			current = tail ? [tail] : [];
			currentTokens = tail ? tokenLen(tail) : 0;
		}

		current.push(unit);
		currentTokens += unitTokens + (current.length > 1 ? JOINER_TOKENS : 0);
	}
	flush();

	return chunks.filter((chunk) => chunk.trim().length > 0);
}

export { CHUNK_TOKEN_OVERLAP, CHUNK_TOKEN_SIZE, EMBEDDING_MODEL };
