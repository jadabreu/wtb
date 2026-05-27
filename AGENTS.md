# Agent Instructions

Use frontend-design for visual direction and shadcn for implementation accuracy.
Build this in Next.js + TypeScript + Tailwind + shadcn/ui.
Use existing components where possible.
Keep it polished, responsive, accessible, and production-ready.

## Architecture Direction

Ground AI architecture and product-design decisions in a future agentic workflow, even when the current implementation uses simple Responses API calls.

- Treat project variables and structured research artifacts as the source of truth, not chat history.
- Prefer scoped AI actions over generic chat messages, for example `generate_success_metrics(job_step)` or `audit_job_map(project_frame)`.
- Model AI work as: UI action -> action definition -> scoped variables/context -> model call -> structured result -> user preview/apply.
- Keep AI-generated changes explicit and user-approved before mutating saved project state.
- Store model outputs as candidates or artifacts before applying them to durable project variables.
- Design prompt templates and variables so selected objects can become action scope, for example `{{job_step}}`, `{{project_frame}}`, or `{{end_user}}`.
- Do not introduce full agent orchestration until a workflow genuinely needs multi-step planning, tool use, retries, or autonomous sequencing.
