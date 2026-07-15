import fs from "node:fs";
import {
  normalizeIdealStateDraft,
  normalizeThemeDraft,
  normalizeThemeIds,
  normalizeThemeTitle,
  successMetricText
} from "@/lib/artifact-normalizers";
import {
  createEmptySelections,
  fieldKeys,
  type AppState,
  type FieldKey,
  type IdealState,
  type JobStep,
  type Project,
  type SuccessMetric,
  type Theme,
  type WorkbenchDocument
} from "@/lib/types";
import {
  appendEvent,
  documentPath,
  ensureStoreDirs,
  now,
  projectDir,
  projectsDir,
  readJsonFile,
  writeJsonFile
} from "@/lib/document-store/files";
import {
  normalizeAgentMessageArtifacts,
  normalizeAgentPatchSetArtifacts,
  refreshPendingPatchSetStatus
} from "@/lib/document-store/agent-artifacts";

type ArtifactNormalizeOptions = {
  preservePositiveIds?: boolean;
  touchUpdatedAt?: boolean;
};

type JobStepInput = Partial<Omit<JobStep, "successMetrics">> & {
  successMetrics?: unknown;
};

type IdealStateInput = Partial<Omit<IdealState, "blockers" | "themeIds">> & {
  blockers?: unknown;
  themeIds?: unknown;
};

type ThemeInput = Partial<Theme>;

function collectMetricIds(steps: Array<Partial<JobStep> | JobStepInput>) {
  return steps.flatMap((step) =>
    Array.isArray(step.successMetrics)
      ? step.successMetrics
          .map((metric) => (metric && typeof metric === "object" && "id" in metric ? metric.id : null))
          .filter((id): id is number => typeof id === "number" && id > 0)
      : []
  );
}

function normalizeJobSteps(
  steps: JobStepInput[],
  doc: WorkbenchDocument,
  options: ArtifactNormalizeOptions = {}
): JobStep[] {
  const existingIds = new Set(doc.jobSteps.map((step) => step.id));
  const existingMetricIds = new Set(collectMetricIds(doc.jobSteps));
  const positiveStepIds = steps
    .map((step) => step.id)
    .filter((id): id is number => typeof id === "number" && id > 0);
  const positiveMetricIds = collectMetricIds(steps);
  const usedIds = new Set<number>();
  const usedMetricIds = new Set<number>();
  const validThemeIds = new Set(doc.themes.map((theme) => theme.id));
  let nextId = Math.max(
    doc.counters.nextJobStepId,
    1 + Math.max(0, ...doc.jobSteps.map((step) => step.id), ...positiveStepIds)
  );
  let nextMetricId = Math.max(doc.counters.nextSuccessMetricId, 1 + Math.max(0, ...collectMetricIds(doc.jobSteps), ...positiveMetricIds));

  function normalizeSuccessMetrics(metrics: unknown, existingStep: JobStep | undefined): SuccessMetric[] {
    if (!Array.isArray(metrics)) return [];

    return metrics
      .flatMap((metric, metricIndex): SuccessMetric[] => {
        const text = successMetricText(metric);
        if (!text) return [];

        const requestedId =
          metric && typeof metric === "object" && "id" in metric && typeof metric.id === "number"
            ? metric.id
            : null;
        const canKeepMetricId =
          typeof requestedId === "number" &&
          requestedId > 0 &&
          !usedMetricIds.has(requestedId) &&
          (options.preservePositiveIds || existingMetricIds.has(requestedId));

        while (usedMetricIds.has(nextMetricId)) nextMetricId += 1;

        const id = canKeepMetricId ? requestedId : nextMetricId++;
        usedMetricIds.add(id);
        const existingMetric = existingStep?.successMetrics.find((item) => item.id === id);
        const draft = metric && typeof metric === "object" && !Array.isArray(metric) ? (metric as Partial<SuccessMetric>) : {};

        return [{
          id,
          text,
          themeIds: normalizeThemeIds(draft.themeIds, validThemeIds),
          createdAt: draft.createdAt || existingMetric?.createdAt || now(),
          updatedAt: options.touchUpdatedAt ? now() : draft.updatedAt || existingMetric?.updatedAt || now()
        }];
      });
  }

  return steps.map((step, index) => {
    const requestedId = typeof step.id === "number" ? step.id : null;
    const canKeepId =
      typeof requestedId === "number" &&
      requestedId > 0 &&
      !usedIds.has(requestedId) &&
      (options.preservePositiveIds || existingIds.has(requestedId));

    while (usedIds.has(nextId)) nextId += 1;

    const id = canKeepId ? requestedId : nextId++;
    usedIds.add(id);
    const existing = doc.jobSteps.find((item) => item.id === id);

    return {
      id,
      title: step.title?.trim() || `Step ${index + 1}`,
      description: step.description?.trim() || "",
      successMetrics: normalizeSuccessMetrics(step.successMetrics, existing),
      sortOrder: index,
      createdAt: step.createdAt || existing?.createdAt || now(),
      updatedAt: options.touchUpdatedAt ? now() : step.updatedAt || existing?.updatedAt || now()
    };
  });
}

