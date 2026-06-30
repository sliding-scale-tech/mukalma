export const EMBEDDING_MODEL = "gemini-embedding-001";
export const EMBEDDING_DIMENSIONS = 3072;

// Fast model for greeting/general chat — no document retrieval.
export const CHAT_MODEL = "gemini-2.5-flash";
// RAG model — receives full document context + conversation history.
export const RAG_MODEL = "gemini-2.5-flash";
// Fallback used when the primary model returns 503/429 (overloaded).
export const FALLBACK_MODEL = "gemini-1.5-flash";

export const CHUNK_TOKEN_SIZE = 500;
export const CHUNK_TOKEN_OVERLAP = 50;
export const RAG_TOP_K = 5;
export const RAG_SIMILARITY_THRESHOLD = 0.5;
