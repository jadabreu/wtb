import { appendUniqueStrings, normalizeStringList, successMetricTexts } from "@/lib/artifact-normalizers";
import {
  formatListFieldValue,
  isListFieldKey,
  parseListFieldValue,
  type FieldKey,
  type JobStep,
  type JobStepDraft
} from "@/lib/types";

function normalizeFieldEditValue(fieldKey: FieldKey, value: string) {
  if (isListFieldKey(fieldKey)) {
    return formatListFieldValue(parseListFieldValue(value));
  }

  return value.trim();
}

function appendUniqueListFieldValues(currentValue: string, values: string[]) {
  const currentItems = parseListFieldValue(currentValue);
  const nextItems = appendUniqueStrings(currentItems, values);
  return nextItems.slice(currentItems.length);
}

function normalizeJobStepDraft(step: Partial<JobStepDraft>): JobStepDraft {
  return {
    title: step.title?.trim() || "",
    description: step.description?.trim() || "",
    successMetrics: normalizeStringList(step.successMetrics)
  };
}

function jobMapSignature(jobSteps: JobStep[]) {
  return JSON.stringify(
    jobSteps.map((step) => ({
      id: step.id,
      title: step.title.trim(),
      description: step.description.trim(),
      successMetrics: successMetricTexts(step.successMetrics)
    }))
  );
}

export { appendUniqueListFieldValues, jobMapSignature, normalizeFieldEditValue, normalizeJobStepDraft };
