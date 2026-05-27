import { fieldLabels, isListFieldKey, parseListFieldValue, type AppState, type FieldKey, type JobStep, type WorkflowStepKey } from "./types";
import { getWorkflowStep } from "./workflow";

export const promptVariableNames = [
  "product",
  "end_user",
  "context",
  "job",
  "emotional_job",
  "social_job",
  "complexity_factors",
  "job_steps",
  "success_metrics",
  "job_map",
  "project_frame",
  "current_step",
  "job_step",
  "job_step_title",
  "job_step_description",
  "job_step_success_metrics",
  "project_name",
  "n"
] as const;

export type PromptVariableName = (typeof promptVariableNames)[number];

export type PromptRenderOptions = {
  projectName?: string;
  defaultN?: number;
  workflowStep?: WorkflowStepKey;
  jobStep?: JobStep | null;
};

export function clampDefaultN(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 10;
  return Math.min(100, Math.max(1, Math.round(parsed)));
}

function isFieldComplete(key: FieldKey, value: string) {
  return isListFieldKey(key) ? parseListFieldValue(value).length > 0 : value.trim().length > 0;
}

function formatFieldValueForPrompt(key: FieldKey, value: string) {
  if (!isFieldComplete(key, value)) return "not selected yet";
  if (!isListFieldKey(key)) return value.trim();
  return parseListFieldValue(value).map((item) => `- ${item}`).join("\n");
}

function formatJobStep(step: JobStep | null | undefined) {
  if (!step) return "no job step selected";
  return `${step.title}${step.description ? `: ${step.description}` : ""}`;
}

function formatJobStepsForPrompt(steps: JobStep[]) {
  if (steps.length === 0) return "not mapped yet";
  return steps.map((step, index) => `${index + 1}. ${formatJobStep(step)}`).join("\n");
}

function formatSuccessMetricsForPrompt(steps: JobStep[]) {
  if (steps.length === 0) return "not mapped yet";
  return steps
    .map((step, index) => {
      const metrics = step.successMetrics.length > 0 ? step.successMetrics.map((metric) => `- ${metric}`).join("\n") : "- no success metrics yet";
      return `${index + 1}. ${step.title}\n${metrics}`;
    })
    .join("\n\n");
}

function formatJobMapForPrompt(steps: JobStep[]) {
  if (steps.length === 0) return "not mapped yet";
  return steps
    .map((step, index) => {
      const metrics = step.successMetrics.length > 0 ? step.successMetrics.map((metric) => `  - ${metric}`).join("\n") : "  - no success metrics yet";
      return `${index + 1}. ${formatJobStep(step)}\nSuccess metrics:\n${metrics}`;
    })
    .join("\n\n");
}

export function formatProjectFrameForPrompt(state: AppState, projectName = "Untitled research") {
  const selections = state.selections;
  const lines = [
    `Project: ${projectName || "Untitled research"}`,
    `${fieldLabels.product}: ${selections.product || "not selected yet"}`,
    `${fieldLabels.end_user}: ${selections.end_user || "not selected yet"}`,
    `${fieldLabels.context}: ${selections.context || "not selected yet"}`,
    `${fieldLabels.job}: ${selections.job || "not selected yet"}`,
    `${fieldLabels.emotional_job}: ${formatFieldValueForPrompt("emotional_job", selections.emotional_job)}`,
    `${fieldLabels.social_job}: ${formatFieldValueForPrompt("social_job", selections.social_job)}`,
    `${fieldLabels.complexity_factors}: ${formatFieldValueForPrompt("complexity_factors", selections.complexity_factors)}`
  ];

  if (state.jobSteps.length > 0) {
    lines.push(`Job map:\n${formatJobStepsForPrompt(state.jobSteps)}`);
  }

  return lines.join("\n");
}

export function buildPromptVariables(state: AppState, options: PromptRenderOptions = {}) {
  const jobStep = options.jobStep || null;
  const workflowStep = options.workflowStep ? getWorkflowStep(options.workflowStep) : null;
  const projectName = options.projectName || "Untitled research";

  return {
    product: state.selections.product || "not selected yet",
    end_user: state.selections.end_user || "not selected yet",
    context: state.selections.context || "not selected yet",
    job: state.selections.job || "not selected yet",
    emotional_job: formatFieldValueForPrompt("emotional_job", state.selections.emotional_job),
    social_job: formatFieldValueForPrompt("social_job", state.selections.social_job),
    complexity_factors: formatFieldValueForPrompt("complexity_factors", state.selections.complexity_factors),
    job_steps: formatJobStepsForPrompt(state.jobSteps),
    success_metrics: formatSuccessMetricsForPrompt(state.jobSteps),
    job_map: formatJobMapForPrompt(state.jobSteps),
    project_frame: formatProjectFrameForPrompt(state, projectName),
    current_step: workflowStep ? workflowStep.label : "not selected",
    job_step: formatJobStep(jobStep),
    job_step_title: jobStep?.title || "no job step selected",
    job_step_description: jobStep?.description || "no job step selected",
    job_step_success_metrics: jobStep && jobStep.successMetrics.length > 0 ? jobStep.successMetrics.map((metric) => `- ${metric}`).join("\n") : "no success metrics yet",
    project_name: projectName,
    n: String(clampDefaultN(options.defaultN))
  } satisfies Record<PromptVariableName, string>;
}

export function renderPromptTemplate(template: string, state: AppState, options: PromptRenderOptions = {}) {
  const values = buildPromptVariables(state, options);

  return template
    .replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_match, key: string) => values[key as PromptVariableName] || `[missing: ${key}]`)
    .replace(/\{n\}/g, values.n);
}

export function findUnknownVariables(template: string) {
  const knownVariables = new Set<string>(promptVariableNames);
  const matches = [...template.matchAll(/{{\s*([a-zA-Z0-9_]+)\s*}}/g)].map((match) => match[1]);
  return [...new Set(matches.filter((key) => !knownVariables.has(key)))];
}
