import { type CSSProperties, type DragEvent, type ReactNode, useState } from "react";
import { ArrowDown, ArrowUp, GripVertical, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ArtifactBody, ArtifactCard } from "@/components/workbench/artifact";
import { idealStateLabelLabels, idealStateLabelValues, normalizeIdealStateLabel, type IdealState, type IdealStateLabel, type Theme } from "@/lib/types";
import { cn } from "@/lib/utils";
import styles from "./workflow-components.module.css";

type IdealStatesEditorProps = {
  header: ReactNode;
  idealStates: IdealState[];
  themes: Theme[];
  expandedIdealStates: Record<number, boolean>;
  saving: boolean;
  onAddIdealState: () => void;
  onToggleIdealState: (idealStateId: number) => void;
  onUpdateIdealState: (idealStateId: number, patch: Partial<IdealState>) => void;
  onMoveIdealState: (idealStateId: number, direction: -1 | 1) => void;
  onReorderIdealState: (sourceIdealStateId: number, targetIdealStateId: number) => void;
  onRemoveIdealState: (idealStateId: number) => void;
};

function idealLabelVariant(label: IdealStateLabel) {
  if (label === "critical_gap") return "destructive";
  if (label === "table_stake") return "secondary";
  return "outline";
}

function IdealStatesEditor({
  header,
  idealStates,
  themes,
  expandedIdealStates,
  saving,
  onAddIdealState,
  onToggleIdealState,
  onUpdateIdealState,
  onMoveIdealState,
  onReorderIdealState,
  onRemoveIdealState
}: IdealStatesEditorProps) {
  const [draggingIdealStateId, setDraggingIdealStateId] = useState<number | null>(null);
  const [dragOverIdealStateId, setDragOverIdealStateId] = useState<number | null>(null);
  const themeById = new Map(themes.map((theme) => [theme.id, theme]));

  function resetDragState() {
    setDraggingIdealStateId(null);
    setDragOverIdealStateId(null);
  }

  function handleDragStart(event: DragEvent<HTMLButtonElement>, idealStateId: number) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(idealStateId));
    setDraggingIdealStateId(idealStateId);
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>, idealStateId: number) {
    if (saving || !draggingIdealStateId || draggingIdealStateId === idealStateId) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDragOverIdealStateId(idealStateId);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>, targetIdealStateId: number) {
    event.preventDefault();
    const sourceIdealStateId = draggingIdealStateId || Number(event.dataTransfer.getData("text/plain"));
    if (sourceIdealStateId && sourceIdealStateId !== targetIdealStateId) {
      onReorderIdealState(sourceIdealStateId, targetIdealStateId);
    }
    resetDragState();
  }

  return (
	    <ArtifactCard variant="editor" density="compact" className={styles.artifactCard}>
      {header}

      <ArtifactBody className="grid gap-3">
        {idealStates.length === 0 ? (
          <div className={styles.emptyState}>
            <p>No ideals defined yet.</p>
            <Button type="button" variant="outline" onClick={onAddIdealState} disabled={saving}>
              <Plus data-icon="inline-start" />
              Add first ideal
            </Button>
          </div>
        ) : (
          <div className={styles.idealList}>
            {idealStates.map((idealState, index) => {
              const isEditing = Boolean(expandedIdealStates[idealState.id]);
              const description = idealState.description.trim();
              const label = normalizeIdealStateLabel(idealState.label);
              const idealThemes = idealState.themeIds
                .map((themeId) => themeById.get(themeId))
                .filter((theme): theme is Theme => Boolean(theme));
              const isDragging = draggingIdealStateId === idealState.id;
              const isDropTarget = Boolean(draggingIdealStateId && dragOverIdealStateId === idealState.id && !isDragging);

              return (
                <Card
                  className={cn(styles.idealCard, isDragging && styles.idealCardDragging, isDropTarget && styles.idealCardDropTarget)}
                  key={idealState.id}
                  onDragOver={(event) => handleDragOver(event, idealState.id)}
                  onDragLeave={() => setDragOverIdealStateId((current) => (current === idealState.id ? null : current))}
                  onDrop={(event) => handleDrop(event, idealState.id)}
                >
                  <div className={styles.idealRow}>
                    <span className={styles.jobStepNumber}>{index + 1}</span>
                    <Button
                      className={styles.dragHandle}
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      title={`Drag ideal ${index + 1} to reorder`}
                      aria-label={`Drag ideal ${index + 1} to reorder`}
                      draggable={!saving}
                      onDragStart={(event) => handleDragStart(event, idealState.id)}
                      onDragEnd={resetDragState}
                      disabled={saving}
                    >
                      <GripVertical data-icon="inline-start" />
                    </Button>
                    <div className={styles.idealContent}>
                      <div className={styles.idealTitle}>
                        <strong>{idealState.title.trim() || `Ideal ${index + 1}`}</strong>
                        <Badge variant={idealLabelVariant(label)}>{idealStateLabelLabels[label]}</Badge>
                        {idealThemes.map((theme) => (
                          <Badge className={styles.themeChip} variant="outline" style={{ "--theme-color": theme.color } as CSSProperties} key={theme.id}>
                            {theme.title}
                          </Badge>
                        ))}
                      </div>
                      <small>{description || "No description yet"}</small>
                    </div>
                    <div className={styles.idealActions}>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        title={isEditing ? "Close ideal editor" : "Edit ideal"}
                        aria-label={isEditing ? "Close ideal editor" : "Edit ideal"}
                        onClick={() => onToggleIdealState(idealState.id)}
                        disabled={saving}
                      >
                        {isEditing ? <X data-icon="inline-start" /> : <Pencil data-icon="inline-start" />}
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon-sm"
                        title="Delete ideal"
                        aria-label="Delete ideal"
                        onClick={() => onRemoveIdealState(idealState.id)}
                        disabled={saving}
                      >
                        <Trash2 data-icon="inline-start" />
                      </Button>
                    </div>
                  </div>

                  {isEditing ? (
                    <div className={styles.idealEditor}>
                      <label>
                        <span>Ideal name</span>
                        <Input
                          value={idealState.title}
                          onChange={(event) => onUpdateIdealState(idealState.id, { title: event.target.value })}
                          placeholder="Example: Decisions are clear and low-risk"
                        />
                      </label>
                      <label>
                        <span>Description</span>
                        <Textarea
                          value={idealState.description}
                          onChange={(event) => onUpdateIdealState(idealState.id, { description: event.target.value })}
                          placeholder="What should be true in the user's world"
                        />
                      </label>
                      <label className={styles.idealLabelField}>
                        <span>Label</span>
                        <Select
                          value={label}
                          onValueChange={(value) => onUpdateIdealState(idealState.id, { label: value as IdealStateLabel })}
                          disabled={saving}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              {idealStateLabelValues.map((labelValue) => (
                                <SelectItem value={labelValue} key={labelValue}>
                                  {idealStateLabelLabels[labelValue]}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      </label>

                      <div className={styles.jobStepActions}>
                        <Button className={styles.iconButton} type="button" title="Move ideal up" onClick={() => onMoveIdealState(idealState.id, -1)} disabled={saving || index === 0}>
                          <ArrowUp data-icon="inline-start" />
                        </Button>
                        <Button className={styles.iconButton} type="button" title="Move ideal down" onClick={() => onMoveIdealState(idealState.id, 1)} disabled={saving || index === idealStates.length - 1}>
                          <ArrowDown data-icon="inline-start" />
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

function IdealStatesToolbar({
  saving,
  dirty,
  canClear,
  onAddIdealState,
  onSaveIdeals,
  onCancelEdit,
  onClearIdeals
}: {
  saving: boolean;
  dirty: boolean;
  canClear: boolean;
  onAddIdealState: () => void;
  onSaveIdeals: () => void;
  onCancelEdit: () => void;
  onClearIdeals: () => void;
}) {
  return (
    <div className={styles.inlineToolbar}>
      <Button type="button" variant="outline" onClick={onAddIdealState} disabled={saving}>
        <Plus data-icon="inline-start" />
        Ideal
      </Button>
      {dirty ? (
        <>
          <Button type="button" onClick={onSaveIdeals} disabled={saving}>
            <Save data-icon="inline-start" />
            Save ideals
          </Button>
          <Button type="button" variant="outline" onClick={onCancelEdit} disabled={saving}>
            <X data-icon="inline-start" />
            Cancel
          </Button>
        </>
      ) : null}
      <Button type="button" variant="destructive" onClick={onClearIdeals} disabled={saving || !canClear}>
        <Trash2 data-icon="inline-start" />
        Clear
      </Button>
    </div>
  );
}

export { IdealStatesEditor, IdealStatesToolbar };
