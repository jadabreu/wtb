import { editArtifactsTool } from "@/lib/ai/edit-artifacts-tool";
import { runPromptTool } from "@/lib/ai/run-prompt-tool";

const workbenchArtifactTools = [editArtifactsTool, runPromptTool] as const;

export { workbenchArtifactTools };
