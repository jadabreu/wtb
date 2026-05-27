"use client";

import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowDown, ArrowUp, Check, ChevronDown, ChevronLeft, ChevronRight, FolderPlus, Library, Loader2, MessageSquareX, Pencil, Plus, Save, Send, Sparkles, Trash2, X } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createEmptySelections, fieldKeys, fieldLabels, formatListFieldValue, isListFieldKey, parseListFieldValue, type AppState, type FieldKey, type GeneratedJobStep, type GeneratedOption, type JobStep, type PromptActionType, type PromptAppliesTo, type PromptScopeRequired, type PromptTemplate, type WorkflowStepKey } from "@/lib/types";
import { clampDefaultN, findUnknownVariables, promptVariableNames, renderPromptTemplate } from "@/lib/prompt-render";
import { getMissingRequirements, getNextWorkflowStep, getWorkflowStep, getWorkflowStepIndex, isFieldStepKey, isWorkflowStepComplete, workflowSteps, type WorkflowStep } from "@/lib/workflow";

const emptyState: AppState = {
  activeProjectId: 0,
  projects: [],
  selections: createEmptySelections(),
  jobSteps: [],
  messages: []
};

type GeneratedCandidate = GeneratedOption & {
  recommended: boolean;
};

type TemplateDraft = {
  title: string;
  category: string;
  content: string;
  appliesTo: PromptAppliesTo;
  actionType: PromptActionType;
  scopeRequired: PromptScopeRequired;
  isDefault: boolean;
  isPinned: boolean;
  defaultN: number;
};

type GuidedActionResult = {
  workflowStep: WorkflowStepKey;
  templateId: number;
  templateTitle: string;
  message: string;
  suggestions: GeneratedOption[];
  options: GeneratedOption[];
  jobSteps: GeneratedJobStep[];
  scope?: { type: "job_step"; id: number } | null;
  n: number;
  prompt?: string;
};

const ACTION_THINKING_MESSAGES = [
  "Sorting weak signals from real demand...",
  "Looking for the sharp edge in the customer problem...",
  "Turning the messy middle into usable candidates...",
  "Checking where the job gets expensive, risky, or frustrating...",
  "Mapping the outcome patterns before the suggestions land..."
] as const;

async function parseResponse(response: Response) {
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || "Request failed.");
  }
  return payload as AppState;
}

function templateToDraft(template: PromptTemplate): TemplateDraft {
  return {
    title: template.title,
    category: template.category,
    content: template.content,
    appliesTo: template.appliesTo,
    actionType: template.actionType,
    scopeRequired: template.scopeRequired,
    isDefault: template.isDefault,
    isPinned: template.isPinned,
    defaultN: template.defaultN
  };
}

