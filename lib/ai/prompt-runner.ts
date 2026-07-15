import { getMaxOutputTokens, getOpenAIModel, getReasoningConfig, incompleteResponseMessage, openaiRequest } from "@/lib/ai/config";
import { renderPromptTemplate } from "@/lib/prompt-render";
import { agentReplySchema } from "@/lib/ai/schemas";
import { normalizeAgentReplyOutput } from "@/lib/ai/agent-edits";
import type {
  AgentSelection,
  AppState,
  FieldKey,
  IdealState,
  JobStep,
  PromptAppliesTo,
  PromptTemplate
} from "@/lib/types";
import { fieldKeys } from "@/lib/types";
import type { WorkbenchAgentReply } from "@/lib/ai/agent-types";
import { getMissingRequirements, getWorkflowStep } from "@/lib/workflow";
import type { ReasoningEffort } from "@/lib/ai/config";

type PromptScopeResolution =
  | { ok: true; jobStep: JobStep | null; idealState: IdealState | null }
  | { ok: false; error: string };

type OpenAIResponse = {
  status?: string;
  output?: Array<{
    content?: Array<{
      text?: string;
    }>;
  }>;
  output_text?: string;
  incomplete_details?: {
    reason?: string;
  } | null;
};

type RunPromptOptions = {
  guidance?: string | null;
  idealId?: number | null;
  jobStepId?: number | null;
  n?: number | null;
  reasoningEffort?: ReasoningEffort | null;
  selection: AgentSelection;
  state: AppState;
  template: PromptTemplate;
};

const agentEditCandidateResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "type",
    "field_key",
    "list_field_key",
    "value",
    "values",
    "job_step_id",
    "job_step",
    "job_steps",
    "metrics",
    "ideal_id",
    "ideal",
    "ideals",
    "label",
    "blockers",
    "themes",
    "ideal_theme_assignments",
    "metric_theme_assignments",
    "theme_assignment_mode",
    "summary"
  ],
  properties: {
    type: {
      type: "string",
      enum: [
        "set_field",
        "append_list_field",
        "replace_job_map",
        "append_job_step",
        "update_job_step",
        "delete_job_step",
        "replace_success_metrics",
        "append_success_metrics",
        "replace_ideal",
        "append_ideal",
        "split_ideal",
        "update_ideal_label",
        "replace_ideal_blockers",
        "append_ideal_blockers",
        "organize_themes",
        "delete_ideal"
      ]
    },
    field_key: { type: ["string", "null"], enum: [...fieldKeys, null] },
    list_field_key: { type: ["string", "null"], enum: ["emotional_job", "social_job", "complexity_factors", null] },
    value: { type: ["string", "null"] },
    values: { type: "array", maxItems: 50, items: { type: "string" } },
    job_step_id: { type: ["integer", "null"], minimum: 1 },
    job_step: {
      anyOf: [
        {
          type: "object",
          additionalProperties: false,
          required: ["title", "description", "success_metrics"],
          properties: {
            title: { type: "string" },
            description: { type: "string" },
            success_metrics: { type: "array", maxItems: 20, items: { type: "string" } }
          }
        },
        { type: "null" }
      ]
    },
    job_steps: {
      type: "array",
      maxItems: 20,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "description", "success_metrics"],
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          success_metrics: { type: "array", maxItems: 20, items: { type: "string" } }
        }
      }
    },
    metrics: { type: "array", maxItems: 20, items: { type: "string" } },
    ideal_id: { type: ["integer", "null"], minimum: 1 },
    ideal: {
      anyOf: [
        {
          type: "object",
          additionalProperties: false,
          required: ["title", "description", "label", "blockers"],
          properties: {
            title: { type: "string" },
            description: { type: "string" },
            label: { type: "string", enum: ["table_stake", "nice_to_have", "critical_gap"] },
            blockers: { type: "array", maxItems: 20, items: { type: "string" } }
          }
        },
        { type: "null" }
      ]
    },
    ideals: {
      type: "array",
      maxItems: 10,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "description", "label", "blockers"],
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          label: { type: "string", enum: ["table_stake", "nice_to_have", "critical_gap"] },
          blockers: { type: "array", maxItems: 20, items: { type: "string" } }
        }
      }
    },
    label: { type: ["string", "null"], enum: ["table_stake", "nice_to_have", "critical_gap", null] },
    blockers: { type: "array", maxItems: 20, items: { type: "string" } },
    themes: {
      type: "array",
      maxItems: 30,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "description", "color"],
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          color: { type: ["string", "null"] }
        }
      }
    },
    ideal_theme_assignments: {
      type: "array",
      maxItems: 50,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["ideal_id", "theme_titles"],
        properties: {
          ideal_id: { type: "integer", minimum: 1 },
          theme_titles: { type: "array", maxItems: 8, items: { type: "string" } }
        }
      }
    },
    metric_theme_assignments: {
      type: "array",
      maxItems: 80,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["job_step_id", "metric_id", "theme_titles"],
        properties: {
          job_step_id: { type: "integer", minimum: 1 },
          metric_id: { type: "integer", minimum: 1 },
          theme_titles: { type: "array", maxItems: 8, items: { type: "string" } }
        }
      }
    },
    theme_assignment_mode: { type: ["string", "null"], enum: ["append", "replace", null] },
    summary: { type: "string" }
  }
} as const;

