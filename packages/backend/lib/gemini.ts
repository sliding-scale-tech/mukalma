import {
	type Content,
	GoogleGenerativeAI,
	TaskType,
} from "@google/generative-ai";
import {
	CHAT_MODEL,
	EMBEDDING_MODEL,
	FALLBACK_MODEL,
	RAG_MODEL,
} from "@mukalma/shared/constants/embeddings";

const BATCH_SIZE = 100;

// Retry config for transient Gemini errors (503 overloaded, 429 rate-limited).
const MAX_RETRIES = 3;
const RETRY_BASE_MS = 1000;

function isRetryable(error: unknown): boolean {
	if (error instanceof Error) {
		const msg = error.message;
		return (
			msg.includes("503") ||
			msg.includes("Service Unavailable") ||
			msg.includes("429") ||
			msg.includes("Too Many Requests") ||
			msg.includes("overloaded") ||
			msg.includes("high demand")
		);
	}
	return false;
}

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
	let lastError: unknown;
	for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
		try {
			return await fn();
		} catch (err) {
			lastError = err;
			if (!isRetryable(err)) throw err;
			// Exponential back-off: 1 s, 2 s, 4 s
			const delay = RETRY_BASE_MS * 2 ** attempt;
			await new Promise((resolve) => setTimeout(resolve, delay));
		}
	}
	throw lastError;
}

function getGeminiClient(): GoogleGenerativeAI {
	const apiKey =
		process.env.GEMINI_API_KEY ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY;
	if (!apiKey) {
		throw new Error(
			"GEMINI_API_KEY (or GOOGLE_GENERATIVE_AI_API_KEY) is not configured",
		);
	}
	return new GoogleGenerativeAI(apiKey);
}

function getEmbeddingModel() {
	// gemini-embedding-001 lives on the v1beta endpoint.
	return getGeminiClient().getGenerativeModel(
		{ model: EMBEDDING_MODEL },
		{ apiVersion: "v1beta" },
	);
}

export async function createEmbeddings(texts: string[]): Promise<number[][]> {
	if (texts.length === 0) return [];

	const model = getEmbeddingModel();
	const embeddings: number[][] = [];

	for (let i = 0; i < texts.length; i += BATCH_SIZE) {
		const batch = texts.slice(i, i + BATCH_SIZE);
		const result = await withRetry(() =>
			model.batchEmbedContents({
				requests: batch.map((text) => ({
					content: { role: "user", parts: [{ text }] },
					taskType: TaskType.RETRIEVAL_DOCUMENT,
				})),
			}),
		);

		if (result.embeddings.length !== batch.length) {
			throw new Error("Embedding count mismatch from Gemini API");
		}
		for (const embedding of result.embeddings) {
			if (!embedding.values || embedding.values.length === 0) {
				throw new Error("Gemini returned an empty embedding");
			}
			embeddings.push(embedding.values);
		}
	}

	return embeddings;
}

export async function createQueryEmbedding(query: string): Promise<number[]> {
	const model = getEmbeddingModel();
	const result = await withRetry(() =>
		model.embedContent({
			content: { role: "user", parts: [{ text: query }] },
			taskType: TaskType.RETRIEVAL_QUERY,
		}),
	);

	const values = result.embedding.values;
	if (!values || values.length === 0) {
		throw new Error("Failed to create query embedding");
	}
	return values;
}

export type ChatMessage = {
	role: "user" | "model";
	content: string;
};

function trimHistory(history: ChatMessage[]): ChatMessage[] {
	// Gemini requires the history to start with a user turn.
	const trimmed = [...history];
	while (trimmed.length > 0 && trimmed[0].role === "model") {
		trimmed.shift();
	}
	return trimmed;
}

function buildChatHistory(history: ChatMessage[]): Content[] {
	return trimHistory(history).map((msg) => ({
		role: msg.role,
		parts: [{ text: msg.content }],
	}));
}

async function callModel(
	modelName: string,
	systemPrompt: string,
	history: ChatMessage[],
	userMessage: string,
): Promise<string> {
	const model = getGeminiClient().getGenerativeModel({
		model: modelName,
		systemInstruction: systemPrompt,
	});
	const chat = model.startChat({ history: buildChatHistory(history) });
	const result = await chat.sendMessage(userMessage);
	return result.response.text();
}

async function callWithFallback(
	primaryModel: string,
	systemPrompt: string,
	history: ChatMessage[],
	userMessage: string,
): Promise<string> {
	try {
		return await withRetry(() =>
			callModel(primaryModel, systemPrompt, history, userMessage),
		);
	} catch (err) {
		if (isRetryable(err)) {
			// Primary model exhausted retries — try the stable fallback once.
			console.warn(
				`Primary model ${primaryModel} unavailable, falling back to ${FALLBACK_MODEL}`,
			);
			return await callModel(
				FALLBACK_MODEL,
				systemPrompt,
				history,
				userMessage,
			);
		}
		throw err;
	}
}

/**
 * Light chat model — handles greetings, small-talk, and general replies.
 * Returns [NEEDS_DOCS] when document retrieval is required.
 */
export async function generateChatReply(
	systemPrompt: string,
	history: ChatMessage[],
	userMessage: string,
): Promise<string> {
	return callWithFallback(CHAT_MODEL, systemPrompt, history, userMessage);
}

/**
 * RAG model — receives retrieved document chunks and returns a grounded
 * answer or [ESCALATE].
 */
export async function generateRagReply(
	systemPrompt: string,
	history: ChatMessage[],
	userMessage: string,
): Promise<string> {
	return callWithFallback(RAG_MODEL, systemPrompt, history, userMessage);
}
