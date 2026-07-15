import type { AgentArtifactType } from "@/lib/types";

function getWorkbenchArtifactDefinition(type: AgentArtifactType) {
  void type;
  return undefined;
}

function requireWorkbenchArtifactDefinition(type: AgentArtifactType) {
  const artifact = getWorkbenchArtifactDefinition(type);
  if (!artifact) throw new Error(`Unknown artifact type: ${type}`);
  return artifact;
}

function formatArtifactCapabilityInstructions() {
  const editInstructions = [
    "Direct artifact edits",
    "Tool: edit_artifacts",
    "Surface: saved artifact state",
    "Lifecycle: direct validated edit",
    "Use when:",
    "  - The user clearly asks to add, save, update, replace, delete, tag, or otherwise change saved workbench artifacts.",
    "  - The requested edits can be represented with supported edit operations.",
    "Avoid when:",
    "  - The user is brainstorming, asking for candidates, asking for critique, or still discussing what to save.",
    "  - The request is ambiguous enough that a concise clarifying question would be better.",
    "After tool call: Write a short plain-text confirmation of what changed."
  ].join("\n");

  return editInstructions;
}

function artifactTypeLabel(type: AgentArtifactType): string {
  if (type === "field_suggestions") return "Field suggestions";
  if (type === "artifact_edit_proposal") return "Artifact edit proposal";
  const exhaustive: never = type;
  return exhaustive;
}

export {
  artifactTypeLabel,
  formatArtifactCapabilityInstructions,
  getWorkbenchArtifactDefinition,
  requireWorkbenchArtifactDefinition
};
