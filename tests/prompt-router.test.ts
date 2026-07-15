import test from "node:test";
import assert from "node:assert/strict";
import { buildRenderedPrompt, resolvePromptScope, validatePromptRunReadiness } from "../lib/ai/prompt-runner";
import { createEmptySelections, type AppState, type PromptTemplate } from "../lib/types";

const state: AppState = {
  activeProjectId: 1,
  projects: [{ id: 1, name: "Inventory Planning Tool", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" }],
  selections: {
    ...createEmptySelections(),
    product: "Inventory planning tool",
    end_user: "Supply planners",
    job: "Prioritize replenishment work"
  },
  themes: [],
  jobSteps: [
    {
      id: 10,
      title: "Review exceptions",
      description: "Find SKUs that need attention.",
      successMetrics: [],
      sortOrder: 0
    },
    {
      id: 11,
      title: "Approve replenishment",
      description: "Commit the right action.",
      successMetrics: [],
      sortOrder: 1
    }
  ],
  idealStates: [],
  agentMessages: [],
  pendingPatchSet: null
};

const successMetricsPrompt: PromptTemplate = {
  id: 1,
  title: "Generate success metrics",
  content: "Generate metrics for {{job_step_title}}.\n{{job_step}}",
  category: "Workflow prompts",
  appliesTo: "success_metrics",
  actionType: "generate",
  scopeRequired: "job_step",
  isDefault: true,
  isPinned: true,
  isBuiltin: true,
  defaultN: 8,
  sortOrder: 1,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z"
};

const idealsPrompt: PromptTemplate = {
  id: 2,
  title: "Generate ideals",
  content: "Generate ideals for {{job}}.",
  category: "Workflow prompts",
  appliesTo: "ideals",
  actionType: "generate",
  scopeRequired: "none",
  isDefault: true,
  isPinned: true,
  isBuiltin: true,
  defaultN: 8,
  sortOrder: 2,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z"
};

test("prompt scope uses the selected job step when a scoped prompt needs one", () => {
  const scope = resolvePromptScope({
    state,
    selection: { type: "job_step", id: 11 },
    template: successMetricsPrompt
  });

  assert.equal(scope.ok, true);
  assert.equal(scope.ok ? scope.jobStep?.id : null, 11);
});

test("prompt scope asks for a job step when multiple steps exist and none is selected", () => {
  const scope = resolvePromptScope({
    state,
    selection: { type: "workflow_step", workflowStep: "success_metrics" },
    template: successMetricsPrompt
  });

  assert.equal(scope.ok, false);
  assert.match(scope.ok ? "" : scope.error, /needs a job step/);
});

test("rendered prompt injects selected scoped job step variables", () => {
  const rendered = buildRenderedPrompt({
    state,
    selection: { type: "job_step", id: 10 },
    template: successMetricsPrompt
  });

  assert.equal(rendered.ok, true);
  assert.match(rendered.ok ? rendered.prompt : "", /Review exceptions/);
  assert.match(rendered.ok ? rendered.prompt : "", /Find SKUs that need attention/);
});

test("readiness validation blocks prompts with missing prerequisites", () => {
  const blockedState: AppState = {
    ...state,
    jobSteps: []
  };

  assert.match(validatePromptRunReadiness(blockedState, "success_metrics") || "", /Job map/);
});

test("readiness validation allows ideals before a job map exists", () => {
  const stateWithoutJobMap: AppState = {
    ...state,
    jobSteps: []
  };

  assert.equal(validatePromptRunReadiness(stateWithoutJobMap, idealsPrompt.appliesTo), null);
});
