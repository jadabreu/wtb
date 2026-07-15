import {
  EmptySuccessMetricsState,
  SuccessMetricsEditor,
  SuccessMetricsToolbar
} from "@/components/workbench/success-metrics-editor";
import type { ArtifactEditorModel, ArtifactHeaderRenderer } from "@/components/workbench/artifact-editor-model";

type SuccessMetricsArtifactEditorProps = {
  editor: ArtifactEditorModel;
  renderHeader: ArtifactHeaderRenderer;
};

function SuccessMetricsArtifactEditor({ editor, renderHeader }: SuccessMetricsArtifactEditorProps) {
  const jobMap = editor.jobMap;
  const successMetrics = editor.successMetrics;
  const step = jobMap.drafts.find((item) => item.id === successMetrics.selectedJobStep?.id) || jobMap.drafts[0];

  if (!step) {
    return (
      <EmptySuccessMetricsState
        header={renderHeader(false, "Open")}
        onMapJobSteps={() => editor.selectWorkflowStep("job_map")}
      />
    );
  }

  const hasMetrics = step.successMetrics.some((metric) => metric.text.trim());

  return (
    <SuccessMetricsEditor
      header={renderHeader(
        hasMetrics,
        hasMetrics ? "Saved" : "Open",
        <SuccessMetricsToolbar
          stepId={step.id}
          saving={editor.saving}
          dirty={jobMap.dirty}
          onAddMetric={successMetrics.addMetric}
          onSave={() => void jobMap.save()}
          onCancel={jobMap.cancel}
        />,
        `For: ${step.title}`
      )}
      step={step}
      jobSteps={jobMap.drafts}
      themes={editor.state.themes}
      selectedStepId={successMetrics.selectedJobStepId ?? step.id}
      saving={editor.saving}
      onSelectStep={successMetrics.selectJobStep}
      onAddMetric={successMetrics.addMetric}
      onUpdateMetric={successMetrics.updateMetric}
      onRemoveMetric={successMetrics.removeMetric}
    />
  );
}

export { SuccessMetricsArtifactEditor };
