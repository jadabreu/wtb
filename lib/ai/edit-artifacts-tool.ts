import { tool } from "@openai/agents";
import { normalizeAgentEditCandidate } from "@/lib/ai/agent-edits";
import { editArtifactsParameters } from "@/lib/ai/schemas";
import type { WorkbenchAgentContext } from "@/lib/ai/agent-types";
import type { AgentEditOperationDraft } from "@/lib/types";

const editArtifactsTool = tool<typeof editArtifactsParameters, WorkbenchAgentContext>({
  name: "edit_artifacts",
  description:
    "Apply validated changes to saved workbench artifacts when the user's intent is clear. Use this for direct artifact edits; do not use it just to brainstorm candidates or options.",
  parameters: editArtifactsParameters,
  strict: true,
  async execute(input, runContext) {
    const state = runContext?.context.state;
    if (!state) {
      return { ok: false, error: "Project state is unavailable." };
    }

    await runContext.context.onStatus?.("Validating artifact edits...");

    const operations = input.operations
      .map((operation) => normalizeAgentEditCandidate(operation, state))
      .filter((operation): operation is AgentEditOperationDraft => Boolean(operation));

    if (operations.length === 0) {
      runContext.context.generatedEditSet = null;
      return {
        ok: false,
        error: "No valid artifact edits were produced. Answer in text or ask one clarifying question."
      };
    }

    const editSet = {
      summary: input.summary.trim() || "Updated artifacts",
      operations
    };

    runContext.context.generatedEditSet = runContext.context.generatedEditSet
      ? {
          summary: editSet.summary,
          operations: [...runContext.context.generatedEditSet.operations, ...editSet.operations]
        }
      : editSet;

    return {
      ok: true,
      summary: editSet.summary,
      operationCount: operations.length,
      appliedWhen: "The app will save these edits when this agent reply completes."
    };
  }
});

export { editArtifactsTool };
