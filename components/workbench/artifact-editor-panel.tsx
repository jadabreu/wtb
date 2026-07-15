import type { ReactNode } from "react";
import { ArtifactHeader } from "@/components/workbench/artifact";
import { BlockersArtifactEditor } from "@/components/workbench/blockers-artifact-editor";
import { FieldArtifactEditor } from "@/components/workbench/field-artifact-editor";
import { IdealStatesArtifactEditor } from "@/components/workbench/ideal-states-artifact-editor";
import { JobMapArtifactEditor } from "@/components/workbench/job-map-artifact-editor";
import { SuccessMetricsArtifactEditor } from "@/components/workbench/success-metrics-artifact-editor";
import { ThemesArtifactEditor } from "@/components/workbench/themes-artifact-editor";
import type { ArtifactEditorModel } from "@/components/workbench/artifact-editor-model";
import { getWorkflowArtifactGroup, isFieldStepKey } from "@/lib/workflow";

type ArtifactEditorPanelProps = {
  editor: ArtifactEditorModel;
};

function ArtifactEditorPanel({ editor }: ArtifactEditorPanelProps) {
  const activeWorkflowStep = editor.activeWorkflowStep;

  function renderHeader(
    isSaved = editor.activeWorkflowComplete,
    statusLabel = isSaved ? "Saved" : "Open",
    action?: ReactNode,
    detail = activeWorkflowStep.goal
  ) {
    const activeGroup = getWorkflowArtifactGroup(activeWorkflowStep.key);

    return (
      <ArtifactHeader
        eyebrow={activeGroup ? `${activeGroup.title} artifact` : "Research artifact"}
        title={activeWorkflowStep.label}
        description={detail}
        status={statusLabel}
        statusVariant={isSaved ? "default" : "secondary"}
        actions={action}
      />
    );
  }

  if (isFieldStepKey(activeWorkflowStep.key)) {
    return <FieldArtifactEditor editor={editor} fieldKey={activeWorkflowStep.key} renderHeader={renderHeader} />;
  }

  if (activeWorkflowStep.key === "job_map") {
    return <JobMapArtifactEditor editor={editor} renderHeader={renderHeader} />;
  }

  if (activeWorkflowStep.key === "success_metrics") {
    return <SuccessMetricsArtifactEditor editor={editor} renderHeader={renderHeader} />;
  }

  if (activeWorkflowStep.key === "themes") {
    return <ThemesArtifactEditor editor={editor} renderHeader={renderHeader} />;
  }

  if (activeWorkflowStep.key === "ideals") {
    return <IdealStatesArtifactEditor editor={editor} renderHeader={renderHeader} />;
  }

  if (activeWorkflowStep.key === "blockers") {
    return <BlockersArtifactEditor editor={editor} renderHeader={renderHeader} />;
  }

  return null;
}

export { ArtifactEditorPanel };
