Build this in Next.js + TypeScript + Tailwind + shadcn/ui.

This is a fast-changing internal research workbench. Prioritize desktop usability and consistency.

Architecture boundaries:
- Before changing architecture boundaries, runtime ownership, persistence strategy, agent orchestration, or generation flow ownership, read `BOUNDARIES.md`.
- Keep durable boundary decisions in `BOUNDARIES.md` instead of scattering them through code comments or chat history.
- Do not add speculative boundaries. Update `BOUNDARIES.md` only after repeated work or an explicit architecture decision proves the boundary useful.
- If implementation pressure conflicts with `BOUNDARIES.md`, pause and call out the conflict before coding across the boundary.

Development setup:
- This project is edited live on a VPS as a solo/internal tool.
- The main URL, `https://jtbd.globalsupply.link`, is routed by Traefik to the `jtbd-tool` Docker container.
- The Docker container is expected to run the Next.js dev server with hot reload from the mounted repo.
- Use the existing URL/container dev setup for UI iteration; do not start a separate host `localhost` dev server unless explicitly asked.
- Do not switch the main URL back to a production Docker/build flow unless explicitly asked.
- Avoid restarting Docker for ordinary UI iteration.

UI improvement loop:
- The app is desktop-only for now. Do not spend time fixing mobile UI, running mobile screenshots, or tuning responsive behavior unless the user explicitly asks for mobile support.
- For tiny visual tweaks, edit locally and check hot reload in the browser. Do not run a full build, typecheck, smoke test, or deploy cycle by default.
- The fastest default check is a desktop-only Playwright screenshot of `https://jtbd.globalsupply.link` after hot reload. Inspect that screenshot manually.
- Use a wide desktop viewport as the shared UI baseline: `2048x1100`. This matches the user's browser more closely than the default `1440x1000` capture.
- For one interaction change, run a tiny targeted Playwright snippet for that exact interaction only.
- Do not run `npm run ui:smoke` for ordinary spacing, alignment, color, typography, copy, or simple component placement changes.
- Run `npm run ui:smoke` only after larger page restructures, when console/layout regressions are likely, or before a deliberate checkpoint/handoff.
- Run `npm run typecheck` only when TypeScript/JSX/component APIs changed enough to create real type risk; skip it for CSS-only changes.
- For larger batches or before a deliberate handoff/checkpoint, run `npm run typecheck` and the relevant smoke tests. Run `npm run build` only when explicitly preparing a production-style checkpoint.
- Batch validation and deployment work. Do not spend 5-10 minutes validating each small spacing, alignment, color, or typography adjustment.
