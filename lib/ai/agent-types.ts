import type { AgentEditSetDraft, AgentSelection, AppState } from "@/lib/types";
import type { ReasoningEffort } from "@/lib/ai/config";

type WorkbenchAgentReply = {
  message: string;
  editSet: AgentEditSetDraft | null;
};

type AgentRunOptions = {
  conversationId?: string;
  signal?: AbortSignal;
  reasoningEffort?: ReasoningEffort;
  traceGroupId?: string;
  traceMetadata?: Record<string, unknown>;
};

type AgentStatusHandler = (message: string) => void | Promise<void>;

type WorkbenchAgentContext = {
  state: AppState;
  selection: AgentSelection;
  reasoningEffort?: ReasoningEffort;
  onStatus?: AgentStatusHandler;
  generatedEditSet?: AgentEditSetDraft | null;
};

type StreamOptions = AgentRunOptions & {
  onMessageDelta?: (delta: string) => void | Promise<void>;
  onStatus?: AgentStatusHandler;
};

export type { AgentEditSetDraft, AgentRunOptions, AgentStatusHandler, StreamOptions, WorkbenchAgentContext, WorkbenchAgentReply };
