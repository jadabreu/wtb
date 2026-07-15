import type { ReactNode } from "react";
import { ChevronDown, Pencil, Save, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArtifactBody, ArtifactCard } from "@/components/workbench/artifact";
import { fieldLabels, isListFieldKey, parseListFieldValue, type FieldKey } from "@/lib/types";
import { cn } from "@/lib/utils";
import { isFieldComplete, placeholderFor } from "@/lib/workbench-utils";
import styles from "./workflow-components.module.css";

type FieldStepCardProps = {
  fieldKey: FieldKey;
  value: string;
  draftValue: string;
  expanded: boolean;
  saving: boolean;
  header: ReactNode;
  onEdit: (fieldKey: FieldKey) => void;
  onCancel: (fieldKey: FieldKey) => void;
  onSave: (fieldKey: FieldKey) => void;
  onClear: (fieldKey: FieldKey) => void;
  onDraftChange: (fieldKey: FieldKey, value: string) => void;
};

function FieldStepCard({
  fieldKey,
  value,
  draftValue,
  expanded,
  saving,
  header,
  onEdit,
  onCancel,
  onSave,
  onClear,
  onDraftChange
}: FieldStepCardProps) {
  const trimmedValue = value.trim();
  const listField = isListFieldKey(fieldKey);
  const listItems = listField ? parseListFieldValue(trimmedValue) : [];
  const complete = isFieldComplete(fieldKey, trimmedValue);

  return (
	    <ArtifactCard
	      variant="editor"
	      density="compact"
	      className={cn(
        styles.artifactCard,
        styles.fieldCard,
        !listField && styles.singleFieldCard,
        !complete && styles.emptyField
      )}
    >
      {listField ? header : null}
      <ArtifactBody className={cn(styles.fieldCardContent, !listField && styles.singleFieldCardContent)}>
        {expanded ? (
          <div className={cn(styles.fieldEditor, !listField && styles.singleFieldEditor)}>
            <Textarea
              id={`workflow-${fieldKey}`}
              value={draftValue}
              placeholder={placeholderFor(fieldKey)}
              onChange={(event) => onDraftChange(fieldKey, event.target.value)}
            />
            <div className={styles.fieldEditorActions}>
              <Button className={styles.primaryAction} type="button" onClick={() => onSave(fieldKey)} disabled={saving}>
                <Save data-icon="inline-start" />
                Save
              </Button>
              <Button type="button" variant="outline" onClick={() => onCancel(fieldKey)} disabled={saving}>
                <X data-icon="inline-start" />
                Cancel
              </Button>
              <Button type="button" variant="destructive" onClick={() => onClear(fieldKey)} disabled={saving || !complete}>
                <Trash2 data-icon="inline-start" />
                Clear
              </Button>
            </div>
          </div>
        ) : !listField ? (
          <div className={styles.singleFieldValueRow} data-empty={!complete ? "true" : undefined}>
            <button className={styles.singleFieldValue} type="button" onClick={() => onEdit(fieldKey)}>
              {trimmedValue || placeholderFor(fieldKey)}
            </button>
            <Button
              className={styles.singleFieldEditButton}
              type="button"
              variant="ghost"
              size="icon-xs"
              title={`${complete ? "Edit" : "Add"} ${fieldLabels[fieldKey]}`}
              aria-label={`${complete ? "Edit" : "Add"} ${fieldLabels[fieldKey]}`}
              onClick={() => onEdit(fieldKey)}
              disabled={saving}
            >
              <Pencil data-icon="inline-start" />
            </Button>
          </div>
        ) : (
          <button className={styles.fieldPreview} type="button" onClick={() => onEdit(fieldKey)}>
            {listItems.length > 0 ? (
              <span className={styles.fieldListPreview}>
                {listItems.map((item, index) => (
                  <span className={styles.fieldListItem} key={`${fieldKey}-${index}`}>{item}</span>
                ))}
              </span>
            ) : (
              trimmedValue || placeholderFor(fieldKey)
            )}
          </button>
        )}
      </ArtifactBody>
    </ArtifactCard>
  );
}

function FieldStepEditAction({
  fieldKey,
  complete,
  expanded,
  onEdit,
  onCancel
}: {
  fieldKey: FieldKey;
  complete: boolean;
  expanded: boolean;
  onEdit: (fieldKey: FieldKey) => void;
  onCancel: (fieldKey: FieldKey) => void;
}) {
  return (
    <Button
      className={styles.iconButton}
      type="button"
      variant="outline"
      size="sm"
      title={expanded ? `Collapse ${fieldLabels[fieldKey]}` : `${complete ? "Edit" : "Add"} ${fieldLabels[fieldKey]}`}
      onClick={() => (expanded ? onCancel(fieldKey) : onEdit(fieldKey))}
    >
      {expanded ? <ChevronDown data-icon="inline-start" /> : <Pencil data-icon="inline-start" />}
    </Button>
  );
}

export { FieldStepCard, FieldStepEditAction };
