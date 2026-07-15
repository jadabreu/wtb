const reasoningEfforts = ["none", "low", "medium", "high", "xhigh"] as const;

type ReasoningEffort = (typeof reasoningEfforts)[number];

function isReasoningEffort(value: string): value is ReasoningEffort {
  return reasoningEfforts.includes(value as ReasoningEffort);
}

function getApiKey() {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set.");
  }

  return apiKey;
}

function getOpenAIModel() {
  return process.env.OPENAI_MODEL || "gpt-5.5";
}

function getMaxOutputTokens() {
  const parsed = Number(process.env.OPENAI_MAX_OUTPUT_TOKENS);
  if (Number.isFinite(parsed)) return Math.min(12000, Math.max(1000, Math.round(parsed)));
  return 5000;
}

function getCompactionThreshold() {
  const parsed = Number(process.env.OPENAI_COMPACTION_THRESHOLD);
  if (Number.isFinite(parsed)) return Math.max(1000, Math.round(parsed));
  return 200000;
}

function getContextManagementConfig() {
  const threshold = getCompactionThreshold();
  if (threshold <= 0) return undefined;

  return [
    {
      type: "compaction" as const,
      compactThreshold: threshold
    }
  ];
}

function getReasoningConfig(effortOverride?: ReasoningEffort | null) {
  const configuredEffort = effortOverride ?? process.env.OPENAI_REASONING_EFFORT?.trim().toLowerCase();
  const effort = configuredEffort === "minimal" ? "none" : configuredEffort;
  if (!effort) return undefined;

  if (!isReasoningEffort(effort)) {
    throw new Error(`OPENAI_REASONING_EFFORT must be one of: ${reasoningEfforts.join(", ")}.`);
  }

  return { effort };
}

function incompleteResponseMessage(reason?: string) {
  if (reason === "max_output_tokens") {
    return "The AI response was cut off because it reached the output limit. Try again with a smaller n or a shorter prompt.";
  }

  return "The AI response was incomplete. Try again with a shorter prompt.";
}

async function openaiRequest<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(`https://api.openai.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      "Content-Type": "application/json",
      ...init.headers
    }
  });

  const payload = (await response.json()) as T & { error?: { message?: string } };

  if (!response.ok) {
    throw new Error(payload.error?.message || `OpenAI request failed with status ${response.status}.`);
  }

  return payload;
}

export {
  getContextManagementConfig,
  getMaxOutputTokens,
  getOpenAIModel,
  getReasoningConfig,
  isReasoningEffort,
  incompleteResponseMessage,
  openaiRequest
};
export type { ReasoningEffort };
