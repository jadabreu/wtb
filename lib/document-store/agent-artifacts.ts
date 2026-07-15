import { now } from "@/lib/document-store/files";
import { appendUniqueListFieldValues, jobMapSignature } from "@/lib/ai/edit-normalizers";
import type { AgentMessage, AgentPatch, AgentPatchSet, AgentSuggestionSet, IdealState, WorkbenchDocument } from "@/lib/types";

const reviewablePatchSetStatuses = ["pending", "stale"] as const;

function normalizePatchSetStatus(status: unknown): AgentPatchSet["status"] {
  if (status === "accepted" || status === "rejected" || status === "stale") return status;
  return "pending";
}

function normalizeAgentPatchSetArtifacts(patchSet: AgentPatchSet | null | undefined): AgentPatchSet | null {
  if (!patchSet) return null;

  return {
    ...patchSet,
    artifactType: "artifact_edit_proposal",
    status: normalizePatchSetStatus(patchSet.status)
  };
}

function normalizeAgentSuggestionSetArtifacts(suggestionSet: AgentSuggestionSet | null | undefined): AgentSuggestionSet | null {
  if (!suggestionSet) return null;

  return {
    ...suggestionSet,
    artifactType: "field_suggestions"
  };
}

function normalizeAgentMessageArtifacts(message: AgentMessage): AgentMessage {
  return {
    ...message,
    patchSet: normalizeAgentPatchSetArtifacts(message.patchSet),
    suggestionSet: normalizeAgentSuggestionSetArtifacts(message.suggestionSet)
  };
}

function isReviewablePatchSetStatus(status: AgentPatchSet["status"]) {
  return reviewablePatchSetStatuses.includes(status as (typeof reviewablePatchSetStatuses)[number]);
}

function idealTitleSignature(title: string) {
  return title.trim().toLowerCase();
}

function isAppendPatchStale(patch: Extract<AgentPatch, { type: "append_ideal" }>, idealStates: IdealState[]) {
  const patchTitle = idealTitleSignature(patch.ideal.title);
  return Boolean(patchTitle && idealStates.some((idealState) => idealTitleSignature(idealState.title) === patchTitle));
}

function findPatchTarget(patch: AgentPatch, idealStates: IdealState[]) {
  if (patch.type === "append_ideal") return null;
  if (!("idealId" in patch)) return null;
  return idealStates.find((idealState) => idealState.id === patch.idealId) || null;
}

function getJobStepStaleReason(doc: WorkbenchDocument, patch: AgentPatch, patchSet: AgentPatchSet) {
  if (patch.type === "replace_job_map") {
    if (patch.previousJobMapSignature && jobMapSignature(doc.jobSteps) !== patch.previousJobMapSignature) {
      return "The job map changed after this proposal was generated.";
    }
    return null;
  }

  if (patch.type === "append_job_step") {
    const title = patch.jobStep.title.trim().toLowerCase();
    if (title && doc.jobSteps.some((jobStep) => jobStep.title.trim().toLowerCase() === title)) {
      return "One of the proposed job steps already exists in the artifact.";
    }
    return null;
  }

  if (
    patch.type !== "update_job_step" &&
    patch.type !== "delete_job_step" &&
    patch.type !== "replace_success_metrics" &&
    patch.type !== "append_success_metrics"
  ) {
    return null;
  }

  const target = doc.jobSteps.find((jobStep) => jobStep.id === patch.jobStepId);
  if (!target) return "One of the target job steps no longer exists.";
  if (target.updatedAt && target.updatedAt > patchSet.createdAt) {
    return "One of the target job steps changed after this proposal was generated.";
  }
  if (patch.targetUpdatedAt && target.updatedAt && patch.targetUpdatedAt !== target.updatedAt) {
    return "One of the target job steps changed after this proposal was generated.";
  }

  return null;
}

function getThemeOrganizationStaleReason(doc: WorkbenchDocument, patch: AgentPatch, patchSet: AgentPatchSet) {
  if (patch.type !== "organize_themes") return null;

  for (const assignment of patch.idealAssignments) {
    const target = doc.idealStates.find((idealState) => idealState.id === assignment.idealId);
    if (!target) return "One of the target ideals no longer exists.";
    if (target.updatedAt && target.updatedAt > patchSet.createdAt) {
      return "One of the target ideals changed after this proposal was generated.";
    }
  }

  for (const assignment of patch.metricAssignments) {
    const jobStep = doc.jobSteps.find((step) => step.id === assignment.jobStepId);
    if (!jobStep) return "One of the target job steps no longer exists.";
    if (jobStep.updatedAt && jobStep.updatedAt > patchSet.createdAt) {
      return "One of the target job steps changed after this proposal was generated.";
    }
    if (!jobStep.successMetrics.some((metric) => metric.id === assignment.metricId)) {
      return "One of the target success metrics no longer exists.";
    }
  }

  return null;
}

