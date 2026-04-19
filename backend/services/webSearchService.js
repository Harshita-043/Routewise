export async function searchWeb(query) {
  const serperKey = process.env.SERPER_API_KEY;
  if (!serperKey) {
    console.warn("[RAG] SERPER_API_KEY is missing. Web search will return empty.");
    return "";
  }

  try {
    const response = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: {
        "X-API-KEY": serperKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        q: query,
        gl: "in",
        num: 5,
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      throw new Error(`Serper API failed with status: ${response.status}`);
    }

    const data = await response.json();
    const results = [];

    if (data.organic) {
      data.organic.forEach((result) => {
        if (result.snippet) {
          results.push(result.snippet);
        }
      });
    }

    return results.join("\n\n");
  } catch (error) {
    console.error("[RAG] Live Web Search Error:", error.message);
    return "";
  }
}
