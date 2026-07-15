export type FieldKey =
  | "product"
  | "end_user"
  | "context"
  | "job"
  | "emotional_job"
  | "social_job"
  | "complexity_factors";

export type ListFieldKey = Extract<FieldKey, "emotional_job" | "social_job" | "complexity_factors">;

export type WorkflowStepKey = FieldKey | "job_map" | "success_metrics" | "themes" | "ideals" | "blockers";
export type PromptAppliesTo = Exclude<WorkflowStepKey, "themes"> | "chat";
export type PromptActionType = "generate" | "refine" | "challenge" | "audit" | "chat";
export type PromptScopeRequired = "none" | "job_step" | "ideal_state";

export const listFieldKeys: ListFieldKey[] = ["emotional_job", "social_job", "complexity_factors"];
export const idealStateLabelValues = ["table_stake", "nice_to_have", "critical_gap"] as const;
export type IdealStateLabel = (typeof idealStateLabelValues)[number];
export const defaultIdealStateLabel: IdealStateLabel = "nice_to_have";
export const idealStateLabelLabels: Record<IdealStateLabel, string> = {
  table_stake: "Table stake",
  nice_to_have: "Nice to have",
  critical_gap: "Critical gap"
};

export function isListFieldKey(key: FieldKey): key is ListFieldKey {
  return listFieldKeys.includes(key as ListFieldKey);
}

