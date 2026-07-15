import test from "node:test";
import assert from "node:assert/strict";
import {
  appendUniqueStrings,
  areIdealStateDraftsEqual,
  areJobStepDraftsEqual,
  normalizeIdealStateDrafts,
  normalizeJobStepDrafts
} from "../lib/artifact-normalizers";

test("normalizes job step drafts for stable dirty checks", () => {
  const normalized = normalizeJobStepDrafts([
    {
      title: "  Prepare options  ",
      description: "  Gather viable paths  ",
      successMetrics: [" Clear shortlist ", "", "Decision owner agrees"]
    }
  ]);

  assert.deepEqual(normalized, [
    {
      id: -1,
      title: "Prepare options",
      description: "Gather viable paths",
      successMetrics: [
        { id: -1, text: "Clear shortlist", themeIds: [] },
        { id: -2, text: "Decision owner agrees", themeIds: [] }
      ],
      sortOrder: 0,
      createdAt: undefined,
      updatedAt: undefined
    }
  ]);

  assert.equal(
    areJobStepDraftsEqual(normalized, [
      {
        id: -1,
        title: "Prepare options",
        description: "Gather viable paths",
        successMetrics: [
          { id: -1, text: "Clear shortlist", themeIds: [] },
          { id: -2, text: "Decision owner agrees", themeIds: [] }
        ],
        sortOrder: 999
      }
    ]),
    true
  );
});

test("normalizes ideal drafts and labels", () => {
  const normalized = normalizeIdealStateDrafts([
    {
      title: "  Decisions feel safe  ",
      description: "  Tradeoffs are clear  ",
      label: "not_a_label" as never,
      blockers: [" Missing evidence ", "", "Conflicting priorities"]
    }
  ]);

  assert.equal(normalized[0].title, "Decisions feel safe");
  assert.equal(normalized[0].description, "Tradeoffs are clear");
  assert.equal(normalized[0].label, "nice_to_have");
  assert.deepEqual(normalized[0].blockers, ["Missing evidence", "Conflicting priorities"]);
  assert.deepEqual(normalized[0].themeIds, []);

  assert.equal(
    areIdealStateDraftsEqual(normalized, [
      {
        id: -1,
        title: "Decisions feel safe",
        description: "Tradeoffs are clear",
        label: "nice_to_have",
        blockers: ["Missing evidence", "Conflicting priorities"],
        sortOrder: 12
      }
    ]),
    true
  );
});

test("appends unique strings case-insensitively", () => {
  assert.deepEqual(
    appendUniqueStrings(["Missing evidence"], [" missing evidence ", "Slow approvals"]),
    ["Missing evidence", "Slow approvals"]
  );
});
