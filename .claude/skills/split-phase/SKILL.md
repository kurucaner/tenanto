---
name: split-phase
description: >-
  Break a large implementation phase in a *_PHASES.md doc into smaller sub-phases (e.g. Phase 4 →
  4.1–4.7). Use when the user invokes /split-phase, passes a main phase heading like "### Phase 4 —
  Hardening + lifecycle polish", or asks to sub-phase a big rollout so development stays safe.
disable-model-invocation: true
---

# Split phase into sub-phases

Break one **large** phase in an implementation plan into **shippable sub-phases** — first propose in
**Ask mode** (read-only), then update the markdown in **Agent mode** after the user approves.

Canonical examples in this repo: Phase 2 and Phase 4 in `docs/TENANT_PORTAL_PHASES.md`.

## Invocation

The user typically runs:

```
/split-phase
```

With arguments:

1. **Phase heading** (required) — exact `### Phase N — …` line from the doc, e.g.
   `### Phase 4 — Hardening + lifecycle polish`
2. **Doc path** (optional) — defaults to the open or named `docs/*_PHASES.md` file
3. **Prompt** (optional) — if omitted, use the default prompt below

### Default user prompt (use verbatim when the user does not supply one)

> This is a big phase to implement at once — phase it out into smaller sub-phases so nothing goes
> wrong during development.

## Two-step workflow (mandatory)

### Step 1 — Ask mode (read-only)

**Do not edit files.** Switch to or stay in Ask mode if available; otherwise treat this step as
read-only exploration only.

1. **Locate the phase** — open the doc; find the `### Phase N — …` section matching the user's
   heading. If ambiguous (multiple docs or headings), ask once which file/heading.
2. **Read the phase** — capture Goal, tasks, exit criteria, and any parent doc context (goals,
   architecture, related code, sequencing summary, dependency diagram).
3. **Search the codebase** — grep/read related routes, services, migrations, UI, shared types.
   Inventory what is **already shipped** vs still open. Do not invent file paths.
4. **Propose sub-phases** — output a structured proposal (see [reference.md](reference.md)):
   - Sub-phase count and `#### Phase N.M — Title` headings
   - Per sub-phase: **Goal**, checkbox **Tasks**, **Exit criteria**
   - **Already shipped** table (if work is partially done — prevents re-implementation)
   - **Suggested implementation order** and optional **minimal release cuts** (2–3 grouped drops)
   - **Doc sections to update** beyond the phase block (sequencing summary, dependency diagram,
     "Where to start", "What not to do" if new anti-patterns emerge)
5. **Explain why** — 2–4 sentences on safest sequencing (backend before UI, DB before cron, docs
   after behavior is stable, etc.).
6. **Stop and ask for approval** — end with: "Approve this breakdown and I'll update the doc" (or
   similar). Do **not** edit the markdown until the user confirms ("go ahead", "update the doc",
   "implement", "start", etc.).

### Step 2 — Agent mode (doc update)

After explicit approval, edit the phase doc only (unless the user names another path).

1. **Rewrite the parent phase** (`### Phase N — …`):
   - Keep or sharpen the parent **Goal**; add one line that sub-phases make each slice shippable
     and testable.
   - Insert **Already shipped** table when Step 1 found completed work.
   - Replace the monolithic task list with `#### Phase N.1`, `N.2`, … sub-sections (template in
     [reference.md](reference.md)).
   - Add **Phase N overall exit criteria**, **Suggested implementation order**, and optional
     **Minimal N-release cut** after the last sub-phase.
2. **Sync downstream sections** in the same file:
   - **Safest sequencing summary** — expand parent bullet into one line per sub-phase.
   - **Phase dependency diagram** — insert sub-phase nodes in order.
   - **Where to start** table — add rows for new sub-phases if the doc uses that section.
   - **What not to do** — add repo-specific anti-patterns only if the split surfaced new ones.
3. **Preserve doc style** — match existing phases: checkbox tasks `- [ ]`, real file paths in
   backticks, PropertyOS conventions (shared types, migrations array, TanStack Query, etc.).
4. **Do not implement code** unless the user explicitly asks — this skill updates the plan only.
5. **Summarize** — short reply: sub-phase count, suggested first sub-phase, top 2 sequencing rules.

## Sub-phase design rules

| Rule | Guidance |
| ---- | -------- |
| Slice size | Each sub-phase demoable or verifiable alone (curl, unit test, single UI surface, or doc) |
| Order | Foundation → pipeline/API → UI → hardening/docs; never UI before backend contract exists |
| Numbering | `#### Phase N.M — Short title` under parent `### Phase N — …` |
| Avoid duplication | "Already shipped" table for concerns done in earlier phases |
| Optional tail | Last sub-phase may be `(optional)` for load/soak or nice-to-have polish |
| Exit criteria | Testable — not "works well" or "QA pass" without concrete checks |

## PropertyOS defaults

When splitting phases in this monorepo:

- Prefer **contracts** in `packages/shared` before server or app changes.
- **Migrations** append to `apps/server/src/db/migrations.ts` — own sub-phase if schema changes.
- **Admin UI** sub-phases assume API + query keys exist in a prior sub-phase.
- **Cron / workers** after DB + service functions exist.
- **Docs / E2E matrix** after behavior stabilizes (usually near the end of hardening phases).

## Additional resources

- Sub-phase markdown template and annotated examples: [reference.md](reference.md)
