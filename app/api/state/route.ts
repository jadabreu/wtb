import { NextResponse } from "next/server";
import { getState, resolveProjectId, saveJobSteps, saveSelections } from "@/lib/db";
import { fieldKeys, type FieldKey, type JobStep } from "@/lib/types";

export const runtime = "nodejs";

function parseProjectId(value: string | null) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  return NextResponse.json(getState(parseProjectId(url.searchParams.get("projectId"))));
}

export async function PUT(request: Request) {
  const body = (await request.json()) as {
    projectId?: number;
    selections?: Partial<Record<FieldKey, string>>;
    jobSteps?: Array<Partial<JobStep>>;
  };
  const projectId = resolveProjectId(body.projectId);
  const nextSelections: Partial<Record<FieldKey, string>> = {};

  for (const key of fieldKeys) {
    const value = body.selections?.[key];
    if (typeof value === "string") {
      nextSelections[key] = value.trim();
    }
  }

  if (Object.keys(nextSelections).length > 0) {
    saveSelections(projectId, nextSelections);
  }

  if (Array.isArray(body.jobSteps)) {
    saveJobSteps(projectId, body.jobSteps);
  }

  return NextResponse.json(getState(projectId));
}
