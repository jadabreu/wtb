import { useEffect, useState } from "react";
import type { ProjectToDelete } from "@/components/workbench";
import { createEmptySelections, type AppState, type FieldKey } from "@/lib/types";
import { createResearchProject, deleteResearchProject, loadAppState, saveAppState } from "@/lib/workbench-api";

const emptyState: AppState = {
  activeProjectId: 0,
  projects: [],
  selections: createEmptySelections(),
  themes: [],
  jobSteps: [],
  idealStates: [],
  agentMessages: [],
  pendingPatchSet: null
};

function useProjectState() {
  const [state, setState] = useState<AppState>(emptyState);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [projectToDelete, setProjectToDelete] = useState<ProjectToDelete | null>(null);

  useEffect(() => {
    let mounted = true;

    loadAppState()
      .then((nextState) => {
        if (mounted) setState(nextState);
      })
      .catch((nextError: Error) => setError(nextError.message))
      .finally(() => setLoading(false));

    return () => {
      mounted = false;
    };
  }, []);

  async function loadProject(projectId: number) {
    setLoading(true);
    setError("");

    try {
      setState(await loadAppState(projectId));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not load project.");
    } finally {
      setLoading(false);
    }
  }

  async function createProject() {
    setSaving(true);
    setError("");

    try {
      setState(await createResearchProject());
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not create project.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteProject(projectId: number) {
    if (state.projects.length <= 1 || saving) return;

    setSaving(true);
    setError("");

    try {
      setState(await deleteResearchProject(projectId));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not delete project.");
    } finally {
      setSaving(false);
      setProjectToDelete(null);
    }
  }

  async function updateSelections(nextSelections: Partial<Record<FieldKey, string>>) {
    setSaving(true);
    setError("");

    const optimistic = {
      ...state,
      selections: {
        ...state.selections,
        ...nextSelections
      }
    };
    setState(optimistic);

    try {
      setState(await saveAppState({ projectId: state.activeProjectId, selections: nextSelections }));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not save changes.");
    } finally {
      setSaving(false);
    }
  }

  return {
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
  };
}

export { emptyState, useProjectState };
