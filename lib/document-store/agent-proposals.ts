import {
  appendUniqueStrings,
  normalizeComparableValue,
  normalizeIdealStateDraft,
  normalizeStringList,
  normalizeThemeDraft,
  normalizeThemeTitle,
  successMetricTexts
} from "@/lib/artifact-normalizers";
import {
  appendUniqueListFieldValues,
  normalizeFieldEditValue,
  normalizeJobStepDraft
} from "@/lib/ai/edit-normalizers";
import {
  formatListFieldValue,
  type AgentEditSetDraft,
  normalizeIdealStateLabel,
  parseListFieldValue,
  type AgentMessage,
  type AgentPatch,
  type AgentPatchDraft,
  type AgentPatchSet,
  type AgentSelection,
  type IdealState,
  type IdealStateDraft,
  type JobStep,
  type JobStepDraft,
  type SuccessMetric,
  type Theme,
  type ThemeDraft,
  type WorkbenchDocument
} from "@/lib/types";
import { appendEvent, now } from "@/lib/document-store/files";
import { loadDocument, saveDocument, toAppState } from "@/lib/document-store/core";
import { isReviewablePatchSetStatus, refreshPendingPatchSetStatus } from "@/lib/document-store/agent-artifacts";

function appendAgentMessage(
  doc: WorkbenchDocument,
  role: "user" | "assistant",
  content: string,
  selection: AgentSelection,
  patchSet?: AgentPatchSet | null
) {
  const message: AgentMessage = {
    id: doc.counters.nextAgentMessageId++,
    role,
    content,
    selection,
    patchSet: patchSet || null,
    suggestionSet: null,
    createdAt: now()
  };
  doc.agentMessages.push(message);
  return message;
}

function nextPatchId(index: number) {
  return `patch_${index + 1}`;
}

function normalizeAgentPatch(patch: AgentPatchDraft | AgentPatch, index: number): AgentPatch {
  return {
    ...patch,
    id: "id" in patch && patch.id ? patch.id : nextPatchId(index)
  } as AgentPatch;
}

function appendAgentUserMessage(projectId: number, userMessage: string, selection: AgentSelection) {
  const doc = loadDocument(projectId);
  appendAgentMessage(doc, "user", userMessage, selection);
  saveDocument(doc);
  appendEvent(projectId, "agent.user_message", { message: userMessage, selection });
  return toAppState(doc);
}

function replaceAgentUserMessage(projectId: number, messageId: number, userMessage: string, selection: AgentSelection) {
  const doc = loadDocument(projectId);
  const messageIndex = doc.agentMessages.findIndex((message) => message.id === messageId && message.role === "user");
  if (messageIndex === -1) throw new Error("Could not find the message to replace.");

  const existingMessage = doc.agentMessages[messageIndex];
  doc.agentMessages = [
    ...doc.agentMessages.slice(0, messageIndex),
    {
      ...existingMessage,
      content: userMessage,
      selection,
      createdAt: now()
    }
  ];

  if (doc.pendingPatchSet && !doc.agentMessages.some((message) => message.patchSet?.id === doc.pendingPatchSet?.id)) {
    doc.pendingPatchSet = null;
  }
  refreshPendingPatchSetStatus(doc);

  doc.project.openaiConversationId = null;
  saveDocument(doc);
  appendEvent(projectId, "agent.user_message.replaced", { messageId, message: userMessage, selection });
  return toAppState(doc);
}

function appendAgentAssistantMessage(
  projectId: number,
  assistantMessage: string,
  selection: AgentSelection,
  editSetInput: AgentEditSetDraft | null
) {
  const doc = loadDocument(projectId);
  refreshPendingPatchSetStatus(doc);

  const appliedEdits = applyAgentEditSetToDocument(doc, editSetInput);

  appendAgentMessage(doc, "assistant", assistantMessage, selection);
  saveDocument(doc);
  appendEvent(projectId, "agent.reply", {
    message: assistantMessage,
    editSet: editSetInput ? { summary: editSetInput.summary, operations: appliedEdits } : null
  });
  return toAppState(doc);
}

function appendIdealFromDraft(
  doc: WorkbenchDocument,
  draft: IdealStateDraft,
  sortOrder = doc.idealStates.length
) {
  const timestamp = now();
  const idealState: IdealState = {
    id: doc.counters.nextIdealStateId++,
    ...normalizeIdealStateDraft(draft),
    themeIds: [],
    sortOrder,
    createdAt: timestamp,
    updatedAt: timestamp
  };
  doc.idealStates.splice(sortOrder, 0, idealState);
  doc.idealStates = doc.idealStates.map((item, index) => ({ ...item, sortOrder: index }));
  return idealState;
}

