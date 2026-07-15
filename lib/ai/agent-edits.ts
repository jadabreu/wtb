import { z } from "zod";
import {
  appendUniqueStrings,
  normalizeComparableValue,
  normalizeIdealStateDraft,
  normalizeStringList,
  normalizeThemeDraft,
  normalizeThemeTitle,
  successMetricTexts
} from "@/lib/artifact-normalizers";
import { agentEditCandidateSchema, agentIdealDraftSchema, agentJobStepDraftSchema, agentReplySchema } from "@/lib/ai/schemas";
import {
  appendUniqueListFieldValues,
  jobMapSignature,
  normalizeFieldEditValue,
  normalizeJobStepDraft
} from "@/lib/ai/edit-normalizers";
import {
  fieldKeys,
  listFieldKeys,
  normalizeIdealStateLabel,
  type AgentEditOperationDraft,
  type AppState,
  type FieldKey,
  type IdealStateDraft,
  type JobStepDraft,
  type ListFieldKey,
  type ThemeDraft
} from "@/lib/types";
import type { WorkbenchAgentReply } from "@/lib/ai/agent-types";

function normalizeAgentIdealDraft(value: z.infer<typeof agentIdealDraftSchema>): IdealStateDraft {
  return normalizeIdealStateDraft(value);
}

function normalizeAgentJobStepDraft(value: z.infer<typeof agentJobStepDraftSchema>): JobStepDraft {
  return normalizeJobStepDraft({
    title: value.title,
    description: value.description,
    successMetrics: value.success_metrics
  });
}

function normalizeAgentThemeDraft(value: z.infer<typeof agentEditCandidateSchema>["themes"][number], index: number): ThemeDraft {
  return normalizeThemeDraft({
    title: value.title,
    description: value.description,
    color: value.color || undefined
  }, `Theme ${index + 1}`, index);
}

function idealTitleExists(state: AppState, title: string) {
  const signature = title.trim().toLowerCase();
  return state.idealStates.some((idealState) => idealState.title.trim().toLowerCase() === signature);
}

function jobStepTitleExists(state: AppState, title: string, exceptId?: number) {
  const signature = title.trim().toLowerCase();
  return state.jobSteps.some((jobStep) => jobStep.id !== exceptId && jobStep.title.trim().toLowerCase() === signature);
}

function findMetric(state: AppState, jobStepId: number, metricId: number) {
  const jobStep = state.jobSteps.find((step) => step.id === jobStepId);
  if (!jobStep) return null;
  const metric = jobStep.successMetrics.find((item) => item.id === metricId);
  return metric ? { jobStep, metric } : null;
}

function normalizeThemeTitles(values: string[]) {
  const titles: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const title = normalizeThemeTitle(value);
    const signature = normalizeComparableValue(title);
    if (!title || seen.has(signature)) continue;
    seen.add(signature);
    titles.push(title);
  }
  return titles;
}

function hasThemeDraftChange(state: AppState, themes: ThemeDraft[]) {
  return themes.some((theme) => {
    const signature = normalizeComparableValue(theme.title);
    const existing = state.themes.find((item) => normalizeComparableValue(item.title) === signature);
    if (!existing) return true;
    return Boolean(theme.description && theme.description !== existing.description) || Boolean(theme.color && theme.color !== existing.color);
  });
}

function normalizeFieldKey(value: unknown): FieldKey | null {
  return typeof value === "string" && fieldKeys.includes(value as FieldKey) ? (value as FieldKey) : null;
}

function normalizeListFieldKey(value: unknown): ListFieldKey | null {
  return typeof value === "string" && listFieldKeys.includes(value as ListFieldKey) ? (value as ListFieldKey) : null;
}

