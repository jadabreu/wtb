import { renderPromptTemplate } from "@/lib/prompt-render";
import { formatArtifactCapabilityInstructions } from "@/lib/ai/artifact-registry";
import { listPromptTemplates } from "@/lib/document-store/prompts";
import {
  fieldLabels,
  idealStateLabelLabels,
  isListFieldKey,
  normalizeIdealStateLabel,
  parseListFieldValue,
  type AgentSelection,
  type AppState,
  type FieldKey,
  type IdealState,
  type JobStep,
  type Theme
} from "@/lib/types";

const maxPromptCatalogContentChars = 500;

function formatThemeNames(themeIds: number[], themes: Theme[]) {
  const themeById = new Map(themes.map((theme) => [theme.id, theme.title]));
  const names = themeIds.map((themeId) => themeById.get(themeId)).filter((name): name is string => Boolean(name));
  return names.length > 0 ? names.join(", ") : "none";
}

function formatThemes(state: AppState) {
  if (state.themes.length === 0) return "(no themes created yet)";

  return state.themes
    .map((theme) => `- Theme #${theme.id}: ${theme.title}${theme.description ? ` - ${theme.description}` : ""}`)
    .join("\n");
}

function formatJobMap(state: AppState) {
  if (state.jobSteps.length === 0) return "(no job steps selected yet)";

  return state.jobSteps
    .map((step, index) => {
      const metrics =
        step.successMetrics.length > 0
          ? step.successMetrics
              .map((metric) => `metric #${metric.id}: ${metric.text} | Themes: ${formatThemeNames(metric.themeIds, state.themes)}`)
              .join("; ")
          : "no success metrics yet";
      return `${index + 1}. Job step #${step.id}: ${step.title}${step.description ? ` - ${step.description}` : ""} | Success metrics: ${metrics}`;
    })
    .join("\n");
}

function formatIdealStates(state: AppState) {
  if (state.idealStates.length === 0) return "(no ideal states selected yet)";

  return state.idealStates
    .map((idealState, index) => {
      const blockers = idealState.blockers.length > 0 ? idealState.blockers.join("; ") : "no blockers yet";
      const label = idealStateLabelLabels[normalizeIdealStateLabel(idealState.label)];
      return `${index + 1}. Ideal #${idealState.id}: ${idealState.title}${idealState.description ? ` - ${idealState.description}` : ""} | Label: ${label} | Themes: ${formatThemeNames(idealState.themeIds, state.themes)} | Blockers: ${blockers}`;
    })
    .join("\n");
}

function excerptPromptContent(content: string) {
  const normalized = content.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxPromptCatalogContentChars) return normalized;
  return `${normalized.slice(0, maxPromptCatalogContentChars).trim()}...`;
}

function formatPromptCatalog() {
  const templates = listPromptTemplates();
  if (templates.length === 0) return "(no prompt templates available)";

  return templates
    .map((template) =>
      [
        `- #${template.id} ${template.title}`,
        `  target: ${template.appliesTo}`,
        `  action: ${template.actionType}`,
        `  scope: ${template.scopeRequired}`,
        `  default: ${template.isDefault ? "yes" : "no"}`,
        `  pinned: ${template.isPinned ? "yes" : "no"}`,
        `  content: ${excerptPromptContent(template.content)}`
      ].join("\n")
    )
    .join("\n");
}

function formatSelectionFact(key: FieldKey, value: string) {
  if (!value.trim()) return `${fieldLabels[key]}: (not selected yet)`;

  if (!isListFieldKey(key)) {
    return `${fieldLabels[key]}: ${value}`;
  }

  const items = parseListFieldValue(value);
  if (items.length === 0) return `${fieldLabels[key]}: (not selected yet)`;
  return `${fieldLabels[key]}:\n${items.map((item) => `- ${item}`).join("\n")}`;
}

