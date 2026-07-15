import { NextResponse } from "next/server";
import {
  createPromptTemplate,
  deletePromptTemplate,
  listPromptTemplates,
  restoreBuiltinPromptTemplates,
  updatePromptTemplate
} from "@/lib/document-store";
import type { PromptActionType, PromptAppliesTo, PromptScopeRequired } from "@/lib/types";

export const runtime = "nodejs";

type PromptBody = {
  id?: number;
  title?: string;
  content?: string;
  category?: string;
  appliesTo?: PromptAppliesTo;
  actionType?: PromptActionType;
  scopeRequired?: PromptScopeRequired;
  isDefault?: boolean;
  isPinned?: boolean;
  defaultN?: number;
  action?: "restore_builtins";
};

export async function GET() {
  return NextResponse.json({ templates: listPromptTemplates() });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as PromptBody;

  if (body.action === "restore_builtins") {
    restoreBuiltinPromptTemplates();
    return NextResponse.json({ templates: listPromptTemplates() });
  }

  const id = createPromptTemplate(body);
  return NextResponse.json({ activeTemplateId: id, templates: listPromptTemplates() });
}

export async function PUT(request: Request) {
  const body = (await request.json()) as PromptBody;

  if (!body.id) {
    return NextResponse.json({ error: "Prompt id is required." }, { status: 400 });
  }

  try {
    updatePromptTemplate(body.id, body);
    return NextResponse.json({ activeTemplateId: body.id, templates: listPromptTemplates() });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Could not update prompt.";
    return NextResponse.json({ error: detail }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const body = (await request.json()) as PromptBody;

  if (!body.id) {
    return NextResponse.json({ error: "Prompt id is required." }, { status: 400 });
  }

  try {
    deletePromptTemplate(body.id);
    return NextResponse.json({ templates: listPromptTemplates() });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Could not delete prompt.";
    return NextResponse.json({ error: detail }, { status: 400 });
  }
}
