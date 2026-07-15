import { NextResponse } from "next/server";
import { createProject, deleteProject, getState, resolveProjectId } from "@/lib/document-store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { name?: string };
  const projectId = createProject(body.name);
  return NextResponse.json(getState(projectId));
}

export async function DELETE(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { projectId?: number };
  const projectId = resolveProjectId(body.projectId);

  try {
    const nextProjectId = deleteProject(projectId);
    return NextResponse.json(getState(nextProjectId));
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Could not delete project.";
    return NextResponse.json({ error: detail }, { status: 400 });
  }
}
