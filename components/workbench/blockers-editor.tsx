import type { ReactNode } from "react";
import { ChevronRight, Plus, Save, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ArtifactBody, ArtifactCard, EmptyArtifactState } from "@/components/workbench/artifact";
import type { IdealState } from "@/lib/types";
import { cn } from "@/lib/utils";
import styles from "./workflow-components.module.css";

type BlockersEditorProps = {
  header: ReactNode;
  idealState: IdealState;
  idealStates: IdealState[];
  selectedIdealStateId: number | null;
  saving: boolean;
  onSelectIdealState: (idealStateId: number) => void;
  onAddBlocker: (idealStateId: number) => void;
  onUpdateBlocker: (idealStateId: number, blockerIndex: number, value: string) => void;
  onRemoveBlocker: (idealStateId: number, blockerIndex: number) => void;
};

function BlockersEditor({
  header,
  idealState,
  idealStates,
  selectedIdealStateId,
  saving,
  onSelectIdealState,
  onAddBlocker,
  onUpdateBlocker,
  onRemoveBlocker
}: BlockersEditorProps) {
  return (
	    <ArtifactCard variant="editor" density="compact" className={styles.artifactCard}>
      {header}
      <ArtifactBody className="grid gap-3">
        <label className={styles.scopeSelector}>
          <span>Ideal</span>
          <Select
            value={String(selectedIdealStateId ?? idealState.id)}
            onValueChange={(value) => onSelectIdealState(Number(value))}
            disabled={saving || idealStates.length <= 1}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select ideal" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {idealStates.map((item, index) => (
                  <SelectItem value={String(item.id)} key={item.id}>
                    {index + 1}. {item.title.trim() || `Ideal ${index + 1}`}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </label>

        {idealState.blockers.length === 0 ? (
          <EmptyArtifactState
            title="No blockers saved"
            description={`Add a blocker for "${idealState.title}" manually.`}
            action={
              <div className={styles.emptyActions}>
                <Button type="button" variant="outline" onClick={() => onAddBlocker(idealState.id)} disabled={saving}>
                  <Plus data-icon="inline-start" />
                  Add blocker
                </Button>
              </div>
            }
          />
        ) : (
          <div className={styles.metricList}>
            {idealState.blockers.map((blocker, blockerIndex) => (
              <div className={styles.metricRow} key={`${idealState.id}-${blockerIndex}`}>
                <Textarea
                  value={blocker}
                  onChange={(event) => onUpdateBlocker(idealState.id, blockerIndex, event.target.value)}
                  placeholder="Example: The user lacks trustworthy inventory signals"
                  rows={2}
                />
                <Button className={styles.iconButton} type="button" title="Delete blocker" onClick={() => onRemoveBlocker(idealState.id, blockerIndex)} disabled={saving}>
                  <Trash2 data-icon="inline-start" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </ArtifactBody>
    </ArtifactCard>
  );
}

function BlockersToolbar({
  idealStateId,
  saving,
  dirty,
  onAddBlocker,
  onSave,
  onCancel
}: {
  idealStateId: number;
  saving: boolean;
  dirty: boolean;
  onAddBlocker: (idealStateId: number) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className={styles.inlineToolbar}>
      <Button className={styles.iconButton} type="button" title="Add blocker" onClick={() => onAddBlocker(idealStateId)} disabled={saving}>
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

function EmptyBlockersState({
  header,
  onDefineIdeals
}: {
  header: ReactNode;
  onDefineIdeals: () => void;
}) {
  return (
	    <ArtifactCard variant="editor" density="compact" className={cn(styles.artifactCard, styles.emptyState)}>
      {header}
      <ArtifactBody>
        <EmptyArtifactState
          title="No ideal state selected"
          description="Define ideal states first, then edit blockers for each ideal."
          action={
            <Button type="button" variant="outline" onClick={onDefineIdeals}>
              Define ideals
              <ChevronRight data-icon="inline-end" />
            </Button>
          }
        />
      </ArtifactBody>
    </ArtifactCard>
  );
}

export { BlockersEditor, BlockersToolbar, EmptyBlockersState };
