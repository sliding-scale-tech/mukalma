import {
	CHUNK_TOKEN_OVERLAP,
	CHUNK_TOKEN_SIZE,
	EMBEDDING_MODEL,
} from "@mukalma/shared/constants/embeddings";
import { getEncoding } from "js-tiktoken";

const encoding = getEncoding("cl100k_base");

export function chunkText(text: string): string[] {
	const tokens = encoding.encode(text);
	if (tokens.length === 0) {
		return [];
	}

	const chunks: string[] = [];
	let start = 0;

	while (start < tokens.length) {
		const end = Math.min(start + CHUNK_TOKEN_SIZE, tokens.length);
		const slice = tokens.slice(start, end);
		chunks.push(encoding.decode(slice));
		if (end >= tokens.length) {
			break;
		}
		start = end - CHUNK_TOKEN_OVERLAP;
		if (start < 0) {
			start = 0;
		}
	}

	return chunks.filter((chunk) => chunk.trim().length > 0);
}

export { CHUNK_TOKEN_OVERLAP, CHUNK_TOKEN_SIZE, EMBEDDING_MODEL };
