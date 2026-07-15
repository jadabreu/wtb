import { z } from "zod";
import { getMaxOutputTokens, getOpenAIModel, getReasoningConfig, incompleteResponseMessage, openaiRequest } from "@/lib/ai/config";
import { buildSuggestionInstructions } from "@/lib/ai/context";
import { suggestionReplySchema, suggestionResponseFormatSchema } from "@/lib/ai/schemas";
import type { AppState, FieldKey, GeneratedOption } from "@/lib/types";
import type { ReasoningEffort } from "@/lib/ai/config";

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

type FieldSuggestionReply = {
  message: string;
  suggestions: GeneratedOption[];
  options: GeneratedOption[];
};

function extractOutputText(response: OpenAIResponse) {
  if (response.output_text) return response.output_text;

  const chunks = response.output
    ?.flatMap((item) => item.content || [])
    .map((content) => content.text)
    .filter((text): text is string => typeof text === "string")
    .join("\n");

  return chunks || "";
}

function normalizeSuggestionReply(rawText: string): FieldSuggestionReply {
  let parsed: z.infer<typeof suggestionReplySchema>;

  try {
    parsed = suggestionReplySchema.parse(JSON.parse(rawText));
  } catch {
    throw new Error("The AI response could not be read completely. Try again with a smaller n or a shorter prompt.");
  }

  const normalizeOption = (option: z.infer<typeof suggestionReplySchema>["options"][number]): GeneratedOption => ({
    key: option.key,
    value: option.value.trim(),
    rationale: option.rationale.trim()
  });

  return {
    message: parsed.message.trim(),
    suggestions: parsed.suggestions.map(normalizeOption),
    options: parsed.options.map(normalizeOption)
  };
}

async function generateFieldSuggestions(
  prompt: string,
  state: AppState,
  appliesTo: FieldKey,
  reasoningEffort?: ReasoningEffort | null
): Promise<FieldSuggestionReply> {
  const response = await openaiRequest<OpenAIResponse>("/responses", {
    method: "POST",
    body: JSON.stringify({
      model: getOpenAIModel(),
      instructions: buildSuggestionInstructions(state, appliesTo),
      input: [
        {
          role: "user",
          content: prompt
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "jtbd_field_suggestions",
          strict: true,
          schema: suggestionResponseFormatSchema
        }
      },
      max_output_tokens: getMaxOutputTokens(),
      reasoning: getReasoningConfig(reasoningEffort)
    })
  });

  if (response.status === "incomplete") {
    throw new Error(incompleteResponseMessage(response.incomplete_details?.reason));
  }

  return normalizeSuggestionReply(extractOutputText(response));
}

export { generateFieldSuggestions };
export type { FieldSuggestionReply };
