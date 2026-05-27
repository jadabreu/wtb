import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { createEmptySelections, fieldKeys, type AppState, type ChatMessage, type FieldKey, type GeneratedJobStep, type GeneratedOption, type JobStep, type Project, type PromptActionType, type PromptAppliesTo, type PromptScopeRequired, type PromptTemplate, type Suggestion } from "./types";

const dataDir = path.join(process.cwd(), "data");
const dbPath = path.join(dataDir, "jtbd.sqlite");

let db: Database.Database | null = null;

type MessageRow = {
  id: number;
  role: "user" | "assistant";
  content: string;
  suggestions_json: string | null;
  artifacts_json: string | null;
  created_at: string;
};

type ProjectRow = {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
};

type SelectionRow = {
  field_key: FieldKey;
  value: string;
  updated_at: string;
};

type JobStepRow = {
  id: number;
  title: string;
  description: string;
  success_metrics_json: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

type PromptTemplateRow = {
  id: number;
  title: string;
  content: string;
  category: string;
  applies_to: string;
  action_type: string;
  scope_required: string;
  is_default: number;
  is_pinned: number;
  is_builtin: number;
  sort_order: number;
  default_n: number;
  created_at: string;
  updated_at: string;
};

function getDb() {
  if (db) return db;

  fs.mkdirSync(dataDir, { recursive: true });
  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(`
    create table if not exists messages (
      id integer primary key autoincrement,
      role text not null check(role in ('user', 'assistant')),
      content text not null,
      suggestions_json text,
      artifacts_json text,
      created_at text not null default (datetime('now'))
    );

    create table if not exists selections (
      field_key text primary key,
      value text not null,
      updated_at text not null default (datetime('now'))
    );

    create table if not exists workspace_meta (
      id integer primary key check (id = 1),
      openai_conversation_id text,
      updated_at text not null default (datetime('now'))
    );

    create table if not exists projects (
      id integer primary key autoincrement,
      name text not null,
      openai_conversation_id text,
      created_at text not null default (datetime('now')),
      updated_at text not null default (datetime('now'))
    );

    create table if not exists project_messages (
      id integer primary key autoincrement,
      project_id integer not null references projects(id) on delete cascade,
      role text not null check(role in ('user', 'assistant')),
      content text not null,
      suggestions_json text,
      artifacts_json text,
      created_at text not null default (datetime('now'))
    );

    create table if not exists project_selections (
      project_id integer not null references projects(id) on delete cascade,
      field_key text not null,
      value text not null,
      updated_at text not null default (datetime('now')),
      primary key (project_id, field_key)
    );

    create table if not exists project_job_steps (
      id integer primary key autoincrement,
      project_id integer not null references projects(id) on delete cascade,
      title text not null,
      description text not null default '',
      success_metrics_json text not null default '[]',
      sort_order integer not null default 0,
      created_at text not null default (datetime('now')),
      updated_at text not null default (datetime('now'))
    );

    create table if not exists prompt_templates (
      id integer primary key autoincrement,
      title text not null,
      content text not null,
      category text not null default 'JTBD framing',
      applies_to text not null default 'chat',
      action_type text not null default 'chat',
      scope_required text not null default 'none',
      is_default integer not null default 0,
      is_pinned integer not null default 0,
      is_builtin integer not null default 0,
      sort_order integer not null default 0,
      default_n integer not null default 10,
      created_at text not null default (datetime('now')),
      updated_at text not null default (datetime('now'))
    );
  `);

  ensurePromptTemplateSchema(db);
  ensureMessageArtifactSchema(db);
  migrateSingleWorkspaceData(db);
  seedPromptTemplates(db);
  updateBuiltinPromptTemplatesForN(db);
  return db;
}



function ensurePromptTemplateSchema(database: Database.Database) {
  const columns = database.prepare("pragma table_info(prompt_templates)").all() as Array<{ name: string }>;
  const hasColumn = (name: string) => columns.some((column) => column.name === name);

  if (!hasColumn("default_n")) {
    database.prepare("alter table prompt_templates add column default_n integer not null default 10").run();
  }
  if (!hasColumn("applies_to")) {
    database.prepare("alter table prompt_templates add column applies_to text not null default 'chat'").run();
  }
  if (!hasColumn("action_type")) {
    database.prepare("alter table prompt_templates add column action_type text not null default 'chat'").run();
  }
  if (!hasColumn("scope_required")) {
    database.prepare("alter table prompt_templates add column scope_required text not null default 'none'").run();
  }
  if (!hasColumn("is_default")) {
    database.prepare("alter table prompt_templates add column is_default integer not null default 0").run();
  }
}

function ensureMessageArtifactSchema(database: Database.Database) {
  for (const tableName of ["messages", "project_messages"]) {
    const columns = database.prepare(`pragma table_info(${tableName})`).all() as Array<{ name: string }>;
    if (!columns.some((column) => column.name === "artifacts_json")) {
      database.prepare(`alter table ${tableName} add column artifacts_json text`).run();
    }
  }
}

const defaultPromptTemplates: Array<{
  title: string;
  category: string;
  appliesTo: PromptAppliesTo;
  actionType: PromptActionType;
  scopeRequired: PromptScopeRequired;
  isDefault: boolean;
  isPinned: boolean;
  sortOrder: number;
  defaultN: number;
  content: string;
}> = [
  {
    title: "Clarify product",
    category: "Workflow prompts",
    appliesTo: "product",
    actionType: "generate",
    scopeRequired: "none",
    isDefault: true,
    isPinned: true,
    sortOrder: 10,
    defaultN: 5,
    content: `Generate {{n}} clear product or service framings for this research project.

Current product/service: {{product}}
Project frame:
{{project_frame}}

Each option should be concrete enough to research, but not over-specified. Keep each candidate concise.`
  },
  {
    title: "Generate end-user candidates",
    category: "Workflow prompts",
    appliesTo: "end_user",
    actionType: "generate",
    scopeRequired: "none",
    isDefault: true,
    isPinned: true,
    sortOrder: 20,
    defaultN: 10,
    content: `Generate {{n}} possible end-user candidates for {{product}}.

Project frame:
{{project_frame}}

For each candidate, explain why they may have the job, what situation triggers it, and what would make them a strong or weak fit.`
  },
  {
    title: "Generate context candidates",
    category: "Workflow prompts",
    appliesTo: "context",
    actionType: "generate",
    scopeRequired: "none",
    isDefault: true,
    isPinned: true,
    sortOrder: 30,
    defaultN: 8,
    content: `Given this product and end user, suggest {{n}} likely contexts where the job appears.

Project frame:
{{project_frame}}

List concrete situations, triggers, constraints, or environments that could create demand.`
  },
  {
    title: "Sharpen functional job",
    category: "Workflow prompts",
    appliesTo: "job",
    actionType: "refine",
    scopeRequired: "none",
    isDefault: true,
    isPinned: true,
    sortOrder: 40,
    defaultN: 8,
    content: `Generate {{n}} sharper JTBD-style functional job statements.

Project frame:
{{project_frame}}

Each option must describe progress the end user is trying to make. Do not phrase options as product features, tasks, or solutions.`
  },
  {
    title: "Generate emotional jobs",
    category: "Workflow prompts",
    appliesTo: "emotional_job",
    actionType: "generate",
    scopeRequired: "none",
    isDefault: true,
    isPinned: true,
    sortOrder: 50,
    defaultN: 10,
    content: `Generate {{n}} emotional Jobs-to-be-Done for this project.

Project frame:
{{project_frame}}

Each option must be one standalone emotional job: how the end user wants to feel or stop feeling while making progress. Keep them simple and visceral.`
  },
  {
    title: "Generate social jobs",
    category: "Workflow prompts",
    appliesTo: "social_job",
    actionType: "generate",
    scopeRequired: "none",
    isDefault: true,
    isPinned: true,
    sortOrder: 60,
    defaultN: 10,
    content: `Generate {{n}} social Jobs-to-be-Done for this project.

Project frame:
{{project_frame}}

Each option must be one standalone social job: how the end user wants to be perceived or avoid being perceived. Keep them simple and grounded in real social pressure.`
  },
  {
    title: "Generate complexity factors",
    category: "Workflow prompts",
    appliesTo: "complexity_factors",
    actionType: "generate",
    scopeRequired: "none",
    isDefault: true,
    isPinned: true,
    sortOrder: 70,
    defaultN: 10,
    content: `Generate the {{n}} most important complexity factors for this JTBD frame.

Project frame:
{{project_frame}}

Each option must be one condition, variable, constraint, or force that makes the job harder, riskier, slower, more urgent, or more confusing.`
  },
  {
    title: "Create job map",
    category: "Workflow prompts",
    appliesTo: "job_map",
    actionType: "generate",
    scopeRequired: "none",
    isDefault: true,
    isPinned: true,
    sortOrder: 80,
    defaultN: 12,
    content: `Create a medium-fidelity job map for this JTBD frame.

Project frame:
{{project_frame}}

A job map breaks the job into the main steps the user must accomplish from beginning to end.

Rules:
- Return {{n}} ordered job steps when possible.
- Each step should describe what the user is trying to accomplish, not how they do it.
- Begin each step name with a gerund verb.
- Keep the steps MECE: no duplicates, no major gaps.
- Do not include product features, tools, tiny micro-actions, or methods unless they are part of the job itself.
- Do not include success metrics unless explicitly asked in this prompt.`
  },
  {
    title: "Generate success metrics",
    category: "Workflow prompts",
    appliesTo: "success_metrics",
    actionType: "generate",
    scopeRequired: "job_step",
    isDefault: true,
    isPinned: true,
    sortOrder: 90,
    defaultN: 8,
    content: `Generate {{n}} success metrics for this job step.

Job step:
{{job_step}}

Project frame:
{{project_frame}}

Return metrics that describe what must be true for this step to be completed well. Avoid product features, tasks, methods, or vague satisfaction statements.`
  },
  {
    title: "Challenge assumptions",
    category: "Research quality",
    appliesTo: "chat",
    actionType: "challenge",
    scopeRequired: "none",
    isDefault: false,
    isPinned: true,
    sortOrder: 100,
    defaultN: 10,
    content: `Challenge the current JTBD frame.

{{project_frame}}

Identify the riskiest assumptions, what might be too vague, and what I should validate next.`
  },
  {
    title: "Interview questions",
    category: "Interviews",
    appliesTo: "chat",
    actionType: "generate",
    scopeRequired: "none",
    isDefault: false,
    isPinned: false,
    sortOrder: 110,
    defaultN: 10,
    content: `Generate {{n}} interview questions for this JTBD research project.

{{project_frame}}

Create open-ended questions that uncover behavior, triggers, tradeoffs, and success criteria.`
  },
  {
    title: "Summarize frame",
    category: "Synthesis",
    appliesTo: "chat",
    actionType: "audit",
    scopeRequired: "none",
    isDefault: false,
    isPinned: false,
    sortOrder: 120,
    defaultN: 10,
    content: `Summarize the current JTBD frame for {{project_name}}.

{{project_frame}}

Return a concise summary, unresolved gaps, and the next best research question.`
  }
];
function seedPromptTemplates(database: Database.Database) {
  const count = (database.prepare("select count(*) as count from prompt_templates").get() as { count: number }).count;
  if (count > 0) return;

  const insert = database.prepare(
    `insert into prompt_templates (title, content, category, applies_to, action_type, scope_required, is_default, is_pinned, is_builtin, sort_order, default_n)
     values (@title, @content, @category, @appliesTo, @actionType, @scopeRequired, @isDefault, @isPinned, 1, @sortOrder, @defaultN)`
  );

  const transaction = database.transaction(() => {
    for (const template of defaultPromptTemplates) {
      insert.run({
        title: template.title,
        content: template.content,
        category: template.category,
        appliesTo: template.appliesTo,
        actionType: template.actionType,
        scopeRequired: template.scopeRequired,
        isDefault: template.isDefault ? 1 : 0,
        isPinned: template.isPinned ? 1 : 0,
        sortOrder: template.sortOrder,
        defaultN: template.defaultN
      });
    }
  });

  transaction();
}


function updateBuiltinPromptTemplatesForN(database: Database.Database) {
  const select = database.prepare("select id from prompt_templates where is_builtin = 1 and title = ?");
  const insert = database.prepare(
    `insert into prompt_templates (title, content, category, applies_to, action_type, scope_required, is_default, is_pinned, is_builtin, sort_order, default_n)
     values (@title, @content, @category, @appliesTo, @actionType, @scopeRequired, @isDefault, @isPinned, 1, @sortOrder, @defaultN)`
  );
  const update = database.prepare(
    `update prompt_templates
     set category = @category, applies_to = @appliesTo, action_type = @actionType, scope_required = @scopeRequired,
         is_default = @isDefault, is_pinned = @isPinned, sort_order = @sortOrder, default_n = @defaultN, updated_at = datetime('now')
     where id = @id`
  );

  database.transaction(() => {
    const defaultTitles = defaultPromptTemplates.map((template) => template.title);
    const placeholders = defaultTitles.map(() => "?").join(", ");
    database.prepare(`delete from prompt_templates where is_builtin = 1 and title not in (${placeholders})`).run(...defaultTitles);

    for (const template of defaultPromptTemplates) {
      const payload = {
        title: template.title,
        content: template.content,
        category: template.category,
        appliesTo: template.appliesTo,
        actionType: template.actionType,
        scopeRequired: template.scopeRequired,
        isDefault: template.isDefault ? 1 : 0,
        isPinned: template.isPinned ? 1 : 0,
        sortOrder: template.sortOrder,
        defaultN: template.defaultN
      };
      const existing = select.get(template.title) as { id: number } | undefined;
      if (existing) {
        update.run({ ...payload, id: existing.id });
      } else {
        insert.run(payload);
      }
    }
  })();
}

function migrateSingleWorkspaceData(database: Database.Database) {
  const projectCount = (database.prepare("select count(*) as count from projects").get() as { count: number }).count;

  if (projectCount > 0) return;

  const legacySelection = database.prepare("select value from selections where field_key = 'product'").get() as
    | { value: string }
    | undefined;
  const legacyConversation = database
    .prepare("select openai_conversation_id from workspace_meta where id = 1")
    .get() as { openai_conversation_id: string | null } | undefined;

  const projectName = legacySelection?.value?.trim() || "Untitled research";
  const result = database
    .prepare("insert into projects (name, openai_conversation_id) values (?, ?)")
    .run(projectName, legacyConversation?.openai_conversation_id || null);
  const projectId = Number(result.lastInsertRowid);

  database
    .prepare(
      `insert into project_selections (project_id, field_key, value, updated_at)
       select ?, field_key, value, updated_at from selections`
    )
    .run(projectId);

  database
    .prepare(
      `insert into project_messages (project_id, role, content, suggestions_json, artifacts_json, created_at)
       select ?, role, content, suggestions_json, artifacts_json, created_at from messages order by id asc`
    )
    .run(projectId);
}

function parseSuggestions(value: string | null): Suggestion[] {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value) as Suggestion[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function isFieldKey(value: unknown): value is FieldKey {
  return typeof value === "string" && fieldKeys.includes(value as FieldKey);
}

function parseMessageArtifacts(value: string | null): Pick<ChatMessage, "options" | "generatedJobSteps"> {
  if (!value) return { options: [], generatedJobSteps: [] };

  try {
    const parsed = JSON.parse(value) as {
      options?: unknown;
      generatedJobSteps?: unknown;
      jobSteps?: unknown;
      job_steps?: unknown;
    };

    const options = Array.isArray(parsed.options)
      ? parsed.options
          .map((item): GeneratedOption | null => {
            if (!item || typeof item !== "object") return null;
            const option = item as { key?: unknown; value?: unknown; rationale?: unknown };
            if (!isFieldKey(option.key) || typeof option.value !== "string") return null;
            return {
              key: option.key,
              value: option.value,
              rationale: typeof option.rationale === "string" ? option.rationale : undefined
            };
          })
          .filter((item): item is GeneratedOption => Boolean(item))
      : [];

    const rawJobSteps = parsed.generatedJobSteps ?? parsed.jobSteps ?? parsed.job_steps;
    const generatedJobSteps = Array.isArray(rawJobSteps)
      ? rawJobSteps
          .map((item): GeneratedJobStep | null => {
            if (!item || typeof item !== "object") return null;
            const step = item as { title?: unknown; description?: unknown; successMetrics?: unknown; success_metrics?: unknown };
            if (typeof step.title !== "string") return null;
            const rawMetrics = step.successMetrics ?? step.success_metrics;
            return {
              title: step.title,
              description: typeof step.description === "string" ? step.description : "",
              successMetrics: Array.isArray(rawMetrics) ? rawMetrics.filter((metric): metric is string => typeof metric === "string") : []
            };
          })
          .filter((item): item is GeneratedJobStep => Boolean(item))
      : [];

    return { options, generatedJobSteps };
  } catch {
    return { options: [], generatedJobSteps: [] };
  }
}

function parseSuccessMetrics(value: string | null): string[] {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value) as string[];
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function listProjectRows() {
  return getDb()
    .prepare("select id, name, created_at, updated_at from projects order by updated_at desc, id desc")
    .all() as ProjectRow[];
}

function toProject(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function listProjects() {
  return listProjectRows().map(toProject);
}

export function createProject(name?: string) {
  const projectName = name?.trim() || "Untitled research";
  const result = getDb().prepare("insert into projects (name) values (?)").run(projectName);
  return Number(result.lastInsertRowid);
}

export function resolveProjectId(projectId?: number | null) {
  const database = getDb();

  if (projectId) {
    const row = database.prepare("select id from projects where id = ?").get(projectId) as { id: number } | undefined;
    if (row) return row.id;
  }

  const existing = database
    .prepare("select id from projects order by updated_at desc, id desc limit 1")
    .get() as { id: number } | undefined;

  if (existing) return existing.id;
  return createProject();
}

function touchProject(projectId: number) {
  getDb().prepare("update projects set updated_at = datetime('now') where id = ?").run(projectId);
}

export function getState(projectId?: number | null): AppState {
  const database = getDb();
  const activeProjectId = resolveProjectId(projectId);
  const selections = createEmptySelections();

  const selectionRows = database
    .prepare("select field_key, value, updated_at from project_selections where project_id = ?")
    .all(activeProjectId) as SelectionRow[];

  for (const row of selectionRows) {
    if (fieldKeys.includes(row.field_key)) {
      selections[row.field_key] = row.value;
    }
  }

  const messageRows = database
    .prepare(
      "select id, role, content, suggestions_json, artifacts_json, created_at from project_messages where project_id = ? order by id asc"
    )
    .all(activeProjectId) as MessageRow[];

  const messages: ChatMessage[] = messageRows.map((row) => {
    const artifacts = parseMessageArtifacts(row.artifacts_json);

    return {
      id: row.id,
      role: row.role,
      content: row.content,
      suggestions: parseSuggestions(row.suggestions_json),
      options: artifacts.options,
      generatedJobSteps: artifacts.generatedJobSteps,
      createdAt: row.created_at
    };
  });

  const jobStepRows = database
    .prepare(
      "select id, title, description, success_metrics_json, sort_order, created_at, updated_at from project_job_steps where project_id = ? order by sort_order asc, id asc"
    )
    .all(activeProjectId) as JobStepRow[];

  const jobSteps: JobStep[] = jobStepRows.map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    successMetrics: parseSuccessMetrics(row.success_metrics_json),
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }));

  return {
    activeProjectId,
    projects: listProjects(),
    selections,
    jobSteps,
    messages
  };
}