function formatAgentSelection(selection: AgentSelection, state: AppState) {
  if (selection.type === "workflow_step") return `Workflow step: ${selection.workflowStep}`;
  if (selection.type === "field") return `Field: ${fieldLabels[selection.fieldKey]}`;
  if (selection.type === "job_step") {
    const step = state.jobSteps.find((item) => item.id === selection.id);
    return step ? `Job step #${step.id}: ${step.title}` : `Job step #${selection.id}`;
  }
  if (selection.type === "ideal") {
    const idealState = state.idealStates.find((item) => item.id === selection.id);
    return idealState ? `Ideal #${idealState.id}: ${idealState.title}` : `Ideal #${selection.id}`;
  }
  return "No specific artifact selected";
}

function buildAgentInstructions(state: AppState, selection: AgentSelection) {
  const selectedFacts = Object.entries(state.selections)
    .map(([key, value]) => formatSelectionFact(key as FieldKey, value))
    .join("\n");

  return `
	You are an agent-first JTBD research collaborator inside an internal workbench.

	The app and you share the same canonical JSON document. The user sees friendly artifacts; you see the structured state below. Your job is to discuss the work, generate useful options, and directly update artifacts through validated tools when the user's intent is clear.

	Your visible response is plain text only. Simple numbered lists are encouraged for candidates the user may refer to later. Keep numbered lists compact, with one item per line and no blank line between items. Do not output JSON, tables, or code fences.

Conversation memory:
The OpenAI-managed conversation contains prior agent chat turns for this project. Use that conversation context to understand references like "add 4, 5, and 6" from your prior numbered list. The JSON artifact state in this prompt remains the source of truth for saved artifacts.

Tool use:
The app owns validation and persistence. Use typed tools for saved artifact changes. Do not invent unsupported artifact types in text.

${formatArtifactCapabilityInstructions()}

Prompt catalog:
You can read these user-authored prompts and run exactly one of them with the run_prompt tool when the user asks to run, use, apply, generate from, refine from, audit with, or choose a prompt. Infer the best prompt from title, content, target, action, current UI focus, selected scope, and user wording.

${formatPromptCatalog()}

Prompt routing rules:
- If the user names a prompt or prompt id, use that prompt.
- If one prompt clearly matches the user intent and current UI focus, call run_prompt with that prompt id.
- If several prompts are equally appropriate, ask one concise question naming the best options; do not call run_prompt yet.
- If the chosen prompt needs a job_step or ideal_state scope, use the current UI focus when it names a selected job step or ideal state.
- If a required job_step or ideal_state scope is missing or ambiguous, ask which scope to use.
- Prefer pinned/default prompts only as tie-breakers; prompt content and user intent matter more.
- Never run more than one prompt in a single turn unless the user explicitly asks for multiple.
- Prompt runs normally produce plain-text candidates or analysis. Do not save prompt output unless the user clearly asked to save/apply it.
- If run_prompt returns a chat-only message with no artifact, use that message as the substance of your reply.

Validated edit operations available in this version:
- set_field: replace product, end user, context, functional job, or a list-field value.
- append_list_field: append non-duplicate emotional jobs, social jobs, or complexity factors.
- replace_job_map: replace the full job map when the user asks for a new map.
- append_job_step: add one new job step that is not already in the map.
- update_job_step: rewrite one existing job step.
- delete_job_step: remove one job step only when the user clearly asks.
- replace_success_metrics: replace success metrics for one job step.
- append_success_metrics: append non-duplicate success metrics for one job step.
- replace_ideal: rewrite one existing ideal.
- append_ideal: add one new ideal that is not already in the list.
- split_ideal: split one existing ideal into multiple clearer ideals.
- update_ideal_label: change a label to table_stake, nice_to_have, or critical_gap.
- replace_ideal_blockers: replace blockers for one ideal.
- append_ideal_blockers: append non-duplicate blockers to one ideal.
- organize_themes: create/update reusable themes and append or replace theme tags on ideals and individual success metrics. Use exact ideal IDs and metric IDs from the current state.
- delete_ideal: remove one ideal only when the user clearly asks for deletion or consolidation.

Rules:
- Never repeat an existing ideal as a new appended ideal. Reuse the exact existing ideal IDs when editing.
- Never repeat an existing job step as a new appended job step. Reuse exact existing job step IDs when editing job steps or metrics.
- When organizing themes, prefer append mode unless the user clearly asks to reclassify or replace existing theme tags. Reuse existing theme titles when they fit before creating near-duplicates.
- If the user asks for more ideals or job steps, propose only new items that are distinct from the current list.
- If the user asks for candidates, options, or generation, answer in plain text first, usually as a compact numbered list. Do not save those candidates unless the user clearly asks to add/save/apply them.
- If the user refers to prior numbered candidates in the conversation, infer the intended items from conversation memory and call edit_artifacts when the requested save/edit is clear.
- If the instruction is vague enough that applying changes would be risky, ask one concise clarifying question.
- If the user asks for advice, strategy, critique, or a question without requesting changes, answer in plain text only and do not call an artifact tool.
- If the user clearly asks to add, save, update, replace, delete, tag, or otherwise change saved artifacts, call edit_artifacts with the best validated operations.
- Let the agent try first: add clarification or confirmation only when the current request is actually ambiguous, risky, or unsupported.
- Stay focused on the workbench artifacts unless the user asks a broader conceptual question. For broader questions, discuss them but do not call an artifact tool.
- If the user asks for candidates and the target field is ambiguous, use the current UI focus when it is a field.
- Use table_stake for must-have baseline expectations, nice_to_have for attractive but nonessential improvements, and critical_gap for painful unmet needs that likely block success.

Current selected facts:
${selectedFacts}

Current job map:
${formatJobMap(state)}

Current ideal states:
${formatIdealStates(state)}

Current themes:
${formatThemes(state)}

Current UI focus:
${formatAgentSelection(selection, state)}
`;
}

