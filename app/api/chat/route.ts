import { NextResponse } from "next/server";
import { createJtbdConversation, getJtbdReplyStream } from "@/lib/ai";
import { getOpenAIConversationId, getState, resolveProjectId, saveMessage, saveOpenAIConversationId } from "@/lib/db";

export const runtime = "nodejs";

async function getOrCreateConversationId(projectId: number) {
  const existingConversationId = getOpenAIConversationId(projectId);

  if (existingConversationId) {
    return existingConversationId;
  }

  const conversationId = await createJtbdConversation();
  saveOpenAIConversationId(projectId, conversationId);
  return conversationId;
}

export async function POST(request: Request) {
  const body = (await request.json()) as { projectId?: number; message?: string };
  const message = body.message?.trim();

  if (!message) {
    return NextResponse.json({ error: "Message is required." }, { status: 400 });
  }

  const encoder = new TextEncoder();

  function encodeEvent(payload: unknown) {
    return encoder.encode(`${JSON.stringify(payload)}
`);
  }

  const stream = new ReadableStream({
    async start(controller) {
      let projectId: number | undefined;

      try {
        projectId = resolveProjectId(body.projectId);
        const conversationId = await getOrCreateConversationId(projectId);
        const state = getState(projectId);
        const reply = await getJtbdReplyStream(message, state, conversationId, {
          onMessageDelta(delta) {
            controller.enqueue(encodeEvent({ type: "delta", delta }));
          }
        });
        saveMessage(projectId, "user", message);
        saveMessage(projectId, "assistant", reply.message, reply.suggestions, { options: reply.options, jobSteps: reply.jobSteps });
        controller.enqueue(encodeEvent({ type: "done", state: getState(projectId) }));
      } catch (error) {
        const detail = error instanceof Error ? error.message : "Unknown error";
        console.error("[api/chat] Chat request failed", { projectId, detail });
        controller.enqueue(encodeEvent({ type: "error", error: detail }));
      } finally {
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no"
    }
  });
}