export function renameProject(projectId: number, name: string) {
  getDb()
    .prepare("update projects set name = ?, updated_at = datetime('now') where id = ?")
    .run(name.trim() || "Untitled research", projectId);
}

export function saveSelections(projectId: number, selections: Partial<Record<FieldKey, string>>) {
  const database = getDb();
  const save = database.prepare(
    `insert into project_selections (project_id, field_key, value, updated_at)
     values (@projectId, @key, @value, datetime('now'))
     on conflict(project_id, field_key) do update set value = excluded.value, updated_at = datetime('now')`
  );

  const transaction = database.transaction((items: Partial<Record<FieldKey, string>>) => {
    for (const key of fieldKeys) {
      if (typeof items[key] === "string") {
        save.run({ projectId, key, value: items[key] ?? "" });
      }
    }
  });

  transaction(selections);
  touchProject(projectId);

  if (typeof selections.product === "string" && selections.product.trim()) {
    renameProject(projectId, selections.product.trim());
  }
}

export function saveJobSteps(projectId: number, steps: Array<Partial<JobStep>>) {
  const database = getDb();
  const insert = database.prepare(
    `insert into project_job_steps (project_id, title, description, success_metrics_json, sort_order)
     values (@projectId, @title, @description, @successMetricsJson, @sortOrder)`
  );

  database.transaction((items: Array<Partial<JobStep>>) => {
    database.prepare("delete from project_job_steps where project_id = ?").run(projectId);

    items.forEach((step, index) => {
      const title = step.title?.trim() || `Step ${index + 1}`;
      const description = step.description?.trim() || "";
      const successMetrics = Array.isArray(step.successMetrics)
        ? step.successMetrics.map((metric) => metric.trim()).filter(Boolean)
        : [];

      insert.run({
        projectId,
        title,
        description,
        successMetricsJson: JSON.stringify(successMetrics),
        sortOrder: index
      });
    });
  })(steps);

  touchProject(projectId);
}

