import {
  BlockersEditor,
  BlockersToolbar,
  EmptyBlockersState
} from "@/components/workbench/blockers-editor";
import type { ArtifactEditorModel, ArtifactHeaderRenderer } from "@/components/workbench/artifact-editor-model";

type BlockersArtifactEditorProps = {
  editor: ArtifactEditorModel;
  renderHeader: ArtifactHeaderRenderer;
};

function BlockersArtifactEditor({ editor, renderHeader }: BlockersArtifactEditorProps) {
  const blockers = editor.blockers;
  const ideals = editor.ideals;
  const idealState = ideals.drafts.find((item) => item.id === ideals.selectedIdealState?.id) || ideals.drafts[0];

  if (!idealState) {
    return (
      <EmptyBlockersState
        header={renderHeader(false, "Open")}
        onDefineIdeals={() => editor.selectWorkflowStep("ideals")}
      />
    );
  }

  const hasBlockers = idealState.blockers.some((blocker) => blocker.trim());

  return (
    <BlockersEditor
      header={renderHeader(
        hasBlockers,
        hasBlockers ? "Saved" : "Open",
        <BlockersToolbar
          idealStateId={idealState.id}
          saving={editor.saving}
          dirty={ideals.dirty}
          onAddBlocker={blockers.addBlocker}
          onSave={() => void ideals.save()}
          onCancel={ideals.cancel}
        />,
        `For: ${idealState.title}`
      )}
      idealState={idealState}
      idealStates={ideals.drafts}
      selectedIdealStateId={ideals.selectedIdealStateId ?? idealState.id}
      saving={editor.saving}
      onSelectIdealState={ideals.selectIdealState}
      onAddBlocker={blockers.addBlocker}
      onUpdateBlocker={blockers.updateBlocker}
      onRemoveBlocker={blockers.removeBlocker}
    />
  );
}

export { BlockersArtifactEditor };
