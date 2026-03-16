import { generatedStatResponseSchema, statIdeaResponseSchema } from "@/lib/stats/schemas";

type OpenRouterMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type OpenRouterJsonSchema = {
  name: string;
  strict: true;
  schema: Record<string, unknown>;
};

type OpenRouterChatResponse = {
  id?: string;
  choices?: Array<{
    message?: {
      content?: string | Array<{ type?: string; text?: string }>;
    };
  }>;
  error?: {
    message?: string;
  };
};

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

const statIdeaResponseJsonSchema: OpenRouterJsonSchema = {
  name: "oracle_games_stat_ideas",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      ideas: {
        type: "array",
        maxItems: 10,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            title: { type: "string" },
            description: { type: "string" },
            whyInteresting: { type: "string" },
            chartType: {
              type: "string",
              enum: ["bar", "line", "table", "pie", "scatter"],
            },
            requiredTool: {
              type: "string",
              enum: [
                "getTopScorers",
                "getMostSelected",
                "getBestValuePicks",
                "getBiggestMovers",
                "getTeamDistribution",
                "getTopPlayersByPoints",
                "getMostActivePlayers",
                "getBestAverageRankPlayers",
                "getF1BestPredictors",
                "getF1MostActivePredictors",
                "getF1BonusSpecialists",
                "getF1PopularWinnerPicks",
                "getF1MissedPredictionRisk",
              ],
            },
            confidence: { type: "number", minimum: 0, maximum: 1 },
          },
          required: [
            "title",
            "description",
            "whyInteresting",
            "chartType",
            "requiredTool",
            "confidence",
          ],
        },
      },
    },
    required: ["ideas"],
  },
};

const generatedStatResponseJsonSchema: OpenRouterJsonSchema = {
  name: "oracle_games_generated_stat",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      title: { type: "string" },
      summary: { type: "string" },
      chartType: {
        type: "string",
        enum: ["bar", "line", "table", "pie", "scatter"],
      },
      data: {
        type: "array",
        maxItems: 100,
        items: {
          type: "object",
          additionalProperties: {
            type: ["string", "number", "boolean", "null"],
          },
        },
      },
      confidence: { type: "number", minimum: 0, maximum: 1 },
    },
    required: ["title", "summary", "chartType", "data", "confidence"],
  },
};

function getOpenRouterApiKey() {
  return process.env.OPENROUTER_API_KEY ?? "";
}

export function hasOpenRouterConfig() {
  return getOpenRouterApiKey().length > 0;
}

export function getOpenRouterModel() {
  return process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini";
}

function extractTextContent(content: string | Array<{ text?: string }> | undefined) {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content.map((part) => (typeof part?.text === "string" ? part.text : "")).join("");
  }

  return "";
}

async function callOpenRouterStructuredJson<T>(params: {
  messages: OpenRouterMessage[];
  jsonSchema: OpenRouterJsonSchema;
  validator: (payload: unknown) => T;
}) {
  const apiKey = getOpenRouterApiKey();
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not configured");
  }

  const response = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(process.env.OPENROUTER_HTTP_REFERER
        ? { "HTTP-Referer": process.env.OPENROUTER_HTTP_REFERER }
        : {}),
      ...(process.env.OPENROUTER_APP_TITLE
        ? { "X-Title": process.env.OPENROUTER_APP_TITLE }
        : {}),
    },
    body: JSON.stringify({
      model: getOpenRouterModel(),
      messages: params.messages,
      stream: false,
      provider: {
        require_parameters: true,
        data_collection: "deny",
        zdr: true,
      },
      response_format: {
        type: "json_schema",
        json_schema: params.jsonSchema,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter request failed: ${response.status} ${errorText}`);
  }

  const payload = (await response.json()) as OpenRouterChatResponse;
  if (payload.error?.message) {
    throw new Error(`OpenRouter error: ${payload.error.message}`);
  }

  const content = extractTextContent(payload.choices?.[0]?.message?.content);
  if (!content) {
    throw new Error("OpenRouter returned empty content");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    throw new Error(
      `OpenRouter returned invalid JSON: ${error instanceof Error ? error.message : "Unknown parse error"}`
    );
  }

  return params.validator(parsed);
}

export async function generateIdeasWithOpenRouter(messages: OpenRouterMessage[]) {
  return callOpenRouterStructuredJson({
    messages,
    jsonSchema: statIdeaResponseJsonSchema,
    validator: (payload) => statIdeaResponseSchema.parse(payload),
  });
}

export async function generateStatWithOpenRouter(messages: OpenRouterMessage[]) {
  return callOpenRouterStructuredJson({
    messages,
    jsonSchema: generatedStatResponseJsonSchema,
    validator: (payload) => generatedStatResponseSchema.parse(payload),
  });
}
