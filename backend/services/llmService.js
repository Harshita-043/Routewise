const LLM_EXTRACTION_TIMEOUT_MS = 15000;
const LLM_CHAT_TIMEOUT_MS = 12000;

/**
 * Safely parses JSON from LLM output, stripping markdown code fences and extraneous text.
 */
export function cleanAndParseJson(rawContent) {
  if (!rawContent || typeof rawContent !== "string") {
    return null;
  }

  let cleaned = rawContent.trim();

  // Strip markdown code fences if present (```json ... ``` or ``` ...)
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  }

  try {
    return JSON.parse(cleaned);
  } catch {
    // If there is preamble or postscript text, extract the outermost JSON object or array
    const jsonMatch = cleaned.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch {
        return null;
      }
    }
    return null;
  }
}

/**
 * Executes an LLM completion request with multi-provider fallback.
 * Provider chain:
 *  1. OpenAI (Primary)
 *  2. Groq (Fallback 1)
 *  3. Together AI (Fallback 2)
 */
export async function callLLM({
  systemPrompt,
  userPrompt,
  json = false,
  temperature = 0.2,
  timeoutMs = LLM_EXTRACTION_TIMEOUT_MS,
}) {
  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];

  const providers = [];

  // Provider 1: OpenAI
  if (process.env.OPENAI_API_KEY) {
    providers.push({
      name: "openai",
      url: "https://api.openai.com/v1/chat/completions",
      apiKey: process.env.OPENAI_API_KEY,
      models: [process.env.OPENAI_MODEL || "gpt-4o-mini", "gpt-4o"],
      supportsJsonFormat: true,
    });
  }

  // Provider 2: Groq
  if (process.env.GROQ_API_KEY) {
    const configuredGroq = process.env.GROQ_MODEL;
    const defaultGroqModels = ["openai/gpt-oss-20b", "qwen/qwen3.8-27b", "openai/gpt-oss-120b"];
    const groqModels = configuredGroq
      ? [configuredGroq, ...defaultGroqModels.filter((m) => m !== configuredGroq)]
      : defaultGroqModels;

    providers.push({
      name: "groq",
      url: "https://api.groq.com/openai/v1/chat/completions",
      apiKey: process.env.GROQ_API_KEY,
      models: groqModels,
      supportsJsonFormat: true,
    });
  }

  // Provider 3: Together AI
  if (process.env.TOGETHER_API_KEY) {
    const configuredTogether = process.env.TOGETHER_MODEL;
    const defaultTogetherModels = [
      "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo",
      "mistralai/Mixtral-8x7B-Instruct-v0.1",
    ];
    const togetherModels = configuredTogether
      ? [configuredTogether, ...defaultTogetherModels.filter((m) => m !== configuredTogether)]
      : defaultTogetherModels;

    providers.push({
      name: "together",
      url: "https://api.together.xyz/v1/chat/completions",
      apiKey: process.env.TOGETHER_API_KEY,
      models: togetherModels,
      supportsJsonFormat: false,
    });
  }

  const failures = [];

  for (const provider of providers) {
    for (const model of provider.models) {
      try {
        const bodyPayload = {
          model,
          messages,
          temperature,
        };

        if (json && provider.supportsJsonFormat) {
          bodyPayload.response_format = { type: "json_object" };
        }

        const res = await fetch(provider.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${provider.apiKey}`,
          },
          body: JSON.stringify(bodyPayload),
          signal: AbortSignal.timeout(timeoutMs),
        });

        if (res.ok) {
          const result = await res.json();
          const rawContent = result.choices?.[0]?.message?.content || "";
          
          if (json) {
            const parsed = cleanAndParseJson(rawContent);
            if (parsed !== null) {
              return {
                rawContent,
                data: parsed,
                provider: provider.name,
                model,
              };
            }
            // If response couldn't be parsed as JSON, try next model
            console.warn(`[LLM] ${provider.name} (${model}) response could not be parsed as JSON.`);
            continue;
          }

          return {
            rawContent,
            data: null,
            provider: provider.name,
            model,
          };
        }

        // Provider returned non-200 (e.g. 401 auth, 402 payment, 404 model, 429 quota)
        const errorText = await res.text().catch(() => "");
        console.warn(`[LLM] ${provider.name} (${model}) failed HTTP ${res.status}: ${errorText.slice(0, 100)}`);
        failures.push(`${provider.name}:${model}:HTTP_${res.status}`);

        // If auth or account-level billing failure, break from this provider to next provider
        if (res.status === 401 || res.status === 402) {
          break;
        }
      } catch (err) {
        console.warn(`[LLM] ${provider.name} (${model}) exception:`, err.message);
        failures.push(`${provider.name}:${model}:${err.message}`);
      }
    }
  }

  console.warn("[LLM] All providers failed:", failures.join(", "));
  return null;
}

/**
 * Extracts structured JSON data using the highest-priority working LLM.
 */
export async function extractStructuredData(systemPrompt, userPrompt) {
  const result = await callLLM({
    systemPrompt,
    userPrompt,
    json: true,
    temperature: 0.1,
    timeoutMs: LLM_EXTRACTION_TIMEOUT_MS,
  });

  return result ? result.data : null;
}

/**
 * Generates conversational chat responses with multi-provider fallback.
 */
export async function generateChatResponse(systemPrompt, userPrompt) {
  const result = await callLLM({
    systemPrompt,
    userPrompt,
    json: false,
    temperature: 0.6,
    timeoutMs: LLM_CHAT_TIMEOUT_MS,
  });

  if (result && result.rawContent) {
    return result.rawContent.trim();
  }

  return "Here are the top trains we found for your route.";
}
