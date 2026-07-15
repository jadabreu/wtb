import { tool } from "@openai/agents";
import { z } from "zod";
import { getDefaultPromptTemplate, getPromptTemplate } from "@/lib/document-store/prompts";
import { formatRenderedSuggestionPrompt } from "@/lib/ai/context";
import { generateFieldSuggestions } from "@/lib/ai/suggestion-generator";
import { buildRenderedPrompt, runStructuredPrompt, validatePromptRunReadiness } from "@/lib/ai/prompt-runner";
import type { WorkbenchAgentContext } from "@/lib/ai/agent-types";
import { fieldKeys, fieldLabels, type GeneratedOption, type PromptAppliesTo } from "@/lib/types";
import { getWorkflowStep } from "@/lib/workflow";
import { clampDefaultN } from "@/lib/prompt-render";

const promptAppliesToValues = [
  "product",
  "end_user",
  "context",
  "job",
  "emotional_job",
  "social_job",
  "complexity_factors",
  "job_map",
  "success_metrics",
  "ideals",
  "blockers",
  "chat"
] as const;

const runPromptParameters = z.object({
  promptId: z.number().int().positive().nullable(),
  appliesTo: z.enum(promptAppliesToValues).nullable(),
  jobStepId: z.number().int().positive().nullable(),
  idealId: z.number().int().positive().nullable(),
  n: z.number().int().min(1).max(50).nullable(),
  guidance: z.string().max(1200).nullable()
});

function resolvePromptTemplate(promptId: number | null, appliesTo: PromptAppliesTo | null) {
  if (promptId) return getPromptTemplate(promptId);
  if (appliesTo) return getDefaultPromptTemplate(appliesTo);
  return null;
}

function formatPlainTextOptions(options: GeneratedOption[]) {
  const seen = new Set<string>();
  return options
    .map((option) => option.value.trim())
    .filter((value) => {
      const signature = value.toLowerCase();
      if (!value || seen.has(signature)) return false;
      seen.add(signature);
      return true;
    })
    .map((value, index) => `${index + 1}. ${value}`)
    .join("\n");
}

const runPromptTool = tool<typeof runPromptParameters, WorkbenchAgentContext>({
  name: "run_prompt",
  description:
    "Run one validated prompt from the app prompt catalog. Use this only after choosing a single best prompt; if multiple prompts fit equally, ask the user which prompt to run instead.",
  parameters: runPromptParameters,
  strict: true,
  async execute(input, runContext) {
    const state = runContext?.context.state;
    const selection = runContext?.context.selection;
    if (!state || !selection) {
      return { ok: false, error: "Project state is unavailable." };
    }

    await runContext.context.onStatus?.("Loading the selected prompt...");

    const template = resolvePromptTemplate(input.promptId, input.appliesTo);
    if (!template) {
      return { ok: false, error: "No matching prompt was found. Ask the user which prompt to run." };
    }

    await runContext.context.onStatus?.(`Running "${template.title}"...`);

    if (input.appliesTo && template.appliesTo !== input.appliesTo) {
      return {
        ok: false,
        promptId: template.id,
        error: `Prompt "${template.title}" applies to ${template.appliesTo}, not ${input.appliesTo}.`
      };
    }

    const readinessError = validatePromptRunReadiness(state, template.appliesTo);
    if (readinessError) {
      return { ok: false, promptId: template.id, error: readinessError };
    }

    const n = clampDefaultN(input.n ?? template.defaultN);

    if (fieldKeys.includes(template.appliesTo as (typeof fieldKeys)[number])) {
      const appliesTo = template.appliesTo as (typeof fieldKeys)[number];
      const rendered = buildRenderedPrompt({
        guidance: null,
        idealId: input.idealId,
        jobStepId: input.jobStepId,
        n,
        selection,
        state,
        template
      });
      if (!rendered.ok) {
        return { ok: false, promptId: template.id, error: rendered.error };
      }
      await runContext.context.onStatus?.(`Generating ${fieldLabels[appliesTo].toLowerCase()} suggestions...`);
      const prompt = formatRenderedSuggestionPrompt(rendered.prompt, appliesTo, input.guidance);
      const reply = await generateFieldSuggestions(prompt, state, appliesTo, runContext.context.reasoningEffort);
      const message = [reply.message, formatPlainTextOptions(reply.options)].filter(Boolean).join("\n\n");
      await runContext.context.onStatus?.("Preparing prompt results...");
      return {
        ok: true,
        promptId: template.id,
        promptTitle: template.title,
        appliesTo,
        message
      };
    }

    const reply = await runStructuredPrompt({
      guidance: input.guidance,
      idealId: input.idealId,
      jobStepId: input.jobStepId,
      n,
      reasoningEffort: runContext.context.reasoningEffort,
      selection,
      state,
      template
    });
    await runContext.context.onStatus?.("Preparing prompt results...");

    runContext.context.generatedEditSet = reply.editSet;

    return {
      ok: true,
      promptId: template.id,
      promptTitle: template.title,
      appliesTo: template.appliesTo,
      workflowStep: template.appliesTo === "chat" ? null : getWorkflowStep(template.appliesTo).label,
      message: reply.message,
      editSet: reply.editSet
    };
  }
});

export { promptAppliesToValues, runPromptParameters, runPromptTool };