function normalizeAgentEditCandidate(
  operation: z.infer<typeof agentEditCandidateSchema>,
  state: AppState
): AgentEditOperationDraft | null {
  const idealId = operation.ideal_id ?? null;
  const targetIdeal = typeof idealId === "number" ? state.idealStates.find((idealState) => idealState.id === idealId) : null;
  const jobStepId = operation.job_step_id ?? null;
  const targetJobStep = typeof jobStepId === "number" ? state.jobSteps.find((jobStep) => jobStep.id === jobStepId) : null;
  const summary = operation.summary.trim();
  const cleanBlockers = normalizeStringList(operation.blockers);
  const cleanMetrics = normalizeStringList(operation.metrics);

  switch (operation.type) {
    case "set_field": {
      const fieldKey = normalizeFieldKey(operation.field_key);
      if (!fieldKey || operation.value === null) return null;
      const value = normalizeFieldEditValue(fieldKey, operation.value);
      if (value === (state.selections[fieldKey] || "")) return null;
      return {
        type: "set_field",
        fieldKey,
        value,
        previousValue: state.selections[fieldKey] || "",
        summary
      };
    }
    case "append_list_field": {
      const fieldKey = normalizeListFieldKey(operation.list_field_key) || normalizeListFieldKey(operation.field_key);
      if (!fieldKey) return null;
      const values = normalizeStringList(operation.values);
      if (values.length === 0) return null;
      const nextValues = appendUniqueListFieldValues(state.selections[fieldKey] || "", values);
      if (nextValues.length === 0) return null;
      return {
        type: "append_list_field",
        fieldKey,
        values: nextValues,
        previousValue: state.selections[fieldKey] || "",
        summary
      };
    }
    case "replace_job_map": {
      const jobSteps = operation.job_steps.map(normalizeAgentJobStepDraft).filter((jobStep) => jobStep.title);
      if (jobSteps.length === 0) return null;
      return {
        type: "replace_job_map",
        jobSteps,
        previousJobMapSignature: jobMapSignature(state.jobSteps),
        summary
      };
    }
    case "append_job_step": {
      if (!operation.job_step) return null;
      const jobStep = normalizeAgentJobStepDraft(operation.job_step);
      if (!jobStep.title || jobStepTitleExists(state, jobStep.title)) return null;
      return { type: "append_job_step", jobStep, summary };
    }
    case "update_job_step": {
      if (!targetJobStep || !operation.job_step) return null;
      const jobStep = normalizeAgentJobStepDraft(operation.job_step);
      if (!jobStep.title || jobStepTitleExists(state, jobStep.title, targetJobStep.id)) return null;
      return {
        type: "update_job_step",
        jobStepId: targetJobStep.id,
        jobStep,
        targetUpdatedAt: targetJobStep.updatedAt,
        summary
      };
    }
    case "delete_job_step": {
      if (!targetJobStep || !summary) return null;
      return {
        type: "delete_job_step",
        jobStepId: targetJobStep.id,
        targetUpdatedAt: targetJobStep.updatedAt,
        summary
      };
    }
    case "replace_success_metrics": {
      if (!targetJobStep) return null;
      return {
        type: "replace_success_metrics",
        jobStepId: targetJobStep.id,
        metrics: cleanMetrics,
        targetUpdatedAt: targetJobStep.updatedAt,
        summary
      };
    }
    case "append_success_metrics": {
      if (!targetJobStep || cleanMetrics.length === 0) return null;
      const nextMetrics = appendUniqueStrings(successMetricTexts(targetJobStep.successMetrics), cleanMetrics);
      if (nextMetrics.length === targetJobStep.successMetrics.length) return null;
      return {
        type: "append_success_metrics",
        jobStepId: targetJobStep.id,
        metrics: cleanMetrics,
        targetUpdatedAt: targetJobStep.updatedAt,
        summary
      };
    }
    case "organize_themes": {
      const themeDraftsBySignature = new Map<string, ThemeDraft>();

      operation.themes
        .map(normalizeAgentThemeDraft)
        .filter((theme) => theme.title)
        .forEach((theme) => {
          const signature = normalizeComparableValue(theme.title);
          if (!themeDraftsBySignature.has(signature)) themeDraftsBySignature.set(signature, theme);
        });

      const idealAssignments = operation.ideal_theme_assignments
        .map((assignment) => {
          const target = state.idealStates.find((idealState) => idealState.id === assignment.ideal_id);
          const themeTitles = normalizeThemeTitles(assignment.theme_titles);
          themeTitles.forEach((title) => {
            const signature = normalizeComparableValue(title);
            if (!themeDraftsBySignature.has(signature) && !state.themes.some((theme) => normalizeComparableValue(theme.title) === signature)) {
              themeDraftsBySignature.set(signature, { title, description: "" });
            }
          });
          return target && (themeTitles.length > 0 || operation.theme_assignment_mode === "replace")
            ? { idealId: target.id, themeTitles }
            : null;
        })
        .filter((assignment): assignment is { idealId: number; themeTitles: string[] } => Boolean(assignment));

      const metricAssignments = operation.metric_theme_assignments
        .map((assignment) => {
          const target = findMetric(state, assignment.job_step_id, assignment.metric_id);
          const themeTitles = normalizeThemeTitles(assignment.theme_titles);
          themeTitles.forEach((title) => {
            const signature = normalizeComparableValue(title);
            if (!themeDraftsBySignature.has(signature) && !state.themes.some((theme) => normalizeComparableValue(theme.title) === signature)) {
              themeDraftsBySignature.set(signature, { title, description: "" });
            }
          });
          return target && (themeTitles.length > 0 || operation.theme_assignment_mode === "replace")
            ? { jobStepId: target.jobStep.id, metricId: target.metric.id, themeTitles }
            : null;
        })
        .filter((assignment): assignment is { jobStepId: number; metricId: number; themeTitles: string[] } => Boolean(assignment));

      const themes = [...themeDraftsBySignature.values()];
      const assignmentMode = operation.theme_assignment_mode === "replace" ? "replace" : "append";
      const existingThemeIdsByTitle = new Map(state.themes.map((theme) => [normalizeComparableValue(theme.title), theme.id]));
      const wouldChangeIdealTags = idealAssignments.some((assignment) => {
        const target = state.idealStates.find((idealState) => idealState.id === assignment.idealId);
        if (!target) return false;
        const assignedIds = assignment.themeTitles
          .map((title) => existingThemeIdsByTitle.get(normalizeComparableValue(title)))
          .filter((id): id is number => typeof id === "number");
        return assignmentMode === "replace"
          ? JSON.stringify([...target.themeIds].sort()) !== JSON.stringify([...assignedIds].sort())
          : assignedIds.some((id) => !target.themeIds.includes(id)) || assignment.themeTitles.some((title) => !existingThemeIdsByTitle.has(normalizeComparableValue(title)));
      });
      const wouldChangeMetricTags = metricAssignments.some((assignment) => {
        const target = findMetric(state, assignment.jobStepId, assignment.metricId);
        if (!target) return false;
        const assignedIds = assignment.themeTitles
          .map((title) => existingThemeIdsByTitle.get(normalizeComparableValue(title)))
          .filter((id): id is number => typeof id === "number");
        return assignmentMode === "replace"
          ? JSON.stringify([...target.metric.themeIds].sort()) !== JSON.stringify([...assignedIds].sort())
          : assignedIds.some((id) => !target.metric.themeIds.includes(id)) || assignment.themeTitles.some((title) => !existingThemeIdsByTitle.has(normalizeComparableValue(title)));
      });

      if (!hasThemeDraftChange(state, themes) && !wouldChangeIdealTags && !wouldChangeMetricTags) return null;

      return {
        type: "organize_themes",
        themes,
        idealAssignments,
        metricAssignments,
        assignmentMode,
        summary
      };
    }
    case "replace_ideal": {
      if (!targetIdeal || !operation.ideal) return null;
      return { type: "replace_ideal", idealId: targetIdeal.id, ideal: normalizeAgentIdealDraft(operation.ideal), summary };
    }
    case "append_ideal": {
      if (!operation.ideal) return null;
      const ideal = normalizeAgentIdealDraft(operation.ideal);
      if (!ideal.title || idealTitleExists(state, ideal.title)) return null;
      return { type: "append_ideal", ideal, summary };
    }
    case "split_ideal": {
      if (!targetIdeal || operation.ideals.length === 0) return null;
      const ideals = operation.ideals.map(normalizeAgentIdealDraft).filter((ideal) => ideal.title);
      if (ideals.length === 0) return null;
      return {
        type: "split_ideal",
        idealId: targetIdeal.id,
        ideals,
        summary
      };
    }
    case "update_ideal_label": {
      if (!targetIdeal || !operation.label) return null;
      return { type: "update_ideal_label", idealId: targetIdeal.id, label: normalizeIdealStateLabel(operation.label), summary };
    }
    case "replace_ideal_blockers": {
      if (!targetIdeal) return null;
      return { type: "replace_ideal_blockers", idealId: targetIdeal.id, blockers: cleanBlockers, summary };
    }
    case "append_ideal_blockers": {
      if (!targetIdeal || cleanBlockers.length === 0) return null;
      return { type: "append_ideal_blockers", idealId: targetIdeal.id, blockers: cleanBlockers, summary };
    }
    case "delete_ideal": {
      if (!targetIdeal || !summary) return null;
      return { type: "delete_ideal", idealId: targetIdeal.id, summary };
    }
  }
}

function normalizeAgentReplyOutput(
  parsed: z.infer<typeof agentReplySchema>,
  state: AppState
): WorkbenchAgentReply {
  const operations = parsed.edit_set?.patches
    .map((operation) => normalizeAgentEditCandidate(operation, state))
    .filter((operation): operation is AgentEditOperationDraft => Boolean(operation)) || [];

  return {
    message: parsed.message.trim(),
    editSet:
      parsed.edit_set && operations.length > 0
        ? {
            summary: parsed.edit_set.summary.trim() || "Updated artifacts",
            operations
          }
        : null,
  };
}

export { normalizeAgentEditCandidate, normalizeAgentReplyOutput };
