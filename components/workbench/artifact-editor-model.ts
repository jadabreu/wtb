import type { Dispatch, ReactNode, SetStateAction } from "react";
import type { AppState, FieldKey, IdealState, JobStep, Theme, WorkflowStepKey } from "@/lib/types";
import type { WorkflowStep } from "@/lib/workflow";

type ArtifactHeaderRenderer = (
  isSaved?: boolean,
  statusLabel?: string,
  action?: ReactNode,
  detail?: string
) => ReactNode;

type FieldEditorModel = {
  expandedFields: Partial<Record<FieldKey, boolean>>;
  drafts: Record<FieldKey, string>;
  edit: (fieldKey: FieldKey) => void;
  cancel: (fieldKey: FieldKey) => void;
  save: (fieldKey: FieldKey) => Promise<void>;
  clear: (fieldKey: FieldKey) => Promise<void>;
  setDrafts: Dispatch<SetStateAction<Record<FieldKey, string>>>;
};

type JobMapEditorModel = {
  drafts: JobStep[];
  dirty: boolean;
  expandedSteps: Record<number, boolean>;
  addStep: () => void;
  cancel: () => void;
  clear: () => Promise<void>;
  moveStep: (stepId: number, direction: -1 | 1) => void;
  removeStep: (stepId: number) => void;
  save: () => Promise<void>;
  toggleStep: (stepId: number) => void;
  updateStep: (stepId: number, patch: Partial<JobStep>) => void;
};

type SuccessMetricsEditorModel = {
  selectedJobStep: JobStep | null;
  selectedJobStepId: number | null;
  addMetric: (stepId: number) => void;
  removeMetric: (stepId: number, metricIndex: number) => void;
  selectJobStep: (stepId: number | null) => void;
  updateMetric: (stepId: number, metricIndex: number, value: string) => void;
};

type ThemesEditorModel = {
  drafts: Theme[];
  dirty: boolean;
  addTheme: () => void;
  cancel: () => void;
  removeTheme: (themeId: number) => void;
  save: () => Promise<void>;
  updateTheme: (themeId: number, patch: Partial<Theme>) => void;
};

type IdealStatesEditorModel = {
  drafts: IdealState[];
  dirty: boolean;
  expandedIdealStates: Record<number, boolean>;
  selectedIdealState: IdealState | null;
  selectedIdealStateId: number | null;
  addIdealState: () => void;
  cancel: () => void;
  clear: () => Promise<void>;
  moveIdealState: (idealStateId: number, direction: -1 | 1) => void;
  removeIdealState: (idealStateId: number) => void;
  reorderIdealState: (sourceIdealStateId: number, targetIdealStateId: number) => void;
  save: () => Promise<void>;
  selectIdealState: (idealStateId: number | null) => void;
  toggleIdealState: (idealStateId: number) => void;
  updateIdealState: (idealStateId: number, patch: Partial<IdealState>) => void;
};

type BlockersEditorModel = {
  addBlocker: (idealStateId: number) => void;
  removeBlocker: (idealStateId: number, blockerIndex: number) => void;
  updateBlocker: (idealStateId: number, blockerIndex: number, value: string) => void;
};

type ArtifactEditorModel = {
  activeWorkflowComplete: boolean;
  activeWorkflowStep: WorkflowStep;
  saving: boolean;
  state: AppState;
  blockers: BlockersEditorModel;
  field: FieldEditorModel;
  ideals: IdealStatesEditorModel;
  jobMap: JobMapEditorModel;
  successMetrics: SuccessMetricsEditorModel;
  themes: ThemesEditorModel;
  selectWorkflowStep: (stepKey: WorkflowStepKey) => void;
};

export type {
  ArtifactEditorModel,
  ArtifactHeaderRenderer,
  BlockersEditorModel,
  FieldEditorModel,
  IdealStatesEditorModel,
  JobMapEditorModel,
  SuccessMetricsEditorModel,
  ThemesEditorModel
};