export function normalizeIdealStateLabel(value: unknown): IdealStateLabel {
  return typeof value === "string" && idealStateLabelValues.includes(value as IdealStateLabel)
    ? (value as IdealStateLabel)
    : defaultIdealStateLabel;
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

export type JobStepDraft = GeneratedJobStep;

export type ThemeDraft = {
  title: string;
  description: string;
  color?: string;
};

export type Theme = {
  id: number;
  title: string;
  description: string;
  color: string;
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string;
};

export type SuccessMetric = {
  id: number;
  text: string;
  themeIds: number[];
  createdAt?: string;
  updatedAt?: string;
};

export type GeneratedIdealState = {
  title: string;
  description: string;
  label?: IdealStateLabel;
  blockers: string[];
};

export type IdealStateDraft = {
  title: string;
  description: string;
  label: IdealStateLabel;
  blockers: string[];
};

export type JobStep = {
  id: number;
  title: string;
  description: string;
  successMetrics: SuccessMetric[];
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string;
};

export type IdealState = {
  id: number;
  title: string;
  description: string;
  label: IdealStateLabel;
  blockers: string[];
  themeIds: number[];
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
  openaiConversationId?: string | null;
};

export type AgentSelection =
  | { type: "none" }
  | { type: "workflow_step"; workflowStep: WorkflowStepKey }
  | { type: "field"; fieldKey: FieldKey }
  | { type: "job_step"; id: number }
  | { type: "ideal"; id: number };

export const agentArtifactTypeValues = ["field_suggestions", "artifact_edit_proposal"] as const;

export type AgentArtifactType = (typeof agentArtifactTypeValues)[number];

export type AgentEditOperation =
  | {
      id: string;
      type: "set_field";
      fieldKey: FieldKey;
      value: string;
      previousValue?: string;
      summary?: string;
    }
  | {
      id: string;
      type: "append_list_field";
      fieldKey: ListFieldKey;
      values: string[];
      previousValue?: string;
      summary?: string;
    }
  | {
      id: string;
      type: "replace_job_map";
      jobSteps: JobStepDraft[];
      previousJobMapSignature?: string;
      summary?: string;
    }
  | {
      id: string;
      type: "append_job_step";
      jobStep: JobStepDraft;
      summary?: string;
    }
  | {
      id: string;
      type: "update_job_step";
      jobStepId: number;
      jobStep: JobStepDraft;
      targetUpdatedAt?: string;
      summary?: string;
    }
  | {
      id: string;
      type: "delete_job_step";
      jobStepId: number;
      targetUpdatedAt?: string;
      summary: string;
    }
  | {
      id: string;
      type: "replace_success_metrics";
      jobStepId: number;
      metrics: string[];
      targetUpdatedAt?: string;
      summary?: string;
    }
  | {
      id: string;
      type: "append_success_metrics";
      jobStepId: number;
      metrics: string[];
      targetUpdatedAt?: string;
      summary?: string;
    }
  | {
      id: string;
      type: "replace_ideal";
      idealId: number;
      ideal: IdealStateDraft;
      summary?: string;
    }
  | {
      id: string;
      type: "append_ideal";
      ideal: IdealStateDraft;
      summary?: string;
    }
  | {
      id: string;
      type: "split_ideal";
      idealId: number;
      ideals: IdealStateDraft[];
      summary?: string;
    }
  | {
      id: string;
      type: "update_ideal_label";
      idealId: number;
      label: IdealStateLabel;
      summary?: string;
    }
  | {
      id: string;
      type: "replace_ideal_blockers";
      idealId: number;
      blockers: string[];
      summary?: string;
    }
  | {
      id: string;
      type: "append_ideal_blockers";
      idealId: number;
      blockers: string[];
      summary?: string;
    }
  | {
      id: string;
      type: "organize_themes";
      themes: ThemeDraft[];
      idealAssignments: Array<{
        idealId: number;
        themeTitles: string[];
      }>;
      metricAssignments: Array<{
        jobStepId: number;
        metricId: number;
        themeTitles: string[];
      }>;
      assignmentMode: "append" | "replace";
      summary?: string;
    }
  | {
      id: string;
      type: "delete_ideal";
      idealId: number;
      summary: string;
    };

export type AgentPatch = AgentEditOperation;

type AgentEditOperationWithoutId<TType extends AgentEditOperation["type"]> = Omit<Extract<AgentEditOperation, { type: TType }>, "id">;

export type AgentEditOperationDraft =
  | AgentEditOperationWithoutId<"set_field">
  | AgentEditOperationWithoutId<"append_list_field">
  | AgentEditOperationWithoutId<"replace_job_map">
  | AgentEditOperationWithoutId<"append_job_step">
  | AgentEditOperationWithoutId<"update_job_step">
  | AgentEditOperationWithoutId<"delete_job_step">
  | AgentEditOperationWithoutId<"replace_success_metrics">
  | AgentEditOperationWithoutId<"append_success_metrics">
  | AgentEditOperationWithoutId<"replace_ideal">
  | AgentEditOperationWithoutId<"append_ideal">
  | AgentEditOperationWithoutId<"split_ideal">
  | AgentEditOperationWithoutId<"update_ideal_label">
  | AgentEditOperationWithoutId<"replace_ideal_blockers">
  | AgentEditOperationWithoutId<"append_ideal_blockers">
  | AgentEditOperationWithoutId<"organize_themes">
  | AgentEditOperationWithoutId<"delete_ideal">;

export type AgentPatchDraft = AgentEditOperationDraft;

export type AgentPatchSet = {
  artifactType: "artifact_edit_proposal";
  id: string;
  summary: string;
  patches: AgentEditOperation[];
  status: "pending" | "accepted" | "rejected" | "stale";
  statusReason?: string;
  createdAt: string;
  updatedAt?: string;
};

export type AgentPatchSetDraft = {
  artifactType: "artifact_edit_proposal";
  summary: string;
  patches: AgentEditOperationDraft[];
};

export type AgentEditSetDraft = {
  summary: string;
  operations: AgentEditOperationDraft[];
};

export type AgentSuggestion = GeneratedOption & {
  id: string;
  recommended: boolean;
};

export type AgentSuggestionDraft = GeneratedOption & {
  recommended?: boolean;
};

export type AgentSuggestionSet = {
  artifactType: "field_suggestions";
  id: string;
  appliesTo: FieldKey;
  templateId: number;
  templateTitle: string;
  summary: string;
  suggestions: AgentSuggestion[];
  createdAt: string;
};

export type AgentSuggestionSetDraft = {
  artifactType: "field_suggestions";
  appliesTo: FieldKey;
  templateId: number;
  templateTitle: string;
  summary: string;
  suggestions: AgentSuggestionDraft[];
};

export type AgentMessage = {
  id: number;
  role: "user" | "assistant";
  content: string;
  selection: AgentSelection;
  patchSet?: AgentPatchSet | null;
  suggestionSet?: AgentSuggestionSet | null;
  createdAt: string;
};

export const agentReasoningEffortValues = ["none", "low", "medium", "high", "xhigh"] as const;

export type AgentReasoningEffort = (typeof agentReasoningEffortValues)[number];

export type AgentRunMarker = {
  status: "stopped" | "failed";
  reasoningEffort: AgentReasoningEffort;
};

export type AppState = {
  activeProjectId: number;
  projects: Project[];
  selections: Record<FieldKey, string>;
  themes: Theme[];
  jobSteps: JobStep[];
  idealStates: IdealState[];
  agentMessages: AgentMessage[];
  pendingPatchSet: AgentPatchSet | null;
};

export type WorkbenchDocument = {
  version: 1;
  project: Project;
  selections: Record<FieldKey, string>;
  themes: Theme[];
  jobSteps: JobStep[];
  idealStates: IdealState[];
  agentMessages: AgentMessage[];
  pendingPatchSet: AgentPatchSet | null;
  counters: {
    nextAgentMessageId: number;
    nextJobStepId: number;
    nextSuccessMetricId: number;
    nextThemeId: number;
    nextIdealStateId: number;
    nextPatchSetId: number;
  };
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
