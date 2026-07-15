import { JobMapEditor, JobMapToolbar } from "@/components/workbench/job-map-editor";
import type { ArtifactEditorModel, ArtifactHeaderRenderer } from "@/components/workbench/artifact-editor-model";

type JobMapArtifactEditorProps = {
  editor: ArtifactEditorModel;
  renderHeader: ArtifactHeaderRenderer;
};

function JobMapArtifactEditor({ editor, renderHeader }: JobMapArtifactEditorProps) {
  const jobMap = editor.jobMap;

  return (
    <JobMapEditor
      header={renderHeader(
        jobMap.drafts.length > 0,
        jobMap.drafts.length > 0 ? "Saved" : "Open",
        <JobMapToolbar
          jobSteps={jobMap.drafts}
          saving={editor.saving}
          dirty={jobMap.dirty}
          canClear={jobMap.drafts.length > 0 || editor.state.jobSteps.length > 0}
          onAddStep={jobMap.addStep}
          onSaveMap={() => void jobMap.save()}
          onCancelEdit={jobMap.cancel}
          onClearMap={() => void jobMap.clear()}
        />,
        `${jobMap.drafts.length} steps`
      )}
      jobSteps={jobMap.drafts}
      expandedSteps={jobMap.expandedSteps}
      saving={editor.saving}
      onAddStep={jobMap.addStep}
      onToggleStep={jobMap.toggleStep}
      onUpdateStep={jobMap.updateStep}
      onMoveStep={jobMap.moveStep}
      onRemoveStep={jobMap.removeStep}
    />
  );
}

export { JobMapArtifactEditor };
