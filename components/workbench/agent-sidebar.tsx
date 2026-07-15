import { useCallback, useState } from "react";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AgentComposer } from "@/components/workbench/agent-composer";
import { AgentMessageList } from "@/components/workbench/agent-message-list";
import {
  agentReasoningEffortValues,
  type AgentReasoningEffort,
  type AgentMessage,
  type AgentRunMarker,
} from "@/lib/types";
import { cn } from "@/lib/utils";

type AgentSidebarProps = {
  messages: AgentMessage[];
  title?: string;
  pendingMessage: string;
  running: boolean;
  runMarkers: Record<number, AgentRunMarker>;
  statusMessage: string;
  streamingMessage: string;
  className?: string;
  onSend: (
    message: string,
    reasoningEffort: AgentReasoningEffort,
    options?: { replaceMessageId?: number }
  ) => void;
  onStop: () => void;
};

const reasoningEffortLabels: Record<AgentReasoningEffort, string> = {
  none: "None",
  low: "Low",
  medium: "Medium",
  high: "High",
  xhigh: "Extra high"
};

function AgentSidebar({
  messages,
  title = "Chat",
  pendingMessage,
  running,
  runMarkers,
  statusMessage,
  streamingMessage,
  className,
  onSend,
  onStop
}: AgentSidebarProps) {
  const [reasoningEffort, setReasoningEffort] = useState<AgentReasoningEffort>("medium");
  const [draft, setDraft] = useState("");
  const [editingMessageId, setEditingMessageId] = useState<number | null>(null);

  const handleEditMessage = useCallback((message: AgentMessage) => {
    setDraft(message.content);
    setEditingMessageId(message.id);
  }, []);

  const handleEditLastMessage = useCallback(() => {
    const lastUserMessage = [...messages].reverse().find((message) => message.role === "user");
    if (!lastUserMessage) return;
    setDraft(lastUserMessage.content);
    setEditingMessageId(lastUserMessage.id);
  }, [messages]);

  const handleRetryMessage = useCallback((message: AgentMessage, marker: AgentRunMarker) => {
    setDraft("");
    setEditingMessageId(null);
    onSend(message.content, marker.reasoningEffort, { replaceMessageId: message.id });
  }, [onSend]);

  const handleDraftChange = useCallback((nextDraft: string) => {
    setDraft(nextDraft);
  }, []);

  const handleCancelEdit = useCallback(() => {
    setDraft("");
    setEditingMessageId(null);
  }, []);

  const handleSend = useCallback((message: string) => {
    const replaceMessageId = editingMessageId ?? undefined;
    setEditingMessageId(null);
    onSend(message, reasoningEffort, replaceMessageId ? { replaceMessageId } : undefined);
  }, [editingMessageId, onSend, reasoningEffort]);

  return (
    <aside
      aria-label="Chat"
      className={cn(
        "flex min-h-0 flex-col overflow-hidden rounded-lg border bg-card text-card-foreground shadow-xs",
        className
      )}
    >
      <header className="flex shrink-0 items-center justify-between gap-3 border-b px-4 py-3">
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold tracking-tight">{title}</h1>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-xs text-muted-foreground">Effort</span>
          <Select
            value={reasoningEffort}
            onValueChange={(value) => setReasoningEffort(value as AgentReasoningEffort)}
            disabled={running}
          >
            <SelectTrigger size="sm" className="w-[112px]" aria-label="Reasoning effort">
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              {agentReasoningEffortValues.map((effort) => (
                <SelectItem value={effort} key={effort}>
                  {reasoningEffortLabels[effort]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </header>

      <AgentMessageList
        messages={messages}
        pendingMessage={pendingMessage}
        running={running}
        runMarkers={runMarkers}
        statusMessage={statusMessage}
        streamingMessage={streamingMessage}
        onEditMessage={handleEditMessage}
        onRetryMessage={handleRetryMessage}
      />

      <Separator />
      <AgentComposer
        draft={draft}
        editing={editingMessageId !== null}
        running={running}
        onCancelEdit={handleCancelEdit}
        onDraftChange={handleDraftChange}
        onEditLastMessage={handleEditLastMessage}
        onSend={handleSend}
        onStop={onStop}
      />
    </aside>
  );
}

export { AgentSidebar };
