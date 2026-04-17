const HASH_DIMENSION = 256;

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

function fallbackEmbedding(text) {
  const vector = Array.from({ length: HASH_DIMENSION }, () => 0);
  tokenize(text).forEach((token) => {
    vector[hashToken(token)] += 1;
  });
  return normalizeVector(vector);
}

export async function embedText(text) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return fallbackEmbedding(text);
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
    });

    if (!response.ok) {
      throw new Error(`Embedding request failed with ${response.status}`);
    }

    const data = await response.json();
    const embedding = data.data?.[0]?.embedding;

    if (!Array.isArray(embedding) || !embedding.length) {
      throw new Error("Embedding provider returned an empty vector");
    }

    return embedding;
  } catch {
    return fallbackEmbedding(text);
  }
}

export function cosineSimilarity(vectorA = [], vectorB = []) {
  const length = Math.min(vectorA.length, vectorB.length);

  if (!length) {
    return 0;
  }

  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let index = 0; index < length; index += 1) {
    const valueA = vectorA[index] || 0;
    const valueB = vectorB[index] || 0;
    dotProduct += valueA * valueB;
    magnitudeA += valueA ** 2;
    magnitudeB += valueB ** 2;
  }

  return dotProduct / ((Math.sqrt(magnitudeA) || 1) * (Math.sqrt(magnitudeB) || 1));
}
