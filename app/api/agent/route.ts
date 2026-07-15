import { NextResponse } from "next/server";
import { startOpenAIConversationsSession } from "@openai/agents";
import { getWorkbenchAgentReplyStream } from "@/lib/ai/workbench-agent";
import {
  appendAgentAssistantMessage,
  appendAgentUserMessage,
  applyPendingPatchSet,
  getOpenAIConversationId,
  getState,
  rejectPendingPatchSet,
  replaceAgentUserMessage,
  resolveProjectId,
  saveOpenAIConversationId
} from "@/lib/document-store";
import { createNdjsonStream } from "@/lib/ndjson-stream";
import { isReasoningEffort, type ReasoningEffort } from "@/lib/ai/config";
import { fieldKeys, type AgentSelection, type AppState, type FieldKey } from "@/lib/types";
import { isWorkflowStepKey } from "@/lib/workflow";

export const runtime = "nodejs";

type AgentPostBody = {
  projectId?: number;
  message?: string;
  selection?: Partial<AgentSelection>;
  reasoningEffort?: string;
  replaceMessageId?: number;
};

type AgentPutBody = {
  projectId?: number;
  action?: "accept" | "reject";
  patchIds?: string[];
};

function isAgentFieldKey(value: unknown): value is FieldKey {
  return typeof value === "string" && fieldKeys.includes(value as FieldKey);
}

function normalizeSelection(selection: Partial<AgentSelection> | undefined, state: ReturnType<typeof getState>): AgentSelection {
  if (!selection || typeof selection.type !== "string") return { type: "none" };

  if (selection.type === "workflow_step" && "workflowStep" in selection && isWorkflowStepKey(selection.workflowStep)) {
    return { type: "workflow_step", workflowStep: selection.workflowStep };
  }

  if (selection.type === "field" && "fieldKey" in selection) {
    const fieldKey = selection.fieldKey;
    if (isAgentFieldKey(fieldKey)) return { type: "field", fieldKey };
  }

  if (selection.type === "job_step" && "id" in selection && typeof selection.id === "number") {
    const jobStep = state.jobSteps.find((step) => step.id === selection.id);
    if (jobStep) return { type: "job_step", id: jobStep.id };
  }

  if (selection.type === "ideal" && "id" in selection && typeof selection.id === "number") {
    const idealState = state.idealStates.find((item) => item.id === selection.id);
    if (idealState) return { type: "ideal", id: idealState.id };
  }

  return { type: "none" };
}

function agentTraceMetadata(projectId: number, conversationId: string, selection: AgentSelection) {
  const metadata: Record<string, string> = {
    projectId: String(projectId),
    openaiConversationId: conversationId,
    selectionType: selection.type
  };

  if (selection.type === "workflow_step") metadata.workflowStep = selection.workflowStep;
  if (selection.type === "field") metadata.fieldKey = selection.fieldKey;
  if (selection.type === "job_step") metadata.jobStepId = String(selection.id);
  if (selection.type === "ideal") metadata.idealId = String(selection.id);

  return metadata;
}

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

async function getOrCreateOpenAIConversationId(projectId: number) {
  const existingConversationId = getOpenAIConversationId(projectId);
  if (existingConversationId) return existingConversationId;

  // Model memory is OpenAI-managed per project; app JSON remains the artifact source of truth.
  const conversationId = await startOpenAIConversationsSession();
  saveOpenAIConversationId(projectId, conversationId);
  return conversationId;
}

const selectableReasoningEfforts = ["none", "low", "medium", "high", "xhigh"] as const;

function normalizeReasoningEffort(value: unknown): ReasoningEffort | undefined {
  if (typeof value !== "string") return undefined;
  const requestedEffort = value.trim().toLowerCase();
  const effort = requestedEffort === "minimal" ? "none" : requestedEffort;
  if (!selectableReasoningEfforts.includes(effort as (typeof selectableReasoningEfforts)[number])) {
    throw new Error(`Reasoning effort must be one of: ${selectableReasoningEfforts.join(", ")}.`);
  }
  if (!isReasoningEffort(effort)) {
    throw new Error(`Reasoning effort must be one of: ${selectableReasoningEfforts.join(", ")}.`);
  }
  return effort;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as AgentPostBody;
  const message = body.message?.trim();

  if (!message) {
    return NextResponse.json({ error: "Message is required." }, { status: 400 });
  }

  const projectId = resolveProjectId(body.projectId);
  const state = getState(projectId);
  const selection = normalizeSelection(body.selection, state);
  let reasoningEffort: ReasoningEffort | undefined;

  try {
    reasoningEffort = normalizeReasoningEffort(body.reasoningEffort);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Invalid reasoning effort.";
    return NextResponse.json({ error: detail }, { status: 400 });
  }

  return createNdjsonStream(async ({ emit, aborted }) => {
    try {
      if (aborted()) return;
      emit({ type: "status", message: "Reading the current artifact..." });
      const userState =
        typeof body.replaceMessageId === "number"
          ? replaceAgentUserMessage(projectId, body.replaceMessageId, message, selection)
          : appendAgentUserMessage(projectId, message, selection);
      emit({ type: "state", state: userState });

      const seedState: AppState = {
        ...userState,
        agentMessages: userState.agentMessages.slice(0, -1)
      };
      if (aborted()) return;
      const openaiConversationId = await getOrCreateOpenAIConversationId(projectId);
      if (aborted()) return;
      emit({ type: "status", message: "Drafting a reply..." });
      const reply = await getWorkbenchAgentReplyStream(message, seedState, selection, {
        conversationId: openaiConversationId,
        signal: request.signal,
        reasoningEffort,
        traceGroupId: openaiConversationId,
        traceMetadata: {
          ...agentTraceMetadata(projectId, openaiConversationId, selection),
          ...(reasoningEffort ? { reasoningEffort } : {})
        },
        onStatus(message) {
          if (aborted()) return;
          emit({ type: "status", message });
        },
        onMessageDelta(delta) {
          if (aborted()) return;
          emit({ type: "delta", delta });
        }
      });
      if (aborted()) return;
      const nextState = appendAgentAssistantMessage(projectId, reply.message, selection, reply.editSet);
      emit({ type: "done", state: nextState });
    } catch (error) {
      if (aborted() || isAbortError(error)) return;
      const detail = error instanceof Error ? error.message : "Could not run agent.";
      console.error("[api/agent] Agent request failed", { projectId, detail });
      emit({ type: "error", error: detail });
    }
  }, { signal: request.signal });
}

export async function PUT(request: Request) {
  const body = (await request.json().catch(() => ({}))) as AgentPutBody;
  const projectId = resolveProjectId(body.projectId);

  if (body.action === "accept") {
    return NextResponse.json(applyPendingPatchSet(projectId, Array.isArray(body.patchIds) ? body.patchIds : undefined));
  }

  if (body.action === "reject") {
    return NextResponse.json(rejectPendingPatchSet(projectId));
  }

  return NextResponse.json({ error: "Action must be accept or reject." }, { status: 400 });
}
