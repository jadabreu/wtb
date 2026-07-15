import type { PromptActionType, PromptAppliesTo, PromptScopeRequired } from "@/lib/types";

export type DefaultPromptTemplateSeed = {
  title: string;
  category: string;
  appliesTo: PromptAppliesTo;
  actionType: PromptActionType;
  scopeRequired: PromptScopeRequired;
  isDefault: boolean;
  isPinned: boolean;
  sortOrder: number;
  defaultN: number;
  content: string;
};

export const defaultPromptTemplates: DefaultPromptTemplateSeed[] = [
  {
    title: "Clarify product",
    category: "Workflow prompts",
    appliesTo: "product",
    actionType: "generate",
    scopeRequired: "none",
    isDefault: true,
    isPinned: true,
    sortOrder: 10,
    defaultN: 5,
    content: `Generate {{n}} clear product or service framings for this research project.

Current product/service: {{product}}
Project frame:
{{project_frame}}

Each option should be concrete enough to research, but not over-specified. Keep each candidate concise.`
  },
  {
    title: "Generate end-user candidates",
    category: "Workflow prompts",
    appliesTo: "end_user",
    actionType: "generate",
    scopeRequired: "none",
    isDefault: true,
    isPinned: true,
    sortOrder: 20,
    defaultN: 10,
    content: `Generate {{n}} possible end-user candidates for {{product}}.

Project frame:
{{project_frame}}

For each candidate, explain why they may have the job, what situation triggers it, and what would make them a strong or weak fit.`
  },
  {
    title: "Generate context candidates",
    category: "Workflow prompts",
    appliesTo: "context",
    actionType: "generate",
    scopeRequired: "none",
    isDefault: true,
    isPinned: true,
    sortOrder: 30,
    defaultN: 8,
    content: `Given this product and end user, suggest {{n}} likely contexts where the job appears.

Project frame:
{{project_frame}}

List concrete situations, triggers, constraints, or environments that could create demand.`
  },
  {
    title: "Sharpen functional job",
    category: "Workflow prompts",
    appliesTo: "job",
    actionType: "refine",
    scopeRequired: "none",
    isDefault: true,
    isPinned: true,
    sortOrder: 40,
    defaultN: 8,
    content: `Generate {{n}} sharper JTBD-style functional job statements.

Project frame:
{{project_frame}}

Each option must describe progress the end user is trying to make. Do not phrase options as product features, tasks, or solutions.`
  },
  {
    title: "Generate emotional jobs",
    category: "Workflow prompts",
    appliesTo: "emotional_job",
    actionType: "generate",
    scopeRequired: "none",
    isDefault: true,
    isPinned: true,
    sortOrder: 50,
    defaultN: 10,
    content: `Generate {{n}} emotional Jobs-to-be-Done for this project.

Project frame:
{{project_frame}}

Each option must be one standalone emotional job: how the end user wants to feel or stop feeling while making progress. Keep them simple and visceral.`
  },
  {
    title: "Generate social jobs",
    category: "Workflow prompts",
    appliesTo: "social_job",
    actionType: "generate",
    scopeRequired: "none",
    isDefault: true,
    isPinned: true,
    sortOrder: 60,
    defaultN: 10,
    content: `Generate {{n}} social Jobs-to-be-Done for this project.

Project frame:
{{project_frame}}

Each option must be one standalone social job: how the end user wants to be perceived or avoid being perceived. Keep them simple and grounded in real social pressure.`
  },
  {
    title: "Generate complexity factors",
    category: "Workflow prompts",
    appliesTo: "complexity_factors",
    actionType: "generate",
    scopeRequired: "none",
    isDefault: true,
    isPinned: true,
    sortOrder: 70,
    defaultN: 10,
    content: `Generate the {{n}} most important complexity factors for this JTBD frame.

Project frame:
{{project_frame}}

Each option must be one condition, variable, constraint, or force that makes the job harder, riskier, slower, more urgent, or more confusing.`
  },
  {
    title: "Create job map",
    category: "Workflow prompts",
    appliesTo: "job_map",
    actionType: "generate",
    scopeRequired: "none",
    isDefault: true,
    isPinned: true,
    sortOrder: 80,
    defaultN: 12,
    content: `Create a medium-fidelity job map for this JTBD frame.

Project frame:
{{project_frame}}

A job map breaks the job into the main steps the user must accomplish from beginning to end.

Rules:
- Return {{n}} ordered job steps when possible.
- Each step should describe what the user is trying to accomplish, not how they do it.
- Begin each step name with a gerund verb.
- Keep the steps MECE: no duplicates, no major gaps.
- Do not include product features, tools, tiny micro-actions, or methods unless they are part of the job itself.
- Do not include success metrics unless explicitly asked in this prompt.`
  },
  {
    title: "Generate success metrics",
    category: "Workflow prompts",
    appliesTo: "success_metrics",
    actionType: "generate",
    scopeRequired: "job_step",
    isDefault: true,
    isPinned: true,
    sortOrder: 90,
    defaultN: 8,
    content: `Generate {{n}} success metrics for this job step.

Job step:
{{job_step}}

Project frame:
{{project_frame}}

Return metrics that describe what must be true for this step to be completed well. Avoid product features, tasks, methods, or vague satisfaction statements.`
  },
  {
    title: "Generate ideals",
    category: "Workflow prompts",
    appliesTo: "ideals",
    actionType: "generate",
    scopeRequired: "none",
    isDefault: true,
    isPinned: true,
    sortOrder: 100,
    defaultN: 8,
    content: `Generate {{n}} ideal states for this JTBD frame.

Current job map, if one exists:
{{job_map}}

Project frame:
{{project_frame}}

Label each ideal as table_stake, nice_to_have, or critical_gap.

Return standalone ideal-state items that describe what should be true in the user's world when the job is handled exceptionally well. Do not require a job map to generate useful ideals. Avoid product features, tasks, methods, or vague satisfaction language.`
  },
  {
    title: "Generate blockers",
    category: "Workflow prompts",
    appliesTo: "blockers",
    actionType: "generate",
    scopeRequired: "ideal_state",
    isDefault: true,
    isPinned: true,
    sortOrder: 110,
    defaultN: 8,
    content: `Generate {{n}} blockers for this ideal state.

Ideal state:
{{ideal_state}}

Existing blockers:
{{ideal_state_blockers}}

Project frame:
{{project_frame}}

Return concrete blockers that could prevent this ideal state from being reached. Avoid restating the ideal, naming product features, or using vague obstacle language.`
  },
  {
    title: "Challenge assumptions",
    category: "Research quality",
    appliesTo: "chat",
    actionType: "challenge",
    scopeRequired: "none",
    isDefault: false,
    isPinned: true,
    sortOrder: 120,
    defaultN: 10,
    content: `Challenge the current JTBD frame.

{{project_frame}}

Identify the riskiest assumptions, what might be too vague, and what I should validate next.`
  },
  {
    title: "Interview questions",
    category: "Interviews",
    appliesTo: "chat",
    actionType: "generate",
    scopeRequired: "none",
    isDefault: false,
    isPinned: false,
    sortOrder: 130,
    defaultN: 10,
    content: `Generate {{n}} interview questions for this JTBD research project.

{{project_frame}}

Create open-ended questions that uncover behavior, triggers, tradeoffs, and success criteria.`
  },
  {
    title: "Summarize frame",
    category: "Synthesis",
    appliesTo: "chat",
    actionType: "audit",
    scopeRequired: "none",
    isDefault: false,
    isPinned: false,
    sortOrder: 140,
    defaultN: 10,
    content: `Summarize the current JTBD frame for {{project_name}}.

{{project_frame}}

Return a concise summary, unresolved gaps, and the next best research question.`
  }
];
