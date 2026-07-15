import {
  defaultIdealStateLabel,
  normalizeIdealStateLabel,
  type IdealState,
  type IdealStateDraft,
  type JobStep,
  type SuccessMetric,
  type Theme,
  type ThemeDraft
} from "@/lib/types";

type JobStepDraftInput = Partial<Omit<JobStep, "successMetrics">> & {
  successMetrics?: unknown;
};

type IdealStateDraftInput = Partial<Omit<IdealState, "themeIds" | "blockers">> & {
  blockers?: unknown;
  themeIds?: unknown;
};

type ThemeDraftInput = Partial<Theme>;

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeStringList(values: unknown) {
  return Array.isArray(values) ? values.map(normalizeText).filter(Boolean) : [];
}

const themeColorPalette = [
  "#2f6f5f",
  "#9a5b1f",
  "#4f6f9f",
  "#8a5b8f",
  "#7a6a22",
  "#59636e",
  "#9b4d4d",
  "#3f7568"
] as const;

function normalizeThemeColor(value: unknown, index = 0) {
  if (typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value.trim())) {
    return value.trim().toLowerCase();
  }

  return themeColorPalette[index % themeColorPalette.length];
}

function normalizeThemeTitle(value: unknown) {
  return normalizeText(value).replace(/\s+/g, " ");
}

function normalizeThemeIds(values: unknown, validThemeIds?: Set<number>) {
  if (!Array.isArray(values)) return [];

  const ids: number[] = [];
  const seen = new Set<number>();
  for (const value of values) {
    const id = typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null;
    if (!id || seen.has(id)) continue;
    if (validThemeIds && !validThemeIds.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

function normalizeThemeDraft(value: Partial<ThemeDraft> | Partial<Theme>, fallbackTitle = "New theme", index = 0): ThemeDraft {
  return {
    title: normalizeThemeTitle(value.title) || fallbackTitle,
    description: normalizeText(value.description),
    color: normalizeThemeColor(value.color, index)
  };
}

function normalizeComparableValue(value: string) {
  return value.trim().toLowerCase();
}

function appendUniqueStrings(currentValues: string[], nextValues: string[]) {
  const values = [...currentValues];
  const seen = new Set(values.map(normalizeComparableValue));

  for (const value of nextValues.map(normalizeText).filter(Boolean)) {
    const signature = normalizeComparableValue(value);
    if (!seen.has(signature)) {
      seen.add(signature);
      values.push(value);
    }
  }

  return values;
}

function successMetricText(metric: unknown) {
  if (typeof metric === "string") return normalizeText(metric);
  if (metric && typeof metric === "object" && "text" in metric) {
    return normalizeText((metric as Partial<SuccessMetric>).text);
  }
  return "";
}

function successMetricTexts(metrics: unknown) {
  return Array.isArray(metrics) ? metrics.map(successMetricText).filter(Boolean) : [];
}

function normalizeSuccessMetricDraft(metric: unknown, index: number, validThemeIds?: Set<number>): SuccessMetric | null {
  const text = successMetricText(metric);
  if (!text) return null;

  if (metric && typeof metric === "object" && !Array.isArray(metric)) {
    const draft = metric as Partial<SuccessMetric>;
    return {
      id: typeof draft.id === "number" ? draft.id : -(index + 1),
      text,
      themeIds: normalizeThemeIds(draft.themeIds, validThemeIds),
      createdAt: draft.createdAt,
      updatedAt: draft.updatedAt
    };
  }

  return {
    id: -(index + 1),
    text,
    themeIds: []
  };
}

function normalizeSuccessMetricDrafts(metrics: unknown, validThemeIds?: Set<number>) {
  if (!Array.isArray(metrics)) return [];

  const normalizedMetrics: SuccessMetric[] = [];
  for (const metric of metrics) {
    const normalizedMetric = normalizeSuccessMetricDraft(metric, normalizedMetrics.length, validThemeIds);
    if (normalizedMetric) normalizedMetrics.push(normalizedMetric);
  }
  return normalizedMetrics;
}

function normalizeJobStepDraft(step: JobStepDraftInput, index: number): JobStep {
  return {
    id: typeof step.id === "number" ? step.id : -(index + 1),
    title: normalizeText(step.title) || `Step ${index + 1}`,
    description: normalizeText(step.description),
    successMetrics: normalizeSuccessMetricDrafts(step.successMetrics),
    sortOrder: index,
    createdAt: step.createdAt,
    updatedAt: step.updatedAt
  };
}

function normalizeJobStepDrafts(steps: JobStepDraftInput[]): JobStep[] {
  return steps.map(normalizeJobStepDraft);
}

function normalizeIdealStateDraft(value: Partial<IdealStateDraft> | IdealStateDraftInput, fallbackTitle = "New ideal"): IdealStateDraft {
  return {
    title: normalizeText(value.title) || fallbackTitle,
    description: normalizeText(value.description),
    label: normalizeIdealStateLabel(value.label || defaultIdealStateLabel),
    blockers: normalizeStringList(value.blockers)
  };
}

function normalizeIdealStateDraftWithId(idealState: IdealStateDraftInput, index: number): IdealState {
  return {
    id: typeof idealState.id === "number" ? idealState.id : -(index + 1),
    ...normalizeIdealStateDraft(idealState, `Ideal ${index + 1}`),
    themeIds: normalizeThemeIds(idealState.themeIds),
    sortOrder: index,
    createdAt: idealState.createdAt,
    updatedAt: idealState.updatedAt
  };
}

function normalizeIdealStateDrafts(idealStates: IdealStateDraftInput[]): IdealState[] {
  return idealStates.map(normalizeIdealStateDraftWithId);
}

function normalizeThemeDraftWithId(theme: ThemeDraftInput, index: number): Theme {
  return {
    id: typeof theme.id === "number" ? theme.id : -(index + 1),
    ...normalizeThemeDraft(theme, `Theme ${index + 1}`, index),
    color: normalizeThemeColor(theme.color, index),
    sortOrder: index,
    createdAt: theme.createdAt,
    updatedAt: theme.updatedAt
  };
}

function normalizeThemeDrafts(themes: ThemeDraftInput[]): Theme[] {
  return themes.map(normalizeThemeDraftWithId);
}

function areJobStepDraftsEqual(left: JobStepDraftInput[], right: JobStepDraftInput[]) {
  return JSON.stringify(normalizeJobStepDrafts(left)) === JSON.stringify(normalizeJobStepDrafts(right));
}

function areIdealStateDraftsEqual(left: IdealStateDraftInput[], right: IdealStateDraftInput[]) {
  return JSON.stringify(normalizeIdealStateDrafts(left)) === JSON.stringify(normalizeIdealStateDrafts(right));
}

function areThemeDraftsEqual(left: ThemeDraftInput[], right: ThemeDraftInput[]) {
  return JSON.stringify(normalizeThemeDrafts(left)) === JSON.stringify(normalizeThemeDrafts(right));
}

export {
  appendUniqueStrings,
  areIdealStateDraftsEqual,
  areJobStepDraftsEqual,
  areThemeDraftsEqual,
  normalizeComparableValue,
  normalizeIdealStateDraft,
  normalizeIdealStateDrafts,
  normalizeJobStepDrafts,
  normalizeStringList,
  normalizeSuccessMetricDrafts,
  normalizeThemeColor,
  normalizeThemeDraft,
  normalizeThemeDrafts,
  normalizeThemeIds,
  normalizeThemeTitle,
  successMetricText,
  successMetricTexts,
  themeColorPalette
};
