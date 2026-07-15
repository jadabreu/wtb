import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, Check, ChevronDown, Copy, Plus, Save, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ArtifactBody, ArtifactCard } from "@/components/workbench/artifact";
import { formatJobMapMarkdown } from "@/lib/prompt-render";
import type { JobStep } from "@/lib/types";
import { cn } from "@/lib/utils";
import styles from "./workflow-components.module.css";

type JobMapEditorProps = {
  header: ReactNode;
  jobSteps: JobStep[];
  expandedSteps: Record<number, boolean>;
  saving: boolean;
  onAddStep: () => void;
  onToggleStep: (stepId: number) => void;
  onUpdateStep: (stepId: number, patch: Partial<JobStep>) => void;
  onMoveStep: (stepId: number, direction: -1 | 1) => void;
  onRemoveStep: (stepId: number) => void;
};

function JobMapEditor({
  header,
  jobSteps,
  expandedSteps,
  saving,
  onAddStep,
  onToggleStep,
  onUpdateStep,
  onMoveStep,
  onRemoveStep
}: JobMapEditorProps) {
  return (
	    <ArtifactCard variant="editor" density="compact" className={styles.artifactCard}>
      {header}

      <ArtifactBody className="grid gap-3">
        {jobSteps.length === 0 ? (
          <div className={styles.emptyState}>
            <p>No job steps mapped yet.</p>
            <Button type="button" variant="outline" onClick={onAddStep} disabled={saving}>
              <Plus data-icon="inline-start" />
              Add first step
            </Button>
          </div>
        ) : (
          <div className={styles.jobStepList}>
            {jobSteps.map((step, index) => {
              const isStepExpanded = expandedSteps[step.id] ?? index === 0;
              const stepDescription = step.description.trim();

              return (
                <Card className={styles.jobStepCard} key={step.id}>
                  <button className={styles.jobStepHeader} type="button" onClick={() => onToggleStep(step.id)} aria-expanded={isStepExpanded}>
                    <span className={styles.jobStepNumber}>{index + 1}</span>
                    <span className={styles.jobStepTitle}>
                      <strong>{step.title.trim() || `Step ${index + 1}`}</strong>
                      <small>{stepDescription || "No description yet"}</small>
                    </span>
                    <ChevronDown data-icon="inline-start" className={cn(styles.sectionChevron, isStepExpanded && styles.sectionChevronOpen)} />
                  </button>

                  {isStepExpanded ? (
                    <div className={styles.jobStepEditor}>
                      <label>
                        <span>Step name</span>
                        <Input
                          value={step.title}
                          onChange={(event) => onUpdateStep(step.id, { title: event.target.value })}
                          placeholder="Example: Prepare for the day"
                        />
                      </label>
                      <label>
                        <span>Description</span>
                        <Textarea
                          value={step.description}
                          onChange={(event) => onUpdateStep(step.id, { description: event.target.value })}
                          placeholder="What the user is trying to complete in this step"
                        />
                      </label>

                      <div className={styles.jobStepActions}>
                        <Button className={styles.iconButton} type="button" title="Move step up" onClick={() => onMoveStep(step.id, -1)} disabled={saving || index === 0}>
                          <ArrowUp data-icon="inline-start" />
                        </Button>
                        <Button className={styles.iconButton} type="button" title="Move step down" onClick={() => onMoveStep(step.id, 1)} disabled={saving || index === jobSteps.length - 1}>
                          <ArrowDown data-icon="inline-start" />
                        </Button>
                        <Button type="button" variant="destructive" onClick={() => onRemoveStep(step.id)} disabled={saving}>
                          <Trash2 data-icon="inline-start" />
                          Delete step
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </Card>
              );
            })}
          </div>
        )}
      </ArtifactBody>
    </ArtifactCard>
  );
}

function JobMapToolbar({
  jobSteps,
  saving,
  dirty,
  canClear,
  onAddStep,
  onSaveMap,
  onCancelEdit,
  onClearMap
}: {
  jobSteps: JobStep[];
  saving: boolean;
  dirty: boolean;
  canClear: boolean;
  onAddStep: () => void;
  onSaveMap: () => void;
  onCancelEdit: () => void;
  onClearMap: () => void;
}) {
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "failed">("idle");
  const markdown = useMemo(() => formatJobMapMarkdown(jobSteps), [jobSteps]);

  useEffect(() => {
    if (copyStatus === "idle") return undefined;

    const timeoutId = window.setTimeout(() => setCopyStatus("idle"), 1800);
    return () => window.clearTimeout(timeoutId);
  }, [copyStatus]);

  async function copyJobMap() {
    try {
      await navigator.clipboard.writeText(markdown);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("failed");
    }
  }

  const copyLabel = copyStatus === "copied" ? "Copied" : copyStatus === "failed" ? "Copy failed" : "Copy";

  return (
    <div className={styles.inlineToolbar}>
      <Button type="button" variant="outline" onClick={onAddStep} disabled={saving}>
        <Plus data-icon="inline-start" />
        Step
      </Button>
      <Button
        type="button"
        variant="outline"
        title="Copy job map as Markdown"
        onClick={() => void copyJobMap()}
        disabled={jobSteps.length === 0}
      >
        {copyStatus === "copied" ? <Check data-icon="inline-start" /> : <Copy data-icon="inline-start" />}
        {copyLabel}
      </Button>
      {dirty ? (
        <>
          <Button type="button" onClick={onSaveMap} disabled={saving}>
            <Save data-icon="inline-start" />
            Save map
          </Button>
          <Button type="button" variant="outline" onClick={onCancelEdit} disabled={saving}>
            <X data-icon="inline-start" />
            Cancel
          </Button>
        </>
      ) : null}
      <Button type="button" variant="destructive" onClick={onClearMap} disabled={saving || !canClear}>
        <Trash2 data-icon="inline-start" />
        Clear
      </Button>
    </div>
  );
}

export { JobMapEditor, JobMapToolbar };