export default function Home() {
  const [state, setState] = useState<AppState>(emptyState);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const [streamingMessage, setStreamingMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [projectsCollapsed, setProjectsCollapsed] = useState(false);
  const [promptLibraryOpen, setPromptLibraryOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<{ id: number; name: string } | null>(null);
  const [promptDeleteOpen, setPromptDeleteOpen] = useState(false);
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [activeTemplateId, setActiveTemplateId] = useState<number | null>(null);
  const [templateDraft, setTemplateDraft] = useState<TemplateDraft>({
    title: "",
    category: "",
    content: "",
    appliesTo: "chat",
    actionType: "chat",
    scopeRequired: "none",
    isDefault: false,
    isPinned: false,
    defaultN: 10
  });
  const [expandedFields, setExpandedFields] = useState<Partial<Record<FieldKey, boolean>>>({});
  const [expandedSteps, setExpandedSteps] = useState<Record<number, boolean>>({});
  const [fieldDrafts, setFieldDrafts] = useState<Record<FieldKey, string>>(emptyState.selections);
  const [jobStepDrafts, setJobStepDrafts] = useState<JobStep[]>([]);
  const [activeWorkflowStepKey, setActiveWorkflowStepKey] = useState<WorkflowStepKey>("product");
  const [actionRunning, setActionRunning] = useState(false);
  const [actionResult, setActionResult] = useState<GuidedActionResult | null>(null);
  const [actionStreamingMessage, setActionStreamingMessage] = useState("");
  const [actionThinkingMessage, setActionThinkingMessage] = useState<string>(ACTION_THINKING_MESSAGES[0]);
  const [actionN, setActionN] = useState(10);
  const [selectedActionTemplateIds, setSelectedActionTemplateIds] = useState<Partial<Record<WorkflowStepKey, number>>>({});
  const [selectedJobStepId, setSelectedJobStepId] = useState<number | null>(null);
  const messagesRef = useRef<HTMLDivElement | null>(null);
  const templateTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  const completedFields = useMemo(
    () => fieldKeys.filter((key) => isFieldComplete(key, state.selections[key])).length,
    [state.selections]
  );
  const jobMapDirty = JSON.stringify(normalizeJobSteps(jobStepDrafts)) !== JSON.stringify(normalizeJobSteps(state.jobSteps));
  const activeProject = state.projects.find((project) => project.id === state.activeProjectId);
  const activeWorkflowStep = getWorkflowStep(activeWorkflowStepKey);
  const activeWorkflowIndex = getWorkflowStepIndex(activeWorkflowStep.key);
  const activeWorkflowComplete = isWorkflowStepComplete(activeWorkflowStep, state);
  const missingWorkflowRequirements = getMissingRequirements(activeWorkflowStep, state);
  const availableActionTemplates = templates.filter((template) => template.appliesTo === activeWorkflowStep.key);
  const selectedActionTemplate =
    availableActionTemplates.find((template) => template.id === selectedActionTemplateIds[activeWorkflowStep.key]) ||
    availableActionTemplates.find((template) => template.isDefault) ||
    availableActionTemplates[0];
  const activeActionN = actionN || selectedActionTemplate?.defaultN || activeWorkflowStep.defaultN;
  const selectedJobStep = state.jobSteps.find((step) => step.id === selectedJobStepId) || state.jobSteps[0] || null;
  const guidedCandidates = actionResult?.workflowStep === activeWorkflowStep.key ? generatedCandidatesForActionResult(actionResult, activeWorkflowStep) : [];
  const guidedJobSteps = actionResult?.workflowStep === "job_map" ? actionResult.jobSteps : [];
  const guidedMetrics = actionResult?.workflowStep === "success_metrics" ? metricsForActionResult(actionResult) : [];
  const quickTemplates = useMemo(
    () => selectQuickTemplates(templates, activeWorkflowStep.key, completedFields),
    [templates, activeWorkflowStep.key, completedFields]
  );
  const activeTemplate = templates.find((template) => template.id === activeTemplateId) || templates[0];
  const renderedTemplatePreview = activeTemplate
    ? renderPromptTemplate(templateDraft.content, state, {
        projectName: activeProject?.name,
        defaultN: templateDraft.defaultN,
        workflowStep: templateDraft.appliesTo !== "chat" ? templateDraft.appliesTo : activeWorkflowStep.key,
        jobStep: selectedJobStep
      })
    : "";
  const unknownTemplateVariables = activeTemplate ? findUnknownVariables(templateDraft.content) : [];

  useEffect(() => {
    let mounted = true;

    fetch("/api/state")
      .then(parseResponse)
      .then((nextState) => {
        if (mounted) setState(nextState);
      })
      .catch((nextError: Error) => setError(nextError.message))
      .finally(() => setLoading(false));

    fetch("/api/prompts")
      .then(async (response) => {
        const payload = (await response.json()) as { templates: PromptTemplate[] };
        if (!response.ok) throw new Error("Could not load prompts.");
        return payload.templates;
      })
      .then((nextTemplates) => {
        if (!mounted) return;
        setTemplates(nextTemplates);
        const firstTemplate = nextTemplates[0];
        if (firstTemplate) {
          setActiveTemplateId(firstTemplate.id);
          setTemplateDraft(templateToDraft(firstTemplate));
        }
      })
      .catch((nextError: Error) => setError(nextError.message));

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    messagesRef.current?.scrollTo({
      top: messagesRef.current.scrollHeight,
      behavior: "smooth"
    });
  }, [state.messages.length, state.activeProjectId, pendingMessage, streamingMessage, sending]);

  useEffect(() => {
    setFieldDrafts(state.selections);
    setExpandedFields({});
  }, [state.activeProjectId, state.selections]);

  useEffect(() => {
    setJobStepDrafts(state.jobSteps.map(cloneJobStep));
    setExpandedSteps({});
  }, [state.activeProjectId, state.jobSteps]);

  useEffect(() => {
    if (!state.activeProjectId) return;
    const nextStep = getNextWorkflowStep(state);
    setActiveWorkflowStepKey(nextStep.key);
    setActionResult(null);
    setSelectedJobStepId(state.jobSteps[0]?.id ?? null);
  }, [state.activeProjectId]);

  useEffect(() => {
    setActionN(selectedActionTemplate?.defaultN || activeWorkflowStep.defaultN);
    setActionResult(null);
  }, [activeWorkflowStep.key, selectedActionTemplate?.id]);

  useEffect(() => {
    if (state.jobSteps.length === 0) {
      setSelectedJobStepId(null);
      return;
    }

    if (!selectedJobStepId || !state.jobSteps.some((step) => step.id === selectedJobStepId)) {
      setSelectedJobStepId(state.jobSteps[0].id);
    }
  }, [selectedJobStepId, state.jobSteps]);

  async function loadProject(projectId: number) {
    setLoading(true);
    setError("");
    setDraft("");
    setPendingMessage(null);
    setStreamingMessage("");

    try {
      const response = await fetch(`/api/state?projectId=${projectId}`);
      setState(await parseResponse(response));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not load project.");
    } finally {
      setLoading(false);
    }
  }

  async function createProject() {
    setSaving(true);
    setError("");
    setDraft("");
    setPendingMessage(null);

    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Untitled research" })
      });
      setState(await parseResponse(response));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not create project.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteProject(projectId: number) {
    if (state.projects.length <= 1 || saving) return;

    setSaving(true);
    setError("");
    setDraft("");
    setPendingMessage(null);

    try {
      const response = await fetch("/api/projects", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId })
      });
      setState(await parseResponse(response));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not delete project.");
    } finally {
      setSaving(false);
      setProjectToDelete(null);
    }
  }

  async function sendMessage() {
    const message = draft.trim();
    if (!message || sending) return;

    setDraft("");
    setPendingMessage(message);
    setStreamingMessage("");
    setSending(true);
    setError("");

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: state.activeProjectId, message })
      });
      await readChatStream(response, {
        onDelta(delta) {
          setStreamingMessage((current) => `${current}${delta}`);
        },
        onDone(nextState) {
          setState(nextState);
        }
      });
      setPendingMessage(null);
      setStreamingMessage("");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not send message.");
      setDraft(message);
      setPendingMessage(null);
      setStreamingMessage("");
    } finally {
      setSending(false);
    }
  }

  async function updateSelections(nextSelections: Partial<Record<FieldKey, string>>) {
    setSaving(true);
    setError("");

    const optimistic = {
      ...state,
      selections: {
        ...state.selections,
        ...nextSelections
      }
    };
    setState(optimistic);

    try {
      const response = await fetch("/api/state", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: state.activeProjectId, selections: nextSelections })
      });
      setState(await parseResponse(response));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not save changes.");
    } finally {
      setSaving(false);
    }
  }

  async function resetChat() {
    setSaving(true);
    setError("");

    try {
      const response = await fetch("/api/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: state.activeProjectId })
      });
      setState(await parseResponse(response));
      setDraft("");
      setPendingMessage(null);
      setStreamingMessage("");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not reset chat.");
    } finally {
      setSaving(false);
    }
  }

  async function acceptSuggestion(suggestion: GeneratedOption) {
    const nextValue = isListFieldKey(suggestion.key)
      ? appendListFieldValue(state.selections[suggestion.key], suggestion.value)
      : suggestion.value;

    await updateSelections({ [suggestion.key]: nextValue });
  }

  function editField(key: FieldKey) {
    setFieldDrafts((current) => ({ ...current, [key]: state.selections[key] }));
    setExpandedFields((current) => ({ ...current, [key]: true }));
  }

  function cancelFieldEdit(key: FieldKey) {
    setFieldDrafts((current) => ({ ...current, [key]: state.selections[key] }));
    setExpandedFields((current) => ({ ...current, [key]: false }));
  }

  async function saveField(key: FieldKey) {
    const nextValue = normalizeFieldValue(key, fieldDrafts[key]);
    setFieldDrafts((current) => ({ ...current, [key]: nextValue }));
    await updateSelections({ [key]: nextValue });
    setExpandedFields((current) => ({ ...current, [key]: false }));
  }

  async function clearField(key: FieldKey) {
    setFieldDrafts((current) => ({ ...current, [key]: "" }));
    await updateSelections({ [key]: "" });
    setExpandedFields((current) => ({ ...current, [key]: false }));
  }

  function toggleStep(stepId: number) {
    setExpandedSteps((current) => ({ ...current, [stepId]: !current[stepId] }));
  }

  function addJobStep() {
    const nextId = -Date.now();
    setJobStepDrafts((current) => [
      ...current,
      {
        id: nextId,
        title: `Step ${current.length + 1}`,
        description: "",
        successMetrics: [],
        sortOrder: current.length
      }
    ]);
    setExpandedSteps((current) => ({ ...current, [nextId]: true }));
  }

  function updateJobStep(stepId: number, patch: Partial<JobStep>) {
    setJobStepDrafts((current) =>
      current.map((step) => (step.id === stepId ? { ...step, ...patch } : step))
    );
  }

  function removeJobStep(stepId: number) {
    setJobStepDrafts((current) => normalizeJobSteps(current.filter((step) => step.id !== stepId)));
  }

  function moveJobStep(stepId: number, direction: -1 | 1) {
    setJobStepDrafts((current) => {
      const index = current.findIndex((step) => step.id === stepId);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return current;
      const next = [...current];
      const [step] = next.splice(index, 1);
      next.splice(nextIndex, 0, step);
      return normalizeJobSteps(next);
    });
  }

  function addSuccessMetric(stepId: number) {
    setJobStepDrafts((current) =>
      current.map((step) =>
        step.id === stepId ? { ...step, successMetrics: [...step.successMetrics, ""] } : step
      )
    );
    setExpandedSteps((current) => ({ ...current, [stepId]: true }));
  }

  function updateSuccessMetric(stepId: number, metricIndex: number, value: string) {
    setJobStepDrafts((current) =>
      current.map((step) => {
        if (step.id !== stepId) return step;
        return {
          ...step,
          successMetrics: step.successMetrics.map((metric, index) => (index === metricIndex ? value : metric))
        };
      })
    );
  }

  function removeSuccessMetric(stepId: number, metricIndex: number) {
    setJobStepDrafts((current) =>
      current.map((step) => {
        if (step.id !== stepId) return step;
        return {
          ...step,
          successMetrics: step.successMetrics.filter((_metric, index) => index !== metricIndex)
        };
      })
    );
  }

  async function persistJobSteps(nextJobSteps: JobStep[], failureMessage = "Could not save job map.") {
    setSaving(true);
    setError("");
    setState((current) => ({ ...current, jobSteps: nextJobSteps }));

    try {
      const response = await fetch("/api/state", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: state.activeProjectId, jobSteps: nextJobSteps })
      });
      setState(await parseResponse(response));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : failureMessage);
    } finally {
      setSaving(false);
    }
  }

  async function saveJobMap() {
    await persistJobSteps(normalizeJobSteps(jobStepDrafts));
  }

  async function saveGeneratedJobSteps(generatedSteps: GeneratedJobStep[]) {
    if (generatedSteps.length === 0) return;

    const nextJobSteps = normalizeJobSteps(
      generatedSteps.map((step, index) => ({
        id: -(Date.now() + index),
        title: step.title,
        description: step.description,
        successMetrics: step.successMetrics,
        sortOrder: index
      }))
    );

    setJobStepDrafts(nextJobSteps);
    setExpandedSteps(Object.fromEntries(nextJobSteps.map((step, index) => [step.id, index === 0])));
    await persistJobSteps(nextJobSteps, "Could not save generated job map.");
  }

  function cancelJobMapEdit() {
    setJobStepDrafts(state.jobSteps.map(cloneJobStep));
    setExpandedSteps({});
  }

  async function clearJobMap() {
    setJobStepDrafts([]);
    setExpandedSteps({});
    setSaving(true);
    setError("");

    try {
      const response = await fetch("/api/state", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: state.activeProjectId, jobSteps: [] })
      });
      setState(await parseResponse(response));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not clear job map.");
    } finally {
      setSaving(false);
    }
  }

  function selectTemplate(template: PromptTemplate) {
    setActiveTemplateId(template.id);
    setTemplateDraft(templateToDraft(template));
  }

  function insertTemplate(template: PromptTemplate) {
    setDraft(renderPromptTemplate(template.content, state, { projectName: activeProject?.name, defaultN: template.defaultN, workflowStep: template.appliesTo !== "chat" ? template.appliesTo : activeWorkflowStep.key, jobStep: selectedJobStep }));
    setPromptLibraryOpen(false);
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

  async function createTemplate() {
    setSaving(true);
    setError("");

    try {
      const response = await fetch("/api/prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "New AI action",
          category: "Custom",
          content: "Use {{project_frame}} to help me think through this JTBD research project.",
          appliesTo: activeWorkflowStep.key,
          actionType: "generate",
          scopeRequired: activeWorkflowStep.scopeRequired || "none",
          isDefault: false,
          isPinned: false,
          defaultN: activeWorkflowStep.defaultN
        })
      });
      const payload = (await response.json()) as { activeTemplateId?: number; templates?: PromptTemplate[]; error?: string };
      if (!response.ok) throw new Error(payload.error || "Could not create prompt.");
      setTemplates(payload.templates || []);
      const nextTemplate = payload.templates?.find((template) => template.id === payload.activeTemplateId);
      if (nextTemplate) selectTemplate(nextTemplate);
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

    try {
      const response = await fetch("/api/prompts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: activeTemplateId, ...templateDraft })
      });
      const payload = (await response.json()) as { activeTemplateId?: number; templates?: PromptTemplate[]; error?: string };
      if (!response.ok) throw new Error(payload.error || "Could not save prompt.");
      setTemplates(payload.templates || []);
      const nextTemplate = payload.templates?.find((template) => template.id === activeTemplateId);
      if (nextTemplate) selectTemplate(nextTemplate);
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

    try {
      const response = await fetch("/api/prompts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: activeTemplateId })
      });
      const payload = (await response.json()) as { templates?: PromptTemplate[]; error?: string };
      if (!response.ok) throw new Error(payload.error || "Could not delete prompt.");
      const nextTemplates = payload.templates || [];
      setTemplates(nextTemplates);
      const nextTemplate = nextTemplates[0];
      if (nextTemplate) selectTemplate(nextTemplate);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not delete prompt.");
    } finally {
      setSaving(false);
      setPromptDeleteOpen(false);
    }
  }

  async function restoreBuiltins() {
    setSaving(true);
    setError("");

    try {
      const response = await fetch("/api/prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "restore_builtins" })
      });
      const payload = (await response.json()) as { templates?: PromptTemplate[]; error?: string };
      if (!response.ok) throw new Error(payload.error || "Could not restore prompts.");
      const nextTemplates = payload.templates || [];
      setTemplates(nextTemplates);
      const nextTemplate = nextTemplates[0];
      if (nextTemplate) selectTemplate(nextTemplate);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not restore prompts.");
    } finally {
      setSaving(false);
    }
  }

  function selectWorkflowStep(stepKey: WorkflowStepKey) {
    setActiveWorkflowStepKey(stepKey);
    setActionResult(null);
    setActionStreamingMessage("");
    setActionThinkingMessage(ACTION_THINKING_MESSAGES[0]);
    setError("");
  }

  function moveWorkflowStep(direction: -1 | 1) {
    const nextIndex = Math.min(workflowSteps.length - 1, Math.max(0, activeWorkflowIndex + direction));
    selectWorkflowStep(workflowSteps[nextIndex].key);
  }

  async function runGuidedAction() {
    if (!selectedActionTemplate || actionRunning || !state.activeProjectId) return;

    const thinkingIndex = (Date.now() + activeWorkflowIndex) % ACTION_THINKING_MESSAGES.length;
    setActionRunning(true);
    setActionResult(null);
    setActionStreamingMessage("");
    setActionThinkingMessage(ACTION_THINKING_MESSAGES[thinkingIndex]);
    setError("");

    try {
      const response = await fetch("/api/actions/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: state.activeProjectId,
          workflowStep: activeWorkflowStep.key,
          templateId: selectedActionTemplate.id,
          n: clampDefaultN(activeActionN),
          scope: activeWorkflowStep.scopeRequired === "job_step" && selectedJobStep ? { type: "job_step", id: selectedJobStep.id } : undefined,
          stream: true
        })
      });
      await readGuidedActionStream(response, {
        onStatus(message) {
          if (message) setActionThinkingMessage(message);
        },
        onDelta(delta) {
          setActionStreamingMessage((current) => `${current}${delta}`);
        },
        onDone(result) {
          setActionResult(result);
        }
      });
      setActionStreamingMessage("");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not run AI action.");
      setActionStreamingMessage("");
    } finally {
      setActionRunning(false);
    }
  }

  async function acceptGuidedCandidate(candidate: GeneratedOption) {
    await acceptSuggestion(candidate);
    if (!isListFieldKey(candidate.key)) {
      moveWorkflowStep(1);
    }
  }

  async function appendSuccessMetricsToStep(stepId: number, metrics: string[]) {
    const cleanedMetrics = metrics.map((metric) => metric.trim()).filter(Boolean);
    if (cleanedMetrics.length === 0) return;

    const nextJobSteps = state.jobSteps.map((step) => {
      if (step.id !== stepId) return step;
      const existing = new Set(step.successMetrics.map(normalizeComparableValue));
      const nextMetrics = [...step.successMetrics];

      for (const metric of cleanedMetrics) {
        const signature = normalizeComparableValue(metric);
        if (!existing.has(signature)) {
          existing.add(signature);
          nextMetrics.push(metric);
        }
      }

      return { ...step, successMetrics: nextMetrics };
    });

    setJobStepDrafts(nextJobSteps.map(cloneJobStep));
    await persistJobSteps(nextJobSteps, "Could not save success metrics.");
  }

  const starterPrompt =
    "Tell me what product or service you want to research, and who you think the user might be.";
  const starterExamples = [
    "Research a procurement analytics dashboard for mid-market distributors.",
    "Explore a tactical backpack for commuters who carry work and gym gear.",
    "Study a done-for-you bookkeeping service for small agency owners."
  ];
  const hasConversation = state.messages.length > 0 || Boolean(pendingMessage) || sending;

  function renderWorkflowCardContext(
    isSaved = activeWorkflowComplete,
    statusLabel = isSaved ? "Saved" : "Open",
    action?: ReactNode,
    detail = activeWorkflowStep.goal
  ) {
    return (
      <div className="workflow-card-context simplified">
        <div className="workflow-card-heading">
          <span className="workflow-step-label">Step {activeWorkflowIndex + 1} of {workflowSteps.length}</span>
          <h3>{activeWorkflowStep.label}</h3>
          <p>{detail}</p>
        </div>
        <div className="workflow-card-actions">
          <Badge variant={isSaved ? "default" : "secondary"}>{statusLabel}</Badge>
          {action}
        </div>
      </div>
    );
  }

  return (
    <main className="app-shell">
      <section className={projectsCollapsed ? "workbench projects-collapsed" : "workbench"} suppressHydrationWarning>
        <aside className="project-sidebar" aria-label="Projects">
          <div className="sidebar-brand brand">
            <div className="brand-mark" aria-hidden="true">
              <Sparkles size={20} />
            </div>
            <div>
              <h1>What to Build?</h1>
              <p>Find customer problems worth solving</p>
            </div>
          </div>
          <div className="project-sidebar-header">
            <div>
              <h2>Projects</h2>
              <p>{state.projects.length} saved</p>
            </div>
            <Button
              className="icon-button"
              type="button"
              title="Collapse projects"
              onClick={() => setProjectsCollapsed(true)}
            >
              <ChevronLeft data-icon="inline-start" />
            </Button>
          </div>
          <Button className="primary-button new-project-button" type="button" onClick={createProject} disabled={saving || sending}>
            <FolderPlus data-icon="inline-start" />
            New research
          </Button>
          <div className="project-list">
            {state.projects.map((project) => {
              const isActive = project.id === state.activeProjectId;
              return (
                <div className={`project-row ${isActive ? "active" : ""}`} key={project.id}>
                  <Button
                    className="project-open-button"
                    type="button"
                    onClick={() => void loadProject(project.id)}
                    disabled={loading || saving || sending || isActive}
                  >
                    <span className="project-name">{project.name}</span>
                    <span className="project-meta">{isActive ? `${completedFields}/${fieldKeys.length} fields` : "Open"}</span>
                  </Button>
                  <Button
                    className="project-delete-button"
                    type="button"
                    title={`Delete ${project.name}`}
                    onClick={() => setProjectToDelete({ id: project.id, name: project.name })}
                    disabled={saving || sending || state.projects.length <= 1}
                  >
                    <Trash2 data-icon="inline-start" />
                  </Button>
                </div>
              );
            })}
          </div>
        </aside>

        <Button
          className="project-rail"
          type="button"
          title="Expand projects"
          onClick={() => setProjectsCollapsed(false)}
        >
          <ChevronRight data-icon="inline-start" />
          <span>Projects</span>
        </Button>

        <div className="workspace">
          <Card className="pane workflow-pane">
            <Tabs className="workflow-tabs" defaultValue="workflow">
              <div className="pane-header workflow-header">
                <div>
                  <h2>Customer Outcome Mapping</h2>
                  <p>Map the outcomes customers care about most.</p>
                </div>
                <div className="workflow-header-actions">
                  <TabsList>
                    <TabsTrigger value="workflow">Workflow</TabsTrigger>
                    <TabsTrigger value="chat">Ask AI</TabsTrigger>
                  </TabsList>
                  <Button className="secondary-button" type="button" onClick={() => setPromptLibraryOpen(true)}>
                    <Library data-icon="inline-start" />
                    AI Actions
                  </Button>
                </div>
              </div>

              <TabsContent className="workflow-tab-content" value="workflow">
                <nav className="workflow-stepper" aria-label="JTBD workflow steps">
                  {workflowSteps.map((step, index) => {
                    const isActive = step.key === activeWorkflowStep.key;
                    const isComplete = isWorkflowStepComplete(step, state);

                    return (
                      <button
                        className={`workflow-step ${isActive ? "active" : ""} ${isComplete ? "complete" : ""}`}
                        type="button"
                        key={step.key}
                        onClick={() => selectWorkflowStep(step.key)}
                        aria-current={isActive ? "step" : undefined}
                      >
                        <span>{index + 1}</span>
                        <strong>{step.shortLabel}</strong>
                      </button>
                    );
                  })}
                </nav>

                <div className="workflow-content">
                  <section className="workflow-focus" aria-label={`${activeWorkflowStep.label} workflow`}>
                    {error ? (
                      <Alert className="workflow-alert" variant="destructive">
                        <AlertTriangle data-icon="inline-start" />
                        <AlertTitle>Something needs attention</AlertTitle>
                        <AlertDescription>{error}</AlertDescription>
                      </Alert>
                    ) : null}

                    {missingWorkflowRequirements.length > 0 ? (
                      <Alert className="workflow-alert">
                        <AlertTriangle data-icon="inline-start" />
                        <AlertTitle>Previous step needed</AlertTitle>
                        <AlertDescription>
                          Complete {missingWorkflowRequirements.map((key) => getWorkflowStep(key).label).join(", ")} first.
                        </AlertDescription>
                      </Alert>
                    ) : null}


                    <div className="workflow-desktop-grid">
                      <div className="workflow-artifact-column">

                    {isFieldStepKey(activeWorkflowStep.key) ? (() => {
                      const key = activeWorkflowStep.key;
                      const value = state.selections[key].trim();
                      const listItems = isListFieldKey(key) ? parseListFieldValue(value) : [];
                      const isComplete = isFieldComplete(key, value);
                      const isExpanded = Boolean(expandedFields[key]);

                      return (
                        <Card className={`workflow-saved-state field-card ${isComplete ? "complete" : "empty"} ${isExpanded ? "expanded" : "collapsed"}`}>
                          <CardHeader className="field-card-header workflow-saved-header combined">
                            {renderWorkflowCardContext(
                              isComplete,
                              isComplete ? "Saved" : "Not set",
                              <Button
                                className="field-icon-button"
                                type="button"
                                title={isExpanded ? `Collapse ${fieldLabels[key]}` : `${isComplete ? "Edit" : "Add"} ${fieldLabels[key]}`}
                                onClick={() => (isExpanded ? cancelFieldEdit(key) : editField(key))}
                              >
                                {isExpanded ? <ChevronDown data-icon="inline-start" /> : <Pencil data-icon="inline-start" />}
                              </Button>
                            )}
                          </CardHeader>
                          <CardContent className="field-card-content">
                            {isExpanded ? (
                              <div className="field-editor">
                                <Textarea
                                  id={`workflow-${key}`}
                                  value={fieldDrafts[key]}
                                  placeholder={placeholderFor(key)}
                                  onChange={(event) =>
                                    setFieldDrafts((current) => ({
                                      ...current,
                                      [key]: event.target.value
                                    }))
                                  }
                                />
                                <div className="field-editor-actions">
                                  <Button className="primary-button field-save-button" type="button" onClick={() => void saveField(key)} disabled={saving}>
                                    <Save data-icon="inline-start" />
                                    Save
                                  </Button>
                                  <Button className="secondary-button field-cancel-button" type="button" onClick={() => cancelFieldEdit(key)} disabled={saving}>
                                    <X data-icon="inline-start" />
                                    Cancel
                                  </Button>
                                  <Button className="field-clear-button" type="button" onClick={() => void clearField(key)} disabled={saving || !isComplete}>
                                    <Trash2 data-icon="inline-start" />
                                    Clear
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <button className={`field-preview ${isListFieldKey(key) && listItems.length > 0 ? "list-preview" : ""}`} type="button" onClick={() => editField(key)}>
                                {isListFieldKey(key) && listItems.length > 0 ? (
                                  <span className="field-list-preview">
                                    {listItems.map((item, index) => (
                                      <span className="field-list-item" key={`${key}-${index}`}>{item}</span>
                                    ))}
                                  </span>
                                ) : (
                                  value || placeholderFor(key)
                                )}
                              </button>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })() : null}

                    {activeWorkflowStep.key === "job_map" ? (
                      <div className="workflow-saved-state job-map-editor workflow-current-card">
                        {renderWorkflowCardContext(
                          jobStepDrafts.length > 0,
                          jobStepDrafts.length > 0 ? "Saved" : "Open",
                          <div className="job-map-toolbar inline-toolbar">
                            <Button className="secondary-button job-map-action" type="button" onClick={addJobStep} disabled={saving}>
                              <Plus data-icon="inline-start" />
                              Step
                            </Button>
                            {jobMapDirty ? (
                              <>
                                <Button className="primary-button job-map-action" type="button" onClick={() => void saveJobMap()} disabled={saving}>
                                  <Save data-icon="inline-start" />
                                  Save map
                                </Button>
                                <Button className="secondary-button job-map-action" type="button" onClick={cancelJobMapEdit} disabled={saving}>
                                  <X data-icon="inline-start" />
                                  Cancel
                                </Button>
                              </>
                            ) : null}
                            <Button className="field-clear-button job-map-action" type="button" onClick={() => void clearJobMap()} disabled={saving || (jobStepDrafts.length === 0 && state.jobSteps.length === 0)}>
                              <Trash2 data-icon="inline-start" />
                              Clear
                            </Button>
                          </div>,
                          `${jobStepDrafts.length} steps`
                        )}

                        {jobStepDrafts.length === 0 ? (
                          <div className="job-map-empty">
                            <p>No job steps mapped yet.</p>
                            <Button className="secondary-button job-map-action" type="button" onClick={addJobStep} disabled={saving}>
                              <Plus data-icon="inline-start" />
                              Add first step
                            </Button>
                          </div>
                        ) : (
                          <div className="job-step-list">
                            {jobStepDrafts.map((step, index) => {
                              const isStepExpanded = expandedSteps[step.id] ?? index === 0;
                              const stepDescription = step.description.trim();

                              return (
                                <Card className="job-step-card" key={step.id}>
                                  <button className="job-step-header" type="button" onClick={() => toggleStep(step.id)} aria-expanded={isStepExpanded}>
                                    <span className="job-step-number">{index + 1}</span>
                                    <span className="job-step-title-wrap">
                                      <strong>{step.title.trim() || `Step ${index + 1}`}</strong>
                                      <small>{stepDescription || "No description yet"}</small>
                                    </span>
                                    <ChevronDown data-icon="inline-start" className={isStepExpanded ? "section-chevron open" : "section-chevron"} />
                                  </button>

                                  {isStepExpanded ? (
                                    <div className="job-step-editor">
                                      <label>
                                        <span>Step name</span>
                                        <Input
                                          value={step.title}
                                          onChange={(event) => updateJobStep(step.id, { title: event.target.value })}
                                          placeholder="Example: Prepare for the day"
                                        />
                                      </label>
                                      <label>
                                        <span>Description</span>
                                        <Textarea
                                          value={step.description}
                                          onChange={(event) => updateJobStep(step.id, { description: event.target.value })}
                                          placeholder="What the user is trying to complete in this step"
                                        />
                                      </label>

                                      <div className="job-step-actions">
                                        <Button className="field-icon-button" type="button" title="Move step up" onClick={() => moveJobStep(step.id, -1)} disabled={saving || index === 0}>
                                          <ArrowUp data-icon="inline-start" />
                                        </Button>
                                        <Button className="field-icon-button" type="button" title="Move step down" onClick={() => moveJobStep(step.id, 1)} disabled={saving || index === jobStepDrafts.length - 1}>
                                          <ArrowDown data-icon="inline-start" />
                                        </Button>
                                        <Button className="field-clear-button" type="button" onClick={() => removeJobStep(step.id)} disabled={saving}>
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
                      </div>
                    ) : null}

                    {activeWorkflowStep.key === "success_metrics" ? (() => {
                      const step = jobStepDrafts.find((item) => item.id === selectedJobStep?.id) || jobStepDrafts[0];
                      if (!step) {
                        return (
                          <div className="workflow-empty-state workflow-current-card">
                            {renderWorkflowCardContext(false, "Open")}
                            <div className="workflow-empty-content">
                              <strong>No job step selected</strong>
                              <p>Map the job steps first, then generate or edit success metrics for each step.</p>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div className="workflow-saved-state metric-block workflow-metric-editor workflow-current-card">
                          {renderWorkflowCardContext(
                            step.successMetrics.some((metric) => metric.trim()),
                            step.successMetrics.some((metric) => metric.trim()) ? "Saved" : "Open",
                            <div className="inline-toolbar">
                              <Button className="field-icon-button" type="button" title="Add success metric" onClick={() => addSuccessMetric(step.id)} disabled={saving}>
                                <Plus data-icon="inline-start" />
                              </Button>
                              {jobMapDirty ? (
                                <>
                                  <Button className="primary-button job-map-action" type="button" onClick={() => void saveJobMap()} disabled={saving}>
                                    <Save data-icon="inline-start" />
                                    Save
                                  </Button>
                                  <Button className="secondary-button job-map-action" type="button" onClick={cancelJobMapEdit} disabled={saving}>
                                    <X data-icon="inline-start" />
                                    Cancel
                                  </Button>
                                </>
                              ) : null}
                            </div>,
                            `For: ${step.title}`
                          )}
                          {step.successMetrics.length === 0 ? (
                            <p className="metric-empty">No metrics saved for this step yet.</p>
                          ) : (
                            <div className="metric-list">
                              {step.successMetrics.map((metric, metricIndex) => (
                                <div className="metric-row" key={`${step.id}-${metricIndex}`}>
                                  <Input
                                    value={metric}
                                    onChange={(event) => updateSuccessMetric(step.id, metricIndex, event.target.value)}
                                    placeholder="Example: Finds essentials without searching"
                                  />
                                  <Button className="field-icon-button" type="button" title="Delete success metric" onClick={() => removeSuccessMetric(step.id, metricIndex)} disabled={saving}>
                                    <Trash2 data-icon="inline-start" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })() : null}
                      </div>

                      <aside className="workflow-ai-column" aria-label="AI action and generated candidates">
                        <div className="workflow-ai-panel">
                          <div className="workflow-ai-panel-header">
                            <div>
                              <span>AI action</span>
                              <h3>{selectedActionTemplate?.title || "No action assigned"}</h3>
                            </div>
                            <Badge variant={activeWorkflowComplete ? "default" : "secondary"}>
                              {activeWorkflowComplete ? "Using saved context" : "Needs context"}
                            </Badge>
                          </div>

                    <div className="workflow-controls">
                      <label>
                        <span>Action</span>
                        <select
                          value={selectedActionTemplate?.id || ""}
                          onChange={(event) =>
                            setSelectedActionTemplateIds((current) => ({
                              ...current,
                              [activeWorkflowStep.key]: Number(event.target.value)
                            }))
                          }
                          disabled={availableActionTemplates.length === 0 || actionRunning}
                        >
                          {availableActionTemplates.length === 0 ? <option value="">No action assigned</option> : null}
                          {availableActionTemplates.map((template) => (
                            <option value={template.id} key={template.id}>
                              {template.title}{template.isDefault ? " · default" : ""}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="workflow-n-field">
                        <span>N</span>
                        <Input
                          type="number"
                          min="1"
                          max="100"
                          value={activeActionN}
                          onChange={(event) => setActionN(clampDefaultN(event.target.value))}
                          disabled={actionRunning}
                        />
                      </label>

                      {activeWorkflowStep.scopeRequired === "job_step" ? (
                        <label className="workflow-scope-field">
                          <span>Job step</span>
                          <select
                            value={selectedJobStep?.id || ""}
                            onChange={(event) => setSelectedJobStepId(Number(event.target.value))}
                            disabled={state.jobSteps.length === 0 || actionRunning}
                          >
                            {state.jobSteps.length === 0 ? <option value="">No job steps</option> : null}
                            {state.jobSteps.map((step, index) => (
                              <option value={step.id} key={step.id}>
                                {index + 1}. {step.title}
                              </option>
                            ))}
                          </select>
                        </label>
                      ) : null}

                      <Button
                        className="primary-button workflow-run-button"
                        type="button"
                        onClick={() => void runGuidedAction()}
                        disabled={actionRunning || !selectedActionTemplate || missingWorkflowRequirements.length > 0 || (activeWorkflowStep.scopeRequired === "job_step" && !selectedJobStep)}
                      >
                        {actionRunning ? <Loader2 data-icon="inline-start" className="spin" /> : <Sparkles data-icon="inline-start" />}
                        {actionRunning ? "Generating" : actionResult?.workflowStep === activeWorkflowStep.key ? "Generate more" : "Generate suggestions"}
                      </Button>
                    </div>
                        </div>

                    {actionRunning ? (
                      <div className={`workflow-thinking ${actionStreamingMessage ? "has-stream" : ""}`} aria-label="Generating suggestions" aria-live="polite">
                        <div className="workflow-thinking-header">
                          <span className="workflow-thinking-status">
                            <Loader2 className="spin" />
                            AI is working
                          </span>
                          {actionStreamingMessage ? (
                            <Badge variant="secondary">Streaming</Badge>
                          ) : (
                            <span className="thinking-dots" aria-hidden="true">
                              <i />
                              <i />
                              <i />
                            </span>
                          )}
                        </div>
                        {actionStreamingMessage ? (
                          <p className="workflow-streamed-message">{actionStreamingMessage}</p>
                        ) : (
                          <>
                            <p className="workflow-thinking-copy">{actionThinkingMessage}</p>
                            <div className="workflow-thinking-lines" aria-hidden="true">
                              <Skeleton />
                              <Skeleton />
                            </div>
                          </>
                        )}
                      </div>
                    ) : null}


                    {actionResult?.workflowStep === activeWorkflowStep.key ? (
                      <div className="workflow-result">
                        <div className="workflow-response">
                          <span>{actionResult.templateTitle}</span>
                          <p>{actionResult.message}</p>
                        </div>

                        {guidedCandidates.length > 0 ? (
                          <div className="workflow-candidate-list">
                            {guidedCandidates.map((candidate, index) => {
                              const isSelected = isCandidateSaved(candidate, state.selections);
                              const candidateAction = candidateActionLabel(candidate.key, isSelected);
                              return (
                                <Card className={`suggestion ${candidate.recommended ? "recommended" : ""} ${isSelected ? "accepted" : ""}`} key={`guided-${candidate.key}-${index}-${candidate.value}`}>
                                  <div className="suggestion-body">
                                    <div className="suggestion-meta">
                                      <Badge variant={isSelected ? "default" : "secondary"}>{fieldLabels[candidate.key]}</Badge>
                                      <Badge variant="outline">{isSelected ? "Saved" : candidate.recommended ? "Recommended" : "Candidate"}</Badge>
                                    </div>
                                    <p>{candidate.value}</p>
                                    {candidate.rationale ? <p className="hint">{candidate.rationale}</p> : null}
                                  </div>
                                  <Button
                                    className="suggestion-accept"
                                    type="button"
                                    title={`${candidateAction} ${fieldLabels[candidate.key]}`}
                                    onClick={() => void acceptGuidedCandidate(candidate)}
                                    disabled={saving || isSelected}
                                    variant={isSelected ? "secondary" : candidate.recommended ? "default" : "outline"}
                                    size="sm"
                                  >
                                    <Check data-icon="inline-start" />
                                    {candidateAction}
                                  </Button>
                                </Card>
                              );
                            })}
                          </div>
                        ) : null}

                        {guidedJobSteps.length > 0 ? (
                          <div className="artifact-block generated-job-map workflow-artifact">
                            <div className="artifact-header">
                              <div>
                                <span>Generated job map</span>
                                <small>{guidedJobSteps.length} steps</small>
                              </div>
                              <Button className="secondary-button artifact-action" type="button" onClick={() => void saveGeneratedJobSteps(guidedJobSteps)} disabled={saving} size="sm">
                                <Save data-icon="inline-start" />
                                {state.jobSteps.length > 0 ? "Replace map" : "Use map"}
                              </Button>
                            </div>
                            <div className="generated-step-list">
                              {guidedJobSteps.map((step, index) => (
                                <div className="generated-step-card" key={`guided-step-${index}`}>
                                  <div className="generated-step-title">
                                    <span>{index + 1}</span>
                                    <strong>{step.title}</strong>
                                  </div>
                                  {step.description ? <p>{step.description}</p> : null}
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}

                        {guidedMetrics.length > 0 && selectedJobStep ? (
                          <div className="metric-suggestion-block">
                            <div className="artifact-header">
                              <div>
                                <span>Generated metrics</span>
                                <small>{selectedJobStep.title}</small>
                              </div>
                              <Button className="secondary-button artifact-action" type="button" onClick={() => void appendSuccessMetricsToStep(selectedJobStep.id, guidedMetrics)} disabled={saving} size="sm">
                                <Plus data-icon="inline-start" />
                                Add all
                              </Button>
                            </div>
                            <div className="metric-suggestion-list">
                              {guidedMetrics.map((metric, index) => (
                                <div className="metric-suggestion" key={`guided-metric-${index}`}>
                                  <span>{metric}</span>
                                  <Button className="field-icon-button" type="button" title="Add metric" onClick={() => void appendSuccessMetricsToStep(selectedJobStep.id, [metric])} disabled={saving}>
                                    <Plus data-icon="inline-start" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ) : !actionRunning ? (
                      <div className="workflow-result workflow-result-empty">
                        <div className="workflow-response">
                          <span>Candidate preview</span>
                          <p>Run the assigned action to generate options. Nothing is saved until you choose what to apply.</p>
                        </div>
                      </div>
                    ) : null}
                      </aside>
                    </div>

                    <div className="workflow-footer-actions">
                      <Button className="secondary-button" type="button" onClick={() => moveWorkflowStep(-1)} disabled={activeWorkflowIndex === 0}>
                        <ChevronLeft data-icon="inline-start" />
                        Back
                      </Button>
                      <Button className="secondary-button" type="button" onClick={() => moveWorkflowStep(1)} disabled={activeWorkflowIndex === workflowSteps.length - 1}>
                        Next
                        <ChevronRight data-icon="inline-end" />
                      </Button>
                    </div>
                  </section>
                </div>
              </TabsContent>

              <TabsContent className="chat-tab-content" value="chat">
                <div className="chat-toolbar">
                  <div>
                    <h3>Research chat</h3>
                    <p>Use this for open-ended exploration.</p>
                  </div>
                  <Button
                    className="icon-button"
                    type="button"
                    title="Reset chat"
                    onClick={resetChat}
                    disabled={saving || sending || !state.activeProjectId}
                  >
                    <MessageSquareX data-icon="inline-start" />
                  </Button>
                </div>

                <div className="messages" ref={messagesRef} aria-live="polite">
                  {loading ? (
                    <div className="chat-skeleton" aria-label="Loading workspace">
                      <Skeleton />
                      <Skeleton />
                      <Skeleton />
                    </div>
                  ) : !hasConversation ? (
                    <div className="chat-start-card">
                      <span className="section-kicker">Start the research</span>
                      <h3>Describe the product or service in one rough sentence.</h3>
                      <p>The assistant will turn it into candidate users, contexts, jobs, and saved JTBD fields.</p>
                      <div className="starter-grid">
                        {starterExamples.map((example) => (
                          <Button className="starter-card" type="button" key={example} onClick={() => setDraft(example)}>
                            {example}
                          </Button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <>
                      {state.messages.map((message) => {
                        const generatedCandidates = generatedCandidatesForMessage(message);
                        const recommendedCount = generatedCandidates.filter((candidate) => candidate.recommended).length;
                        const hasGeneratedJobSteps = message.generatedJobSteps.length > 0;

                        return (
                          <div className={`message ${message.role}`} key={message.id}>
                            <span className="message-label">{message.role === "assistant" ? "AI coach" : "You"}</span>
                            <div className="bubble">{message.content}</div>
                            {generatedCandidates.length > 0 ? (
                              <div className="suggestions candidate-stack">
                                <div className="candidate-stack-header">
                                  <div>
                                    <span>Generated candidates</span>
                                    <small>{recommendedCount > 0 ? `${recommendedCount} recommended · ` : ""}{generatedCandidates.length} total</small>
                                  </div>
                                </div>
                                {generatedCandidates.map((candidate, index) => {
                                  const isSelected = isCandidateSaved(candidate, state.selections);
                                  const candidateAction = candidateActionLabel(candidate.key, isSelected);
                                  return (
                                    <Card className={`suggestion ${candidate.recommended ? "recommended" : ""} ${isSelected ? "accepted" : ""}`} key={`${message.id}-${candidate.key}-${index}`}>
                                      <div className="suggestion-body">
                                        <div className="suggestion-meta">
                                          <Badge variant={isSelected ? "default" : "secondary"}>{fieldLabels[candidate.key]}</Badge>
                                          <Badge variant="outline">{isSelected ? "Saved" : candidate.recommended ? "Recommended" : "Option"}</Badge>
                                        </div>
                                        <p>{candidate.value}</p>
                                        {candidate.rationale ? <p className="hint">{candidate.rationale}</p> : null}
                                      </div>
                                      <Button
                                        className="suggestion-accept"
                                        type="button"
                                        title={`${candidateAction} ${fieldLabels[candidate.key]}`}
                                        onClick={() => void acceptSuggestion(candidate)}
                                        disabled={saving || isSelected}
                                        variant={isSelected ? "secondary" : candidate.recommended ? "default" : "outline"}
                                        size="sm"
                                      >
                                        <Check data-icon="inline-start" />
                                        {candidateAction}
                                      </Button>
                                    </Card>
                                  );
                                })}
                              </div>
                            ) : null}

                            {hasGeneratedJobSteps ? (
                              <div className="artifact-block generated-job-map">
                                <div className="artifact-header">
                                  <div>
                                    <span>Generated job map</span>
                                    <small>
                                      {message.generatedJobSteps.length} steps
                                      {countGeneratedMetrics(message.generatedJobSteps) > 0 ? ` · ${countGeneratedMetrics(message.generatedJobSteps)} metrics` : ""}
                                    </small>
                                  </div>
                                  <Button
                                    className="secondary-button artifact-action"
                                    type="button"
                                    onClick={() => void saveGeneratedJobSteps(message.generatedJobSteps)}
                                    disabled={saving}
                                    size="sm"
                                  >
                                    <Save data-icon="inline-start" />
                                    {state.jobSteps.length > 0 ? "Replace map" : "Use map"}
                                  </Button>
                                </div>
                                <div className="generated-step-list">
                                  {message.generatedJobSteps.map((step, index) => (
                                    <div className="generated-step-card" key={`${message.id}-generated-step-${index}`}>
                                      <div className="generated-step-title">
                                        <span>{index + 1}</span>
                                        <strong>{step.title}</strong>
                                      </div>
                                      {step.description ? <p>{step.description}</p> : null}
                                      {step.successMetrics.length > 0 ? (
                                        <ul>
                                          {step.successMetrics.map((metric, metricIndex) => (
                                            <li key={`${message.id}-generated-step-${index}-metric-${metricIndex}`}>{metric}</li>
                                          ))}
                                        </ul>
                                      ) : null}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                      {pendingMessage ? (
                        <div className="message user pending">
                          <span className="message-label">You</span>
                          <div className="bubble">{pendingMessage}</div>
                        </div>
                      ) : null}
                      {sending ? (
                        <div className="message assistant pending">
                          <span className="message-label">AI coach</span>
                          {streamingMessage ? (
                            <div className="bubble streaming-bubble">{streamingMessage}</div>
                          ) : (
                            <div className="bubble thinking-bubble">
                              <span>Working on the JTBD frame</span>
                              <span className="thinking-dots" aria-hidden="true">
                                <i />
                                <i />
                                <i />
                              </span>
                            </div>
                          )}
                        </div>
                      ) : null}
                    </>
                  )}
                </div>

                <div className="composer">
                  {error ? (
                    <Alert className="error-alert" variant="destructive">
                      <AlertTriangle data-icon="inline-start" />
                      <AlertTitle>Something needs attention</AlertTitle>
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  ) : null}
                  <div className="quick-prompts">
                    <div className="quick-prompt-list">
                      {quickTemplates.map((template) => (
                        <Button className="quick-prompt" type="button" key={template.id} onClick={() => insertTemplate(template)}>
                          {template.title}
                        </Button>
                      ))}
                    </div>
                    <Button className="secondary-button" type="button" onClick={() => setPromptLibraryOpen(true)}>
                      <Library data-icon="inline-start" />
                      AI Actions
                    </Button>
                  </div>
                  <Textarea
                    aria-label="Message"
                    placeholder={starterPrompt}
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                        void sendMessage();
                      }
                    }}
                  />
                  <div className="composer-actions">
                    <span className="hint">Press Ctrl/Command + Enter to send.</span>
                    <Button className="primary-button" type="button" onClick={sendMessage} disabled={sending || !draft.trim()}>
                      {sending ? <Loader2 data-icon="inline-start" className="spin" /> : <Send data-icon="inline-start" />}
                      Send
                    </Button>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </Card>

        </div>
      </section>

      <Sheet open={promptLibraryOpen} onOpenChange={setPromptLibraryOpen}>
        <SheetContent className="prompt-drawer" aria-label="AI Actions" showCloseButton={false}>
          <SheetHeader className="prompt-drawer-header">
            <div>
              <SheetTitle>AI Actions</SheetTitle>
              <SheetDescription>Workflow prompts assigned to JTBD variables and scopes.</SheetDescription>
            </div>
            <Button className="icon-button" type="button" title="Close AI Actions" onClick={() => setPromptLibraryOpen(false)}>
              <X data-icon="inline-start" />
            </Button>
          </SheetHeader>

            <div className="prompt-library-layout">
              <div className="prompt-template-list">
                <Button className="primary-button" type="button" onClick={createTemplate} disabled={saving}>
                  <Plus data-icon="inline-start" />
                  New action
                </Button>
                {templates.map((template) => (
                  <Button
                    className={`prompt-template-row ${template.id === activeTemplateId ? "active" : ""}`}
                    type="button"
                    key={template.id}
                    onClick={() => selectTemplate(template)}
                  >
                    <span>{template.title}</span>
                    <small>{template.appliesTo === "chat" ? "Chat" : getWorkflowStep(template.appliesTo).label}{template.isDefault ? " - default" : template.isPinned ? " - quick" : ""}</small>
                  </Button>
                ))}
              </div>

              <div className="prompt-editor">
                {activeTemplate ? (
                  <>
                    <div className="prompt-editor-grid">
                      <label>
                        <span>Title</span>
                        <Input
                          value={templateDraft.title}
                          onChange={(event) => setTemplateDraft((current) => ({ ...current, title: event.target.value }))}
                        />
                      </label>
                      <label>
                        <span>Category</span>
                        <Input
                          value={templateDraft.category}
                          onChange={(event) => setTemplateDraft((current) => ({ ...current, category: event.target.value }))}
                        />
                      </label>
                      <label>
                        <span>Workflow step</span>
                        <select
                          value={templateDraft.appliesTo}
                          onChange={(event) => {
                            const appliesTo = event.target.value as PromptAppliesTo;
                            setTemplateDraft((current) => ({
                              ...current,
                              appliesTo,
                              actionType: appliesTo === "chat" ? "chat" : current.actionType === "chat" ? "generate" : current.actionType,
                              scopeRequired: appliesTo === "success_metrics" ? "job_step" : current.scopeRequired,
                              isDefault: appliesTo === "chat" ? false : current.isDefault
                            }));
                          }}
                        >
                          <option value="chat">Chat / fallback</option>
                          {workflowSteps.map((step) => (
                            <option value={step.key} key={step.key}>{step.label}</option>
                          ))}
                        </select>
                      </label>
                      <label>
                        <span>Action type</span>
                        <select
                          value={templateDraft.actionType}
                          onChange={(event) => setTemplateDraft((current) => ({ ...current, actionType: event.target.value as PromptActionType }))}
                        >
                          <option value="generate">Generate</option>
                          <option value="refine">Refine</option>
                          <option value="challenge">Challenge</option>
                          <option value="audit">Audit</option>
                          <option value="chat">Chat</option>
                        </select>
                      </label>
                      <label>
                        <span>Scope</span>
                        <select
                          value={templateDraft.scopeRequired}
                          onChange={(event) => setTemplateDraft((current) => ({ ...current, scopeRequired: event.target.value as PromptScopeRequired }))}
                        >
                          <option value="none">None</option>
                          <option value="job_step">Job step</option>
                        </select>
                      </label>
                      <label className="default-n-field">
                        <span>Default n</span>
                        <Input
                          type="number"
                          min="1"
                          max="100"
                          value={templateDraft.defaultN}
                          onChange={(event) =>
                            setTemplateDraft((current) => ({ ...current, defaultN: clampDefaultN(event.target.value) }))
                          }
                        />
                      </label>
                    </div>

                    <div className="prompt-toggle-row">
                      <label className="pin-toggle">
                        <Switch
                          checked={templateDraft.isDefault}
                          disabled={templateDraft.appliesTo === "chat"}
                          onCheckedChange={(checked) => setTemplateDraft((current) => ({ ...current, isDefault: checked }))}
                        />
                        <span>Default for step</span>
                      </label>
                      <label className="pin-toggle">
                        <Switch
                          checked={templateDraft.isPinned}
                          onCheckedChange={(checked) => setTemplateDraft((current) => ({ ...current, isPinned: checked }))}
                        />
                        <span>Show as quick action</span>
                      </label>
                    </div>

                    <div className="variable-row" aria-label="Insert variables">
                      {promptVariableNames.map((variable) => (
                        <Button
                          className="variable-chip"
                          type="button"
                          key={variable}
                          onClick={() => insertTemplateVariable(variable)}
                          variant="outline"
                          size="sm"
                        >
                          {`{{${variable}}}`}
                        </Button>
                      ))}
                    </div>

                    <Tabs className="prompt-tabs" defaultValue="template">
                      <TabsList>
                        <TabsTrigger value="template">Template</TabsTrigger>
                        <TabsTrigger value="preview">Preview</TabsTrigger>
                      </TabsList>
                      <TabsContent value="template">
                        <label className="template-textarea-label">
                          <span>Template</span>
                          <Textarea
                            ref={templateTextareaRef}
                            value={templateDraft.content}
                            onChange={(event) => setTemplateDraft((current) => ({ ...current, content: event.target.value }))}
                          />
                        </label>
                        {unknownTemplateVariables.length > 0 ? (
                          <Alert variant="destructive">
                            <AlertTriangle data-icon="inline-start" />
                            <AlertTitle>Unknown variables</AlertTitle>
                            <AlertDescription>{unknownTemplateVariables.join(", ")}</AlertDescription>
                          </Alert>
                        ) : null}
                      </TabsContent>
                      <TabsContent value="preview">
                        <div className="prompt-preview">
                          <span>Rendered prompt</span>
                          <pre>{renderedTemplatePreview}</pre>
                        </div>
                      </TabsContent>
                    </Tabs>

                    <div className="prompt-editor-actions">
                      <Button className="primary-button" type="button" onClick={saveTemplate} disabled={saving}>
                        <Save data-icon="inline-start" />
                        Save
                      </Button>
                      <Button className="secondary-button" type="button" onClick={() => insertTemplate(activeTemplate)}>
                        <Send data-icon="inline-start" />
                        Insert in chat
                      </Button>
                      <Button className="secondary-button" type="button" onClick={restoreBuiltins} disabled={saving}>
                        Restore built-ins
                      </Button>
                      <Button className="project-delete-button" type="button" title="Delete AI action" onClick={() => setPromptDeleteOpen(true)} disabled={saving || templates.length <= 1}>
                        <Trash2 data-icon="inline-start" />
                      </Button>
                    </div>
                  </>
                ) : (
                  <p className="empty-state">No AI action selected.</p>
                )}
              </div>
            </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={Boolean(projectToDelete)} onOpenChange={(open) => !open && setProjectToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete project?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes {projectToDelete ? `"${projectToDelete.name}"` : "this project"}, including its chat history and selected JTBD fields.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={saving || !projectToDelete}
              variant="destructive"
              onClick={(event) => {
                event.preventDefault();
                if (projectToDelete) void deleteProject(projectToDelete.id);
              }}
            >
              Delete project
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={promptDeleteOpen} onOpenChange={setPromptDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete AI action?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes {activeTemplate ? `"${activeTemplate.title}"` : "this AI action"} from the library. Existing project history will stay saved.
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
              Delete action
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}

async function readGuidedActionStream(
  response: Response,
  handlers: { onStatus: (message: string) => void; onDelta: (delta: string) => void; onDone: (result: GuidedActionResult) => void }
) {
  const contentType = response.headers.get("Content-Type") || "";

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error || "Could not run AI action.");
  }

  if (!response.body || !contentType.includes("application/x-ndjson")) {
    const payload = (await response.json()) as GuidedActionResult & { error?: string };
    if (payload.error) throw new Error(payload.error);
    handlers.onDone(payload);
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  function handleLine(line: string) {
    if (!line.trim()) return;
    const event = JSON.parse(line) as { type?: string; message?: string; delta?: string; result?: GuidedActionResult; error?: string };

    if (event.type === "status") {
      handlers.onStatus(event.message || "");
      return;
    }

    if (event.type === "delta" && event.delta) {
      handlers.onDelta(event.delta);
      return;
    }

    if (event.type === "done" && event.result) {
      handlers.onDone(event.result);
      return;
    }

    if (event.type === "error") {
      throw new Error(event.error || "Could not run AI action.");
    }
  }

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) handleLine(line);
  }

  buffer += decoder.decode();
  if (buffer.trim()) handleLine(buffer);
}

async function readChatStream(
  response: Response,
  handlers: { onDelta: (delta: string) => void; onDone: (state: AppState) => void }
) {
  if (!response.ok || !response.body) {
    await parseResponse(response);
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  function handleLine(line: string) {
    if (!line.trim()) return;
    const event = JSON.parse(line) as { type?: string; delta?: string; state?: AppState; error?: string };

    if (event.type === "delta" && event.delta) {
      handlers.onDelta(event.delta);
      return;
    }

    if (event.type === "done" && event.state) {
      handlers.onDone(event.state);
      return;
    }

    if (event.type === "error") {
      throw new Error(event.error || "Could not send message.");
    }
  }

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) handleLine(line);
  }

  buffer += decoder.decode();
  if (buffer.trim()) handleLine(buffer);
}

function selectQuickTemplates(templates: PromptTemplate[], activeStepKey: WorkflowStepKey, completedFields: number) {
  const ordered = [
    ...templates.filter((template) => template.appliesTo === activeStepKey),
    ...templates.filter((template) => template.isPinned && template.appliesTo === "chat"),
    ...templates.filter((template) => template.isPinned),
    ...templates
  ];
  const seen = new Set<number>();

  return ordered
    .filter((template) => {
      if (seen.has(template.id)) return false;
      if (completedFields < fieldKeys.length && template.appliesTo === "chat" && !template.isPinned) return false;
      seen.add(template.id);
      return true;
    })
    .slice(0, 4);
}

function cloneJobStep(step: JobStep): JobStep {
  return {
    ...step,
    successMetrics: [...step.successMetrics]
  };
}

function normalizeJobSteps(steps: Array<Partial<JobStep>>): JobStep[] {
  return steps.map((step, index) => ({
    id: typeof step.id === "number" ? step.id : -(index + 1),
    title: step.title?.trim() || `Step ${index + 1}`,
    description: step.description?.trim() || "",
    successMetrics: Array.isArray(step.successMetrics)
      ? step.successMetrics.map((metric) => metric.trim()).filter(Boolean)
      : [],
    sortOrder: index,
    createdAt: step.createdAt,
    updatedAt: step.updatedAt
  }));
}


function countGeneratedMetrics(steps: GeneratedJobStep[]) {
  return steps.reduce((total, step) => total + step.successMetrics.filter((metric) => metric.trim()).length, 0);
}

function optionSignature(option: GeneratedOption) {
  return `${option.key}:${option.value.trim().toLowerCase()}`;
}

function normalizeComparableValue(value: string) {
  return value.trim().toLowerCase();
}

function normalizeFieldValue(key: FieldKey, value: string) {
  return isListFieldKey(key) ? formatListFieldValue(parseListFieldValue(value)) : value.trim();
}

function isFieldComplete(key: FieldKey, value: string) {
  return isListFieldKey(key) ? parseListFieldValue(value).length > 0 : value.trim().length > 0;
}

function appendListFieldValue(currentValue: string, nextValue: string) {
  const items = parseListFieldValue(currentValue);
  const seen = new Set(items.map(normalizeComparableValue));

  for (const item of parseListFieldValue(nextValue)) {
    const signature = normalizeComparableValue(item);
    if (!seen.has(signature)) {
      seen.add(signature);
      items.push(item);
    }
  }

  return formatListFieldValue(items);
}

function isCandidateSaved(candidate: GeneratedOption, selections: Record<FieldKey, string>) {
  if (!isListFieldKey(candidate.key)) {
    return normalizeComparableValue(selections[candidate.key]) === normalizeComparableValue(candidate.value);
  }

  const currentItems = new Set(parseListFieldValue(selections[candidate.key]).map(normalizeComparableValue));
  const candidateItems = parseListFieldValue(candidate.value);
  return candidateItems.length > 0 && candidateItems.every((item) => currentItems.has(normalizeComparableValue(item)));
}

function candidateActionLabel(key: FieldKey, isSelected: boolean) {
  if (isSelected) return "Saved";
  return isListFieldKey(key) ? "Add" : "Save";
}

function generatedCandidatesForMessage(message: AppState["messages"][number]): GeneratedCandidate[] {
  const candidates: GeneratedCandidate[] = [];
  const seen = new Set<string>();

  function addCandidate(option: GeneratedOption, recommended: boolean) {
    const signature = optionSignature(option);
    if (seen.has(signature)) return;
    seen.add(signature);
    candidates.push({ ...option, recommended });
  }

  message.suggestions.forEach((suggestion) => addCandidate(suggestion, true));
  message.options.forEach((option) => addCandidate(option, false));

  return candidates;
}

function generatedCandidatesForActionResult(result: GuidedActionResult, step: WorkflowStep): GeneratedCandidate[] {
  if (!isFieldStepKey(step.key)) return [];

  const candidates: GeneratedCandidate[] = [];
  const seen = new Set<string>();

  function addCandidate(option: GeneratedOption, recommended: boolean) {
    if (option.key !== step.key) return;
    const signature = optionSignature(option);
    if (seen.has(signature)) return;
    seen.add(signature);
    candidates.push({ ...option, recommended });
  }

  result.suggestions.forEach((suggestion) => addCandidate(suggestion, true));
  result.options.forEach((option) => addCandidate(option, false));

  return candidates;
}

function metricsForActionResult(result: GuidedActionResult) {
  const metrics = result.jobSteps.flatMap((step) => step.successMetrics).map((metric) => metric.trim()).filter(Boolean);
  const seen = new Set<string>();
  return metrics.filter((metric) => {
    const signature = normalizeComparableValue(metric);
    if (seen.has(signature)) return false;
    seen.add(signature);
    return true;
  });
}

function placeholderFor(key: FieldKey) {
  switch (key) {
    case "product":
      return "Example: procurement analytics dashboard";
    case "end_user":
      return "Example: operations managers at mid-market distributors";
    case "context":
      return "Example: when supplier delays threaten customer orders";
    case "job":
      return "Example: keep customer commitments despite supply uncertainty";
    case "emotional_job":
      return "Example:\nFeel confident making the decision\nAvoid anxiety about missing something important";
    case "social_job":
      return "Example:\nLook organized and capable\nAvoid seeming unprepared to the team";
    case "complexity_factors":
      return "Example:\nSupplier variability\nTime pressure\nUnclear tradeoffs";
  }
}
