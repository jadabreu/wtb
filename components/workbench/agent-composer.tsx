import { useEffect, useRef } from "react";
import { Send, Square, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type AgentComposerProps = {
  draft: string;
  editing: boolean;
  running: boolean;
  onCancelEdit: () => void;
  onDraftChange: (draft: string) => void;
  onEditLastMessage: () => void;
  onSend: (message: string) => void;
  onStop: () => void;
};

function AgentComposer({
  draft,
  editing,
  running,
  onCancelEdit,
  onDraftChange,
  onEditLastMessage,
  onSend,
  onStop
}: AgentComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  function submit(nextMessage = draft) {
    const trimmed = nextMessage.trim();
    if (!trimmed || running) return;
    onSend(trimmed);
    onDraftChange("");
  }

  useEffect(() => {
    function handleDocumentKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (running) {
        event.preventDefault();
        onStop();
        return;
      }
      if (editing) {
        event.preventDefault();
        onCancelEdit();
      }
    }

    document.addEventListener("keydown", handleDocumentKeyDown);
    return () => document.removeEventListener("keydown", handleDocumentKeyDown);
  }, [editing, onCancelEdit, onStop, running]);

  useEffect(() => {
    if (!draft) return;
    textareaRef.current?.focus();
  }, [draft]);

  return (
    <form
      className="grid shrink-0 gap-2 p-3"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <Textarea
        ref={textareaRef}
        className="max-h-32 min-h-20 resize-none"
        value={draft}
        placeholder="Ask for a polish, split, label change, or blocker pass"
        onChange={(event) => onDraftChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape" && running) {
            event.preventDefault();
            onStop();
            return;
          }
          if (event.key === "Escape" && editing) {
            event.preventDefault();
            onCancelEdit();
            return;
          }
          if (event.key === "ArrowUp" && !running && !draft.trim() && event.currentTarget.selectionStart === 0) {
            event.preventDefault();
            onEditLastMessage();
            return;
          }
          if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
          event.preventDefault();
          submit();
        }}
      />
      <div className="flex items-center justify-between gap-3">
        {editing && !running ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Editing previous message</span>
            <Button type="button" size="xs" variant="ghost" onClick={onCancelEdit}>
              <X data-icon="inline-start" />
              Cancel
            </Button>
          </div>
        ) : (
          <span />
        )}
        {running ? (
          <Button type="button" variant="outline" onClick={onStop}>
            <Square data-icon="inline-start" />
            Stop
          </Button>
        ) : (
          <Button type="submit" disabled={!draft.trim()}>
            <Send data-icon="inline-start" />
            {editing ? "Resend" : "Send"}
          </Button>
        )}
      </div>
    </form>
  );
}

export { AgentComposer };
