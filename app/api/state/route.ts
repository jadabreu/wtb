import { NextResponse } from "next/server";
import { getState, resolveProjectId, saveIdealStates, saveJobSteps, saveSelections, saveThemes } from "@/lib/document-store";
import { fieldKeys, type FieldKey, type IdealState, type JobStep, type Theme } from "@/lib/types";

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
    themes?: Array<Partial<Theme>>;
    jobSteps?: Array<Partial<JobStep>>;
    idealStates?: Array<Partial<IdealState>>;
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

  if (Array.isArray(body.themes)) {
    saveThemes(projectId, body.themes);
  }

  if (Array.isArray(body.jobSteps)) {
    saveJobSteps(projectId, body.jobSteps);
  }

  if (Array.isArray(body.idealStates)) {
    saveIdealStates(projectId, body.idealStates);
  }

  return NextResponse.json(getState(projectId));
}
