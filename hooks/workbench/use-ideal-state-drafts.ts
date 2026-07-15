import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { areIdealStateDraftsEqual } from "@/lib/artifact-normalizers";
import { defaultIdealStateLabel, type AppState, type IdealState } from "@/lib/types";
import { saveAppState } from "@/lib/workbench-api";
import { cloneIdealState, normalizeIdealStates } from "@/lib/workbench-utils";

function useIdealStateDrafts({
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
  const [expandedIdealStates, setExpandedIdealStates] = useState<Record<number, boolean>>({});
  const [idealStateDrafts, setIdealStateDrafts] = useState<IdealState[]>([]);
  const nextTemporaryIdRef = useRef(-1);

  const idealStatesDirty = useMemo(
    () => !areIdealStateDraftsEqual(idealStateDrafts, state.idealStates),
    [idealStateDrafts, state.idealStates]
  );

  useEffect(() => {
    setIdealStateDrafts(state.idealStates.map(cloneIdealState));
    setExpandedIdealStates({});
  }, [state.activeProjectId, state.idealStates]);

  function toggleIdealState(idealStateId: number) {
    setExpandedIdealStates((current) => ({ ...current, [idealStateId]: !current[idealStateId] }));
  }

  function addIdealState() {
    const nextId = nextTemporaryIdRef.current;
    nextTemporaryIdRef.current -= 1;
    setIdealStateDrafts((current) => [
      ...current,
      {
        id: nextId,
        title: `Ideal ${current.length + 1}`,
        description: "",
        label: defaultIdealStateLabel,
        blockers: [],
        themeIds: [],
        sortOrder: current.length
      }
    ]);
    setExpandedIdealStates((current) => ({ ...current, [nextId]: true }));
  }

  function updateIdealState(idealStateId: number, patch: Partial<IdealState>) {
    setIdealStateDrafts((current) =>
      current.map((idealState) => (idealState.id === idealStateId ? { ...idealState, ...patch } : idealState))
    );
  }

  function removeIdealState(idealStateId: number) {
    setIdealStateDrafts((current) => normalizeIdealStates(current.filter((idealState) => idealState.id !== idealStateId)));
  }

  function moveIdealState(idealStateId: number, direction: -1 | 1) {
    setIdealStateDrafts((current) => {
      const index = current.findIndex((idealState) => idealState.id === idealStateId);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return current;
      const next = [...current];
      const [idealState] = next.splice(index, 1);
      next.splice(nextIndex, 0, idealState);
      return normalizeIdealStates(next);
    });
  }

  function reorderIdealState(sourceIdealStateId: number, targetIdealStateId: number) {
    setIdealStateDrafts((current) => {
      const sourceIndex = current.findIndex((idealState) => idealState.id === sourceIdealStateId);
      const targetIndex = current.findIndex((idealState) => idealState.id === targetIdealStateId);
      if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return current;

      const next = [...current];
      const [idealState] = next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, idealState);
      return normalizeIdealStates(next);
    });
  }

  async function persistIdealStates(nextIdealStates: IdealState[], failureMessage = "Could not save ideals.") {
    setSaving(true);
    setError("");
    setState((current) => ({ ...current, idealStates: nextIdealStates }));

    try {
      setState(await saveAppState({ projectId: state.activeProjectId, idealStates: nextIdealStates }));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : failureMessage);
    } finally {
      setSaving(false);
    }
  }

  async function saveIdeals() {
    await persistIdealStates(normalizeIdealStates(idealStateDrafts));
  }

  function cancelIdealEdit() {
    setIdealStateDrafts(state.idealStates.map(cloneIdealState));
    setExpandedIdealStates({});
  }

  async function clearIdeals() {
    setIdealStateDrafts([]);
    setExpandedIdealStates({});
    setSaving(true);
    setError("");

    try {
      setState(await saveAppState({ projectId: state.activeProjectId, idealStates: [] }));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not clear ideals.");
    } finally {
      setSaving(false);
    }
  }

  function addBlocker(idealStateId: number) {
    setIdealStateDrafts((current) =>
      current.map((idealState) =>
        idealState.id === idealStateId ? { ...idealState, blockers: [...idealState.blockers, ""] } : idealState
      )
    );
    setExpandedIdealStates((current) => ({ ...current, [idealStateId]: true }));
  }

  function updateBlocker(idealStateId: number, blockerIndex: number, value: string) {
    setIdealStateDrafts((current) =>
      current.map((idealState) => {
        if (idealState.id !== idealStateId) return idealState;
        return {
          ...idealState,
          blockers: idealState.blockers.map((blocker, index) => (index === blockerIndex ? value : blocker))
        };
      })
    );
  }

  function removeBlocker(idealStateId: number, blockerIndex: number) {
    setIdealStateDrafts((current) =>
      current.map((idealState) => {
        if (idealState.id !== idealStateId) return idealState;
        return {
          ...idealState,
          blockers: idealState.blockers.filter((_blocker, index) => index !== blockerIndex)
        };
      })
    );
  }

  return {
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
  };
}

export { useIdealStateDrafts };
