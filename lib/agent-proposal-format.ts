import {
  fieldLabels,
  idealStateLabelLabels,
  normalizeIdealStateLabel,
  type AgentMessage,
  type AgentPatch,
  type AgentPatchSet,
  type AgentSuggestionSet,
  type AppState,
  type IdealState,
  type IdealStateDraft,
  type Theme
} from "@/lib/types";
import { artifactTypeLabel } from "@/lib/ai/artifact-registry";

type AgentPatchFormatState = Pick<AppState, "idealStates" | "jobSteps"> & {
  themes?: Theme[];
};

function formatIdealDraft(ideal: IdealStateDraft) {
  const label = idealStateLabelLabels[normalizeIdealStateLabel(ideal.label)];
  const description = ideal.description ? ` - ${ideal.description}` : "";
  const blockers = ideal.blockers.length > 0 ? ideal.blockers.join("; ") : "no blockers";

  return `${ideal.title}${description} | Label: ${label} | Blockers: ${blockers}`;
}

function formatAgentPatchActionLabel(patch: AgentPatch) {
  if (patch.type === "set_field") return "Set field";
  if (patch.type === "append_list_field") return "Add list items";
  if (patch.type === "replace_job_map") return "Replace map";
  if (patch.type === "append_job_step") return "Add step";
  if (patch.type === "update_job_step") return "Update step";
  if (patch.type === "delete_job_step") return "Delete step";
  if (patch.type === "replace_success_metrics") return "Replace metrics";
  if (patch.type === "append_success_metrics") return "Add metrics";
  if (patch.type === "replace_ideal") return "Rewrite";
  if (patch.type === "append_ideal") return "Add";
  if (patch.type === "split_ideal") return "Split";
  if (patch.type === "update_ideal_label") return "Relabel";
  if (patch.type === "replace_ideal_blockers") return "Replace blockers";
  if (patch.type === "append_ideal_blockers") return "Add blockers";
  if (patch.type === "organize_themes") return "Organize themes";
  return "Delete";
}

function formatAgentPatchTargetTitle(patch: AgentPatch, state: AgentPatchFormatState | IdealState[] = []) {
  const idealStates = Array.isArray(state) ? state : state.idealStates;
  const jobSteps = Array.isArray(state) ? [] : state.jobSteps;

  if (patch.type === "set_field" || patch.type === "append_list_field") return fieldLabels[patch.fieldKey];
  if (patch.type === "replace_job_map") return "Job map";
  if (patch.type === "append_job_step") return patch.jobStep.title;
  if (
    patch.type === "update_job_step" ||
    patch.type === "delete_job_step" ||
    patch.type === "replace_success_metrics" ||
    patch.type === "append_success_metrics"
  ) {
    const jobStep = jobSteps.find((item) => item.id === patch.jobStepId);
    return jobStep?.title || `Job step #${patch.jobStepId}`;
  }
  if (patch.type === "append_ideal") return patch.ideal.title;
  if (patch.type === "organize_themes") return "Themes";
  const idealState = idealStates.find((item) => item.id === patch.idealId);
  return idealState?.title || `Ideal #${patch.idealId}`;
}

function formatThemeTitleList(themes: Array<{ title: string }>) {
  return themes.length > 0 ? themes.map((theme) => theme.title).join("; ") : "no new themes";
}

function formatAgentPatchDetails(patch: AgentPatch) {
  if (patch.type === "set_field") return patch.value;
  if (patch.type === "append_list_field") return patch.values.join("; ");
  if (patch.type === "replace_job_map") return patch.jobSteps.map((step, index) => `${index + 1}. ${step.title}`).join(" / ");
  if (patch.type === "append_job_step" || patch.type === "update_job_step") {
    const metrics = patch.jobStep.successMetrics.length > 0 ? patch.jobStep.successMetrics.join("; ") : "no success metrics";
    return `${patch.jobStep.title}${patch.jobStep.description ? ` - ${patch.jobStep.description}` : ""} | Success metrics: ${metrics}`;
  }
  if (patch.type === "delete_job_step") return patch.summary;
  if (patch.type === "replace_success_metrics" || patch.type === "append_success_metrics") {
    return patch.metrics.length > 0 ? patch.metrics.join("; ") : "no success metrics";
  }
  if (patch.type === "replace_ideal") return formatIdealDraft(patch.ideal);
  if (patch.type === "append_ideal") return formatIdealDraft(patch.ideal);
  if (patch.type === "split_ideal") {
    return patch.ideals.map((ideal, index) => `${index + 1}. ${formatIdealDraft(ideal)}`).join(" / ");
  }
  if (patch.type === "update_ideal_label") {
    return idealStateLabelLabels[normalizeIdealStateLabel(patch.label)];
  }
  if (patch.type === "replace_ideal_blockers" || patch.type === "append_ideal_blockers") {
    return patch.blockers.length > 0 ? patch.blockers.join("; ") : "no blockers";
  }
  if (patch.type === "organize_themes") {
    const idealCount = patch.idealAssignments.length;
    const metricCount = patch.metricAssignments.length;
    return `${patch.assignmentMode === "replace" ? "Replace" : "Append"} tags | Themes: ${formatThemeTitleList(patch.themes)} | ${idealCount} ideal tags, ${metricCount} metric tags`;
  }
  return patch.summary;
}

function formatAgentPatchForAgent(patch: AgentPatch, state: AgentPatchFormatState | IdealState[] = []) {
  return `- ${patch.id}: ${formatAgentPatchActionLabel(patch)} ${formatAgentPatchTargetTitle(patch, state)} | ${formatAgentPatchDetails(patch)}`;
}

function formatAgentPatchSetForAgent(patchSet: AgentPatchSet | null, state: AgentPatchFormatState | IdealState[] = []) {
  if (!patchSet) return "(no pending proposal)";

  const patches = patchSet.patches.map((patch) => formatAgentPatchForAgent(patch, state)).join("\n");
  return `${artifactTypeLabel(patchSet.artifactType)} ${patchSet.id} (${patchSet.status}): ${patchSet.summary}\n${patches}`;
}

function formatAgentSuggestionSetForAgent(suggestionSet: AgentSuggestionSet | null | undefined) {
  if (!suggestionSet) return "";

  const suggestions = suggestionSet.suggestions
    .map((suggestion) => `- ${suggestion.id}: ${suggestion.value}${suggestion.rationale ? ` | ${suggestion.rationale}` : ""}`)
    .join("\n");

  return `${artifactTypeLabel(suggestionSet.artifactType)} ${suggestionSet.id} for ${fieldLabels[suggestionSet.appliesTo]}: ${suggestionSet.summary}\n${suggestions}`;
}

function formatAgentMessageForSession(message: AgentMessage, state: AgentPatchFormatState | IdealState[] = []) {
  const attachments = [
    message.patchSet ? formatAgentPatchSetForAgent(message.patchSet, state) : "",
    formatAgentSuggestionSetForAgent(message.suggestionSet)
  ].filter(Boolean);

  if (attachments.length === 0) return message.content;

  return `${message.content}\n\nStructured artifact payloads from this saved turn:\n${attachments.join("\n\n")}`;
}

export {
  formatAgentMessageForSession,
  formatAgentPatchActionLabel,
  formatAgentPatchDetails,
  formatAgentPatchForAgent,
  formatAgentPatchSetForAgent,
  formatAgentPatchTargetTitle,
  formatAgentSuggestionSetForAgent
};
