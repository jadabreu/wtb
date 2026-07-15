import { defaultPromptTemplates } from "@/lib/default-prompts";
import {
  fieldKeys,
  type PromptActionType,
  type PromptAppliesTo,
  type PromptScopeRequired,
  type PromptTemplate
} from "@/lib/types";
import {
  ensureStoreDirs,
  now,
  promptTemplatesPath,
  readJsonFile,
  writeJsonFile
} from "@/lib/document-store/files";

type PromptTemplateInput = Partial<
  Pick<
    PromptTemplate,
    "title" | "content" | "category" | "appliesTo" | "actionType" | "scopeRequired" | "isDefault" | "isPinned" | "defaultN"
  >
>;

function promptSeedToTemplate(seed: (typeof defaultPromptTemplates)[number], index: number): PromptTemplate {
  const timestamp = now();
  return {
    id: index + 1,
    title: seed.title,
    content: seed.content,
    category: seed.category,
    appliesTo: seed.appliesTo,
    actionType: seed.actionType,
    scopeRequired: seed.scopeRequired,
    isDefault: seed.isDefault,
    isPinned: seed.isPinned,
    isBuiltin: true,
    defaultN: seed.defaultN,
    sortOrder: seed.sortOrder,
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

function loadPromptTemplateFile() {
  ensureStoreDirs();
  const templates = readJsonFile<PromptTemplate[]>(promptTemplatesPath);
  if (templates && templates.length > 0) return templates;

  const seeded = defaultPromptTemplates.map(promptSeedToTemplate);
  writeJsonFile(promptTemplatesPath, seeded);
  return seeded;
}

function savePromptTemplateFile(templates: PromptTemplate[]) {
  writeJsonFile(promptTemplatesPath, templates);
}

function listPromptTemplates() {
  return loadPromptTemplateFile().sort((left, right) => left.sortOrder - right.sortOrder || left.id - right.id);
}

function getPromptTemplate(id: number) {
  return listPromptTemplates().find((template) => template.id === id) || null;
}

function getDefaultPromptTemplate(appliesTo: PromptAppliesTo) {
  return listPromptTemplates().find((template) => template.appliesTo === appliesTo && template.isDefault) || null;
}

function normalizePromptAppliesTo(value: unknown): PromptAppliesTo {
  return typeof value === "string" && (fieldKeys as string[]).concat(["job_map", "success_metrics", "ideals", "blockers", "chat"]).includes(value)
    ? (value as PromptAppliesTo)
    : "chat";
}

function normalizePromptActionType(value: unknown): PromptActionType {
  return typeof value === "string" && ["generate", "refine", "challenge", "audit", "chat"].includes(value)
    ? (value as PromptActionType)
    : "chat";
}

function normalizePromptScopeRequired(value: unknown, fallback: PromptScopeRequired): PromptScopeRequired {
  return typeof value === "string" && ["none", "job_step", "ideal_state"].includes(value)
    ? (value as PromptScopeRequired)
    : fallback;
}

function defaultScopeFor(appliesTo: PromptAppliesTo): PromptScopeRequired {
  if (appliesTo === "success_metrics") return "job_step";
  if (appliesTo === "blockers") return "ideal_state";
  return "none";
}

function ensureSingleDefault(templates: PromptTemplate[], appliesTo: PromptAppliesTo, defaultId: number) {
  return templates.map((template) =>
    template.appliesTo === appliesTo && template.id !== defaultId ? { ...template, isDefault: false, updatedAt: now() } : template
  );
}

function createPromptTemplate(input: PromptTemplateInput) {
  const templates = listPromptTemplates();
  const id = Math.max(0, ...templates.map((template) => template.id)) + 1;
  const timestamp = now();
  const appliesTo = normalizePromptAppliesTo(input.appliesTo || "product");
  const actionType = normalizePromptActionType(input.actionType || "generate");
  const scopeRequired = normalizePromptScopeRequired(input.scopeRequired, defaultScopeFor(appliesTo));
  const template: PromptTemplate = {
    id,
    title: input.title?.trim() || "New prompt",
    content: input.content?.trim() || "Use {{project_frame}} to help me improve this JTBD research project.",
    category: input.category?.trim() || "Custom",
    appliesTo,
    actionType,
    scopeRequired,
    isDefault: Boolean(input.isDefault),
    isPinned: Boolean(input.isPinned),
    isBuiltin: false,
    defaultN: Math.min(100, Math.max(1, Math.round(Number(input.defaultN) || 10))),
    sortOrder: Math.max(0, ...templates.map((item) => item.sortOrder)) + 10,
    createdAt: timestamp,
    updatedAt: timestamp
  };
  const nextTemplates = template.isDefault ? ensureSingleDefault(templates, template.appliesTo, template.id) : templates;
  savePromptTemplateFile([...nextTemplates, template]);
  return id;
}

function updatePromptTemplate(id: number, input: PromptTemplateInput) {
  const templates = listPromptTemplates();
  const current = templates.find((template) => template.id === id);
  if (!current) throw new Error("Prompt not found.");

  const appliesTo = normalizePromptAppliesTo(input.appliesTo || current.appliesTo);
  const updated: PromptTemplate = {
    ...current,
    title: input.title?.trim() || current.title,
    content: input.content?.trim() || current.content,
    category: input.category?.trim() || current.category,
    appliesTo,
    actionType: normalizePromptActionType(input.actionType || current.actionType),
    scopeRequired: normalizePromptScopeRequired(input.scopeRequired || current.scopeRequired, defaultScopeFor(appliesTo)),
    isDefault: typeof input.isDefault === "boolean" ? input.isDefault : current.isDefault,
    isPinned: typeof input.isPinned === "boolean" ? input.isPinned : current.isPinned,
    defaultN: Math.min(100, Math.max(1, Math.round(Number(input.defaultN) || current.defaultN))),
    updatedAt: now()
  };

  const nextTemplates = templates.map((template) => (template.id === id ? updated : template));
  savePromptTemplateFile(updated.isDefault ? ensureSingleDefault(nextTemplates, updated.appliesTo, updated.id) : nextTemplates);
}

function deletePromptTemplate(id: number) {
  const templates = listPromptTemplates();
  if (templates.length <= 1) throw new Error("Cannot delete the last prompt.");
  savePromptTemplateFile(templates.filter((template) => template.id !== id));
}

function restoreBuiltinPromptTemplates() {
  const customTemplates = listPromptTemplates().filter((template) => !template.isBuiltin);
  const maxCustomId = Math.max(0, ...customTemplates.map((template) => template.id));
  const builtins = defaultPromptTemplates.map((seed, index) => ({
    ...promptSeedToTemplate(seed, maxCustomId + index),
    id: maxCustomId + index + 1
  }));
  savePromptTemplateFile([...customTemplates, ...builtins]);
}

export {
  createPromptTemplate,
  deletePromptTemplate,
  getDefaultPromptTemplate,
  getPromptTemplate,
  listPromptTemplates,
  restoreBuiltinPromptTemplates,
  updatePromptTemplate
};
