export type FieldKey =
  | "product"
  | "end_user"
  | "context"
  | "job"
  | "emotional_job"
  | "social_job"
  | "complexity_factors";

export type ListFieldKey = Extract<FieldKey, "emotional_job" | "social_job" | "complexity_factors">;

export type WorkflowStepKey = FieldKey | "job_map" | "success_metrics";
export type PromptAppliesTo = WorkflowStepKey | "chat";
export type PromptActionType = "generate" | "refine" | "challenge" | "audit" | "chat";
export type PromptScopeRequired = "none" | "job_step";

export const listFieldKeys: ListFieldKey[] = ["emotional_job", "social_job", "complexity_factors"];

export function isListFieldKey(key: FieldKey): key is ListFieldKey {
  return listFieldKeys.includes(key as ListFieldKey);
}

export function parseListFieldValue(value: string) {
  return value
    .split(/\r?\n/)
    .map((item) => item.replace(/^\s*[-*]\s*/, "").trim())
    .filter(Boolean);
}

export function formatListFieldValue(items: string[]) {
  return items.map((item) => item.trim()).filter(Boolean).join("\n");
}

export type Selection = {
  key: FieldKey;
  value: string;
  updatedAt?: string;
};

export type GeneratedOption = {
  key: FieldKey;
  value: string;
  rationale?: string;
};

export type Suggestion = GeneratedOption;

export type GeneratedJobStep = {
  title: string;
  description: string;
  successMetrics: string[];
};

export type ChatMessage = {
  id: number;
  role: "user" | "assistant";
  content: string;
  suggestions: Suggestion[];
  options: GeneratedOption[];
  generatedJobSteps: GeneratedJobStep[];
  createdAt: string;
};

export type JobStep = {
  id: number;
  title: string;
  description: string;
  successMetrics: string[];
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string;
};

export type PromptTemplate = {
  id: number;
  title: string;
  content: string;
  category: string;
  appliesTo: PromptAppliesTo;
  actionType: PromptActionType;
  scopeRequired: PromptScopeRequired;
  isDefault: boolean;
  isPinned: boolean;
  isBuiltin: boolean;
  defaultN: number;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type Project = {
  id: number;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export type AppState = {
  activeProjectId: number;
  projects: Project[];
  selections: Record<FieldKey, string>;
  jobSteps: JobStep[];
  messages: ChatMessage[];
};

export const fieldLabels: Record<FieldKey, string> = {
  product: "Product or service",
  end_user: "End user",
  context: "Context",
  job: "Functional job",
  emotional_job: "Emotional jobs",
  social_job: "Social jobs",
  complexity_factors: "Complexity factors"
};

export const fieldKeys = Object.keys(fieldLabels) as FieldKey[];

export function createEmptySelections() {
  return Object.fromEntries(fieldKeys.map((key) => [key, ""])) as Record<FieldKey, string>;
}
