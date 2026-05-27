import { NextResponse } from "next/server";
import { getJtbdActionReply, getJtbdActionReplyStream } from "@/lib/ai";
import { getDefaultPromptTemplate, getPromptTemplate, getState, resolveProjectId } from "@/lib/db";
import { clampDefaultN, renderPromptTemplate } from "@/lib/prompt-render";
import { getWorkflowStep, getMissingRequirements, isWorkflowStepKey } from "@/lib/workflow";
import type { JobStep, PromptTemplate } from "@/lib/types";

export const runtime = "nodejs";

type ActionRunBody = {
  projectId?: number;
  workflowStep?: string;
  templateId?: number;
  n?: number;
  scope?: {
    type?: string;
    id?: number;
  };
  stream?: boolean;
};

function resolveTemplate(body: ActionRunBody, fallbackStep: string): PromptTemplate | null {
  if (typeof body.templateId === "number") {
    const template = getPromptTemplate(body.templateId);
    if (template) return template;
  }

  return getDefaultPromptTemplate(fallbackStep as PromptTemplate["appliesTo"]);
}

function resolveJobStep(steps: JobStep[], body: ActionRunBody) {
  if (body.scope?.type !== "job_step") return null;
  if (typeof body.scope.id !== "number") return null;
  return steps.find((step) => step.id === body.scope?.id) || null;
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as ActionRunBody;

  if (!isWorkflowStepKey(body.workflowStep)) {
    return NextResponse.json({ error: "A valid workflow step is required." }, { status: 400 });
  }

  const workflowStep = getWorkflowStep(body.workflowStep);
  const projectId = resolveProjectId(body.projectId);
  const state = getState(projectId);
  const missingRequirements = getMissingRequirements(workflowStep, state);

  if (missingRequirements.length > 0) {
    return NextResponse.json(
      { error: `Complete ${missingRequirements.map((key) => getWorkflowStep(key).label).join(", ")} before running this action.` },
      { status: 400 }
    );
  }

  const template = resolveTemplate(body, workflowStep.key);
  if (!template) {
    return NextResponse.json({ error: `No AI action is assigned to ${workflowStep.label}.` }, { status: 400 });
  }

  const jobStep = workflowStep.scopeRequired === "job_step" ? resolveJobStep(state.jobSteps, body) : null;
  if (workflowStep.scopeRequired === "job_step" && !jobStep) {
    return NextResponse.json({ error: "Select a job step before running this action." }, { status: 400 });
  }

  const n = clampDefaultN(body.n ?? template.defaultN ?? workflowStep.defaultN);
  const prompt = renderPromptTemplate(template.content, state, {
    projectName: state.projects.find((project) => project.id === state.activeProjectId)?.name,
    defaultN: n,
    workflowStep: workflowStep.key,
    jobStep
  });

  const actionMeta = {
    workflowStep: workflowStep.key,
    templateId: template.id,
    templateTitle: template.title,
    scope: jobStep ? { type: "job_step", id: jobStep.id } : null,
    n,
    prompt
  };

  if (body.stream) {
    const encoder = new TextEncoder();

    function encodeEvent(payload: unknown) {
      return encoder.encode(`${JSON.stringify(payload)}
`);
    }

    const stream = new ReadableStream({
      async start(controller) {
        try {
          controller.enqueue(
            encodeEvent({
              type: "status",
              message: "Looking for the sharp edge in the customer problem..."
            })
          );
          const reply = await getJtbdActionReplyStream(prompt, state, workflowStep.key, {
            onMessageDelta(delta) {
              controller.enqueue(encodeEvent({ type: "delta", delta }));
            }
          });
          controller.enqueue(encodeEvent({ type: "done", result: { ...actionMeta, ...reply } }));
        } catch (error) {
          const detail = error instanceof Error ? error.message : "Could not run AI action.";
          console.error("[api/actions/run] Guided action stream failed", { projectId, workflowStep: workflowStep.key, detail });
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

  try {
    const reply = await getJtbdActionReply(prompt, state, workflowStep.key);
    return NextResponse.json({
      ...actionMeta,
      ...reply
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Could not run AI action.";
    console.error("[api/actions/run] Guided action failed", { projectId, workflowStep: workflowStep.key, detail });
    return NextResponse.json({ error: detail }, { status: 500 });
  }
}
