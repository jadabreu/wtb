import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { areThemeDraftsEqual, normalizeThemeDrafts, themeColorPalette } from "@/lib/artifact-normalizers";
import type { AppState, Theme } from "@/lib/types";
import { saveAppState } from "@/lib/workbench-api";

function cloneTheme(theme: Theme): Theme {
  return { ...theme };
}

function useThemeDrafts({
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
  const [themeDrafts, setThemeDrafts] = useState<Theme[]>([]);
  const nextTemporaryIdRef = useRef(-1);

  const themesDirty = useMemo(
    () => !areThemeDraftsEqual(themeDrafts, state.themes),
    [themeDrafts, state.themes]
  );

  useEffect(() => {
    setThemeDrafts(state.themes.map(cloneTheme));
  }, [state.activeProjectId, state.themes]);

  function addTheme() {
    const nextId = nextTemporaryIdRef.current;
    nextTemporaryIdRef.current -= 1;
    setThemeDrafts((current) => [
      ...current,
      {
        id: nextId,
        title: `Theme ${current.length + 1}`,
        description: "",
        color: themeColorPalette[current.length % themeColorPalette.length],
        sortOrder: current.length
      }
    ]);
  }

  function updateTheme(themeId: number, patch: Partial<Theme>) {
    setThemeDrafts((current) =>
      current.map((theme) => (theme.id === themeId ? { ...theme, ...patch } : theme))
    );
  }

  function removeTheme(themeId: number) {
    setThemeDrafts((current) => normalizeThemeDrafts(current.filter((theme) => theme.id !== themeId)));
  }

  async function saveThemes() {
    const nextThemes = normalizeThemeDrafts(themeDrafts);
    setSaving(true);
    setError("");
    setState((current) => ({ ...current, themes: nextThemes }));

    try {
      setState(await saveAppState({ projectId: state.activeProjectId, themes: nextThemes }));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not save themes.");
    } finally {
      setSaving(false);
    }
  }

  function cancelThemeEdit() {
    setThemeDrafts(state.themes.map(cloneTheme));
  }

  return {
    addTheme,
    cancelThemeEdit,
    removeTheme,
    saveThemes,
    themeDrafts,
    themesDirty,
    updateTheme
  };
}

export { useThemeDrafts };
