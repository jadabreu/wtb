import { fieldLabels, isListFieldKey, type AppState, type FieldKey, type PromptAppliesTo, type WorkflowStepKey } from "./types";

export type WorkflowStepKind = "single" | "list" | "job_map" | "scoped_list";

export type WorkflowStep = {
  key: WorkflowStepKey;
  label: string;
  shortLabel: string;
  goal: string;
  kind: WorkflowStepKind;
  requiredBefore?: WorkflowStepKey[];
  scopeRequired?: "job_step";
  defaultN: number;
};

export const workflowSteps: WorkflowStep[] = [
  {
    key: "product",
    label: fieldLabels.product,
    shortLabel: "Product",
    goal: "Define the product, service, or business idea being researched.",
    kind: "single",
    defaultN: 5
  },
  {
    key: "end_user",
    label: fieldLabels.end_user,
    shortLabel: "User",
    goal: "Choose the most useful user segment to research first.",
    kind: "single",
    requiredBefore: ["product"],
    defaultN: 10
  },
  {
    key: "context",
    label: fieldLabels.context,
    shortLabel: "Context",
    goal: "Find the situation, trigger, or constraint that creates demand.",
    kind: "single",
    requiredBefore: ["product", "end_user"],
    defaultN: 8
  },
  {
    key: "job",
    label: fieldLabels.job,
    shortLabel: "Job",
    goal: "State the functional progress the user is trying to make.",
    kind: "single",
    requiredBefore: ["product", "end_user"],
    defaultN: 8
  },
  {
    key: "emotional_job",
    label: fieldLabels.emotional_job,
    shortLabel: "Emotional",
    goal: "Capture what the user wants to feel or stop feeling.",
    kind: "list",
    requiredBefore: ["end_user", "job"],
    defaultN: 10
  },
  {
    key: "social_job",
    label: fieldLabels.social_job,
    shortLabel: "Social",
    goal: "Capture how the user wants to be perceived or avoid being perceived.",
    kind: "list",
    requiredBefore: ["end_user", "job"],
    defaultN: 10
  },
  {
    key: "complexity_factors",
    label: fieldLabels.complexity_factors,
    shortLabel: "Friction",
    goal: "Identify the conditions that make the job harder, riskier, slower, or more urgent.",
    kind: "list",
    requiredBefore: ["end_user", "job"],
    defaultN: 10
  },
  {
    key: "job_map",
    label: "Job map",
    shortLabel: "Map",
    goal: "Break the job into the main steps the user must complete.",
    kind: "job_map",
    requiredBefore: ["end_user", "job"],
    defaultN: 12
  },
  {
    key: "success_metrics",
    label: "Success metrics",
    shortLabel: "Metrics",
    goal: "Define what must be true for each job step to be completed well.",
    kind: "scoped_list",
    requiredBefore: ["job_map"],
    scopeRequired: "job_step",
    defaultN: 8
  }
];

export const workflowStepKeys = workflowSteps.map((step) => step.key);

export function isWorkflowStepKey(value: unknown): value is WorkflowStepKey {
  return typeof value === "string" && workflowStepKeys.includes(value as WorkflowStepKey);
}

export function isPromptAppliesTo(value: unknown): value is PromptAppliesTo {
  return value === "chat" || isWorkflowStepKey(value);
}

export function getWorkflowStep(key: WorkflowStepKey) {
  return workflowSteps.find((step) => step.key === key) || workflowSteps[0];
}

export function getWorkflowStepIndex(key: WorkflowStepKey) {
  return Math.max(0, workflowSteps.findIndex((step) => step.key === key));
}

export function isWorkflowStepComplete(step: WorkflowStep, state: AppState) {
  if (step.kind === "job_map") return state.jobSteps.length > 0;
  if (step.kind === "scoped_list") return state.jobSteps.some((jobStep) => jobStep.successMetrics.length > 0);
  return isFieldStepKey(step.key) ? isFieldValueComplete(step.key, state.selections[step.key]) : false;
}

export function isFieldStepKey(key: WorkflowStepKey): key is FieldKey {
  return key !== "job_map" && key !== "success_metrics";
}

export function isFieldValueComplete(key: FieldKey, value: string) {
  return isListFieldKey(key) ? value.split(/\r?\n/).map((item) => item.replace(/^\s*[-*]\s*/, "").trim()).filter(Boolean).length > 0 : value.trim().length > 0;
}

export function getNextWorkflowStep(state: AppState) {
  return workflowSteps.find((step) => !isWorkflowStepComplete(step, state)) || workflowSteps[workflowSteps.length - 1];
}

export function getMissingRequirements(step: WorkflowStep, state: AppState) {
  return (step.requiredBefore || []).filter((key) => {
    const requirement = getWorkflowStep(key);
    return !isWorkflowStepComplete(requirement, state);
  });
}