type MessageArtifactsInput = {
  options?: GeneratedOption[];
  generatedJobSteps?: GeneratedJobStep[];
  jobSteps?: GeneratedJobStep[];
};

export function saveMessage(
  projectId: number,
  role: "user" | "assistant",
  content: string,
  suggestions: Suggestion[] = [],
  artifacts: MessageArtifactsInput = {}
) {
  const artifactPayload = {
    options: artifacts.options || [],
    generatedJobSteps: artifacts.generatedJobSteps || artifacts.jobSteps || []
  };
  const result = getDb()
    .prepare("insert into project_messages (project_id, role, content, suggestions_json, artifacts_json) values (?, ?, ?, ?, ?)")
    .run(projectId, role, content, JSON.stringify(suggestions), JSON.stringify(artifactPayload));

  touchProject(projectId);
  return Number(result.lastInsertRowid);
}

export function getOpenAIConversationId(projectId: number) {
  const row = getDb()
    .prepare("select openai_conversation_id from projects where id = ?")
    .get(projectId) as { openai_conversation_id: string | null } | undefined;

  return row?.openai_conversation_id || null;
}

export function saveOpenAIConversationId(projectId: number, conversationId: string) {
  getDb()
    .prepare("update projects set openai_conversation_id = ?, updated_at = datetime('now') where id = ?")
    .run(conversationId, projectId);
}


