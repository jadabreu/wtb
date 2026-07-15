import {
  formatListFieldValue,
  isListFieldKey,
  parseListFieldValue,
  type AppState,
  type FieldKey,
  type GeneratedOption,
  type IdealState,
  type JobStep
} from "@/lib/types";
import {
  appendUniqueStrings,
  normalizeComparableValue,
  normalizeIdealStateDrafts,
  normalizeJobStepDrafts
} from "@/lib/artifact-normalizers";

async function parseAppStateResponse(response: Response) {
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || "Request failed.");
  }
  return payload as AppState;
}

function cloneJobStep(step: JobStep): JobStep {
  return {
    ...step,
    successMetrics: step.successMetrics.map((metric) => ({
      ...metric,
      themeIds: [...metric.themeIds]
    }))
  };
}

function cloneIdealState(idealState: IdealState): IdealState {
  return {
    ...idealState,
    blockers: [...idealState.blockers],
    themeIds: [...idealState.themeIds]
  };
}

function normalizeFieldValue(key: FieldKey, value: string) {
  return isListFieldKey(key) ? formatListFieldValue(parseListFieldValue(value)) : value.trim();
}

function isFieldComplete(key: FieldKey, value: string) {
  return isListFieldKey(key) ? parseListFieldValue(value).length > 0 : value.trim().length > 0;
}

function appendListFieldValue(currentValue: string, nextValue: string) {
  return formatListFieldValue(appendUniqueStrings(parseListFieldValue(currentValue), parseListFieldValue(nextValue)));
}

function isCandidateSaved(candidate: GeneratedOption, selections: Record<FieldKey, string>) {
  if (!isListFieldKey(candidate.key)) {
    return normalizeComparableValue(selections[candidate.key]) === normalizeComparableValue(candidate.value);
  }

  const currentItems = new Set(parseListFieldValue(selections[candidate.key]).map(normalizeComparableValue));
  const candidateItems = parseListFieldValue(candidate.value);
  return candidateItems.length > 0 && candidateItems.every((item) => currentItems.has(normalizeComparableValue(item)));
}

function candidateActionLabel(key: FieldKey, isSelected: boolean) {
  if (isSelected) return "Accepted";
  return isListFieldKey(key) ? "Add" : "Use";
}

function placeholderFor(key: FieldKey) {
  switch (key) {
    case "product":
      return "Example: procurement analytics dashboard";
    case "end_user":
      return "Example: operations managers at mid-market distributors";
    case "context":
      return "Example: when supplier delays threaten customer orders";
    case "job":
      return "Example: keep customer commitments despite supply uncertainty";
    case "emotional_job":
      return "Example:\nFeel confident making the decision\nAvoid anxiety about missing something important";
    case "social_job":
      return "Example:\nLook organized and capable\nAvoid seeming unprepared to the team";
    case "complexity_factors":
      return "Example:\nSupplier variability\nTime pressure\nUnclear tradeoffs";
  }
}

export {
  appendListFieldValue,
  candidateActionLabel,
  cloneIdealState,
  cloneJobStep,
  isCandidateSaved,
  isFieldComplete,
  normalizeComparableValue,
  normalizeFieldValue,
  normalizeIdealStateDrafts as normalizeIdealStates,
  normalizeJobStepDrafts as normalizeJobSteps,
  parseAppStateResponse,
  placeholderFor
};
