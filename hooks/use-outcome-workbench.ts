import { useEffect, useRef, useState } from "react";
import { useAgentRunner } from "@/hooks/workbench/use-agent-runner";
import { useFieldDrafts } from "@/hooks/workbench/use-field-drafts";
import { useIdealStateDrafts } from "@/hooks/workbench/use-ideal-state-drafts";
import { useJobMapDrafts } from "@/hooks/workbench/use-job-map-drafts";
import { useProjectState } from "@/hooks/workbench/use-project-state";
import { useThemeDrafts } from "@/hooks/workbench/use-theme-drafts";
import type { ArtifactEditorModel } from "@/components/workbench/artifact-editor-model";
import type { WorkflowStepKey } from "@/lib/types";
import { getMissingRequirements, getNextWorkflowStep, getWorkflowStep, isWorkflowStepComplete } from "@/lib/workflow";

function useOutcomeWorkbench() {
  const {
    createProject,
    deleteProject,
    error,
    loadProject,
    loading,
    projectToDelete,
    saving,
    setError,
    setProjectToDelete,
    setSaving,
    setState,
    state,
    updateSelections
  } = useProjectState();

  const {
    cancelFieldEdit,
    clearField,
    completedFields,
    editField,
    expandedFields,
    fieldDrafts,
    saveField,
    setFieldDrafts
  } = useFieldDrafts(state, updateSelections);

  const {
    addJobStep,
    addSuccessMetric,
    cancelJobMapEdit,
    clearJobMap,
    expandedSteps,
    jobMapDirty,
    jobStepDrafts,
    moveJobStep,
    removeJobStep,
    removeSuccessMetric,
    saveJobMap,
    toggleStep,
    updateJobStep,
    updateSuccessMetric
  } = useJobMapDrafts({ state, setError, setSaving, setState });

  const {
    addBlocker,
    addIdealState,
    cancelIdealEdit,
    clearIdeals,
    expandedIdealStates,
    idealStateDrafts,
    idealStatesDirty,
    moveIdealState,
    removeBlocker,
    removeIdealState,
    reorderIdealState,
    saveIdeals,
    toggleIdealState,
    updateBlocker,
    updateIdealState
  } = useIdealStateDrafts({ state, setError, setSaving, setState });

  const {
    addTheme,
    cancelThemeEdit,
    removeTheme,
    saveThemes,
    themeDrafts,
    themesDirty,
    updateTheme
  } = useThemeDrafts({ state, setError, setSaving, setState });

  const [activeWorkflowStepKey, setActiveWorkflowStepKey] = useState<WorkflowStepKey>("product");
  const [selectedJobStepId, setSelectedJobStepId] = useState<number | null>(null);
  const [selectedIdealStateId, setSelectedIdealStateId] = useState<number | null>(null);
  const autoSelectedProjectIdRef = useRef<number | null>(null);

  const activeProject = state.projects.find((project) => project.id === state.activeProjectId);
  const activeWorkflowStep = getWorkflowStep(activeWorkflowStepKey);
  const activeWorkflowComplete = isWorkflowStepComplete(activeWorkflowStep, state);
  const missingWorkflowRequirements = getMissingRequirements(activeWorkflowStep, state);
  const selectedJobStep = state.jobSteps.find((step) => step.id === selectedJobStepId) || state.jobSteps[0] || null;
  const selectedIdealState = state.idealStates.find((idealState) => idealState.id === selectedIdealStateId) || state.idealStates[0] || null;

  const {
    agentPendingMessage,
    agentRunning,
    agentRunMarkers,
    agentStatusMessage,
    agentStreamingMessage,
    runAgentMessage,
    stopAgentRun
  } = useAgentRunner({
    activeWorkflowStep,
    selectedIdealState,
    selectedJobStep,
    setError,
    setState,
    state
  });

  useEffect(() => {
    if (!state.activeProjectId) return;
    if (autoSelectedProjectIdRef.current === state.activeProjectId) return;

    autoSelectedProjectIdRef.current = state.activeProjectId;
    const nextStep = getNextWorkflowStep(state);
    setActiveWorkflowStepKey(nextStep.key);
    setSelectedJobStepId(state.jobSteps[0]?.id ?? null);
    setSelectedIdealStateId(state.idealStates[0]?.id ?? null);
  }, [state]);

  useEffect(() => {
    if (state.jobSteps.length === 0) {
      setSelectedJobStepId(null);
      return;
    }

    if (!selectedJobStepId || !state.jobSteps.some((step) => step.id === selectedJobStepId)) {
      setSelectedJobStepId(state.jobSteps[0].id);
    }
  }, [selectedJobStepId, state.jobSteps]);

  useEffect(() => {
    if (state.idealStates.length === 0) {
      setSelectedIdealStateId(null);
      return;
    }

    if (!selectedIdealStateId || !state.idealStates.some((idealState) => idealState.id === selectedIdealStateId)) {
      setSelectedIdealStateId(state.idealStates[0].id);
    }
  }, [selectedIdealStateId, state.idealStates]);

  function selectWorkflowStep(stepKey: WorkflowStepKey) {
    setActiveWorkflowStepKey(stepKey);
    setError("");
  }

  const artifactEditor: ArtifactEditorModel = {
    activeWorkflowComplete,
    activeWorkflowStep,
    saving,
    state,
    blockers: {
      addBlocker,
      removeBlocker,
      updateBlocker
    },
    field: {
      expandedFields,
      drafts: fieldDrafts,
      edit: editField,
      cancel: cancelFieldEdit,
      save: saveField,
      clear: clearField,
      setDrafts: setFieldDrafts
    },
    ideals: {
      drafts: idealStateDrafts,
      dirty: idealStatesDirty,
      expandedIdealStates,
      selectedIdealState,
      selectedIdealStateId,
      addIdealState,
      cancel: cancelIdealEdit,
      clear: clearIdeals,
      moveIdealState,
      removeIdealState,
      reorderIdealState,
      save: saveIdeals,
      selectIdealState: setSelectedIdealStateId,
      toggleIdealState,
      updateIdealState
    },
    jobMap: {
      drafts: jobStepDrafts,
      dirty: jobMapDirty,
      expandedSteps,
      addStep: addJobStep,
      cancel: cancelJobMapEdit,
      clear: clearJobMap,
      moveStep: moveJobStep,
      removeStep: removeJobStep,
      save: saveJobMap,
      toggleStep,
      updateStep: updateJobStep
    },
    successMetrics: {
      selectedJobStep,
      selectedJobStepId,
      addMetric: addSuccessMetric,
      removeMetric: removeSuccessMetric,
      selectJobStep: setSelectedJobStepId,
      updateMetric: updateSuccessMetric
    },
    themes: {
      drafts: themeDrafts,
      dirty: themesDirty,
      addTheme,
      cancel: cancelThemeEdit,
      removeTheme,
      save: saveThemes,
      updateTheme
    },
    selectWorkflowStep
  };

  return {
    activeProject,
    activeWorkflowComplete,
    activeWorkflowStep,
    agentPendingMessage,
    agentRunning,
    agentRunMarkers,
    agentStatusMessage,
    agentStreamingMessage,
    artifactEditor,
    completedFields,
    createProject,
    deleteProject,
    error,
    loadProject,
    loading,
    missingWorkflowRequirements,
    projectToDelete,
    runAgentMessage,
    saving,
    selectWorkflowStep,
    setProjectToDelete,
    stopAgentRun,
    state
  };
}

export { useOutcomeWorkbench };