function getFieldStaleReason(doc: WorkbenchDocument, patch: AgentPatch) {
  if (patch.type !== "set_field" && patch.type !== "append_list_field") return null;

  if (patch.previousValue !== undefined && (doc.selections[patch.fieldKey] || "") !== patch.previousValue) {
    return "One of the target fields changed after this proposal was generated.";
  }

  if (patch.type === "append_list_field") {
    const nextValues = appendUniqueListFieldValues(doc.selections[patch.fieldKey] || "", patch.values);
    if (nextValues.length === 0) return "The proposed list-field values are already present.";
  }

  return null;
}

function getPatchSetStaleReason(doc: WorkbenchDocument, patchSet: AgentPatchSet) {
  if (patchSet.status !== "pending") return null;

  for (const patch of patchSet.patches) {
    const fieldStaleReason = getFieldStaleReason(doc, patch);
    if (fieldStaleReason) return fieldStaleReason;

    const jobStepStaleReason = getJobStepStaleReason(doc, patch, patchSet);
    if (jobStepStaleReason) return jobStepStaleReason;

    const themeOrganizationStaleReason = getThemeOrganizationStaleReason(doc, patch, patchSet);
    if (themeOrganizationStaleReason) return themeOrganizationStaleReason;

    if (
      patch.type !== "replace_ideal" &&
      patch.type !== "append_ideal" &&
      patch.type !== "split_ideal" &&
      patch.type !== "update_ideal_label" &&
      patch.type !== "replace_ideal_blockers" &&
      patch.type !== "append_ideal_blockers" &&
      patch.type !== "organize_themes" &&
      patch.type !== "delete_ideal"
    ) {
      continue;
    }

    if (patch.type === "organize_themes") continue;

    if (patch.type === "append_ideal" && isAppendPatchStale(patch, doc.idealStates)) {
      return "One of the proposed ideals already exists in the artifact.";
    }

    const target = findPatchTarget(patch, doc.idealStates);
    if (patch.type !== "append_ideal" && !target) {
      return "One of the target ideals no longer exists.";
    }

    if (target?.updatedAt && target.updatedAt > patchSet.createdAt) {
      return "One of the target ideals changed after this proposal was generated.";
    }
  }

  return null;
}

function syncPatchSetToMessages(doc: WorkbenchDocument, patchSet: AgentPatchSet) {
  doc.agentMessages = doc.agentMessages.map((message) =>
    message.patchSet?.id === patchSet.id ? { ...message, patchSet } : message
  );
}

function refreshPendingPatchSetStatus(doc: WorkbenchDocument) {
  if (!doc.pendingPatchSet) return false;

  doc.pendingPatchSet = normalizeAgentPatchSetArtifacts(doc.pendingPatchSet);
  if (!doc.pendingPatchSet) return false;

  const staleReason = getPatchSetStaleReason(doc, doc.pendingPatchSet);
  if (!staleReason) {
    syncPatchSetToMessages(doc, doc.pendingPatchSet);
    return false;
  }

  const stalePatchSet: AgentPatchSet = {
    ...doc.pendingPatchSet,
    status: "stale",
    statusReason: staleReason,
    updatedAt: now()
  };
  doc.pendingPatchSet = stalePatchSet;
  syncPatchSetToMessages(doc, stalePatchSet);
  return true;
}

function hasReviewablePatchSet(doc: WorkbenchDocument) {
  refreshPendingPatchSetStatus(doc);
  return Boolean(doc.pendingPatchSet && isReviewablePatchSetStatus(doc.pendingPatchSet.status));
}

export {
  getPatchSetStaleReason,
  hasReviewablePatchSet,
  isReviewablePatchSetStatus,
  normalizeAgentMessageArtifacts,
  normalizeAgentPatchSetArtifacts,
  normalizeAgentSuggestionSetArtifacts,
  refreshPendingPatchSetStatus
};
