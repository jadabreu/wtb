import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { areJobStepDraftsEqual } from "@/lib/artifact-normalizers";
import type { AppState, JobStep } from "@/lib/types";
import { saveAppState } from "@/lib/workbench-api";
import { cloneJobStep, normalizeJobSteps } from "@/lib/workbench-utils";

function useJobMapDrafts({
  state,
  setError,
  setSaving,
  setState
}: {
  state: AppState;
  setError: (error: string) => void;
  setSaving: (saving: boolean) => void;
  setState: Dispatch<SetStateAction<AppState>>;
}) {
  const [expandedSteps, setExpandedSteps] = useState<Record<number, boolean>>({});
  const [jobStepDrafts, setJobStepDrafts] = useState<JobStep[]>([]);
  const nextTemporaryIdRef = useRef(-1);
  const nextTemporaryMetricIdRef = useRef(-1);

  const jobMapDirty = useMemo(
    () => !areJobStepDraftsEqual(jobStepDrafts, state.jobSteps),
    [jobStepDrafts, state.jobSteps]
  );

  useEffect(() => {
    setJobStepDrafts(state.jobSteps.map(cloneJobStep));
    setExpandedSteps({});
  }, [state.activeProjectId, state.jobSteps]);

  function toggleStep(stepId: number) {
    setExpandedSteps((current) => ({ ...current, [stepId]: !current[stepId] }));
  }

  function addJobStep() {
    const nextId = nextTemporaryIdRef.current;
    nextTemporaryIdRef.current -= 1;
    setJobStepDrafts((current) => [
      ...current,
      {
        id: nextId,
        title: `Step ${current.length + 1}`,
        description: "",
        successMetrics: [],
        sortOrder: current.length
      }
    ]);
    setExpandedSteps((current) => ({ ...current, [nextId]: true }));
  }

  function updateJobStep(stepId: number, patch: Partial<JobStep>) {
    setJobStepDrafts((current) =>
      current.map((step) => (step.id === stepId ? { ...step, ...patch } : step))
    );
  }

  function removeJobStep(stepId: number) {
    setJobStepDrafts((current) => normalizeJobSteps(current.filter((step) => step.id !== stepId)));
  }

  function moveJobStep(stepId: number, direction: -1 | 1) {
    setJobStepDrafts((current) => {
      const index = current.findIndex((step) => step.id === stepId);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return current;
      const next = [...current];
      const [step] = next.splice(index, 1);
      next.splice(nextIndex, 0, step);
      return normalizeJobSteps(next);
    });
  }

  function addSuccessMetric(stepId: number) {
    const nextMetricId = nextTemporaryMetricIdRef.current;
    nextTemporaryMetricIdRef.current -= 1;
    setJobStepDrafts((current) =>
      current.map((step) =>
        step.id === stepId ? { ...step, successMetrics: [...step.successMetrics, { id: nextMetricId, text: "", themeIds: [] }] } : step
      )
    );
    setExpandedSteps((current) => ({ ...current, [stepId]: true }));
  }

  function updateSuccessMetric(stepId: number, metricIndex: number, value: string) {
    setJobStepDrafts((current) =>
      current.map((step) => {
        if (step.id !== stepId) return step;
        return {
          ...step,
          successMetrics: step.successMetrics.map((metric, index) => (index === metricIndex ? { ...metric, text: value } : metric))
        };
      })
    );
  }

  function removeSuccessMetric(stepId: number, metricIndex: number) {
    setJobStepDrafts((current) =>
      current.map((step) => {
        if (step.id !== stepId) return step;
        return {
          ...step,
          successMetrics: step.successMetrics.filter((_metric, index) => index !== metricIndex)
        };
      })
    );
  }

  async function persistJobSteps(nextJobSteps: JobStep[], failureMessage = "Could not save job map.") {
    setSaving(true);
    setError("");
    setState((current) => ({ ...current, jobSteps: nextJobSteps }));

    try {
      setState(await saveAppState({ projectId: state.activeProjectId, jobSteps: nextJobSteps }));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : failureMessage);
    } finally {
      setSaving(false);
    }
  }

  async function saveJobMap() {
    await persistJobSteps(normalizeJobSteps(jobStepDrafts));
  }

  function cancelJobMapEdit() {
    setJobStepDrafts(state.jobSteps.map(cloneJobStep));
    setExpandedSteps({});
  }

  async function clearJobMap() {
    setJobStepDrafts([]);
    setExpandedSteps({});
    setSaving(true);
    setError("");

    try {
      setState(await saveAppState({ projectId: state.activeProjectId, jobSteps: [] }));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not clear job map.");
    } finally {
      setSaving(false);
    }
  }

  return {
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
  };
}

export { useJobMapDrafts };
