import { z } from "zod";
import { fieldLabels, isListFieldKey, parseListFieldValue, type AppState, type FieldKey, type GeneratedJobStep, type GeneratedOption, type Suggestion, type WorkflowStepKey } from "./types";

export type AiPayload = {
  message: string;
  suggestions: Suggestion[];
  options: GeneratedOption[];
  jobSteps: GeneratedJobStep[];
};

type StreamOptions = {
  onMessageDelta?: (delta: string) => void | Promise<void>;
};

type ResponseBodyOptions = {
  conversationId?: string;
  stream?: boolean;
  includeSuccessMetrics?: boolean;
  workflowStep?: WorkflowStepKey;
};

const fieldKeyValues = ["product", "end_user", "context", "job", "emotional_job", "social_job", "complexity_factors"] as const;

const optionSchema = z.object({
  key: z.enum(fieldKeyValues),
  value: z.string().min(1),
  rationale: z.string()
});

const generatedJobStepSchema = z.object({
  title: z.string().min(1),
  description: z.string(),
  success_metrics: z.array(z.string().min(1)).max(20)
});

const replySchema = z.object({
  message: z.string().min(1),
  suggestions: z.array(optionSchema).max(4),
  options: z.array(optionSchema).max(100),
  job_steps: z.array(generatedJobStepSchema).max(20)
});

const optionResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["key", "value", "rationale"],
  properties: {
    key: {
      type: "string",
      enum: [...fieldKeyValues]
    },
    value: {
      type: "string",
      description: "A concrete candidate value the user can accept."
    },
    rationale: {
      type: "string",
      description: "A short reason this option fits the conversation."
    }
  }
} as const;

const responseFormatSchema = {
  type: "object",
  additionalProperties: false,
  required: ["message", "suggestions", "options", "job_steps"],
  properties: {
    message: {
      type: "string",
      description: "A concise coaching reply. Ask at most one follow-up question."
    },
    suggestions: {
      type: "array",
      maxItems: 4,
      description: "The best quick-save field values to show as primary recommendation chips.",
      items: optionResponseSchema
    },
    options: {
      type: "array",
      maxItems: 100,
      description: "Every generated field-like option or candidate, including all requested N candidates when they map to a JTBD field.",
      items: optionResponseSchema
    },
    job_steps: {
      type: "array",
      maxItems: 20,
      description: "Ordered job-map candidates. Leave success_metrics empty unless the current user request asks for success criteria, measures, metrics, or success metrics.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "description", "success_metrics"],
        properties: {
          title: {
            type: "string",
            description: "Concise job-step name."
          },
          description: {
            type: "string",
            description: "What the user is trying to accomplish in this step."
          },
          success_metrics: {
            type: "array",
            maxItems: 20,
            description: "Specific success criteria for this job step. Use an empty array unless the current user request explicitly asks for success criteria, measures, metrics, or success metrics.",
            items: {
              type: "string"
            }
          }
        }
      }
    }
  }
} as const;

type OpenAIConversation = {
  id: string;
};

type OpenAIResponse = {
  id: string;
  status?: string;
  output?: Array<{
    type?: string;
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
  output_text?: string;
  incomplete_details?: {
    reason?: string;
  } | null;
  error?: {
    message?: string;
  };
};

function getApiKey() {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set.");
  }

  return apiKey;
}

const reasoningEfforts = ["none", "minimal", "low", "medium", "high", "xhigh"] as const;

type ReasoningEffort = (typeof reasoningEfforts)[number];

function getMaxOutputTokens() {
  const parsed = Number(process.env.OPENAI_MAX_OUTPUT_TOKENS);
  if (Number.isFinite(parsed)) return Math.min(12000, Math.max(1000, Math.round(parsed)));
  return 5000;
}

function getReasoningConfig() {
  const effort = process.env.OPENAI_REASONING_EFFORT?.trim().toLowerCase();
  if (!effort) return undefined;

  if (!reasoningEfforts.includes(effort as ReasoningEffort)) {
    throw new Error(`OPENAI_REASONING_EFFORT must be one of: ${reasoningEfforts.join(", ")}.`);
  }

  return { effort: effort as ReasoningEffort };
}

