import { memo, useCallback, useEffect, useRef, useState } from "react";
import { Check, Copy, Loader2, Pencil, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  type AgentMessage,
  type AgentRunMarker
} from "@/lib/types";
import { cn } from "@/lib/utils";

type AgentMessageListProps = {
  messages: AgentMessage[];
  pendingMessage: string;
  running: boolean;
  runMarkers: Record<number, AgentRunMarker>;
  statusMessage: string;
  streamingMessage: string;
  onEditMessage: (message: AgentMessage) => void;
  onRetryMessage: (message: AgentMessage, marker: AgentRunMarker) => void;
};

function formatMessageTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function AgentPlainTextContent({ className, content }: { className?: string; content: string }) {
  if (!content.trim()) return null;
  return <div className={cn("whitespace-pre-wrap break-words leading-relaxed", className)}>{content}</div>;
}

type AgentMessageRowProps = {
  message: AgentMessage;
  marker?: AgentRunMarker;
  copied: boolean;
  running: boolean;
  onCopyMessage: (messageId: number, content: string) => void;
  onEditMessage: (message: AgentMessage) => void;
  onRetryMessage: (message: AgentMessage, marker: AgentRunMarker) => void;
};

const AgentMessageRow = memo(function AgentMessageRow({
  message,
  marker,
  copied,
  running,
  onCopyMessage,
  onEditMessage,
  onRetryMessage
}: AgentMessageRowProps) {
  const isUserMessage = message.role === "user";
  const footerClassName = isUserMessage ? "text-primary-foreground/80" : "text-muted-foreground";
  const iconActionButtonClassName = isUserMessage
    ? "size-5 rounded-sm text-primary-foreground/80 hover:bg-primary-foreground/10 hover:text-primary-foreground [&_svg]:!size-3"
    : "size-5 rounded-sm text-muted-foreground hover:text-foreground [&_svg]:!size-3";
  const textActionButtonClassName = isUserMessage
    ? "h-6 px-1.5 text-primary-foreground/85 hover:bg-primary-foreground/10 hover:text-primary-foreground"
    : "h-6 px-1.5 text-muted-foreground";
  const markerLabel = marker?.status === "stopped" ? "Stopped" : "Failed";

  return (
    <article
      className={cn(
        "grid max-w-[92%] gap-1 rounded-md px-3 py-2 text-sm",
        isUserMessage ? "ml-auto bg-primary text-primary-foreground" : "mr-auto border bg-background"
      )}
    >
      {isUserMessage ? (
        <p className="whitespace-pre-wrap break-words">{message.content}</p>
      ) : (
        <AgentPlainTextContent content={message.content} />
      )}
      <div
        className={cn(
          "flex items-center justify-between gap-3 text-[11px]",
          footerClassName
        )}
      >
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span>{formatMessageTime(message.createdAt)}</span>
          {marker ? (
            <span
              className={cn(
                "rounded-sm border px-1.5 py-0.5 font-medium",
                isUserMessage ? "border-primary-foreground/25 text-primary-foreground/90" : "border-border"
              )}
            >
              {markerLabel}
            </span>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {isUserMessage ? (
            <>
              <Button
                type="button"
                size="icon-xs"
                variant="ghost"
                className={iconActionButtonClassName}
                title="Edit message"
                aria-label="Edit message"
                onClick={() => onEditMessage(message)}
              >
                <Pencil data-icon="inline-start" />
              </Button>
              {marker ? (
                <Button
                  type="button"
                  size="xs"
                  variant="ghost"
                  className={textActionButtonClassName}
                  disabled={running}
                  title="Retry message"
                  aria-label={`Retry ${marker.status} message`}
                  onClick={() => onRetryMessage(message, marker)}
                >
                  <RotateCcw data-icon="inline-start" />
                  Retry
                </Button>
              ) : null}
            </>
          ) : (
            <Button
              type="button"
              size="icon-xs"
              variant="ghost"
              className={iconActionButtonClassName}
              title={copied ? "Copied" : "Copy response"}
              aria-label={copied ? "Copied response" : "Copy response"}
              onClick={() => onCopyMessage(message.id, message.content)}
            >
              {copied ? <Check data-icon="inline-start" /> : <Copy data-icon="inline-start" />}
            </Button>
          )}
        </div>
      </div>
    </article>
  );
});

function AgentMessageList({
  messages,
  pendingMessage,
  running,
  runMarkers,
  statusMessage,
  streamingMessage,
  onEditMessage,
  onRetryMessage
}: AgentMessageListProps) {
  const [copiedMessageId, setCopiedMessageId] = useState<number | null>(null);
  const scrollRootRef = useRef<HTMLDivElement | null>(null);
  const stickToBottomRef = useRef(true);
  const scrollFrameRef = useRef<number | null>(null);
  const copyResetRef = useRef<number | null>(null);
  const editMessageRef = useRef(onEditMessage);
  const retryMessageRef = useRef(onRetryMessage);

  editMessageRef.current = onEditMessage;
  retryMessageRef.current = onRetryMessage;

  const getViewport = useCallback(() => {
    return scrollRootRef.current?.querySelector<HTMLElement>('[data-slot="scroll-area-viewport"]') ?? null;
  }, []);

  const updateStickToBottom = useCallback(() => {
    const viewport = getViewport();
    if (!viewport) return;

    const distanceFromBottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
    stickToBottomRef.current = distanceFromBottom < 80;
  }, [getViewport]);

  const handleCopyMessage = useCallback(async (messageId: number, content: string) => {
    if (!navigator.clipboard?.writeText) return;

    try {
      await navigator.clipboard.writeText(content);
    } catch {
      return;
    }

    setCopiedMessageId(messageId);

    if (copyResetRef.current !== null) {
      window.clearTimeout(copyResetRef.current);
    }

    copyResetRef.current = window.setTimeout(() => {
      setCopiedMessageId((current) => (current === messageId ? null : current));
      copyResetRef.current = null;
    }, 1600);
  }, []);

  const handleEditMessage = useCallback((message: AgentMessage) => {
    editMessageRef.current(message);
  }, []);

  const handleRetryMessage = useCallback((message: AgentMessage, marker: AgentRunMarker) => {
    retryMessageRef.current(message, marker);
  }, []);

  useEffect(() => {
    return () => {
      if (copyResetRef.current !== null) {
        window.clearTimeout(copyResetRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const viewport = getViewport();
    if (!viewport) return;

    viewport.addEventListener("scroll", updateStickToBottom, { passive: true });
    updateStickToBottom();

    return () => {
      viewport.removeEventListener("scroll", updateStickToBottom);
    };
  }, [getViewport, updateStickToBottom]);

  useEffect(() => {
    if (!stickToBottomRef.current && !pendingMessage) return;

    if (scrollFrameRef.current !== null) {
      window.cancelAnimationFrame(scrollFrameRef.current);
    }

    scrollFrameRef.current = window.requestAnimationFrame(() => {
      scrollFrameRef.current = null;
      const viewport = getViewport();
      if (!viewport || (!stickToBottomRef.current && !pendingMessage)) return;
      viewport.scrollTop = viewport.scrollHeight;
    });

    return () => {
      if (scrollFrameRef.current !== null) {
        window.cancelAnimationFrame(scrollFrameRef.current);
        scrollFrameRef.current = null;
      }
    };
  }, [getViewport, messages.length, pendingMessage, running, streamingMessage]);

  return (
    <div ref={scrollRootRef} className="min-h-0 flex-1">
      <ScrollArea className="size-full">
        <div className="grid gap-3 p-4">
          {messages.length === 0 && !pendingMessage && !running ? (
            <p className="px-1 py-2 text-sm text-muted-foreground">Ask for a polish, split, label change, or blocker pass.</p>
          ) : (
            messages.map((message) => (
              <AgentMessageRow
                key={message.id}
                message={message}
                marker={message.role === "user" ? runMarkers[message.id] : undefined}
                copied={copiedMessageId === message.id}
                running={running}
                onCopyMessage={handleCopyMessage}
                onEditMessage={handleEditMessage}
                onRetryMessage={handleRetryMessage}
              />
            ))
          )}
          {pendingMessage ? (
            <article className="ml-auto grid max-w-[92%] gap-1 rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground">
              <p className="whitespace-pre-wrap break-words">{pendingMessage}</p>
              <div className="text-[11px] text-primary-foreground/80">sending...</div>
            </article>
          ) : null}
          {running ? (
            <article className="mr-auto grid max-w-[92%] gap-2 rounded-md border bg-background px-3 py-2 text-sm">
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <Loader2 className="size-3 animate-spin" data-icon="inline-start" />
                {streamingMessage ? "writing..." : statusMessage || "thinking..."}
              </div>
              {streamingMessage ? <AgentPlainTextContent content={streamingMessage} /> : null}
            </article>
          ) : null}
        </div>
      </ScrollArea>
    </div>
  );
}

export { AgentMessageList };
