"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Check, Ellipsis, RotateCcw, Save, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Field, FieldLabel } from "@/components/ui/field";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { PanelBody, PanelHeader, PanelToolbar, PromptCatalog, PromptPreviewPanel, PromptSettingsPanel, PromptVariablePanel, ResearchSidebar, WorkbenchAppLayout, WorkbenchFrame, WorkbenchGrid, WorkbenchPanel, WorkbenchShell, WorkbenchTopbar } from "@/components/workbench";
import { createEmptySelections, type AppState, type PromptTemplate } from "@/lib/types";
import { findUnknownVariables, promptVariableNames, renderPromptTemplate } from "@/lib/prompt-render";
import { getWorkflowStep } from "@/lib/workflow";
import { cn } from "@/lib/utils";
import { emptyTemplateDraft, formatActionType, templateToDraft, type TemplateDraft } from "@/lib/prompt-template-utils";
import { createPromptTemplate, deletePromptTemplate, loadPromptWorkbench, restoreBuiltinPromptTemplates, savePromptTemplate } from "@/lib/workbench-api";
import promptStyles from "@/components/workbench/prompt-components.module.css";

const emptyState: AppState = {
  activeProjectId: 0,
  projects: [],
  selections: createEmptySelections(),
  themes: [],
  jobSteps: [],
  idealStates: [],
  agentMessages: [],
  pendingPatchSet: null
};

