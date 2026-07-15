# Architecture Boundaries

Keep this file short. Add a boundary only after repeated work or an explicit architecture decision proves it useful.

## Purpose

This file records architecture boundaries future work should respect. It is not a design manifesto, roadmap, or refactor backlog.

## Agent-First Complexity

Assume the agent can handle the workflow with conversation and its existing tools.

Add complexity only in response to observed failures or persistent friction. Escalate gradually: improve guidance first, add lightweight guardrails next, and introduce dedicated UI, registries, review objects, or workflow state only when simpler measures have proven insufficient.

Default posture: let the agent try; guide it when needed; build machinery last.

## Data

The canonical project state is a JSON document, not a relational database.

Do not introduce SQLite, Prisma, migrations, or a server database unless project content, querying, concurrency, or deployment needs clearly exceed the JSON document model.

## Agent Collaboration

The app is artifact-first. The user edits structured artifacts in the UI; the agent discusses and proposes changes against the same artifact state.

Agents may directly update saved artifacts through validated tools when user intent is clear. Use proposal/review flows only when the user asks for review, the edit is ambiguous or risky, or observed failures show direct editing is causing friction.

Use one OpenAI-managed conversation per project for model memory. The app stores the conversation id, passes it through the Agents SDK, and lets the Responses API manage prior context and server-side compaction.

Use the Agents SDK for orchestration, typed tools, streaming events, and future multi-agent handoffs. Do not use the SDK `Session` abstraction, app-owned model replay files, or `OpenAIResponsesCompactionSession` for the main workbench chat path unless this boundary is explicitly revisited.

The visible chat transcript and canonical artifact JSON remain app-owned. The OpenAI conversation is model memory only; saved artifacts, UI history, and any optional review state must not depend on reading it back.

## Prompt Generation

Prompt templates live in the app prompt library.

The agent should access generation prompts through tools rather than duplicating prompt wiring in UI buttons or hardcoded route logic.

## UI

Manual artifact editing remains available in the main UI.

Generation and polishing flows should happen through the agent/chat layer unless there is a strong product reason to add a separate direct generation control.
