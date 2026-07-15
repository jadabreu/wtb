import { Check, Plus, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PanelBody, WorkbenchPanel } from "@/components/workbench/workbench";
import type { PromptTemplate } from "@/lib/types";
import { formatActionType } from "@/lib/prompt-template-utils";
import { workflowSteps } from "@/lib/workflow";
import { cn } from "@/lib/utils";
import styles from "./prompt-components.module.css";

type PromptCatalogProps = {
  templates: PromptTemplate[];
  filteredTemplates: PromptTemplate[];
  chatTemplates: PromptTemplate[];
  activeTemplateId: number | null;
  query: string;
  status: string;
  saving: boolean;
  loading: boolean;
  onQueryChange: (query: string) => void;
  onCreateTemplate: () => void;
  onSelectTemplate: (template: PromptTemplate) => void;
};

function PromptCatalog({
  templates,
  filteredTemplates,
  chatTemplates,
  activeTemplateId,
  query,
  status,
  saving,
  loading,
  onQueryChange,
  onCreateTemplate,
  onSelectTemplate
}: PromptCatalogProps) {
  return (
    <WorkbenchPanel className={styles.listPanel} as="aside">
      <PanelBody className={cn(styles.catalogBody, "flex min-h-0 flex-1 flex-col gap-3 p-3")}>
        <div className={styles.catalogHeading}>
          <div>
            <strong>Catalog</strong>
            <span>{templates.length} templates</span>
          </div>
          <Button className={styles.createButton} type="button" onClick={onCreateTemplate} disabled={saving}>
            <Plus data-icon="inline-start" />
            New
          </Button>
        </div>
        {status ? (
          <Badge className="justify-start" variant="secondary">
            <Check data-icon="inline-start" />
            {status}
          </Badge>
        ) : null}
        <div className={cn(styles.search, "flex h-9 items-center gap-2 rounded-md border bg-background px-3")}>
          <Search data-icon="inline-start" />
          <Input
            aria-label="Search prompts"
            className="h-8 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
            value={query}
            placeholder="Search prompts"
            onChange={(event) => onQueryChange(event.target.value)}
          />
        </div>

        <ScrollArea className="min-h-0 flex-1">
          <div className={styles.catalogList}>
            {workflowSteps.map((step) => {
              const stepTemplates = filteredTemplates.filter((template) => template.appliesTo === step.key);
              if (stepTemplates.length === 0) return null;
              return (
                <div className={styles.catalogGroup} key={step.key}>
                  <div className={styles.catalogGroupHeader}>
                    <span>{step.label}</span>
                    <small>{stepTemplates.length}</small>
                  </div>
                  {stepTemplates.map((template) => (
                    <PromptCatalogRow
                      key={template.id}
                      template={template}
                      active={template.id === activeTemplateId}
                      onSelect={onSelectTemplate}
                    />
                  ))}
                </div>
              );
            })}

            {chatTemplates.length > 0 ? (
              <div className={styles.catalogGroup}>
                <div className={styles.catalogGroupHeader}>
                  <span>Chat fallback</span>
                  <small>{chatTemplates.length}</small>
                </div>
                {chatTemplates.map((template) => (
                  <PromptCatalogRow
                    key={template.id}
                    template={template}
                    active={template.id === activeTemplateId}
                    onSelect={onSelectTemplate}
                  />
                ))}
              </div>
            ) : null}

            {!loading && filteredTemplates.length === 0 ? (
              <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">No prompts match the current search.</p>
            ) : null}
          </div>
        </ScrollArea>
      </PanelBody>
    </WorkbenchPanel>
  );
}

function PromptCatalogRow({
  template,
  active,
  onSelect
}: {
  template: PromptTemplate;
  active: boolean;
  onSelect: (template: PromptTemplate) => void;
}) {
  return (
    <Button
      className={styles.row}
      type="button"
      variant="ghost"
      data-active={active ? "true" : undefined}
      onClick={() => onSelect(template)}
    >
      <span className={styles.rowCopy}>
        <span>{template.title}</span>
        <small>{template.isDefault ? "Default" : formatActionType(template.actionType)}{template.isPinned ? " · Quick" : ""}</small>
      </span>
    </Button>
  );
}

export { PromptCatalog };
