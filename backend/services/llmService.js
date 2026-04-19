const LLM_EXTRACTION_TIMEOUT_MS = 15000;
const LLM_CHAT_TIMEOUT_MS = 10000;

export async function extractStructuredData(systemPrompt, userPrompt) {
  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt }
  ];

  // Try OpenAI
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey) {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          response_format: { type: "json_object" },
          messages,
          temperature: 0.2
        }),
        signal: AbortSignal.timeout(LLM_EXTRACTION_TIMEOUT_MS)
      });
      if (res.ok) {
        const data = await res.json();
        return JSON.parse(data.choices[0].message.content);
      }
      console.warn(`[LLM] OpenAI extraction HTTP ${res.status}`);
    }
  } catch (err) {
    console.warn("[LLM] OpenAI extraction failed:", err.message);
  }

  // Try Groq
  try {
    const apiKey = process.env.GROQ_API_KEY;
    if (apiKey) {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          response_format: { type: "json_object" },
          messages,
          temperature: 0.2
        }),
        signal: AbortSignal.timeout(LLM_EXTRACTION_TIMEOUT_MS)
      });
      if (res.ok) {
        const data = await res.json();
        return JSON.parse(data.choices[0].message.content);
      }
      console.warn(`[LLM] Groq extraction HTTP ${res.status}`);
    }
  } catch (err) {
    console.warn("[LLM] Groq extraction failed:", err.message);
  }

  // Try Together
  try {
    const apiKey = process.env.TOGETHER_API_KEY;
    if (apiKey) {
      const res = await fetch("https://api.together.xyz/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo",
          response_format: { type: "json_object" },
          messages,
          temperature: 0.2
        }),
        signal: AbortSignal.timeout(LLM_EXTRACTION_TIMEOUT_MS)
      });
      if (res.ok) {
        const data = await res.json();
        return JSON.parse(data.choices[0].message.content);
      }
      console.warn(`[LLM] Together extraction HTTP ${res.status}`);
    }
  } catch (err) {
    console.warn("[LLM] Together extraction failed:", err.message);
  }

  return null;
}

export async function generateChatResponse(systemPrompt, userPrompt) {
  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt }
  ];

  // Try OpenAI
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey) {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages,
          temperature: 0.7
        }),
        signal: AbortSignal.timeout(LLM_CHAT_TIMEOUT_MS)
      });
      if (res.ok) {
        const data = await res.json();
        return data.choices[0].message.content;
      }
      console.warn(`[LLM] OpenAI chat HTTP ${res.status}`);
    }
  } catch (err) {
    console.warn("[LLM] OpenAI chat failed:", err.message);
  }

  // Try Groq
  try {
    const apiKey = process.env.GROQ_API_KEY;
    if (apiKey) {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          messages,
          temperature: 0.7
        }),
        signal: AbortSignal.timeout(LLM_CHAT_TIMEOUT_MS)
      });
      if (res.ok) {
        const data = await res.json();
        return data.choices[0].message.content;
      }
      console.warn(`[LLM] Groq chat HTTP ${res.status}`);
    }
  } catch (err) {
    console.warn("[LLM] Groq chat failed:", err.message);
  }

  return "Here are the top trains we found for your route.";
}
