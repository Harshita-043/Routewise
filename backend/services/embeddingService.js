const HASH_DIMENSION = 256;
const embeddingCache = new Map();

function tokenize(value = "") {
  return String(value)
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function hashToken(token) {
  let hash = 0;
  for (let index = 0; index < token.length; index += 1) {
    hash = (hash * 31 + token.charCodeAt(index)) % HASH_DIMENSION;
  }
  return hash;
}

function normalizeVector(vector) {
  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value ** 2, 0)) || 1;
  return vector.map((value) => Number((value / magnitude).toFixed(8)));
}

export function fallbackEmbedding(text) {
  const vector = Array.from({ length: HASH_DIMENSION }, () => 0);
  tokenize(text).forEach((token) => {
    vector[hashToken(token)] += 1;
  });
  return normalizeVector(vector);
}

/**
 * Generates an embedding for a single text using OpenAI when available,
 * falling back deterministically to local hash-based vector embeddings.
 */
export async function embedText(text) {
  if (!text || typeof text !== "string") {
    return fallbackEmbedding("");
  }

  const cacheKey = text.trim();
  if (embeddingCache.has(cacheKey)) {
    return embeddingCache.get(cacheKey);
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    const vector = fallbackEmbedding(text);
    embeddingCache.set(cacheKey, vector);
    return vector;
  }

  try {
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small",
        input: text,
      }),
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      throw new Error(`Embedding request failed with status ${response.status}`);
    }

    const data = await response.json();
    const embedding = data.data?.[0]?.embedding;

    if (!Array.isArray(embedding) || !embedding.length) {
      throw new Error("Embedding provider returned an empty vector");
    }

    embeddingCache.set(cacheKey, embedding);
    return embedding;
  } catch (err) {
    // If OpenAI is unavailable or quota is exceeded, use deterministic fallback
    const vector = fallbackEmbedding(text);
    embeddingCache.set(cacheKey, vector);
    return vector;
  }
}

/**
 * Batch generates embeddings for an array of texts.
 */
export async function embedBatch(texts = []) {
  return Promise.all(texts.map((t) => embedText(t)));
}

/**
 * Calculates cosine similarity between two vectors.
 * Strict rule: If dimensions do not match, returns 0.
 */
export function cosineSimilarity(vectorA = [], vectorB = []) {
  if (
    !Array.isArray(vectorA) ||
    !Array.isArray(vectorB) ||
    vectorA.length === 0 ||
    vectorB.length === 0 ||
    vectorA.length !== vectorB.length
  ) {
    return 0;
  }

  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let index = 0; index < vectorA.length; index += 1) {
    const valueA = vectorA[index] || 0;
    const valueB = vectorB[index] || 0;
    dotProduct += valueA * valueB;
    magnitudeA += valueA ** 2;
    magnitudeB += valueB ** 2;
  }

  const denominator = Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB);
  if (denominator === 0) {
    return 0;
  }

  return dotProduct / denominator;
}

export function isEmbeddingCompatible(vectorA, vectorB) {
  return (
    Array.isArray(vectorA) &&
    Array.isArray(vectorB) &&
    vectorA.length > 0 &&
    vectorA.length === vectorB.length
  );
}