function normalizeThemes(
  themes: ThemeInput[],
  doc: WorkbenchDocument,
  options: ArtifactNormalizeOptions = {}
): Theme[] {
  const existingIds = new Set(doc.themes.map((theme) => theme.id));
  const positiveThemeIds = themes
    .map((theme) => theme.id)
    .filter((id): id is number => typeof id === "number" && id > 0);
  const usedIds = new Set<number>();
  const usedTitles = new Set<string>();
  let nextId = Math.max(
    doc.counters.nextThemeId,
    1 + Math.max(0, ...doc.themes.map((theme) => theme.id), ...positiveThemeIds)
  );

  return themes
    .flatMap((theme, index): Theme[] => {
      const draft = normalizeThemeDraft(theme, `Theme ${index + 1}`, index);
      const titleSignature = normalizeThemeTitle(draft.title).toLowerCase();
      if (!titleSignature || usedTitles.has(titleSignature)) return [];
      usedTitles.add(titleSignature);

      const requestedId = typeof theme.id === "number" ? theme.id : null;
      const canKeepId =
        typeof requestedId === "number" &&
        requestedId > 0 &&
        !usedIds.has(requestedId) &&
        (options.preservePositiveIds || existingIds.has(requestedId));

      while (usedIds.has(nextId)) nextId += 1;

      const id = canKeepId ? requestedId : nextId++;
      usedIds.add(id);
      const existing = doc.themes.find((item) => item.id === id);

      return [{
        id,
        title: draft.title,
        description: draft.description,
        color: draft.color || "#59636e",
        sortOrder: index,
        createdAt: theme.createdAt || existing?.createdAt || now(),
        updatedAt: options.touchUpdatedAt ? now() : theme.updatedAt || existing?.updatedAt || now()
      }];
    })
    .map((theme, index) => ({ ...theme, sortOrder: index }));
}

function normalizeIdealStates(
  idealStates: IdealStateInput[],
  doc: WorkbenchDocument,
  options: ArtifactNormalizeOptions = {}
): IdealState[] {
  const existingIds = new Set(doc.idealStates.map((idealState) => idealState.id));
  const validThemeIds = new Set(doc.themes.map((theme) => theme.id));
  const positiveIdealStateIds = idealStates
    .map((idealState) => idealState.id)
    .filter((id): id is number => typeof id === "number" && id > 0);
  const usedIds = new Set<number>();
  let nextId = Math.max(
    doc.counters.nextIdealStateId,
    1 + Math.max(0, ...doc.idealStates.map((idealState) => idealState.id), ...positiveIdealStateIds)
  );

  return idealStates.map((idealState, index) => {
    const requestedId = typeof idealState.id === "number" ? idealState.id : null;
    const canKeepId =
      typeof requestedId === "number" &&
      requestedId > 0 &&
      !usedIds.has(requestedId) &&
      (options.preservePositiveIds || existingIds.has(requestedId));

    while (usedIds.has(nextId)) nextId += 1;

    const id = canKeepId ? requestedId : nextId++;
    usedIds.add(id);
    const existing = doc.idealStates.find((item) => item.id === id);
    const draft = normalizeIdealStateDraft(idealState, `Ideal ${index + 1}`);

    return {
      id,
      ...draft,
      themeIds: normalizeThemeIds(idealState.themeIds, validThemeIds),
      sortOrder: index,
      createdAt: idealState.createdAt || existing?.createdAt || now(),
      updatedAt: options.touchUpdatedAt ? now() : idealState.updatedAt || existing?.updatedAt || now()
    };
  });
}

