import test from "node:test";
import assert from "node:assert/strict";
import { normalizeAgentReplyOutput } from "../lib/ai/agent-edits";
import { applyAgentEditSetToDocument } from "../lib/document-store/agent-proposals";
import { createEmptySelections, type AgentPatchSet, type AppState, type WorkbenchDocument } from "../lib/types";

const baseOperation = {
  field_key: null,
  list_field_key: null,
  value: null,
  values: [],
  job_step_id: null,
  job_step: null,
  job_steps: [],
  metrics: [],
  ideal_id: null,
  ideal: null,
  ideals: [],
  label: null,
  blockers: [],
  themes: [],
  ideal_theme_assignments: [],
  metric_theme_assignments: [],
  theme_assignment_mode: null,
  summary: ""
};

const state: AppState = {
  activeProjectId: 1,
  projects: [],
  selections: createEmptySelections(),
  themes: [],
  jobSteps: [],
  idealStates: [],
  agentMessages: [],
  pendingPatchSet: null
};

function createDocument(pendingPatchSet: AgentPatchSet | null = null): WorkbenchDocument {
  return {
    version: 1,
    project: {
      id: 1,
      name: "Inventory Planning Tool",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      openaiConversationId: null
    },
    selections: createEmptySelections(),
    themes: [],
    jobSteps: [],
    idealStates: [],
    agentMessages: pendingPatchSet
      ? [
          {
            id: 1,
            role: "assistant",
            content: "Proposal ready.",
            selection: { type: "none" },
            patchSet: pendingPatchSet,
            suggestionSet: null,
            createdAt: "2026-01-01T00:00:00.000Z"
          }
        ]
      : [],
    pendingPatchSet,
    counters: {
      nextAgentMessageId: 2,
      nextJobStepId: 1,
      nextSuccessMetricId: 1,
      nextThemeId: 1,
      nextIdealStateId: 1,
      nextPatchSetId: 2
    }
  };
}

test("normalizes structured edit output as a direct edit set", () => {
  const reply = normalizeAgentReplyOutput(
    {
      message: "Added the selected ideals.",
      edit_set: {
        summary: "Add selected ideals",
        patches: [
          {
            ...baseOperation,
            type: "append_ideal",
            ideal: {
              title: "Inventory allocation is explainable",
              description: "Planners can understand why inventory goes to one channel before another.",
              label: "critical_gap",
              blockers: ["Unclear channel priority"]
            },
            summary: "Add explainable allocation ideal"
          }
        ]
      }
    },
    state
  );

  assert.equal(reply.editSet?.summary, "Add selected ideals");
  assert.deepEqual(reply.editSet?.operations, [
    {
      type: "append_ideal",
      ideal: {
        title: "Inventory allocation is explainable",
        description: "Planners can understand why inventory goes to one channel before another.",
        label: "critical_gap",
        blockers: ["Unclear channel priority"]
      },
      summary: "Add explainable allocation ideal"
    }
  ]);
});

test("applies direct edit sets without creating a pending proposal", () => {
  const pendingPatchSet: AgentPatchSet = {
    artifactType: "artifact_edit_proposal",
    id: "proposal_1",
    summary: "Old proposal",
    status: "pending",
    createdAt: "2026-01-01T00:00:00.000Z",
    patches: [
      {
        id: "patch_1",
        type: "set_field",
        fieldKey: "product",
        value: "Legacy proposal",
        summary: "Legacy edit"
      }
    ]
  };
  const doc = createDocument(pendingPatchSet);

  const applied = applyAgentEditSetToDocument(doc, {
    summary: "Add chosen ideal",
    operations: [
      {
        type: "append_ideal",
        ideal: {
          title: "Inventory allocation is explainable",
          description: "Planners can understand why inventory goes to one channel before another.",
          label: "critical_gap",
          blockers: ["Unclear channel priority"]
        },
        summary: "Add explainable allocation ideal"
      }
    ]
  });

  assert.equal(applied.length, 1);
  assert.equal(applied[0]?.id, "patch_1");
  assert.equal(doc.pendingPatchSet, null);
  assert.equal(doc.agentMessages[0]?.patchSet?.status, "stale");
  assert.equal(doc.idealStates.length, 1);
  assert.equal(doc.idealStates[0]?.title, "Inventory allocation is explainable");
});
