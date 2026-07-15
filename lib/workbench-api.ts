import type { AgentReasoningEffort, AgentSelection, AppState, FieldKey, IdealState, JobStep, PromptTemplate, Theme } from "@/lib/types";
import type { TemplateDraft } from "@/lib/prompt-template-utils";
import { parsePromptResponse } from "@/lib/prompt-template-utils";
import { parseAppStateResponse } from "@/lib/workbench-utils";

type PromptPayload = {
  activeTemplateId?: number;
  templates?: PromptTemplate[];
  error?: string;
};

function jsonHeaders() {
  return { "Content-Type": "application/json" };
}

async function loadAppState(projectId?: number) {
  const query = typeof projectId === "number" ? `?projectId=${projectId}` : "";
  const response = await fetch(`/api/state${query}`);
  return parseAppStateResponse(response);
}

async function saveAppState(body: { projectId: number; selections?: Partial<Record<FieldKey, string>>; themes?: Theme[]; jobSteps?: JobStep[]; idealStates?: IdealState[] }) {
  const response = await fetch("/api/state", {
    method: "PUT",
    headers: jsonHeaders(),
    body: JSON.stringify(body)
  });
  return parseAppStateResponse(response);
}

async function createResearchProject(name = "Untitled research") {
  const response = await fetch("/api/projects", {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify({ name })
  });
  return parseAppStateResponse(response);
}

async function deleteResearchProject(projectId: number) {
  const response = await fetch("/api/projects", {
    method: "DELETE",
    headers: jsonHeaders(),
    body: JSON.stringify({ projectId })
  });
  return parseAppStateResponse(response);
}

async function loadPromptWorkbench(): Promise<{ state: AppState; prompts: PromptPayload }> {
  const [state, prompts] = await Promise.all([
    fetch("/api/state").then(parseAppStateResponse),
    fetch("/api/prompts").then(parsePromptResponse)
  ]);
  return { state, prompts };
}

async function loadPromptTemplates() {
  const response = await fetch("/api/prompts");
  const payload = (await response.json()) as { templates: PromptTemplate[]; error?: string };
  if (!response.ok) throw new Error(payload.error || "Could not load prompts.");
  return payload.templates || [];
}

async function createPromptTemplate() {
  const response = await fetch("/api/prompts", {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify({
      title: "New prompt",
      category: "Custom",
      content: "Use {{project_frame}} to help me improve this JTBD research project.",
      appliesTo: "product",
      actionType: "generate",
      scopeRequired: "none",
      isDefault: false,
      isPinned: false,
      defaultN: 10
    })
  });
  return parsePromptResponse(response);
}

async function savePromptTemplate(id: number, draft: TemplateDraft) {
  const response = await fetch("/api/prompts", {
    method: "PUT",
    headers: jsonHeaders(),
    body: JSON.stringify({ id, ...draft })
  });
  return parsePromptResponse(response);
}

async function deletePromptTemplate(id: number) {
  const response = await fetch("/api/prompts", {
    method: "DELETE",
    headers: jsonHeaders(),
    body: JSON.stringify({ id })
  });
  return parsePromptResponse(response);
}

async function restoreBuiltinPromptTemplates() {
  const response = await fetch("/api/prompts", {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify({ action: "restore_builtins" })
  });
  return parsePromptResponse(response);
}

async function runAgentRequest(
  body: {
    projectId: number;
    message: string;
    selection: AgentSelection;
    reasoningEffort: AgentReasoningEffort;
    replaceMessageId?: number;
  },
  options: { signal?: AbortSignal } = {}
) {
  return fetch("/api/agent", {
    method: "POST",
    headers: jsonHeaders(),
    signal: options.signal,
    body: JSON.stringify(body)
  });
}

async function readAgentRunStream(
  response: Response,
  handlers: {
    onStatus: (message: string) => void;
    onDelta: (delta: string) => void;
    onState: (state: AppState) => void;
    onDone: (state: AppState) => void;
  }
) {
  const contentType = response.headers.get("Content-Type") || "";

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error || "Could not run agent.");
  }

  if (!response.body || !contentType.includes("application/x-ndjson")) {
    handlers.onDone(await parseAppStateResponse(response));
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  function handleLine(line: string) {
    if (!line.trim()) return;
    const event = JSON.parse(line) as { type?: string; message?: string; delta?: string; state?: AppState; error?: string };

    if (event.type === "status") {
      handlers.onStatus(event.message || "");
      return;
    }

    if (event.type === "delta" && typeof event.delta === "string") {
      handlers.onDelta(event.delta);
      return;
    }

    if (event.type === "state" && event.state) {
      handlers.onState(event.state);
      return;
    }

    if (event.type === "done" && event.state) {
      handlers.onDone(event.state);
      return;
    }

    if (event.type === "error") {
      throw new Error(event.error || "Could not run agent.");
    }
  }

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let newlineIndex = buffer.indexOf("\n");
    while (newlineIndex !== -1) {
      const line = buffer.slice(0, newlineIndex);
      buffer = buffer.slice(newlineIndex + 1);
      handleLine(line);
      newlineIndex = buffer.indexOf("\n");
    }
  }

  buffer += decoder.decode();
  if (buffer.trim()) handleLine(buffer);
}

export {
  createPromptTemplate,
  createResearchProject,
  deletePromptTemplate,
  deleteResearchProject,
  loadAppState,
  loadPromptTemplates,
  loadPromptWorkbench,
  readAgentRunStream,
  restoreBuiltinPromptTemplates,
  runAgentRequest,
  saveAppState,
  savePromptTemplate
};
