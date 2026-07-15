import { useEffect, useState, type ReactNode } from "react";
import { CheckCircle2, ChevronDown, ChevronRight, CircleAlert, CircleDashed } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { AppState, WorkflowStepKey } from "@/lib/types";
import { cn } from "@/lib/utils";
import { getMissingRequirements, workflowArtifactGroups, type WorkflowStep } from "@/lib/workflow";
import styles from "./workflow-components.module.css";

type ArtifactStatus = {
  label: string;
  kind: "ready" | "draft" | "needs-context";
};

function artifactStatus(step: WorkflowStep, state: AppState, isComplete: (step: WorkflowStep) => boolean): ArtifactStatus {
  if (isComplete(step)) return { label: "Ready", kind: "ready" };
  if (getMissingRequirements(step, state).length > 0) return { label: "Needs context", kind: "needs-context" };
  return { label: "Draft", kind: "draft" };
}

function ArtifactNavigator({
  steps,
  activeStepKey,
  state,
  isComplete,
  onSelect,
  activeDetail,
  className
}: {
  steps: WorkflowStep[];
  activeStepKey: WorkflowStepKey;
  state: AppState;
  isComplete: (step: WorkflowStep) => boolean;
  onSelect: (stepKey: WorkflowStepKey) => void;
  activeDetail?: ReactNode;
  className?: string;
}) {
  const stepsByKey = new Map(steps.map((step) => [step.key, step]));
  const [expandedStepKey, setExpandedStepKey] = useState<WorkflowStepKey | null>(activeStepKey);

  useEffect(() => {
    setExpandedStepKey(activeStepKey);
  }, [activeStepKey]);

  function handleSelect(stepKey: WorkflowStepKey) {
    if (stepKey === activeStepKey) {
      setExpandedStepKey((current) => (current === stepKey ? null : stepKey));
      return;
    }

    setExpandedStepKey(stepKey);
    onSelect(stepKey);
  }

  return (
    <nav className={cn(styles.artifactMap, className)} aria-label="Research artifacts">
      {workflowArtifactGroups.map((group) => (
        <section className={styles.artifactGroup} key={group.title} aria-label={group.title}>
          <div className={styles.artifactGroupHeader}>
            <strong>{group.title}</strong>
            <span>{group.description}</span>
          </div>

          <div className={styles.artifactNavList}>
            {group.stepKeys.map((stepKey) => {
              const step = stepsByKey.get(stepKey);
              if (!step) return null;

              const active = step.key === activeStepKey;
              const expanded = active && expandedStepKey === step.key;
              const status = artifactStatus(step, state, isComplete);
              const StatusIcon = status.kind === "ready" ? CheckCircle2 : status.kind === "needs-context" ? CircleAlert : CircleDashed;
              const DisclosureIcon = expanded ? ChevronDown : ChevronRight;
              const missingRequirements = getMissingRequirements(step, state)
                .map((key) => stepsByKey.get(key)?.shortLabel || key)
                .join(", ");

              return (
                <div className={styles.artifactNavEntry} key={step.key}>
                  <Button
                    className={styles.artifactNavItem}
                    type="button"
                    variant="ghost"
                    data-active={active ? "true" : undefined}
                    data-expanded={expanded ? "true" : undefined}
                    data-workflow-step={step.key}
                    onClick={() => handleSelect(step.key)}
                    aria-current={active ? "page" : undefined}
                    aria-expanded={expanded}
                    title={missingRequirements ? `Related context missing: ${missingRequirements}` : step.goal}
                  >
                    <span className={styles.artifactNavDisclosure} aria-hidden="true">
                      <DisclosureIcon />
                    </span>
                    <span className={styles.artifactNavIcon} data-status={status.kind}>
                      <StatusIcon aria-hidden="true" />
                    </span>
                    <span className={styles.artifactNavText}>
                      <strong>{step.shortLabel}</strong>
                      <small>{step.label}</small>
                    </span>
                  <Badge className={styles.artifactNavStatus} data-status={status.kind} variant="outline">
                      {status.label}
                    </Badge>
                  </Button>
                  {expanded && activeDetail ? (
                    <div className={styles.artifactNavDetail}>
                      {activeDetail}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </nav>
  );
}

export { ArtifactNavigator };
