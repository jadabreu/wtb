import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { clampDefaultN } from "@/lib/prompt-render";
import { workflowSteps } from "@/lib/workflow";
import type { PromptActionType, PromptAppliesTo, PromptScopeRequired } from "@/lib/types";
import type { TemplateDraft } from "@/lib/prompt-template-utils";
import styles from "./prompt-components.module.css";

type PromptSettingsPanelProps = {
  draft: TemplateDraft;
  onChange: (draft: TemplateDraft) => void;
};

function PromptSettingsPanel({ draft, onChange }: PromptSettingsPanelProps) {
  function updateDraft(patch: Partial<TemplateDraft>) {
    onChange({ ...draft, ...patch });
  }

  function updateAppliesTo(value: string) {
    const appliesTo = value as PromptAppliesTo;
    updateDraft({
      appliesTo,
      actionType: appliesTo === "chat" ? "chat" : draft.actionType === "chat" ? "generate" : draft.actionType,
      scopeRequired: appliesTo === "success_metrics" ? "job_step" : appliesTo === "blockers" ? "ideal_state" : draft.scopeRequired,
      isDefault: appliesTo === "chat" ? false : draft.isDefault
    });
  }

  return (
    <FieldGroup className={`${styles.settingsGrid} grid gap-3 md:grid-cols-12`}>
      <Field className="md:col-span-6">
        <FieldLabel>Name</FieldLabel>
        <Input
          value={draft.title}
          onChange={(event) => updateDraft({ title: event.target.value })}
        />
      </Field>
      <Field className="md:col-span-6">
        <FieldLabel>Category</FieldLabel>
        <Input
          value={draft.category}
          onChange={(event) => updateDraft({ category: event.target.value })}
        />
      </Field>
      <Field className="md:col-span-4">
        <FieldLabel>Outcome step</FieldLabel>
        <Select value={draft.appliesTo} onValueChange={updateAppliesTo}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="chat">Chat / fallback</SelectItem>
              {workflowSteps.map((step) => (
                <SelectItem value={step.key} key={step.key}>{step.label}</SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </Field>
      <Field className="md:col-span-3">
        <FieldLabel>Prompt role</FieldLabel>
        <Select
          value={draft.actionType}
          onValueChange={(value) => updateDraft({ actionType: value as PromptActionType })}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="generate">Generate</SelectItem>
              <SelectItem value="refine">Refine</SelectItem>
              <SelectItem value="challenge">Challenge</SelectItem>
              <SelectItem value="audit">Audit</SelectItem>
              <SelectItem value="chat">Chat</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </Field>
      <Field className="md:col-span-4">
        <FieldLabel>Scope</FieldLabel>
        <Select
          value={draft.scopeRequired}
          onValueChange={(value) => updateDraft({ scopeRequired: value as PromptScopeRequired })}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="none">None</SelectItem>
              <SelectItem value="job_step">Job step</SelectItem>
              <SelectItem value="ideal_state">Ideal state</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </Field>
      <Field className="md:col-span-2">
        <FieldLabel>Default N</FieldLabel>
        <Input
          type="number"
          min="1"
          max="100"
          value={draft.defaultN}
          onChange={(event) => updateDraft({ defaultN: clampDefaultN(event.target.value) })}
        />
      </Field>
      <div className={`${styles.switches} md:col-span-6`}>
        <label>
          <Switch
            checked={draft.isDefault}
            disabled={draft.appliesTo === "chat"}
            onCheckedChange={(checked) => updateDraft({ isDefault: checked })}
          />
          <span>Default</span>
        </label>
        <label>
          <Switch
            checked={draft.isPinned}
            onCheckedChange={(checked) => updateDraft({ isPinned: checked })}
          />
          <span>Quick prompt</span>
        </label>
      </div>
    </FieldGroup>
  );
}

export { PromptSettingsPanel };