export function deleteProject(projectId: number) {
  const database = getDb();
  const count = (database.prepare("select count(*) as count from projects").get() as { count: number }).count;

  if (count <= 1) {
    throw new Error("Cannot delete the last project.");
  }

  const nextProject = database
    .prepare("select id from projects where id != ? order by updated_at desc, id desc limit 1")
    .get(projectId) as { id: number } | undefined;

  if (!nextProject) {
    throw new Error("No replacement project is available.");
  }

  database.transaction(() => {
    database.prepare("delete from project_messages where project_id = ?").run(projectId);
    database.prepare("delete from project_selections where project_id = ?").run(projectId);
    database.prepare("delete from project_job_steps where project_id = ?").run(projectId);
    database.prepare("delete from projects where id = ?").run(projectId);
  })();

  return nextProject.id;
}


function clampDefaultN(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 10;
  return Math.min(100, Math.max(1, Math.round(parsed)));
}

const promptAppliesToValues = ["chat", "product", "end_user", "context", "job", "emotional_job", "social_job", "complexity_factors", "job_map", "success_metrics"] as const;
const promptActionTypeValues = ["generate", "refine", "challenge", "audit", "chat"] as const;
const promptScopeRequiredValues = ["none", "job_step"] as const;

function normalizePromptAppliesTo(value: unknown, fallback: PromptAppliesTo = "chat"): PromptAppliesTo {
  return typeof value === "string" && promptAppliesToValues.includes(value as PromptAppliesTo) ? (value as PromptAppliesTo) : fallback;
}