function normalizeDocument(
  raw: Partial<WorkbenchDocument> | null,
  fallbackProject?: Partial<Project>
): WorkbenchDocument {
  const timestamp = now();
  const projectId = typeof raw?.project?.id === "number" ? raw.project.id : fallbackProject?.id || 1;
  const projectCreatedAt = raw?.project?.createdAt || fallbackProject?.createdAt || timestamp;
  const projectUpdatedAt = raw?.project?.updatedAt || fallbackProject?.updatedAt || timestamp;
  const selections = { ...createEmptySelections(), ...(raw?.selections || {}) };
  const agentMessages = Array.isArray(raw?.agentMessages) ? raw.agentMessages.map(normalizeAgentMessageArtifacts) : [];

  const doc: WorkbenchDocument = {
    version: 1,
    project: {
      id: projectId,
      name: raw?.project?.name?.trim() || fallbackProject?.name?.trim() || "Untitled research",
      createdAt: projectCreatedAt,
      updatedAt: projectUpdatedAt,
      openaiConversationId: raw?.project?.openaiConversationId || null
    },
    selections,
    themes: [],
    jobSteps: [],
    idealStates: [],
    agentMessages,
    pendingPatchSet: normalizeAgentPatchSetArtifacts(raw?.pendingPatchSet),
    counters: {
      nextAgentMessageId: Math.max(
        raw?.counters?.nextAgentMessageId || 1,
        1 + Math.max(0, ...agentMessages.map((message) => message.id || 0))
      ),
      nextJobStepId: raw?.counters?.nextJobStepId || 1,
      nextSuccessMetricId: raw?.counters?.nextSuccessMetricId || 1,
      nextThemeId: raw?.counters?.nextThemeId || 1,
      nextIdealStateId: raw?.counters?.nextIdealStateId || 1,
      nextPatchSetId: raw?.counters?.nextPatchSetId || 1
    }
  };

  doc.themes = normalizeThemes(Array.isArray(raw?.themes) ? raw.themes : [], doc, {
    preservePositiveIds: true
  });
  doc.jobSteps = normalizeJobSteps(Array.isArray(raw?.jobSteps) ? raw.jobSteps : [], doc, {
    preservePositiveIds: true
  });
  doc.idealStates = normalizeIdealStates(Array.isArray(raw?.idealStates) ? raw.idealStates : [], doc, {
    preservePositiveIds: true
  });
  doc.counters.nextJobStepId = Math.max(
    doc.counters.nextJobStepId,
    1 + Math.max(0, ...doc.jobSteps.map((step) => step.id))
  );
  doc.counters.nextSuccessMetricId = Math.max(
    doc.counters.nextSuccessMetricId,
    1 + Math.max(0, ...collectMetricIds(doc.jobSteps))
  );
  doc.counters.nextThemeId = Math.max(
    doc.counters.nextThemeId,
    1 + Math.max(0, ...doc.themes.map((theme) => theme.id))
  );
  doc.counters.nextIdealStateId = Math.max(
    doc.counters.nextIdealStateId,
    1 + Math.max(0, ...doc.idealStates.map((idealState) => idealState.id))
  );
  refreshPendingPatchSetStatus(doc);

  return doc;
}

function loadDocument(projectId: number) {
  ensureStoreDirs();
  const path = documentPath(projectId);
  const doc = normalizeDocument(readJsonFile<WorkbenchDocument>(documentPath(projectId)), { id: projectId });
  if (!fs.existsSync(path)) saveDocument(doc);
  return doc;
}

function saveDocument(doc: WorkbenchDocument) {
  doc.version = 1;
  doc.project.updatedAt = now();
  doc.themes = doc.themes.map((theme, index) => ({ ...theme, sortOrder: index }));
  doc.jobSteps = doc.jobSteps.map((step, index) => ({ ...step, sortOrder: index }));
  doc.idealStates = doc.idealStates.map((idealState, index) => ({ ...idealState, sortOrder: index }));
  const validThemeIds = new Set(doc.themes.map((theme) => theme.id));
  doc.jobSteps = doc.jobSteps.map((step) => ({
    ...step,
    successMetrics: step.successMetrics.map((metric) => ({
      ...metric,
      themeIds: normalizeThemeIds(metric.themeIds, validThemeIds)
    }))
  }));
  doc.idealStates = doc.idealStates.map((idealState) => ({
    ...idealState,
    themeIds: normalizeThemeIds(idealState.themeIds, validThemeIds)
  }));
  doc.counters.nextAgentMessageId = Math.max(
    doc.counters.nextAgentMessageId,
    1 + Math.max(0, ...doc.agentMessages.map((message) => message.id || 0))
  );
  doc.counters.nextJobStepId = Math.max(
    doc.counters.nextJobStepId,
    1 + Math.max(0, ...doc.jobSteps.map((step) => step.id))
  );
  doc.counters.nextSuccessMetricId = Math.max(
    doc.counters.nextSuccessMetricId,
    1 + Math.max(0, ...collectMetricIds(doc.jobSteps))
  );
  doc.counters.nextThemeId = Math.max(
    doc.counters.nextThemeId,
    1 + Math.max(0, ...doc.themes.map((theme) => theme.id))
  );
  doc.counters.nextIdealStateId = Math.max(
    doc.counters.nextIdealStateId,
    1 + Math.max(0, ...doc.idealStates.map((idealState) => idealState.id))
  );
  writeJsonFile(documentPath(doc.project.id), doc);
}

function listDocuments() {
  ensureStoreDirs();
  const projectIds = fs
    .readdirSync(projectsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && Number.isInteger(Number(entry.name)))
    .map((entry) => Number(entry.name))
    .sort((left, right) => left - right);

  return projectIds.map((projectId) => loadDocument(projectId));
}