export default function ActionLibraryPage() {
  const [state, setState] = useState<AppState>(emptyState);
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [activeTemplateId, setActiveTemplateId] = useState<number | null>(null);
  const [templateDraft, setTemplateDraft] = useState<TemplateDraft>(emptyTemplateDraft);
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const templateTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  const activeTemplate = templates.find((template) => template.id === activeTemplateId) || templates[0] || null;
  const activeProject = state.projects.find((project) => project.id === state.activeProjectId);
  const selectedJobStep = state.jobSteps[0] || null;
  const selectedIdealState = state.idealStates[0] || null;
  const unknownTemplateVariables = findUnknownVariables(templateDraft.content);
  const renderedTemplatePreview = renderPromptTemplate(templateDraft.content, state, {
    projectName: activeProject?.name,
    defaultN: templateDraft.defaultN,
    workflowStep: templateDraft.appliesTo !== "chat" ? templateDraft.appliesTo : "product",
    jobStep: selectedJobStep,
    idealState: selectedIdealState
  });
  const filteredTemplates = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return templates;
    return templates.filter((template) => {
      const stepLabel = template.appliesTo === "chat" ? "chat fallback" : getWorkflowStep(template.appliesTo).label;
      return `${template.title} ${template.category} ${stepLabel} ${template.actionType}`.toLowerCase().includes(needle);
    });
  }, [query, templates]);

  useEffect(() => {
    let mounted = true;

    loadPromptWorkbench()
      .then(({ state: nextState, prompts }) => {
        if (!mounted) return;
        const nextTemplates = prompts.templates || [];
        setState(nextState);
        setTemplates(nextTemplates);
        const firstTemplate = nextTemplates[0] || null;
        setActiveTemplateId(firstTemplate?.id || null);
        if (firstTemplate) setTemplateDraft(templateToDraft(firstTemplate));
      })
      .catch((nextError: Error) => setError(nextError.message))
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  function selectTemplate(template: PromptTemplate) {
    setActiveTemplateId(template.id);
    setTemplateDraft(templateToDraft(template));
    setError("");
    setStatus("");
  }

  function insertTemplateVariable(variable: (typeof promptVariableNames)[number]) {
    const token = `{{${variable}}}`;
    const element = templateTextareaRef.current;

    setTemplateDraft((current) => {
      if (!element) {
        const separator = current.content && !current.content.endsWith(" ") ? " " : "";
        return { ...current, content: `${current.content}${separator}${token}` };
      }

      const start = element.selectionStart ?? current.content.length;
      const end = element.selectionEnd ?? start;
      const nextContent = `${current.content.slice(0, start)}${token}${current.content.slice(end)}`;

      requestAnimationFrame(() => {
        element.focus();
        const cursor = start + token.length;
        element.setSelectionRange(cursor, cursor);
      });

      return { ...current, content: nextContent };
    });
  }

  function templateSummary() {
    const stepLabel = templateDraft.appliesTo === "chat" ? "Chat fallback" : getWorkflowStep(templateDraft.appliesTo).label;
    const scopeLabel = templateDraft.scopeRequired === "job_step" ? "Job step scope" : templateDraft.scopeRequired === "ideal_state" ? "Ideal scope" : "Project scope";
    const flags = [
      stepLabel,
      formatActionType(templateDraft.actionType),
      scopeLabel,
      templateDraft.isDefault ? "Default" : "Optional",
      templateDraft.isPinned ? "Quick" : null
    ].filter(Boolean);

    return flags.join(" · ");
  }

  async function createTemplate() {
    setSaving(true);
    setError("");
    setStatus("");

    try {
      const payload = await createPromptTemplate();
      const nextTemplates = payload.templates || [];
      setTemplates(nextTemplates);
      const nextTemplate = nextTemplates.find((template) => template.id === payload.activeTemplateId) || nextTemplates[0];
      if (nextTemplate) selectTemplate(nextTemplate);
      setStatus("Prompt created.");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not create prompt.");
    } finally {
      setSaving(false);
    }
  }

  async function saveTemplate() {
    if (!activeTemplateId) return;
    setSaving(true);
    setError("");
    setStatus("");

    try {
      const payload = await savePromptTemplate(activeTemplateId, templateDraft);
      const nextTemplates = payload.templates || [];
      setTemplates(nextTemplates);
      const nextTemplate = nextTemplates.find((template) => template.id === activeTemplateId);
      if (nextTemplate) selectTemplate(nextTemplate);
      setStatus("Prompt saved.");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not save prompt.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteTemplate() {
    if (!activeTemplateId || templates.length <= 1) return;
    setSaving(true);
    setError("");
    setStatus("");

    try {
      const payload = await deletePromptTemplate(activeTemplateId);
      const nextTemplates = payload.templates || [];
      setTemplates(nextTemplates);
      const nextTemplate = nextTemplates[0];
      setActiveTemplateId(nextTemplate?.id || null);
      if (nextTemplate) setTemplateDraft(templateToDraft(nextTemplate));
      setStatus("Prompt deleted.");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not delete prompt.");
    } finally {
      setSaving(false);
      setDeleteOpen(false);
    }
  }

  async function restoreBuiltins() {
    setSaving(true);
    setError("");
    setStatus("");

    try {
      const payload = await restoreBuiltinPromptTemplates();
      const nextTemplates = payload.templates || [];
      setTemplates(nextTemplates);
      const nextTemplate = activeTemplateId ? nextTemplates.find((template) => template.id === activeTemplateId) || nextTemplates[0] : nextTemplates[0];
      if (nextTemplate) selectTemplate(nextTemplate);
      setStatus("Built-in prompts restored.");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not restore built-ins.");
    } finally {
      setSaving(false);
    }
  }

  const chatTemplates = filteredTemplates.filter((template) => template.appliesTo === "chat");

  return (
    <WorkbenchShell className={promptStyles.shell}>
      <WorkbenchFrame className="max-w-none p-0 lg:p-0">
        <WorkbenchAppLayout
          className={promptStyles.layout}
          sidebar={
            <ResearchSidebar active="prompts" />
          }
        >
        <WorkbenchTopbar
          className={promptStyles.header}
          title="Prompts"
        />

      {error ? (
        <Alert variant="destructive">
          <AlertTriangle data-icon="inline-start" />
          <AlertTitle>Something needs attention</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <WorkbenchGrid columns="single" className={cn(promptStyles.grid, "min-h-0 flex-1")} aria-label="Prompt assignment workspace">
        <PromptCatalog
          templates={templates}
          filteredTemplates={filteredTemplates}
          chatTemplates={chatTemplates}
          activeTemplateId={activeTemplateId}
          query={query}
          status={status}
          saving={saving}
          loading={loading}
          onQueryChange={setQuery}
          onCreateTemplate={() => void createTemplate()}
          onSelectTemplate={selectTemplate}
        />
        <WorkbenchPanel className={promptStyles.definitionPanel}>
          {activeTemplate ? (
            <>
              <PanelHeader
                className={promptStyles.definitionHeader}
                title={templateDraft.title || "Untitled prompt"}
                description={templateSummary()}
                actions={
                  <PanelToolbar className={promptStyles.headerActions}>
                    <Button type="button" onClick={saveTemplate} disabled={saving}>
                      <Save data-icon="inline-start" />
                      Save
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button className={promptStyles.circleButton} type="button" variant="outline" aria-label="Prompt actions">
                          <Ellipsis data-icon="inline-start" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className={promptStyles.actionsMenu}>
                        <DropdownMenuLabel>Prompt actions</DropdownMenuLabel>
                        <DropdownMenuGroup>
                          <DropdownMenuItem onSelect={() => void restoreBuiltins()} disabled={saving}>
                            <RotateCcw data-icon="inline-start" />
                            Restore built-ins
                          </DropdownMenuItem>
                          <DropdownMenuItem variant="destructive" onSelect={() => setDeleteOpen(true)} disabled={saving || templates.length <= 1}>
                            <Trash2 data-icon="inline-start" />
                            Delete prompt
                          </DropdownMenuItem>
                        </DropdownMenuGroup>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem disabled>
                          <Check data-icon="inline-start" />
                          {templates.length} templates
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </PanelToolbar>
                }
              />

              <PanelBody className={cn(promptStyles.body, "flex min-h-0 flex-1 flex-col overflow-auto")}>
                <Tabs className={promptStyles.tabs} defaultValue="edit">
                  <TabsList className={promptStyles.tabsList}>
                    <TabsTrigger value="edit">Edit</TabsTrigger>
                    <TabsTrigger value="preview">Preview</TabsTrigger>
                    <TabsTrigger value="settings">Settings</TabsTrigger>
                  </TabsList>

                  <TabsContent className={promptStyles.tabContent} value="edit">
                    <Field className={cn(promptStyles.editorContent, "min-h-0")}>
                      <FieldLabel>Prompt body</FieldLabel>
                      <Textarea
                        ref={templateTextareaRef}
                        className="min-h-[440px] font-mono text-sm"
                        value={templateDraft.content}
                        onChange={(event) => setTemplateDraft((current) => ({ ...current, content: event.target.value }))}
                      />
                    </Field>

                    {unknownTemplateVariables.length > 0 ? (
                      <Alert variant="destructive">
                        <AlertTriangle data-icon="inline-start" />
                        <AlertTitle>Unknown variables</AlertTitle>
                        <AlertDescription>{unknownTemplateVariables.join(", ")}</AlertDescription>
                      </Alert>
                    ) : null}

                    <PromptVariablePanel onInsert={insertTemplateVariable} />
                  </TabsContent>

                  <TabsContent className={promptStyles.tabContent} value="preview">
                    <PromptPreviewPanel
                      projectName={activeProject?.name || "Untitled research"}
                      jobStepLabel={selectedJobStep ? `Job step: ${selectedJobStep.title}` : "No job step selected."}
                      preview={renderedTemplatePreview}
                    />
                  </TabsContent>

                  <TabsContent className={promptStyles.tabContent} value="settings">
                    <PromptSettingsPanel draft={templateDraft} onChange={setTemplateDraft} />
                  </TabsContent>
                </Tabs>
              </PanelBody>
            </>
          ) : (
            <PanelBody className="grid flex-1 place-items-center">
              <div className="text-center">
                <strong>No prompt selected</strong>
                <p className="text-sm text-muted-foreground">Create a prompt or choose one from the catalog.</p>
              </div>
            </PanelBody>
          )}
        </WorkbenchPanel>
      </WorkbenchGrid>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete prompt?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes {activeTemplate ? `"${activeTemplate.title}"` : "this prompt"} from the catalog. Existing project history will stay saved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={saving || templates.length <= 1}
              variant="destructive"
              onClick={(event) => {
                event.preventDefault();
                void deleteTemplate();
              }}
            >
              Delete prompt
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </WorkbenchAppLayout>
      </WorkbenchFrame>
    </WorkbenchShell>
  );
}
