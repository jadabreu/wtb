import { FieldStepCard, FieldStepEditAction } from "@/components/workbench/field-step-card";
import type { ArtifactEditorModel, ArtifactHeaderRenderer } from "@/components/workbench/artifact-editor-model";
import type { FieldKey } from "@/lib/types";
import { isFieldComplete } from "@/lib/workbench-utils";

type FieldArtifactEditorProps = {
  editor: ArtifactEditorModel;
  fieldKey: FieldKey;
  renderHeader: ArtifactHeaderRenderer;
};

function FieldArtifactEditor({ editor, fieldKey, renderHeader }: FieldArtifactEditorProps) {
  const value = editor.state.selections[fieldKey];
  const isComplete = isFieldComplete(fieldKey, value);
  const isExpanded = Boolean(editor.field.expandedFields[fieldKey]);

  return (
    <FieldStepCard
      fieldKey={fieldKey}
      value={value}
      draftValue={editor.field.drafts[fieldKey]}
      expanded={isExpanded}
      saving={editor.saving}
      header={renderHeader(
        isComplete,
        isComplete ? "Saved" : "Not set",
        <FieldStepEditAction
          fieldKey={fieldKey}
          complete={isComplete}
          expanded={isExpanded}
          onEdit={editor.field.edit}
          onCancel={editor.field.cancel}
        />
      )}
      onEdit={editor.field.edit}
      onCancel={editor.field.cancel}
      onSave={(key) => void editor.field.save(key)}
      onClear={(key) => void editor.field.clear(key)}
      onDraftChange={(key, nextValue) =>
        editor.field.setDrafts((current) => ({ ...current, [key]: nextValue }))
      }
    />
  );
}

export { FieldArtifactEditor };
