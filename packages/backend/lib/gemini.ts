import {
	type Content,
	GoogleGenerativeAI,
	TaskType,
} from "@google/generative-ai";
import {
	CHAT_MODEL,
	EMBEDDING_MODEL,
} from "@mukalma/shared/constants/embeddings";

const BATCH_SIZE = 100;

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
	return getGeminiClient().getGenerativeModel({ model: EMBEDDING_MODEL });
}

export async function createEmbeddings(texts: string[]): Promise<number[][]> {
	if (texts.length === 0) {
		return [];
	}

	const model = getEmbeddingModel();
	const embeddings: number[][] = [];

	for (let i = 0; i < texts.length; i += BATCH_SIZE) {
		const batch = texts.slice(i, i + BATCH_SIZE);
		const result = await model.batchEmbedContents({
			requests: batch.map((text) => ({
				content: { role: "user", parts: [{ text }] },
				taskType: TaskType.RETRIEVAL_DOCUMENT,
			})),
		});

		for (const embedding of result.embeddings) {
			embeddings.push(embedding.values);
		}
	}

	return embeddings;
}

export async function createQueryEmbedding(query: string): Promise<number[]> {
	const model = getEmbeddingModel();
	const result = await model.embedContent({
		content: { role: "user", parts: [{ text: query }] },
		taskType: TaskType.RETRIEVAL_QUERY,
	});

	const values = result.embedding.values;
	if (!values.length) {
		throw new Error("Failed to create query embedding");
	}
	return values;
}

export type ChatMessage = {
	role: "user" | "model";
	content: string;
};

export async function generateChatReply(
	systemPrompt: string,
	history: ChatMessage[],
	userMessage: string,
): Promise<string> {
	const model = getGeminiClient().getGenerativeModel({
		model: CHAT_MODEL,
		systemInstruction: systemPrompt,
	});

	const chatHistory: Content[] = history.map((msg) => ({
		role: msg.role,
		parts: [{ text: msg.content }],
	}));

	const chat = model.startChat({ history: chatHistory });
	const result = await chat.sendMessage(userMessage);
	const response = result.response;
	return response.text();
}