const promptRunResponseFormatSchema = {
  type: "object",
  additionalProperties: false,
  required: ["message", "edit_set"],
  properties: {
    message: {
      type: "string",
      description: "A concise plain-text response for the chat."
    },
    edit_set: {
      anyOf: [
        {
          type: "object",
          additionalProperties: false,
          required: ["summary", "patches"],
          properties: {
            summary: { type: "string" },
            patches: {
              type: "array",
              maxItems: 50,
              items: agentEditCandidateResponseSchema
            }
          }
        },
        { type: "null" }
      ]
    }
  }
} as const;

function extractOutputText(response: OpenAIResponse) {
  if (response.output_text) return response.output_text;
  return (
    response.output
      ?.flatMap((item) => item.content || [])
      .map((content) => content.text)
      .filter((text): text is string => typeof text === "string")
      .join("\n") || ""
  );
}

function parsePromptRunReply(rawText: string) {
  try {
    return agentReplySchema.parse(JSON.parse(rawText));
  } catch {
    throw new Error("The prompt response could not be read completely. Try again with a smaller n or a shorter prompt.");
  }
}

function isFieldPromptTarget(value: PromptAppliesTo): value is FieldKey {
  return fieldKeys.includes(value as FieldKey);
}

function resolveScopedJobStep(state: AppState, selection: AgentSelection, jobStepId?: number | null): JobStep | null {
  if (typeof jobStepId === "number") return state.jobSteps.find((step) => step.id === jobStepId) || null;
  if (selection.type === "job_step") return state.jobSteps.find((step) => step.id === selection.id) || null;
  if (state.jobSteps.length === 1) return state.jobSteps[0];
  return null;
}

function resolveScopedIdealState(state: AppState, selection: AgentSelection, idealId?: number | null): IdealState | null {
  if (typeof idealId === "number") return state.idealStates.find((ideal) => ideal.id === idealId) || null;
  if (selection.type === "ideal") return state.idealStates.find((ideal) => ideal.id === selection.id) || null;
  if (state.idealStates.length === 1) return state.idealStates[0];
  return null;
}

function resolvePromptScope({
  idealId,
  jobStepId,
  selection,
  state,
  template
}: RunPromptOptions): PromptScopeResolution {
  const workflowStep = template.appliesTo === "chat" ? null : getWorkflowStep(template.appliesTo);
  const requiredScope = template.scopeRequired !== "none" ? template.scopeRequired : workflowStep?.scopeRequired || "none";
  const jobStep = requiredScope === "job_step" ? resolveScopedJobStep(state, selection, jobStepId) : null;
  const idealState = requiredScope === "ideal_state" ? resolveScopedIdealState(state, selection, idealId) : null;

  if (requiredScope === "job_step" && !jobStep) {
    return { ok: false, error: "This prompt needs a job step. Ask the user which job step to use before running it." };
  }

  if (requiredScope === "ideal_state" && !idealState) {
    return { ok: false, error: "This prompt needs an ideal state. Ask the user which ideal state to use before running it." };
  }

  return { ok: true, jobStep, idealState };
}

function buildRenderedPrompt({
  guidance,
  idealId,
  jobStepId,
  n,
  selection,
  state,
  template
}: RunPromptOptions) {
  const scope = resolvePromptScope({ guidance, idealId, jobStepId, n, selection, state, template });
  if (!scope.ok) return scope;

  const activeProject = state.projects.find((project) => project.id === state.activeProjectId);
  const renderedPrompt = renderPromptTemplate(template.content, state, {
    projectName: activeProject?.name || "Untitled research",
    defaultN: n ?? template.defaultN,
    workflowStep: template.appliesTo === "chat" ? undefined : template.appliesTo,
    jobStep: scope.jobStep,
    idealState: scope.idealState
  });
  const trimmedGuidance = guidance?.trim();

  return {
    ok: true as const,
    prompt: `${renderedPrompt}${trimmedGuidance ? `\n\nAdditional user guidance:\n${trimmedGuidance}` : ""}`,
    jobStep: scope.jobStep,
    idealState: scope.idealState
  };
}