function successMetricFromText(doc: WorkbenchDocument, text: string, themeIds: number[] = []): SuccessMetric {
  const timestamp = now();
  return {
    id: doc.counters.nextSuccessMetricId++,
    text,
    themeIds,
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

function successMetricsFromStrings(doc: WorkbenchDocument, values: string[]) {
  return normalizeStringList(values).map((metric) => successMetricFromText(doc, metric));
}

function appendUniqueSuccessMetrics(doc: WorkbenchDocument, currentMetrics: SuccessMetric[], nextValues: string[]) {
  const currentTexts = successMetricTexts(currentMetrics);
  const nextTexts = appendUniqueStrings(currentTexts, nextValues).slice(currentTexts.length);
  return [...currentMetrics, ...nextTexts.map((metric) => successMetricFromText(doc, metric))];
}

function jobStepFromDraft(doc: WorkbenchDocument, draft: JobStepDraft, sortOrder = doc.jobSteps.length): JobStep {
  const timestamp = now();
  const normalizedDraft = normalizeJobStepDraft(draft);
  return {
    id: doc.counters.nextJobStepId++,
    title: normalizedDraft.title,
    description: normalizedDraft.description,
    successMetrics: successMetricsFromStrings(doc, normalizedDraft.successMetrics),
    sortOrder,
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

function appendJobStepFromDraft(doc: WorkbenchDocument, draft: JobStepDraft, sortOrder = doc.jobSteps.length) {
  const jobStep = jobStepFromDraft(doc, draft, sortOrder);
  doc.jobSteps.splice(sortOrder, 0, jobStep);
  doc.jobSteps = doc.jobSteps.map((step, index) => ({ ...step, sortOrder: index }));
  return jobStep;
}

function setSelectionValue(doc: WorkbenchDocument, patch: Extract<AgentPatch, { type: "set_field" }>) {
  const value = normalizeFieldEditValue(patch.fieldKey, patch.value);
  doc.selections[patch.fieldKey] = value;
  if (patch.fieldKey === "product" && value) {
    doc.project.name = value;
  }
}

function themeSignature(title: string) {
  return normalizeComparableValue(normalizeThemeTitle(title));
}

function findThemeByTitle(doc: WorkbenchDocument, title: string) {
  const signature = themeSignature(title);
  return doc.themes.find((theme) => themeSignature(theme.title) === signature) || null;
}

function upsertTheme(doc: WorkbenchDocument, draft: ThemeDraft, index = doc.themes.length): Theme {
  const normalizedDraft = normalizeThemeDraft(draft, `Theme ${index + 1}`, index);
  const existing = findThemeByTitle(doc, normalizedDraft.title);

  if (existing) {
    const nextTheme = {
      ...existing,
      description: normalizedDraft.description || existing.description,
      color: normalizedDraft.color || existing.color
    };
    if (nextTheme.description !== existing.description || nextTheme.color !== existing.color) {
      nextTheme.updatedAt = now();
      doc.themes = doc.themes.map((theme) => (theme.id === existing.id ? nextTheme : theme));
      return nextTheme;
    }
    return existing;
  }

  const timestamp = now();
  const theme: Theme = {
    id: doc.counters.nextThemeId++,
    title: normalizedDraft.title,
    description: normalizedDraft.description,
    color: normalizedDraft.color || "#59636e",
    sortOrder: doc.themes.length,
    createdAt: timestamp,
    updatedAt: timestamp
  };
  doc.themes.push(theme);
  return theme;
}

function ensureThemeIdsForTitles(doc: WorkbenchDocument, titles: string[], themeDraftsByTitle: Map<string, ThemeDraft>) {
  return titles
    .map((title, index) => {
      const signature = themeSignature(title);
      const draft = themeDraftsByTitle.get(signature) || { title, description: "" };
      return upsertTheme(doc, draft, index).id;
    })
    .filter((id, index, ids) => ids.indexOf(id) === index);
}

function mergeThemeIds(currentIds: number[], nextIds: number[], mode: "append" | "replace") {
  if (mode === "replace") return nextIds;
  return [...currentIds, ...nextIds.filter((id) => !currentIds.includes(id))];
}

function applyThemeOrganization(doc: WorkbenchDocument, patch: Extract<AgentPatch, { type: "organize_themes" }>) {
  const themeDraftsByTitle = new Map<string, ThemeDraft>();
  patch.themes.forEach((theme, index) => {
    const normalizedDraft = normalizeThemeDraft(theme, `Theme ${index + 1}`, index);
    const signature = themeSignature(normalizedDraft.title);
    if (!themeDraftsByTitle.has(signature)) themeDraftsByTitle.set(signature, normalizedDraft);
    upsertTheme(doc, normalizedDraft, index);
  });

  doc.idealStates = doc.idealStates.map((idealState) => {
    const assignment = patch.idealAssignments.find((item) => item.idealId === idealState.id);
    if (!assignment) return idealState;
    const themeIds = ensureThemeIdsForTitles(doc, assignment.themeTitles, themeDraftsByTitle);
    return {
      ...idealState,
      themeIds: mergeThemeIds(idealState.themeIds, themeIds, patch.assignmentMode),
      updatedAt: now()
    };
  });

  doc.jobSteps = doc.jobSteps.map((jobStep) => {
    const assignments = patch.metricAssignments.filter((item) => item.jobStepId === jobStep.id);
    if (assignments.length === 0) return jobStep;
    let changed = false;
    const successMetrics = jobStep.successMetrics.map((metric) => {
      const assignment = assignments.find((item) => item.metricId === metric.id);
      if (!assignment) return metric;
      const themeIds = ensureThemeIdsForTitles(doc, assignment.themeTitles, themeDraftsByTitle);
      changed = true;
      return {
        ...metric,
        themeIds: mergeThemeIds(metric.themeIds, themeIds, patch.assignmentMode),
        updatedAt: now()
      };
    });
    return changed ? { ...jobStep, successMetrics, updatedAt: now() } : jobStep;
  });

  doc.themes = doc.themes.map((theme, index) => ({ ...theme, sortOrder: index }));
}

function applyAgentPatch(doc: WorkbenchDocument, patch: AgentPatch) {
  switch (patch.type) {
    case "set_field": {
      setSelectionValue(doc, patch);
      return;
    }
    case "append_list_field": {
      const nextValues = appendUniqueListFieldValues(doc.selections[patch.fieldKey] || "", patch.values);
      const allValues = appendUniqueStrings(parseListFieldValue(doc.selections[patch.fieldKey] || ""), nextValues);
      doc.selections[patch.fieldKey] = formatListFieldValue(allValues);
      return;
    }
    case "replace_job_map": {
      doc.jobSteps = [];
      patch.jobSteps.forEach((jobStep, index) => appendJobStepFromDraft(doc, jobStep, index));
      return;
    }
    case "append_job_step": {
      appendJobStepFromDraft(doc, patch.jobStep);
      return;
    }
    case "update_job_step": {
      doc.jobSteps = doc.jobSteps.map((jobStep) =>
        jobStep.id === patch.jobStepId
          ? (() => {
              const normalizedDraft = normalizeJobStepDraft(patch.jobStep);
              return {
                ...jobStep,
                title: normalizedDraft.title,
                description: normalizedDraft.description,
                successMetrics: successMetricsFromStrings(doc, normalizedDraft.successMetrics),
                updatedAt: now()
              };
            })()
          : jobStep
      );
      return;
    }
    case "delete_job_step": {
      doc.jobSteps = doc.jobSteps.filter((jobStep) => jobStep.id !== patch.jobStepId);
      return;
    }
    case "replace_success_metrics": {
      doc.jobSteps = doc.jobSteps.map((jobStep) =>
        jobStep.id === patch.jobStepId ? { ...jobStep, successMetrics: successMetricsFromStrings(doc, patch.metrics), updatedAt: now() } : jobStep
      );
      return;
    }
    case "append_success_metrics": {
      doc.jobSteps = doc.jobSteps.map((jobStep) => {
        if (jobStep.id !== patch.jobStepId) return jobStep;
        return {
          ...jobStep,
          successMetrics: appendUniqueSuccessMetrics(doc, jobStep.successMetrics, patch.metrics),
          updatedAt: now()
        };
      });
      return;
    }
    case "replace_ideal": {
      doc.idealStates = doc.idealStates.map((idealState) =>
        idealState.id === patch.idealId
          ? {
              ...idealState,
              ...normalizeIdealStateDraft(patch.ideal, idealState.title),
              updatedAt: now()
            }
          : idealState
      );
      return;
    }
    case "append_ideal": {
      appendIdealFromDraft(doc, patch.ideal);
      return;
    }
    case "split_ideal": {
      const sourceIndex = doc.idealStates.findIndex((idealState) => idealState.id === patch.idealId);
      if (sourceIndex === -1 || patch.ideals.length === 0) return;

      const source = doc.idealStates[sourceIndex];
      const [firstIdeal, ...additionalIdeals] = patch.ideals;
      doc.idealStates[sourceIndex] = {
        ...source,
        ...normalizeIdealStateDraft(firstIdeal, source.title),
        updatedAt: now()
      };
      additionalIdeals.forEach((ideal, index) =>
        appendIdealFromDraft(doc, normalizeIdealStateDraft(ideal), sourceIndex + index + 1)
      );
      return;
    }
    case "update_ideal_label": {
      doc.idealStates = doc.idealStates.map((idealState) =>
        idealState.id === patch.idealId ? { ...idealState, label: normalizeIdealStateLabel(patch.label), updatedAt: now() } : idealState
      );
      return;
    }
    case "replace_ideal_blockers": {
      doc.idealStates = doc.idealStates.map((idealState) =>
        idealState.id === patch.idealId ? { ...idealState, blockers: normalizeStringList(patch.blockers), updatedAt: now() } : idealState
      );
      return;
    }
    case "append_ideal_blockers": {
      doc.idealStates = doc.idealStates.map((idealState) => {
        if (idealState.id !== patch.idealId) return idealState;
        const nextBlockers = appendUniqueStrings(idealState.blockers, patch.blockers);
        return { ...idealState, blockers: nextBlockers, updatedAt: now() };
      });
      return;
    }
    case "organize_themes": {
      applyThemeOrganization(doc, patch);
      return;
    }
    case "delete_ideal": {
      doc.idealStates = doc.idealStates.filter((idealState) => idealState.id !== patch.idealId);
      return;
    }
  }
}

function clearPendingPatchSetAfterDirectEdit(doc: WorkbenchDocument) {
  const patchSet = doc.pendingPatchSet;
  if (!patchSet || !isReviewablePatchSetStatus(patchSet.status)) return null;

  const stalePatchSet: AgentPatchSet = {
    ...patchSet,
    status: "stale",
    statusReason: "The artifacts changed after direct agent edits.",
    updatedAt: now()
  };
  doc.pendingPatchSet = null;
  doc.agentMessages = doc.agentMessages.map((message) =>
    message.patchSet?.id === patchSet.id ? { ...message, patchSet: stalePatchSet } : message
  );
  return stalePatchSet;
}

function applyAgentEditSetToDocument(doc: WorkbenchDocument, editSetInput: AgentEditSetDraft | null | undefined) {
  if (!editSetInput || editSetInput.operations.length === 0) return [];

  const patches = editSetInput.operations.map(normalizeAgentPatch);
  patches.forEach((patch) => applyAgentPatch(doc, patch));
  clearPendingPatchSetAfterDirectEdit(doc);
  return patches;
}

function applyPendingPatchSet(projectId: number, patchIds?: string[]) {
  const doc = loadDocument(projectId);
  const refreshed = refreshPendingPatchSetStatus(doc);
  const patchSet = doc.pendingPatchSet;
  if (!patchSet || patchSet.status !== "pending") {
    if (refreshed) saveDocument(doc);
    return toAppState(doc);
  }

  const acceptedIds = patchIds && patchIds.length > 0 ? new Set(patchIds) : null;
  const acceptedPatches = acceptedIds ? patchSet.patches.filter((patch) => acceptedIds.has(patch.id)) : patchSet.patches;
  if (acceptedPatches.length === 0) return toAppState(doc);

  acceptedPatches.forEach((patch) => applyAgentPatch(doc, patch));
  const acceptedPatchSet: AgentPatchSet = {
    ...patchSet,
    patches: acceptedPatches,
    status: "accepted",
    updatedAt: now()
  };

  const remainingPatches = acceptedIds ? patchSet.patches.filter((patch) => !acceptedIds.has(patch.id)) : [];
  if (remainingPatches.length > 0) {
    const remainingPatchSet: AgentPatchSet = {
      ...patchSet,
      patches: remainingPatches,
      updatedAt: now()
    };
    doc.pendingPatchSet = remainingPatchSet;
    doc.agentMessages = doc.agentMessages.map((message) =>
      message.patchSet?.id === patchSet.id ? { ...message, patchSet: remainingPatchSet } : message
    );
    refreshPendingPatchSetStatus(doc);
  } else {
    doc.pendingPatchSet = null;
    doc.agentMessages = doc.agentMessages.map((message) =>
      message.patchSet?.id === patchSet.id ? { ...message, patchSet: acceptedPatchSet } : message
    );
  }

  saveDocument(doc);
  appendEvent(projectId, "agent.patch_set.accepted", acceptedPatchSet);
  return toAppState(doc);
}

function rejectPendingPatchSet(projectId: number) {
  const doc = loadDocument(projectId);
  refreshPendingPatchSetStatus(doc);
  const patchSet = doc.pendingPatchSet;
  if (!patchSet || !isReviewablePatchSetStatus(patchSet.status)) return toAppState(doc);

  const rejectedPatchSet: AgentPatchSet = { ...patchSet, status: "rejected", updatedAt: now() };
  doc.pendingPatchSet = null;
  doc.agentMessages = doc.agentMessages.map((message) =>
    message.patchSet?.id === patchSet.id ? { ...message, patchSet: rejectedPatchSet } : message
  );
  saveDocument(doc);
  appendEvent(projectId, "agent.patch_set.rejected", rejectedPatchSet);
  return toAppState(doc);
}

export {
  appendAgentAssistantMessage,
  appendAgentUserMessage,
  applyAgentEditSetToDocument,
  applyPendingPatchSet,
  rejectPendingPatchSet,
  replaceAgentUserMessage
};
