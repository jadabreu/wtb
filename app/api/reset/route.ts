import { NextResponse } from "next/server";
import { getState, resetChat, resolveProjectId } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { projectId?: number };
  const projectId = resolveProjectId(body.projectId);
  resetChat(projectId);
  return NextResponse.json(getState(projectId));
}