function buildPromptRunInstructions(template: PromptTemplate, state: AppState, scope: { jobStep: JobStep | null; idealState: IdealState | null }) {
  const target = template.appliesTo;
  const base = [
    "You run one user-authored prompt inside a JTBD research workbench.",
    "Return JSON only using the required schema.",
    "Use the prompt as task guidance, but keep the work inside the current project state.",
    "Default to conversational output: put generated candidates, critiques, or recommendations in message as plain text, using simple compact numbered lists when useful, and set edit_set to null.",
    "When using a numbered list, put one item per line with no blank line between items.",
    "Only include edit_set operations when the user explicitly asked to save, add, replace, update, delete, tag, or otherwise apply changes immediately.",
    "When edit_set is present, those operations will be directly applied through validated tools after the agent reply completes.",
    `Prompt target: ${target}`,
    `Prompt action: ${template.actionType}`,
    `Prompt scope: ${template.scopeRequired}`,
    scope.jobStep ? `Selected job step id: ${scope.jobStep.id} title: ${scope.jobStep.title}` : null,
    scope.idealState ? `Selected ideal id: ${scope.idealState.id} title: ${scope.idealState.title}` : null
  ].filter(Boolean);

  const targetRules: string[] = [];
  if (target === "job_map") {
    targetRules.push("For job_map generation, normally return a numbered plain-text job map in message and set edit_set to null.");
    targetRules.push("Only return replace_job_map when the user explicitly asked to save or replace the current job map now.");
  } else if (target === "success_metrics") {
    targetRules.push("For success_metrics generation, normally return numbered plain-text metric candidates in message and set edit_set to null.");
    targetRules.push("Only return replace_success_metrics or append_success_metrics when the user explicitly asked to save metrics now.");
  } else if (target === "ideals") {
    targetRules.push("For ideals generation, normally return numbered plain-text ideal candidates in message and set edit_set to null.");
    targetRules.push("Only return append_ideal patches when the user explicitly asked to save or add ideals now. Do not duplicate existing ideal titles.");
  } else if (target === "blockers") {
    targetRules.push("For blockers generation, normally return numbered plain-text blocker candidates in message and set edit_set to null.");
    targetRules.push("Only return append_ideal_blockers when the user explicitly asked to save blockers now.");
  } else if (target === "chat") {
    targetRules.push("For chat prompts, set edit_set to null and put the useful answer in message.");
  } else if (isFieldPromptTarget(target)) {
    targetRules.push("For field targets, return numbered plain-text candidates in message and set edit_set to null unless the user explicitly asked to save a field value now.");
  }

  return [...base, ...targetRules].join("\n");
}

async function runStructuredPrompt(options: RunPromptOptions): Promise<WorkbenchAgentReply> {
  const rendered = buildRenderedPrompt(options);
  if (!rendered.ok) throw new Error(rendered.error);

  const response = await openaiRequest<OpenAIResponse>("/responses", {
    method: "POST",
    body: JSON.stringify({
      model: getOpenAIModel(),
      instructions: buildPromptRunInstructions(options.template, options.state, rendered),
      input: [
        {
          role: "user",
          content: rendered.prompt
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "jtbd_prompt_run",
          strict: true,
          schema: promptRunResponseFormatSchema
        }
      },
      max_output_tokens: getMaxOutputTokens(),
      reasoning: getReasoningConfig(options.reasoningEffort)
    })
  });

  if (response.status === "incomplete") {
    throw new Error(incompleteResponseMessage(response.incomplete_details?.reason));
  }

  const parsed = parsePromptRunReply(extractOutputText(response));
  return normalizeAgentReplyOutput(parsed, options.state);
}

function validatePromptRunReadiness(state: AppState, appliesTo: PromptAppliesTo) {
  if (appliesTo === "chat") return null;
  const workflowStep = getWorkflowStep(appliesTo);
  const missingRequirements = getMissingRequirements(workflowStep, state);
  if (missingRequirements.length === 0) return null;
  return `Complete ${missingRequirements.map((key) => getWorkflowStep(key).label).join(", ")} before running a prompt for ${workflowStep.label}.`;
}

export {
  agentEditCandidateResponseSchema,
  buildRenderedPrompt,
  isFieldPromptTarget,
  promptRunResponseFormatSchema,
  resolvePromptScope,
  runStructuredPrompt,
  validatePromptRunReadiness
};
export type { RunPromptOptions };
