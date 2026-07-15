import { fieldLabels, isListFieldKey, type AppState, type FieldKey, type PromptAppliesTo, type WorkflowStepKey } from "./types";

export type WorkflowStepKind = "single" | "list" | "job_map" | "theme_list" | "ideal_list" | "scoped_list";

export type WorkflowStep = {
  key: WorkflowStepKey;
  label: string;
  shortLabel: string;
  goal: string;
  kind: WorkflowStepKind;
  requiredBefore?: WorkflowStepKey[];
  scopeRequired?: "job_step" | "ideal_state";
  defaultN: number;
};

export type WorkflowArtifactGroup = {
  title: string;
  description: string;
  stepKeys: WorkflowStepKey[];
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
  },
  {
    key: "themes",
    label: "Themes",
    shortLabel: "Themes",
    goal: "Create reusable themes that organize ideals and success metrics.",
    kind: "theme_list",
    defaultN: 8
  },
  {
    key: "ideals",
    label: "Ideals",
    shortLabel: "Ideals",
    goal: "Define the ideal states this job should produce.",
    kind: "ideal_list",
    defaultN: 8
  },
  {
    key: "blockers",
    label: "Blockers",
    shortLabel: "Blockers",
    goal: "Identify what can prevent each ideal state from being reached.",
    kind: "scoped_list",
    requiredBefore: ["ideals"],
    scopeRequired: "ideal_state",
    defaultN: 8
  }
];

export const workflowArtifactGroups: WorkflowArtifactGroup[] = [
  {
    title: "Frame",
    description: "Who and when",
    stepKeys: ["product", "end_user", "context"]
  },
  {
    title: "Jobs",
    description: "Progress and pressure",
    stepKeys: ["job", "emotional_job", "social_job", "complexity_factors"]
  },
  {
    title: "Structure",
    description: "Map and measures",
    stepKeys: ["job_map", "success_metrics"]
  },
  {
    title: "Organization",
    description: "Themes and tags",
    stepKeys: ["themes"]
  },
  {
    title: "Desired state",
    description: "Ideals and blockers",
    stepKeys: ["ideals", "blockers"]
  }
];

export const workflowStepKeys = workflowSteps.map((step) => step.key);

export function isWorkflowStepKey(value: unknown): value is WorkflowStepKey {
  return typeof value === "string" && workflowStepKeys.includes(value as WorkflowStepKey);
}

export function isPromptAppliesTo(value: unknown): value is PromptAppliesTo {
  return value === "chat" || (isWorkflowStepKey(value) && value !== "themes");
}

export function getWorkflowStep(key: WorkflowStepKey) {
  return workflowSteps.find((step) => step.key === key) || workflowSteps[0];
}

export function getWorkflowStepIndex(key: WorkflowStepKey) {
  return Math.max(0, workflowSteps.findIndex((step) => step.key === key));
}

export function getWorkflowArtifactGroup(key: WorkflowStepKey) {
  return workflowArtifactGroups.find((group) => group.stepKeys.includes(key));
}

export function isWorkflowStepComplete(step: WorkflowStep, state: AppState) {
  if (step.kind === "job_map") return state.jobSteps.length > 0;
  if (step.kind === "theme_list") return state.themes.length > 0;
  if (step.kind === "ideal_list") return state.idealStates.length > 0;
  if (step.key === "success_metrics") return state.jobSteps.some((jobStep) => jobStep.successMetrics.length > 0);
  if (step.key === "blockers") return state.idealStates.some((idealState) => idealState.blockers.length > 0);
  return isFieldStepKey(step.key) ? isFieldValueComplete(step.key, state.selections[step.key]) : false;
}

export function isFieldStepKey(key: WorkflowStepKey): key is FieldKey {
  return key !== "job_map" && key !== "success_metrics" && key !== "themes" && key !== "ideals" && key !== "blockers";
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
