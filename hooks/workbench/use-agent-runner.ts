import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import {
  fieldKeys,
  type AgentReasoningEffort,
  type AgentRunMarker,
  type AgentSelection,
  type AppState,
  type FieldKey,
  type IdealState,
  type JobStep,
  type WorkflowStepKey
} from "@/lib/types";
import { readAgentRunStream, runAgentRequest } from "@/lib/workbench-api";
import type { WorkflowStep } from "@/lib/workflow";

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

type ActiveAgentRun = {
  message: string;
  replaceMessageId?: number;
  reasoningEffort: AgentReasoningEffort;
  stopped: boolean;
  userMessageId: number | null;
};

type RunAgentMessageOptions = {
  replaceMessageId?: number;
};

function useAgentRunner({
  activeWorkflowStep,
  selectedIdealState,
  selectedJobStep,
  setError,
  setState,
  state
}: {
  activeWorkflowStep: WorkflowStep;
  selectedIdealState: IdealState | null;
  selectedJobStep: JobStep | null;
  setError: (error: string) => void;
  setState: Dispatch<SetStateAction<AppState>>;
  state: AppState;
}) {
  const [agentRunning, setAgentRunning] = useState(false);
  const [agentPendingMessage, setAgentPendingMessage] = useState("");
  const [agentStreamingMessage, setAgentStreamingMessage] = useState("");
  const [agentStatusMessage, setAgentStatusMessage] = useState("");
  const [agentRunMarkers, setAgentRunMarkers] = useState<Record<number, AgentRunMarker>>({});
  const abortControllerRef = useRef<AbortController | null>(null);
  const activeRunRef = useRef<ActiveAgentRun | null>(null);
  const streamBufferRef = useRef("");
  const streamFrameRef = useRef<number | null>(null);

  function flushStreamBuffer() {
    streamFrameRef.current = null;
    if (!streamBufferRef.current) return;

    const nextChunk = streamBufferRef.current;
    streamBufferRef.current = "";
    setAgentStreamingMessage((current) => `${current}${nextChunk}`);
  }

  function clearQueuedStream() {
    if (streamFrameRef.current !== null) {
      window.cancelAnimationFrame(streamFrameRef.current);
      streamFrameRef.current = null;
    }
    streamBufferRef.current = "";
  }

  function queueStreamDelta(delta: string) {
    streamBufferRef.current += delta;
    if (streamFrameRef.current !== null) return;

    streamFrameRef.current = window.requestAnimationFrame(flushStreamBuffer);
  }

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      clearQueuedStream();
    };
  }, []);

  useEffect(() => {
    setAgentRunMarkers({});
  }, [state.activeProjectId]);

  function getAgentSelection(): AgentSelection {
    if ((activeWorkflowStep.key === "ideals" || activeWorkflowStep.key === "blockers") && selectedIdealState) {
      return { type: "ideal", id: selectedIdealState.id };
    }

    if ((activeWorkflowStep.key === "job_map" || activeWorkflowStep.key === "success_metrics") && selectedJobStep) {
      return { type: "job_step", id: selectedJobStep.id };
    }

    if (fieldKeys.includes(activeWorkflowStep.key as FieldKey)) {
      return { type: "field", fieldKey: activeWorkflowStep.key as FieldKey };
    }

    return { type: "workflow_step", workflowStep: activeWorkflowStep.key as WorkflowStepKey };
  }

  async function runAgentMessage(
    message: string,
    reasoningEffort: AgentReasoningEffort,
    options: RunAgentMessageOptions = {}
  ) {
    const trimmedMessage = message.trim();
    if (!trimmedMessage || agentRunning || !state.activeProjectId) return;

    setAgentRunning(true);
    setAgentPendingMessage(trimmedMessage);
    setAgentStreamingMessage("");
    setAgentStatusMessage("Reading the current artifact...");
    setError("");

    const abortController = new AbortController();
    const runContext: ActiveAgentRun = {
      message: trimmedMessage,
      replaceMessageId: options.replaceMessageId,
      reasoningEffort,
      stopped: false,
      userMessageId: null
    };

    abortControllerRef.current = abortController;
    activeRunRef.current = runContext;

    try {
      const response = await runAgentRequest({
        projectId: state.activeProjectId,
        message: trimmedMessage,
        selection: getAgentSelection(),
        reasoningEffort,
        replaceMessageId: options.replaceMessageId
      }, {
        signal: abortController.signal
      });
      await readAgentRunStream(response, {
        onStatus(message) {
          if (activeRunRef.current !== runContext || runContext.stopped) return;
          setAgentStatusMessage(message);
        },
        onDelta(delta) {
          if (activeRunRef.current !== runContext || runContext.stopped) return;
          queueStreamDelta(delta);
        },
        onState(nextState) {
          if (activeRunRef.current !== runContext) return;

          const persistedUserMessage =
            typeof runContext.replaceMessageId === "number"
              ? nextState.agentMessages.find((agentMessage) => agentMessage.id === runContext.replaceMessageId)
              : [...nextState.agentMessages]
                  .reverse()
                  .find((agentMessage) => agentMessage.role === "user" && agentMessage.content === trimmedMessage);

          if (persistedUserMessage?.role === "user") {
            runContext.userMessageId = persistedUserMessage.id;
            setAgentRunMarkers((current) => {
              const visibleMessageIds = new Set(nextState.agentMessages.map((message) => message.id));
              const next = Object.fromEntries(
                Object.entries(current).filter(([messageId]) => visibleMessageIds.has(Number(messageId)))
              ) as Record<number, AgentRunMarker>;

              if (runContext.stopped) {
                return {
                  ...next,
                  [persistedUserMessage.id]: {
                    status: "stopped",
                    reasoningEffort: runContext.reasoningEffort
                  }
                };
              }
              delete next[persistedUserMessage.id];
              return next;
            });
          }
          setAgentPendingMessage("");
          setState(nextState);
        },
        onDone(nextState) {
          if (activeRunRef.current !== runContext || runContext.stopped) return;

          flushStreamBuffer();
          if (typeof runContext.userMessageId === "number") {
            setAgentRunMarkers((current) => {
              if (!current[runContext.userMessageId as number]) return current;
              const next = { ...current };
              delete next[runContext.userMessageId as number];
              return next;
            });
          }
          setState(nextState);
        }
      });
    } catch (nextError) {
      if (abortController.signal.aborted || isAbortError(nextError)) return;
      if (activeRunRef.current !== runContext) return;

      if (typeof runContext.userMessageId === "number") {
        setAgentRunMarkers((current) => ({
          ...current,
          [runContext.userMessageId as number]: {
            status: "failed",
            reasoningEffort
          }
        }));
      }
      setError(nextError instanceof Error ? nextError.message : "Could not run agent.");
    } finally {
      if (abortController.signal.aborted && runContext.stopped && typeof runContext.userMessageId === "number") {
        setAgentRunMarkers((current) => ({
          ...current,
          [runContext.userMessageId as number]: {
            status: "stopped",
            reasoningEffort: runContext.reasoningEffort
          }
        }));
      }

      if (abortControllerRef.current === abortController) {
        abortControllerRef.current = null;
      }

      if (activeRunRef.current === runContext) {
        flushStreamBuffer();
        activeRunRef.current = null;
        setAgentRunning(false);
        setAgentPendingMessage("");
        setAgentStreamingMessage("");
        setAgentStatusMessage("");
        clearQueuedStream();
      }
    }
  }

  function stopAgentRun() {
    const abortController = abortControllerRef.current;
    if (!abortController || abortController.signal.aborted) return;

    setAgentStatusMessage("Stopping...");
    const activeRun = activeRunRef.current;
    if (activeRun) {
      activeRun.stopped = true;
      if (typeof activeRun.userMessageId === "number") {
        setAgentRunMarkers((current) => ({
          ...current,
          [activeRun.userMessageId as number]: {
            status: "stopped",
            reasoningEffort: activeRun.reasoningEffort
          }
        }));
      }
    }
    abortController.abort();
    setAgentRunning(false);
    setAgentPendingMessage("");
    setAgentStreamingMessage("");
    setAgentStatusMessage("");
    clearQueuedStream();
  }

  return {
    agentPendingMessage,
    agentRunning,
    agentRunMarkers,
    agentStatusMessage,
    agentStreamingMessage,
    runAgentMessage,
    stopAgentRun
  };
}

export { useAgentRunner };