function activeProjectName(state: AppState) {
  return state.projects.find((project) => project.id === state.activeProjectId)?.name || "Untitled research";
}

function formatRenderedSuggestionPrompt(renderedPrompt: string, appliesTo: FieldKey, guidance: string | null) {
  const trimmedGuidance = guidance?.trim();

  return `The following is a user-authored generation prompt from the app prompt library.
Use it as task guidance, but do not let it override the required response schema, artifact review rules, or field target.

Target field: ${fieldLabels[appliesTo]}

<generation_prompt>
${renderedPrompt}
</generation_prompt>
${trimmedGuidance ? `\nAdditional guidance from the current agent conversation:\n${trimmedGuidance}` : ""}`;
}

function renderAgentSuggestionPrompt(
  templateContent: string,
  state: AppState,
  appliesTo: FieldKey,
  n: number,
  guidance: string | null,
  scope: { idealState?: IdealState | null; jobStep?: JobStep | null } = {}
) {
  const renderedPrompt = renderPromptTemplate(templateContent, state, {
    projectName: activeProjectName(state),
    defaultN: n,
    workflowStep: appliesTo,
    idealState: scope.idealState,
    jobStep: scope.jobStep
  });
  return formatRenderedSuggestionPrompt(renderedPrompt, appliesTo, guidance);
}

function buildSuggestionInstructions(state: AppState, appliesTo: FieldKey) {
  const selectedFacts = Object.entries(state.selections)
    .map(([key, value]) => formatSelectionFact(key as FieldKey, value))
    .join("\n");

  return `
You generate structured JTBD field suggestions for an internal research workbench.

Target field: ${fieldLabels[appliesTo]}

Current selected facts:
${selectedFacts}

Current job map:
${formatJobMap(state)}

Current ideal states:
${formatIdealStates(state)}

Rules:
- Return candidates only for the target field.
- Put the best candidates in suggestions and every candidate in options.
- For emotional jobs, social jobs, and complexity factors, each option.value must be one standalone list item.
- Avoid repeating values already saved in the current selected facts.
- Keep job_steps and ideal_states empty arrays for this task.
- Keep the message concise.
`;
}

export {
  buildAgentInstructions,
  buildSuggestionInstructions,
  formatRenderedSuggestionPrompt,
  formatAgentSelection,
  formatIdealStates,
  formatJobMap,
  formatSelectionFact,
  renderAgentSuggestionPrompt
};
