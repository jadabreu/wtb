import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeAgentMessageArtifacts,
  normalizeAgentPatchSetArtifacts,
  refreshPendingPatchSetStatus
} from "../lib/document-store/agent-artifacts";
import type { AgentMessage, AgentPatchSet, WorkbenchDocument } from "../lib/types";

const basePatchSet: AgentPatchSet = {
  artifactType: "artifact_edit_proposal",
  id: "proposal_1",
  summary: "Rewrite the ideal",
  status: "pending",
  createdAt: "2026-01-01T00:00:00.000Z",
  patches: [
    {
      id: "patch_1",
      type: "replace_ideal",
      idealId: 7,
      ideal: {
        title: "Decisions feel safe",
        description: "Tradeoffs are clear.",
        label: "critical_gap",
        blockers: ["Missing evidence"]
      },
      summary: "Clarify the ideal"
    }
  ]
};

function createDocument(patchSet: AgentPatchSet): WorkbenchDocument {
  return {
    version: 1,
    project: {
      id: 1,
      name: "Inventory Planning Tool",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      openaiConversationId: null
    },
    selections: {
      product: "",
      end_user: "",
      context: "",
      job: "",
      emotional_job: "",
      social_job: "",
      complexity_factors: ""
    },
    themes: [],
    jobSteps: [],
    idealStates: [
      {
        id: 7,
        title: "Decision risk is visible",
        description: "Tradeoffs are clear.",
        label: "critical_gap",
        blockers: [],
        themeIds: [],
        sortOrder: 0,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z"
      }
    ],
    agentMessages: [
      {
        id: 2,
        role: "assistant",
        content: "Proposal ready.",
        selection: { type: "ideal", id: 7 },
        patchSet,
        suggestionSet: null,
        createdAt: "2026-01-01T00:00:00.000Z"
      }
    ],
    pendingPatchSet: patchSet,
    counters: {
      nextAgentMessageId: 3,
      nextJobStepId: 1,
      nextSuccessMetricId: 1,
      nextThemeId: 1,
      nextIdealStateId: 8,
      nextPatchSetId: 2
    }
  };
}

test("normalizes old agent artifacts with explicit artifact types", () => {
  const legacyPatchSet = { ...basePatchSet, artifactType: undefined } as unknown as AgentPatchSet;
  const legacyMessage = {
    id: 1,
    role: "assistant",
    content: "Suggestions ready.",
    selection: { type: "field", fieldKey: "product" },
    patchSet: legacyPatchSet,
    suggestionSet: {
      id: "suggestions_1",
      appliesTo: "product",
      templateId: 1,
      templateTitle: "Product ideas",
      summary: "Generated suggestions",
      suggestions: [],
      createdAt: "2026-01-01T00:00:00.000Z"
    },
    createdAt: "2026-01-01T00:00:00.000Z"
  } as unknown as AgentMessage;

  assert.equal(normalizeAgentPatchSetArtifacts(legacyPatchSet)?.artifactType, "artifact_edit_proposal");
  assert.equal(normalizeAgentMessageArtifacts(legacyMessage).suggestionSet?.artifactType, "field_suggestions");
});

test("marks pending proposals stale when the target ideal changed after generation", () => {
  const doc = createDocument(basePatchSet);

  assert.equal(refreshPendingPatchSetStatus(doc), true);
  assert.equal(doc.pendingPatchSet?.status, "stale");
  assert.equal(doc.agentMessages[0]?.patchSet?.status, "stale");
  assert.match(doc.pendingPatchSet?.statusReason || "", /target ideals changed/);
});