function normalizePromptActionType(value: unknown, fallback: PromptActionType = "chat"): PromptActionType {
  return typeof value === "string" && promptActionTypeValues.includes(value as PromptActionType) ? (value as PromptActionType) : fallback;
}

function normalizePromptScopeRequired(value: unknown, fallback: PromptScopeRequired = "none"): PromptScopeRequired {
  return typeof value === "string" && promptScopeRequiredValues.includes(value as PromptScopeRequired) ? (value as PromptScopeRequired) : fallback;
}

function promptTemplateSelectSql() {
  return "select id, title, content, category, applies_to, action_type, scope_required, is_default, is_pinned, is_builtin, sort_order, default_n, created_at, updated_at from prompt_templates";
}

function clearDefaultPromptForStep(appliesTo: PromptAppliesTo, exceptId?: number) {
  if (appliesTo === "chat") return;
  const sql = exceptId
    ? "update prompt_templates set is_default = 0 where applies_to = ? and id != ?"
    : "update prompt_templates set is_default = 0 where applies_to = ?";
  const args = exceptId ? [appliesTo, exceptId] : [appliesTo];
  getDb().prepare(sql).run(...args);
}

function toPromptTemplate(row: PromptTemplateRow): PromptTemplate {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    category: row.category,
    appliesTo: normalizePromptAppliesTo(row.applies_to),
    actionType: normalizePromptActionType(row.action_type),
    scopeRequired: normalizePromptScopeRequired(row.scope_required),
    isDefault: row.is_default === 1,
    isPinned: row.is_pinned === 1,
    isBuiltin: row.is_builtin === 1,
    sortOrder: row.sort_order,
    defaultN: row.default_n,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function listPromptTemplates() {
  return getDb()
    .prepare(`${promptTemplateSelectSql()} order by is_default desc, is_pinned desc, sort_order asc, title asc`)
    .all()
    .map((row) => toPromptTemplate(row as PromptTemplateRow));
}

export function getPromptTemplate(id: number) {
  const row = getDb().prepare(`${promptTemplateSelectSql()} where id = ?`).get(id) as PromptTemplateRow | undefined;
  return row ? toPromptTemplate(row) : null;
}

export function getDefaultPromptTemplate(appliesTo: PromptAppliesTo) {
  const row = getDb()
    .prepare(`${promptTemplateSelectSql()} where applies_to = ? order by is_default desc, is_pinned desc, sort_order asc, id asc limit 1`)
    .get(appliesTo) as PromptTemplateRow | undefined;
  return row ? toPromptTemplate(row) : null;
}

export function createPromptTemplate(
  input: Partial<Pick<PromptTemplate, "title" | "content" | "category" | "appliesTo" | "actionType" | "scopeRequired" | "isDefault" | "isPinned" | "defaultN">>
) {
  const appliesTo = normalizePromptAppliesTo(input.appliesTo);
  const actionType = normalizePromptActionType(input.actionType, appliesTo === "chat" ? "chat" : "generate");
  const scopeRequired = normalizePromptScopeRequired(input.scopeRequired, appliesTo === "success_metrics" ? "job_step" : "none");
  const isDefault = appliesTo !== "chat" && Boolean(input.isDefault);

  const result = getDb()
    .prepare(
      `insert into prompt_templates (title, content, category, applies_to, action_type, scope_required, is_default, is_pinned, is_builtin, sort_order, default_n)
       values (@title, @content, @category, @appliesTo, @actionType, @scopeRequired, @isDefault, @isPinned, 0, @sortOrder, @defaultN)`
    )
    .run({
      title: input.title?.trim() || "Untitled AI action",
      content: input.content?.trim() || "Use {{project_frame}} to help me think through this JTBD research project.",
      category: input.category?.trim() || "Custom",
      appliesTo,
      actionType,
      scopeRequired,
      isDefault: isDefault ? 1 : 0,
      isPinned: input.isPinned ? 1 : 0,
      sortOrder: Date.now(),
      defaultN: clampDefaultN(input.defaultN)
    });

  const id = Number(result.lastInsertRowid);
  if (isDefault) clearDefaultPromptForStep(appliesTo, id);
  return id;
}

export function updatePromptTemplate(
  id: number,
  input: Partial<Pick<PromptTemplate, "title" | "content" | "category" | "appliesTo" | "actionType" | "scopeRequired" | "isDefault" | "isPinned" | "defaultN">>
) {
  const current = getDb().prepare(`${promptTemplateSelectSql()} where id = ?`).get(id) as PromptTemplateRow | undefined;

  if (!current) throw new Error("Prompt template not found.");

  const appliesTo = normalizePromptAppliesTo(input.appliesTo, normalizePromptAppliesTo(current.applies_to));
  const actionType = normalizePromptActionType(input.actionType, normalizePromptActionType(current.action_type));
  const scopeRequired = normalizePromptScopeRequired(input.scopeRequired, normalizePromptScopeRequired(current.scope_required));
  const isDefault = appliesTo !== "chat" && (typeof input.isDefault === "boolean" ? input.isDefault : current.is_default === 1);

  getDb()
    .prepare(
      `update prompt_templates
       set title = @title, content = @content, category = @category, applies_to = @appliesTo, action_type = @actionType,
           scope_required = @scopeRequired, is_default = @isDefault, is_pinned = @isPinned, default_n = @defaultN, updated_at = datetime('now')
       where id = @id`
    )
    .run({
      id,
      title: input.title?.trim() || current.title,
      content: input.content?.trim() || current.content,
      category: input.category?.trim() || current.category,
      appliesTo,
      actionType,
      scopeRequired,
      isDefault: isDefault ? 1 : 0,
      isPinned: typeof input.isPinned === "boolean" ? (input.isPinned ? 1 : 0) : current.is_pinned,
      defaultN: clampDefaultN(input.defaultN ?? current.default_n)
    });

  if (isDefault) clearDefaultPromptForStep(appliesTo, id);
}

export function deletePromptTemplate(id: number) {
  const database = getDb();
  const count = (database.prepare("select count(*) as count from prompt_templates").get() as { count: number }).count;

  if (count <= 1) throw new Error("Cannot delete the last prompt template.");

  database.prepare("delete from prompt_templates where id = ?").run(id);
}

export function restoreBuiltinPromptTemplates() {
  const database = getDb();
  const insert = database.prepare(
    `insert into prompt_templates (title, content, category, applies_to, action_type, scope_required, is_default, is_pinned, is_builtin, sort_order, default_n)
     values (@title, @content, @category, @appliesTo, @actionType, @scopeRequired, @isDefault, @isPinned, 1, @sortOrder, @defaultN)`
  );

  database.transaction(() => {
    database.prepare("delete from prompt_templates where is_builtin = 1").run();
    for (const template of defaultPromptTemplates) {
      insert.run({
        title: template.title,
        content: template.content,
        category: template.category,
        appliesTo: template.appliesTo,
        actionType: template.actionType,
        scopeRequired: template.scopeRequired,
        isDefault: template.isDefault ? 1 : 0,
        isPinned: template.isPinned ? 1 : 0,
        sortOrder: template.sortOrder,
        defaultN: template.defaultN
      });
    }
  })();
}

export function resetChat(projectId: number) {
  const database = getDb();
  database.transaction(() => {
    database.prepare("delete from project_messages where project_id = ?").run(projectId);
    database.prepare("update projects set openai_conversation_id = null, updated_at = datetime('now') where id = ?").run(projectId);
  })();
}
