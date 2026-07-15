import type { CSSProperties, ReactNode } from "react";
import { ChevronRight, Plus, Save, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ArtifactBody, ArtifactCard, EmptyArtifactState } from "@/components/workbench/artifact";
import type { JobStep, Theme } from "@/lib/types";
import { cn } from "@/lib/utils";
import styles from "./workflow-components.module.css";

type SuccessMetricsEditorProps = {
  header: ReactNode;
  step: JobStep;
  jobSteps: JobStep[];
  themes: Theme[];
  selectedStepId: number | null;
  saving: boolean;
  onSelectStep: (stepId: number) => void;
  onAddMetric: (stepId: number) => void;
  onUpdateMetric: (stepId: number, metricIndex: number, value: string) => void;
  onRemoveMetric: (stepId: number, metricIndex: number) => void;
};

function SuccessMetricsEditor({
  header,
  step,
  jobSteps,
  themes,
  selectedStepId,
  saving,
  onSelectStep,
  onAddMetric,
  onUpdateMetric,
  onRemoveMetric
}: SuccessMetricsEditorProps) {
  const themeById = new Map(themes.map((theme) => [theme.id, theme]));

  return (
	    <ArtifactCard variant="editor" density="compact" className={styles.artifactCard}>
      {header}
      <ArtifactBody className="grid gap-3">
        <label className={styles.scopeSelector}>
          <span>Job step</span>
          <Select
            value={String(selectedStepId ?? step.id)}
            onValueChange={(value) => onSelectStep(Number(value))}
            disabled={saving || jobSteps.length <= 1}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select job step" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {jobSteps.map((jobStep, index) => (
                  <SelectItem value={String(jobStep.id)} key={jobStep.id}>
                    {index + 1}. {jobStep.title.trim() || `Step ${index + 1}`}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </label>

        {step.successMetrics.length === 0 ? (
          <EmptyArtifactState
            title="No metrics saved"
            description={`Add a success metric for "${step.title}" manually.`}
            action={
              <div className={styles.emptyActions}>
                <Button type="button" variant="outline" onClick={() => onAddMetric(step.id)} disabled={saving}>
                  <Plus data-icon="inline-start" />
                  Add metric
                </Button>
              </div>
            }
          />
        ) : (
          <div className={styles.metricList}>
            {step.successMetrics.map((metric, metricIndex) => {
              const metricThemes = metric.themeIds
                .map((themeId) => themeById.get(themeId))
                .filter((theme): theme is Theme => Boolean(theme));

              return (
              <div className={styles.metricRow} key={`${step.id}-${metricIndex}`}>
                <div className={styles.metricBody}>
                  <Textarea
                    value={metric.text}
                    onChange={(event) => onUpdateMetric(step.id, metricIndex, event.target.value)}
                    placeholder="Example: Finds essentials without searching"
                    rows={2}
                  />
                  {metricThemes.length > 0 ? (
                    <div className={styles.themeChipRow} aria-label="Metric themes">
                      {metricThemes.map((theme) => (
                        <Badge className={styles.themeChip} variant="outline" style={{ "--theme-color": theme.color } as CSSProperties} key={theme.id}>
                          {theme.title}
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                </div>
                <Button className={styles.iconButton} type="button" title="Delete success metric" onClick={() => onRemoveMetric(step.id, metricIndex)} disabled={saving}>
                  <Trash2 data-icon="inline-start" />
                </Button>
              </div>
              );
            })}
          </div>
        )}
      </ArtifactBody>
    </ArtifactCard>
  );
}

function SuccessMetricsToolbar({
  stepId,
  saving,
  dirty,
  onAddMetric,
  onSave,
  onCancel
}: {
  stepId: number;
  saving: boolean;
  dirty: boolean;
  onAddMetric: (stepId: number) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className={styles.inlineToolbar}>
      <Button className={styles.iconButton} type="button" title="Add success metric" onClick={() => onAddMetric(stepId)} disabled={saving}>
        <Plus data-icon="inline-start" />
      </Button>
      {dirty ? (
        <>
          <Button type="button" onClick={onSave} disabled={saving}>
            <Save data-icon="inline-start" />
            Save
          </Button>
          <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
            <X data-icon="inline-start" />
            Cancel
          </Button>
        </>
      ) : null}
    </div>
  );
}

function EmptySuccessMetricsState({
  header,
  onMapJobSteps
}: {
  header: ReactNode;
  onMapJobSteps: () => void;
}) {
  return (
	    <ArtifactCard variant="editor" density="compact" className={cn(styles.artifactCard, styles.emptyState)}>
      {header}
      <ArtifactBody>
        <EmptyArtifactState
          title="No job step selected"
          description="Map the job steps first, then edit success metrics for each step."
          action={
            <Button type="button" variant="outline" onClick={onMapJobSteps}>
              Map job steps
              <ChevronRight data-icon="inline-end" />
            </Button>
          }
        />
      </ArtifactBody>
    </ArtifactCard>
  );
}

export { EmptySuccessMetricsState, SuccessMetricsEditor, SuccessMetricsToolbar };
