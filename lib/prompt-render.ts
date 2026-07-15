import { fieldLabels, idealStateLabelLabels, isListFieldKey, normalizeIdealStateLabel, parseListFieldValue, type AppState, type FieldKey, type IdealState, type JobStep, type Theme, type WorkflowStepKey } from "./types";
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
  "ideal_states",
  "blockers",
  "job_map",
  "project_frame",
  "current_step",
  "job_step",
  "job_step_title",
  "job_step_description",
  "job_step_success_metrics",
  "ideal_state",
  "ideal_state_title",
  "ideal_state_description",
  "ideal_state_blockers",
  "project_name",
  "n"
] as const;

export type PromptVariableName = (typeof promptVariableNames)[number];

export type PromptRenderOptions = {
  projectName?: string;
  defaultN?: number;
  workflowStep?: WorkflowStepKey;
  jobStep?: JobStep | null;
  idealState?: IdealState | null;
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

function formatThemeNames(themeIds: number[] = [], themes: Theme[] = []) {
  const themeById = new Map(themes.map((theme) => [theme.id, theme.title]));
  const names = themeIds.map((themeId) => themeById.get(themeId)).filter((name): name is string => Boolean(name));
  return names.length > 0 ? ` [Themes: ${names.join(", ")}]` : "";
}

function formatMetricForPrompt(metric: JobStep["successMetrics"][number], themes: Theme[] = []) {
  return `${metric.text}${formatThemeNames(metric.themeIds, themes)}`;
}

function formatSuccessMetricsForPrompt(steps: JobStep[], themes: Theme[] = []) {
  if (steps.length === 0) return "not mapped yet";
  return steps
    .map((step, index) => {
      const metrics = step.successMetrics.length > 0 ? step.successMetrics.map((metric) => `- ${formatMetricForPrompt(metric, themes)}`).join("\n") : "- no success metrics yet";
      return `${index + 1}. ${step.title}\n${metrics}`;
    })
    .join("\n\n");
}

function formatIdealState(idealState: IdealState | null | undefined, themes: Theme[] = []) {
  if (!idealState) return "no ideal state selected";
  const label = idealStateLabelLabels[normalizeIdealStateLabel(idealState.label)];
  return `${idealState.title}${idealState.description ? `: ${idealState.description}` : ""} (${label})${formatThemeNames(idealState.themeIds, themes)}`;
}

function formatIdealStatesForPrompt(idealStates: IdealState[], themes: Theme[] = []) {
  if (idealStates.length === 0) return "not defined yet";
  return idealStates.map((idealState, index) => `${index + 1}. ${formatIdealState(idealState, themes)}`).join("\n");
}

function formatBlockersForPrompt(idealStates: IdealState[]) {
  if (idealStates.length === 0) return "no ideal states yet";
  return idealStates
    .map((idealState, index) => {
      const blockers = idealState.blockers.length > 0 ? idealState.blockers.map((blocker) => `- ${blocker}`).join("\n") : "- no blockers yet";
      return `${index + 1}. ${idealState.title}\n${blockers}`;
    })
    .join("\n\n");
}

function formatJobMapForPrompt(steps: JobStep[], themes: Theme[] = []) {
  if (steps.length === 0) return "not mapped yet";
  return steps
    .map((step, index) => {
      const metrics = step.successMetrics.length > 0 ? step.successMetrics.map((metric) => `  - ${formatMetricForPrompt(metric, themes)}`).join("\n") : "  - no success metrics yet";
      return `${index + 1}. ${formatJobStep(step)}\nSuccess metrics:\n${metrics}`;
    })
    .join("\n\n");
}

function formatIndentedMarkdownText(value: string, firstLinePrefix: string, continuationPrefix: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => `${index === 0 ? firstLinePrefix : continuationPrefix}${line}`);
}

export function formatJobMapMarkdown(steps: JobStep[]) {
  if (steps.length === 0) return "# Job Map\n\nNo job steps mapped yet.";

  const formattedSteps = steps.map((step, index) => {
    const title = step.title.trim() || `Step ${index + 1}`;
    const description = step.description.trim();
    const metrics = step.successMetrics.map((metric) => metric.text.trim()).filter(Boolean);
    const lines = [`${index + 1}. **${title}**`];

    if (description) {
      lines.push(...formatIndentedMarkdownText(description, "   - Description: ", "     "));
    }

    if (metrics.length > 0) {
      lines.push("   - Success metrics:");
      lines.push(...metrics.flatMap((metric) => formatIndentedMarkdownText(metric, "     - ", "       ")));
    }

    return lines.join("\n");
  });

  return `# Job Map\n\n${formattedSteps.join("\n\n")}`;
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

  if (state.idealStates.length > 0) {
    lines.push(`Ideal states:\n${formatIdealStatesForPrompt(state.idealStates, state.themes)}`);
  }

  return lines.join("\n");
}

export function buildPromptVariables(state: AppState, options: PromptRenderOptions = {}) {
  const jobStep = options.jobStep || null;
  const idealState = options.idealState || null;
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
    success_metrics: formatSuccessMetricsForPrompt(state.jobSteps, state.themes),
    ideal_states: formatIdealStatesForPrompt(state.idealStates, state.themes),
    blockers: formatBlockersForPrompt(state.idealStates),
    job_map: formatJobMapForPrompt(state.jobSteps, state.themes),
    project_frame: formatProjectFrameForPrompt(state, projectName),
    current_step: workflowStep ? workflowStep.label : "not selected",
    job_step: formatJobStep(jobStep),
    job_step_title: jobStep?.title || "no job step selected",
    job_step_description: jobStep?.description || "no job step selected",
    job_step_success_metrics: jobStep && jobStep.successMetrics.length > 0 ? jobStep.successMetrics.map((metric) => `- ${formatMetricForPrompt(metric, state.themes)}`).join("\n") : "no success metrics yet",
    ideal_state: formatIdealState(idealState, state.themes),
    ideal_state_title: idealState?.title || "no ideal state selected",
    ideal_state_description: idealState?.description || "no ideal state selected",
    ideal_state_blockers: idealState && idealState.blockers.length > 0 ? idealState.blockers.map((blocker) => `- ${blocker}`).join("\n") : "no blockers yet",
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
