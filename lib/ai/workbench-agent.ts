import {
  Agent,
  extractAllTextOutput,
  isOpenAIResponsesRawModelStreamEvent,
  run,
  withTrace,
  type RunContext,
  type RunStreamEvent
} from "@openai/agents";
import { workbenchArtifactTools } from "@/lib/ai/artifact-tools";
import {
  getContextManagementConfig,
  getMaxOutputTokens,
  getOpenAIModel,
  getReasoningConfig,
  incompleteResponseMessage
} from "@/lib/ai/config";
import { buildAgentInstructions } from "@/lib/ai/context";
import type { AgentRunOptions, StreamOptions, WorkbenchAgentContext, WorkbenchAgentReply } from "@/lib/ai/agent-types";
import type { AgentSelection, AppState } from "@/lib/types";

const toolStatusMessages: Record<string, { start: string; done: string }> = {
  edit_artifacts: {
    start: "Validating artifact edits...",
    done: "Preparing updated artifacts..."
  },
  run_prompt: {
    start: "Running the selected prompt...",
    done: "Reading the prompt results..."
  }
};

function createWorkbenchAgent(options: AgentRunOptions = {}) {
  return new Agent<WorkbenchAgentContext>({
    name: "JTBD Workbench Agent",
    instructions: (runContext: RunContext<WorkbenchAgentContext>) =>
      buildAgentInstructions(runContext.context.state, runContext.context.selection),
    model: getOpenAIModel(),
    modelSettings: {
      maxTokens: getMaxOutputTokens(),
      store: true,
      // Responses API owns long-context compaction while the Agents SDK owns orchestration/tools.
      contextManagement: getContextManagementConfig(),
      reasoning: getReasoningConfig(options.reasoningEffort)
    },
    tools: [...workbenchArtifactTools]
  });
}

function normalizeTextOutput(output: unknown, streamedMessage = "") {
  if (typeof output === "string") return output.trim();
  return streamedMessage.trim();
}

function createStatusEmitter(options: Pick<StreamOptions, "onStatus">) {
  let lastStatus = "";
  return async (message: string) => {
    if (!message || message === lastStatus) return;
    lastStatus = message;
    await options.onStatus?.(message);
  };
}

function getToolName(event: RunStreamEvent) {
  if (event.type !== "run_item_stream_event") return null;
  if (event.item.type !== "tool_call_item" && event.item.type !== "tool_call_output_item") return null;

  const rawItem = event.item.rawItem;
  if (rawItem && typeof rawItem === "object" && "name" in rawItem && typeof rawItem.name === "string") {
    return rawItem.name;
  }

  return null;
}

async function emitRunItemStatus(event: RunStreamEvent, emitStatus: (message: string) => Promise<void>) {
  if (event.type !== "run_item_stream_event") return;

  if (event.name === "reasoning_item_created") {
    await emitStatus("Reasoning through the next step...");
    return;
  }

  const toolName = getToolName(event);
  const toolStatus = toolName ? toolStatusMessages[toolName] : null;

  if (event.name === "tool_called") {
    await emitStatus(toolStatus?.start || "Using a tool...");
  }

  if (event.name === "tool_output") {
    await emitStatus(toolStatus?.done || "Reviewing the tool result...");
  }
}

async function getWorkbenchAgentReply(
  userMessage: string,
  state: AppState,
  selection: AgentSelection,
  options: AgentRunOptions = {}
): Promise<WorkbenchAgentReply> {
  const context: WorkbenchAgentContext = { state, selection, reasoningEffort: options.reasoningEffort };
  const workbenchAgent = createWorkbenchAgent(options);
  const result = await withTrace(
    "JTBD Workbench Agent",
    () =>
      run(workbenchAgent, userMessage, {
        context,
        maxTurns: 3,
        conversationId: options.conversationId,
        signal: options.signal
      }),
    { groupId: options.traceGroupId, metadata: options.traceMetadata }
  );

  if (!result.finalOutput) {
    throw new Error("The AI response was incomplete. Try again with a shorter instruction.");
  }

  return {
    message: normalizeTextOutput(result.finalOutput),
    editSet: context.generatedEditSet || null
  };
}

async function getWorkbenchAgentReplyStream(
  userMessage: string,
  state: AppState,
  selection: AgentSelection,
  options: StreamOptions = {}
): Promise<WorkbenchAgentReply> {
  const emitStatus = createStatusEmitter(options);
  const context: WorkbenchAgentContext = {
    state,
    selection,
    reasoningEffort: options.reasoningEffort,
    onStatus: emitStatus
  };
  const workbenchAgent = createWorkbenchAgent(options);
  return withTrace(
    "JTBD Workbench Agent",
    async () => {
      const result = await run(workbenchAgent, userMessage, {
        context,
        maxTurns: 3,
        conversationId: options.conversationId,
        signal: options.signal,
        stream: true
      });
      let streamedMessage = "";

      for await (const event of result) {
        await emitRunItemStatus(event, emitStatus);

        if (!isOpenAIResponsesRawModelStreamEvent(event)) continue;

        const responseEvent = event.data.event;
        if (String(responseEvent.type).includes("compaction")) {
          await emitStatus("Compacting conversation memory...");
        }

        if (responseEvent.type === "response.output_text.delta" && typeof responseEvent.delta === "string") {
          streamedMessage += responseEvent.delta;
          await options.onMessageDelta?.(responseEvent.delta);
        }

        if (responseEvent.type === "response.failed") {
          throw new Error(responseEvent.response.error?.message || "OpenAI streaming failed.");
        }

        if (responseEvent.type === "response.incomplete") {
          throw new Error(incompleteResponseMessage(responseEvent.response.incomplete_details?.reason));
        }
      }

      await result.completed;
      const messageOutput = extractAllTextOutput(result.newItems);
      const finalMessage = normalizeTextOutput(messageOutput, streamedMessage);

      if (!finalMessage) {
        throw new Error("The AI response was incomplete. Try again with a shorter instruction.");
      }

      const reply: WorkbenchAgentReply = {
        message: finalMessage,
        editSet: context.generatedEditSet || null
      };
      if (reply.message.length > streamedMessage.length) {
        await options.onMessageDelta?.(reply.message.slice(streamedMessage.length));
      }

      return reply;
    },
    { groupId: options.traceGroupId, metadata: options.traceMetadata }
  );
}

export { getWorkbenchAgentReply, getWorkbenchAgentReplyStream };
export type { AgentRunOptions, StreamOptions, WorkbenchAgentContext, WorkbenchAgentReply };