function ensureAtLeastOneProject() {
  const documents = listDocuments();
  if (documents.length > 0) return documents;

  const projectId = createProject("Untitled research");
  return [loadDocument(projectId)];
}

function listProjects() {
  return ensureAtLeastOneProject()
    .map((doc) => doc.project)
    .sort((left, right) => {
      const byUpdated = right.updatedAt.localeCompare(left.updatedAt);
      return byUpdated || right.id - left.id;
    });
}

function toAppState(activeDocument: WorkbenchDocument): AppState {
  return {
    activeProjectId: activeDocument.project.id,
    projects: listProjects(),
    selections: activeDocument.selections,
    themes: activeDocument.themes,
    jobSteps: activeDocument.jobSteps,
    idealStates: activeDocument.idealStates,
    agentMessages: activeDocument.agentMessages,
    pendingPatchSet: activeDocument.pendingPatchSet
  };
}

function createProject(name?: string) {
  ensureStoreDirs();
  const existingIds = listDocuments().map((doc) => doc.project.id);
  const projectId = Math.max(0, ...existingIds) + 1;
  const timestamp = now();
  const doc = normalizeDocument(null, {
    id: projectId,
    name: name?.trim() || "Untitled research",
    createdAt: timestamp,
    updatedAt: timestamp
  });

  saveDocument(doc);
  appendEvent(projectId, "project.created", { name: doc.project.name });
  return projectId;
}

function resolveProjectId(projectId?: number | null) {
  const projects = listProjects();
  if (projectId && projects.some((project) => project.id === projectId)) return projectId;
  if (projects[0]) return projects[0].id;
  return createProject();
}

function getState(projectId?: number | null) {
  return toAppState(loadDocument(resolveProjectId(projectId)));
}

function renameProject(projectId: number, name: string) {
  const doc = loadDocument(projectId);
  doc.project.name = name.trim() || "Untitled research";
  saveDocument(doc);
}

function saveSelections(projectId: number, selections: Partial<Record<FieldKey, string>>) {
  const doc = loadDocument(projectId);

  for (const key of fieldKeys) {
    if (typeof selections[key] === "string") {
      doc.selections[key] = selections[key]?.trim() || "";
    }
  }

  if (typeof selections.product === "string" && selections.product.trim()) {
    doc.project.name = selections.product.trim();
  }

  saveDocument(doc);
  appendEvent(projectId, "selections.saved", selections);
}

function saveThemes(projectId: number, themes: ThemeInput[]) {
  const doc = loadDocument(projectId);
  doc.themes = normalizeThemes(themes, doc, { touchUpdatedAt: true });
  doc.jobSteps = normalizeJobSteps(doc.jobSteps, doc, { preservePositiveIds: true });
  doc.idealStates = normalizeIdealStates(doc.idealStates, doc, { preservePositiveIds: true });
  refreshPendingPatchSetStatus(doc);
  saveDocument(doc);
  appendEvent(projectId, "themes.saved", { count: doc.themes.length });
}

function saveJobSteps(projectId: number, steps: JobStepInput[]) {
  const doc = loadDocument(projectId);
  doc.jobSteps = normalizeJobSteps(steps, doc, { touchUpdatedAt: true });
  saveDocument(doc);
  appendEvent(projectId, "job_steps.saved", { count: doc.jobSteps.length });
}

function saveIdealStates(projectId: number, idealStates: IdealStateInput[]) {
  const doc = loadDocument(projectId);
  doc.idealStates = normalizeIdealStates(idealStates, doc, { touchUpdatedAt: true });
  refreshPendingPatchSetStatus(doc);
  saveDocument(doc);
  appendEvent(projectId, "ideal_states.saved", { count: doc.idealStates.length });
}

function getOpenAIConversationId(projectId: number) {
  return loadDocument(projectId).project.openaiConversationId || null;
}

function saveOpenAIConversationId(projectId: number, conversationId: string) {
  const doc = loadDocument(projectId);
  doc.project.openaiConversationId = conversationId;
  saveDocument(doc);
}

function deleteProject(projectId: number) {
  const projects = listProjects();
  if (projects.length <= 1) throw new Error("Cannot delete the last project.");

  const nextProject = projects.find((project) => project.id !== projectId);
  if (!nextProject) throw new Error("No replacement project is available.");

  fs.rmSync(projectDir(projectId), { recursive: true, force: true });
  return nextProject.id;
}

export {
  createProject,
  deleteProject,
  getOpenAIConversationId,
  getState,
  listProjects,
  loadDocument,
  renameProject,
  resolveProjectId,
  saveDocument,
  saveIdealStates,
  saveJobSteps,
  saveOpenAIConversationId,
  saveSelections,
  saveThemes,
  toAppState
};
