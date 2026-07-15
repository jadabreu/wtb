import { IdealStatesEditor, IdealStatesToolbar } from "@/components/workbench/ideal-states-editor";
import type { ArtifactEditorModel, ArtifactHeaderRenderer } from "@/components/workbench/artifact-editor-model";

type IdealStatesArtifactEditorProps = {
  editor: ArtifactEditorModel;
  renderHeader: ArtifactHeaderRenderer;
};

function IdealStatesArtifactEditor({ editor, renderHeader }: IdealStatesArtifactEditorProps) {
  const ideals = editor.ideals;

  return (
    <IdealStatesEditor
      header={renderHeader(
        ideals.drafts.length > 0,
        ideals.drafts.length > 0 ? "Saved" : "Open",
        <IdealStatesToolbar
          saving={editor.saving}
          dirty={ideals.dirty}
          canClear={ideals.drafts.length > 0 || editor.state.idealStates.length > 0}
          onAddIdealState={ideals.addIdealState}
          onSaveIdeals={() => void ideals.save()}
          onCancelEdit={ideals.cancel}
          onClearIdeals={() => void ideals.clear()}
        />,
        `${ideals.drafts.length} ideals`
      )}
      idealStates={ideals.drafts}
      themes={editor.state.themes}
      expandedIdealStates={ideals.expandedIdealStates}
      saving={editor.saving}
      onAddIdealState={ideals.addIdealState}
      onToggleIdealState={ideals.toggleIdealState}
      onUpdateIdealState={ideals.updateIdealState}
      onMoveIdealState={ideals.moveIdealState}
      onReorderIdealState={ideals.reorderIdealState}
      onRemoveIdealState={ideals.removeIdealState}
    />
  );
}

export { IdealStatesArtifactEditor };
