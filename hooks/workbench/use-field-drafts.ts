import { useEffect, useMemo, useState } from "react";
import { fieldKeys, type AppState, type FieldKey } from "@/lib/types";
import { isFieldComplete, normalizeFieldValue } from "@/lib/workbench-utils";

function useFieldDrafts(
  state: AppState,
  updateSelections: (nextSelections: Partial<Record<FieldKey, string>>) => Promise<void>
) {
  const [expandedFields, setExpandedFields] = useState<Partial<Record<FieldKey, boolean>>>({});
  const [fieldDrafts, setFieldDrafts] = useState<Record<FieldKey, string>>(state.selections);

  const completedFields = useMemo(
    () => fieldKeys.filter((key) => isFieldComplete(key, state.selections[key])).length,
    [state.selections]
  );

  useEffect(() => {
    setFieldDrafts(state.selections);
    setExpandedFields({});
  }, [state.activeProjectId, state.selections]);

  function editField(key: FieldKey) {
    setFieldDrafts((current) => ({ ...current, [key]: state.selections[key] }));
    setExpandedFields((current) => ({ ...current, [key]: true }));
  }

  function cancelFieldEdit(key: FieldKey) {
    setFieldDrafts((current) => ({ ...current, [key]: state.selections[key] }));
    setExpandedFields((current) => ({ ...current, [key]: false }));
  }

  async function saveField(key: FieldKey) {
    const nextValue = normalizeFieldValue(key, fieldDrafts[key]);
    setFieldDrafts((current) => ({ ...current, [key]: nextValue }));
    await updateSelections({ [key]: nextValue });
    setExpandedFields((current) => ({ ...current, [key]: false }));
  }

  async function clearField(key: FieldKey) {
    setFieldDrafts((current) => ({ ...current, [key]: "" }));
    await updateSelections({ [key]: "" });
    setExpandedFields((current) => ({ ...current, [key]: false }));
  }

  return {
    cancelFieldEdit,
    clearField,
    completedFields,
    editField,
    expandedFields,
    fieldDrafts,
    saveField,
    setFieldDrafts
  };
}

export { useFieldDrafts };