function shouldIncludeSuccessMetrics(userMessage: string) {
  const normalized = userMessage.toLowerCase();
  const exclusionPattern = /\b(no|without|exclude|omit|don't|do not)\b[^.?!\n]{0,80}\b(success\s+)?(criteria|criterion|metrics?|measures?|indicators?|kpis?)\b/;
  if (exclusionPattern.test(normalized)) return false;

  return /\b(success\s+(criteria|criterion|metrics?|measures?|indicators?)|criteria\s+for\s+success|metrics?\s+for\s+(each\s+)?(job\s+)?steps?|how\s+(will|would|can)\s+(the\s+)?(user|they|we)\s+know|kpis?)\b/.test(normalized);
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

async function openaiStreamRequest(path: string, body: unknown) {
  const response = await fetch(`https://api.openai.com/v1${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
    throw new Error(payload?.error?.message || `OpenAI request failed with status ${response.status}.`);
  }

  if (!response.body) {
    throw new Error("OpenAI did not return a stream.");
  }

  return response.body;
}

function buildResponseBody(userMessage: string, state: AppState, options: ResponseBodyOptions = {}) {
  const includeSuccessMetrics = options.includeSuccessMetrics ?? shouldIncludeSuccessMetrics(userMessage);

  return {
    model: process.env.OPENAI_MODEL || "gpt-5.2",
    ...(options.conversationId ? { conversation: options.conversationId } : {}),
    instructions: buildInstructions(state, includeSuccessMetrics, options.workflowStep),
    input: [
      {
        role: "user",
        content: userMessage
      }
    ],
    text: {
      format: {
        type: "json_schema",
        name: "jtbd_coach_reply",
        strict: true,
        schema: responseFormatSchema
      }
    },
    max_output_tokens: getMaxOutputTokens(),
    reasoning: getReasoningConfig(),
    stream: Boolean(options.stream)
  };
}

function normalizeReply(rawText: string, includeSuccessMetrics: boolean): AiPayload {
  let parsed: z.infer<typeof replySchema>;

  try {
    parsed = replySchema.parse(JSON.parse(rawText));
  } catch {
    throw new Error("The AI response could not be read completely. Try again with a smaller n or a shorter prompt.");
  }

  const normalizeOption = (option: z.infer<typeof optionSchema>): GeneratedOption => ({
    key: option.key,
    value: option.value.trim(),
    rationale: option.rationale.trim()
  });

  return {
    message: parsed.message.trim(),
    suggestions: parsed.suggestions.map(normalizeOption),
    options: parsed.options.map(normalizeOption),
    jobSteps: parsed.job_steps.map((step) => ({
      title: step.title.trim(),
      description: step.description.trim(),
      successMetrics: includeSuccessMetrics ? step.success_metrics.map((metric) => metric.trim()).filter(Boolean) : []
    }))
  };
}

function parseSseBlock(block: string) {
  const data = block
    .split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trimStart())
    .join("\n");

  if (!data || data === "[DONE]") return null;
  return JSON.parse(data) as { type?: string; delta?: string; error?: { message?: string }; response?: OpenAIResponse };
}

function extractPartialJsonStringValue(source: string, key: string) {
  const keyPattern = `"${key}"`;
  const keyIndex = source.indexOf(keyPattern);
  if (keyIndex === -1) return "";

  const colonIndex = source.indexOf(":", keyIndex + keyPattern.length);
  if (colonIndex === -1) return "";

  let quoteIndex = -1;
  for (let index = colonIndex + 1; index < source.length; index += 1) {
    const char = source[index];
    if (/\s/.test(char)) continue;
    if (char !== '"') return "";
    quoteIndex = index;
    break;
  }

  if (quoteIndex === -1) return "";

  let value = "";
  let escaping = false;
  for (let index = quoteIndex + 1; index < source.length; index += 1) {
    const char = source[index];

    if (escaping) {
      value += `\\${char}`;
      escaping = false;
      continue;
    }

    if (char === "\\") {
      escaping = true;
      continue;
    }

    if (char === '"') break;
    value += char;
  }

  try {
    return JSON.parse(`"${value}"`) as string;
  } catch {
    return value.replace(/\\n/g, "\n").replace(/\\"/g, '"').replace(/\\\\/g, "\\");
  }
}

export async function createJtbdConversation() {
  const conversation = await openaiRequest<OpenAIConversation>("/conversations", {
    method: "POST",
    body: JSON.stringify({
      metadata: {
        app: "jtbd-helper",
        purpose: "jtbd-research-coaching"
      }
    })
  });

  return conversation.id;
}

function formatJobMap(state: AppState) {
  if (state.jobSteps.length === 0) return "(no job steps selected yet)";

  return state.jobSteps
    .map((step, index) => {
      const metrics = step.successMetrics.length > 0 ? step.successMetrics.join("; ") : "no success metrics yet";
      return `${index + 1}. ${step.title}${step.description ? ` - ${step.description}` : ""} | Success metrics: ${metrics}`;
    })
    .join("\n");
}

function formatSelectionFact(key: FieldKey, value: string) {
  if (!value.trim()) return `${fieldLabels[key]}: (not selected yet)`;

  if (!isListFieldKey(key)) {
    return `${fieldLabels[key]}: ${value}`;
  }

  const items = parseListFieldValue(value);
  if (items.length === 0) return `${fieldLabels[key]}: (not selected yet)`;
  return `${fieldLabels[key]}:\n${items.map((item) => `- ${item}`).join("\n")}`;
}

function buildInstructions(state: AppState, includeSuccessMetrics: boolean, workflowStep?: WorkflowStepKey) {
  const selectedFacts = Object.entries(state.selections)
    .map(([key, value]) => formatSelectionFact(key as FieldKey, value))
    .join("\n");
  const jobMap = formatJobMap(state);

  return `
You are a practical Jobs To Be Done research coach.

The user is defining a JTBD research target. Keep the interaction focused on these fields:
- product: the product or service being researched
- end_user: the specific person or role trying to make progress
- context: the situation, trigger, constraint, or environment
- job: the functional progress the end user is trying to make
- emotional_job: list of ways the end user wants to feel or stop feeling
- social_job: list of ways the end user wants to be perceived or avoid being perceived
- complexity_factors: list of conditions that make the job harder, riskier, slower, or more urgent
- job_steps: ordered steps in the user's job map
- success_metrics: criteria attached to each job step, never as a detached global list

Current selected facts from the app UI:
${selectedFacts}

Current job map:
${jobMap}

Guided workflow step this turn: ${workflowStep || "none"}
Success metrics requested this turn: ${includeSuccessMetrics ? "yes" : "no"}

Rules:
- Always mirror generated candidates into structured fields. Do not leave candidates only in the message text.
- Put up to 4 highest-confidence quick-save field values in suggestions.
- Put every field-like candidate you generate in options. If the user asks for a number of candidates, include all of them in options when they map to product, end_user, context, job, emotional_job, social_job, or complexity_factors.
- Treat emotional_job, social_job, and complexity_factors as list fields. For these keys, each option.value must be one standalone list item, not a combined paragraph or comma-separated group.
- Only suggest values that are grounded in the conversation or selected facts.
- If the product/service is missing, prioritize identifying it first.
- Prefer specific user roles over broad markets.
- Phrase the functional job as progress, not a feature request.
- Use job_steps for ordered job-map output.
- Each job step must include a success_metrics array because the app schema requires it.
- If success metrics requested this turn is no, every job_steps item must use success_metrics: [].
- If success metrics requested this turn is yes, attach success metrics to the relevant job step; never return detached success metrics.
- Keep the message concise and ask at most one follow-up question.
`;
}

function extractOutputText(response: OpenAIResponse) {
  if (response.output_text) return response.output_text;

  const chunks = response.output
    ?.flatMap((item) => item.content || [])
    .map((content) => content.text)
    .filter((text): text is string => typeof text === "string")
    .join("\n");

  return chunks || "";
}

export async function getJtbdReply(userMessage: string, state: AppState, conversationId: string): Promise<AiPayload> {
  const response = await openaiRequest<OpenAIResponse>("/responses", {
    method: "POST",
    body: JSON.stringify(buildResponseBody(userMessage, state, { conversationId }))
  });

  if (response.status === "incomplete") {
    throw new Error(incompleteResponseMessage(response.incomplete_details?.reason));
  }

  return normalizeReply(extractOutputText(response), shouldIncludeSuccessMetrics(userMessage));
}


export async function getJtbdActionReply(userMessage: string, state: AppState, workflowStep: WorkflowStepKey): Promise<AiPayload> {
  const includeSuccessMetrics = workflowStep === "success_metrics" || shouldIncludeSuccessMetrics(userMessage);
  const response = await openaiRequest<OpenAIResponse>("/responses", {
    method: "POST",
    body: JSON.stringify(buildResponseBody(userMessage, state, { workflowStep, includeSuccessMetrics }))
  });

  if (response.status === "incomplete") {
    throw new Error(incompleteResponseMessage(response.incomplete_details?.reason));
  }

  return normalizeReply(extractOutputText(response), includeSuccessMetrics);
}

async function readJtbdResponseStream(stream: ReadableStream<Uint8Array>, includeSuccessMetrics: boolean, options: StreamOptions = {}): Promise<AiPayload> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let rawText = "";
  let streamedMessage = "";

  async function handleEventBlock(block: string) {
    const event = parseSseBlock(block);
    if (!event) return;

    if (event.type === "error" || event.type === "response.failed") {
      throw new Error(event.error?.message || event.response?.error?.message || "OpenAI streaming failed.");
    }

    if (event.type === "response.incomplete") {
      throw new Error(incompleteResponseMessage(event.response?.incomplete_details?.reason));
    }

    if (event.type === "response.output_text.delta" && typeof event.delta === "string") {
      rawText += event.delta;
      const nextMessage = extractPartialJsonStringValue(rawText, "message");
      if (nextMessage.length > streamedMessage.length) {
        const delta = nextMessage.slice(streamedMessage.length);
        streamedMessage = nextMessage;
        await options.onMessageDelta?.(delta);
      }
    }
  }

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let boundary = buffer.indexOf("\n\n");
    while (boundary !== -1) {
      const block = buffer.slice(0, boundary).trim();
      buffer = buffer.slice(boundary + 2);
      if (block) await handleEventBlock(block);
      boundary = buffer.indexOf("\n\n");
    }
  }

  buffer += decoder.decode();
  if (buffer.trim()) await handleEventBlock(buffer.trim());

  const reply = normalizeReply(rawText, includeSuccessMetrics);
  if (reply.message.length > streamedMessage.length) {
    await options.onMessageDelta?.(reply.message.slice(streamedMessage.length));
  }

  return reply;
}

export async function getJtbdReplyStream(userMessage: string, state: AppState, conversationId: string, options: StreamOptions = {}): Promise<AiPayload> {
  const stream = await openaiStreamRequest("/responses", buildResponseBody(userMessage, state, { conversationId, stream: true }));
  return readJtbdResponseStream(stream, shouldIncludeSuccessMetrics(userMessage), options);
}

export async function getJtbdActionReplyStream(userMessage: string, state: AppState, workflowStep: WorkflowStepKey, options: StreamOptions = {}): Promise<AiPayload> {
  const includeSuccessMetrics = workflowStep === "success_metrics" || shouldIncludeSuccessMetrics(userMessage);
  const stream = await openaiStreamRequest(
    "/responses",
    buildResponseBody(userMessage, state, { workflowStep, includeSuccessMetrics, stream: true })
  );
  return readJtbdResponseStream(stream, includeSuccessMetrics, options);
}
