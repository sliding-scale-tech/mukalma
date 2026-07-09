export const EMBEDDING_MODEL = "gemini-embedding-001";
export const EMBEDDING_DIMENSIONS = 3072;

// Fast model for greeting/general chat — no document retrieval.
export const CHAT_MODEL = "gemini-2.5-flash";
// RAG model — receives full document context + conversation history.
export const RAG_MODEL = "gemini-2.5-flash";
// Fallback used when the primary model returns 503/429 (overloaded).
export const FALLBACK_MODEL = "gemini-1.5-flash";

export const CHUNK_TOKEN_SIZE = 280;
export const CHUNK_TOKEN_OVERLAP = 60;
export const RAG_TOP_K = 8;
export const RAG_SIMILARITY_THRESHOLD = 0.45;
// Chunks below the similarity threshold but above this floor may be used as
// padding context. Anything below this floor is never shown to the model.
export const RAG_FALLBACK_THRESHOLD = 0.35;
// Maximum number of chunks placed into the RAG prompt.
export const RAG_MAX_CONTEXT_CHUNKS = 5;
