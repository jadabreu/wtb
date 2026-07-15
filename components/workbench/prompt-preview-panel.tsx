import { ScrollArea } from "@/components/ui/scroll-area";
import styles from "./prompt-components.module.css";

type PromptPreviewPanelProps = {
  projectName: string;
  jobStepLabel: string;
  preview: string;
};

function PromptPreviewPanel({ projectName, jobStepLabel, preview }: PromptPreviewPanelProps) {
  return (
    <section className={styles.previewPanel}>
      <div className={styles.subsectionHeader}>
        <strong>{projectName}</strong>
        <span>{jobStepLabel}</span>
      </div>
      <ScrollArea className={`${styles.previewScroll} rounded-md border bg-muted/30`}>
        <pre className="whitespace-pre-wrap p-3 font-mono text-xs leading-relaxed">{preview || "No prompt content yet."}</pre>
      </ScrollArea>
    </section>
  );
}

export { PromptPreviewPanel };
