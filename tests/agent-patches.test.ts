import test from "node:test";
import assert from "node:assert/strict";
import { normalizeAgentPatchCandidate } from "../lib/ai/agent-patches";
import { createEmptySelections, type AppState } from "../lib/types";

const state: AppState = {
  activeProjectId: 1,
  projects: [],
  selections: createEmptySelections(),
  themes: [],
  jobSteps: [
    {
      id: 3,
      title: "Review options",
      description: "Compare viable choices.",
      successMetrics: [{ id: 4, text: "Decision owner agrees", themeIds: [] }],
      sortOrder: 0
    }
  ],
  idealStates: [
    {
      id: 7,
      title: "Decisions feel safe",
      description: "Tradeoffs are clear.",
      label: "critical_gap",
      blockers: ["Missing evidence"],
      themeIds: [],
      sortOrder: 0
    }
  ],
  agentMessages: [],
  pendingPatchSet: null
};

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

test("drops appended ideals that duplicate existing titles", () => {
  const patch = normalizeAgentPatchCandidate(
    {
      ...baseOperation,
      type: "append_ideal",
      ideal: {
        title: " decisions feel safe ",
        description: "Duplicate",
        label: "nice_to_have",
        blockers: []
      },
      summary: "Duplicate ideal"
    },
    state
  );

  assert.equal(patch, null);
});

test("normalizes valid ideal patch candidates", () => {
  const patch = normalizeAgentPatchCandidate(
    {
      ...baseOperation,
      type: "append_ideal_blockers",
      ideal_id: 7,
      blockers: [" Missing trust ", ""],
      summary: "Add blocker"
    },
    state
  );

  assert.deepEqual(patch, {
    type: "append_ideal_blockers",
    idealId: 7,
    blockers: ["Missing trust"],
    summary: "Add blocker"
  });
});

test("normalizes scalar field edit candidates", () => {
  const patch = normalizeAgentPatchCandidate(
    {
      ...baseOperation,
      type: "set_field",
      field_key: "end_user",
      value: " Supply planners ",
      summary: "Set the end user"
    },
    state
  );

  assert.deepEqual(patch, {
    type: "set_field",
    fieldKey: "end_user",
    value: "Supply planners",
    previousValue: "",
    summary: "Set the end user"
  });
});

test("normalizes theme organization candidates", () => {
  const patch = normalizeAgentPatchCandidate(
    {
      ...baseOperation,
      type: "organize_themes",
      themes: [
        {
          title: " Decision confidence ",
          description: "Signals that make a recommendation feel safe.",
          color: null
        }
      ],
      ideal_theme_assignments: [{ ideal_id: 7, theme_titles: ["Decision confidence"] }],
      metric_theme_assignments: [{ job_step_id: 3, metric_id: 4, theme_titles: ["Decision confidence"] }],
      theme_assignment_mode: "append",
      summary: "Organize by confidence"
    },
    state
  );

  assert.deepEqual(patch, {
    type: "organize_themes",
    themes: [
      {
        title: "Decision confidence",
        description: "Signals that make a recommendation feel safe.",
        color: "#2f6f5f"
      }
    ],
    idealAssignments: [{ idealId: 7, themeTitles: ["Decision confidence"] }],
    metricAssignments: [{ jobStepId: 3, metricId: 4, themeTitles: ["Decision confidence"] }],
    assignmentMode: "append",
    summary: "Organize by confidence"
  });
});
