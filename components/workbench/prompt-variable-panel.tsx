import { CopyPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { promptVariableNames } from "@/lib/prompt-render";
import styles from "./prompt-components.module.css";

type PromptVariablePanelProps = {
  onInsert: (variable: (typeof promptVariableNames)[number]) => void;
};

function PromptVariablePanel({ onInsert }: PromptVariablePanelProps) {
  return (
    <section className={styles.variablePanel} aria-label="Prompt variables">
      <div className={styles.subsectionHeader}>
        <strong>Variables</strong>
        <span>Insert context tokens at the cursor</span>
      </div>
      <div className={styles.variableList}>
        {promptVariableNames.map((variable) => (
          <Button
            type="button"
            key={variable}
            onClick={() => onInsert(variable)}
            variant="outline"
            size="sm"
          >
            <CopyPlus data-icon="inline-start" />
            {`{{${variable}}}`}
          </Button>
        ))}
      </div>
    </section>
  );
}

export { PromptVariablePanel };
