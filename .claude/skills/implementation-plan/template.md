# [Feature Name] — Implementation Phases

One-paragraph summary: what this feature does, for whom, and the main technical stack
(e.g. Postgres + BullMQ + SES + SSE). Keep it scannable.

**Related code today**

- [path]: [one-line purpose]
- [path]: [one-line purpose]
- …

---

## Goals

- [User-visible outcome]
- [User-visible outcome]
- [Technical requirement — e.g. 202 Accepted, live progress, idempotency]

## Non-goals (initial release)

- [Deferred capability]
- [Deferred capability]
- [Explicit permission or scope cut]

---

## Guiding principles

1. **[Principle name]** — [One sentence: what to do and why]
2. **[Principle name]** — […]
3. **[Principle name]** — […]
4. …

---

## Target architecture

```
[Component A] → [API / action] → [Persistence]
                                        ↓
                              [Async worker / external service]
                                        ↓
                              [Side effects + aggregate updates]
                                        ↓
                              [Real-time channel → client]
                                        ↓
[Client] ← [stream / poll] ← [terminal state]
```

### Permissions

[Capability name or rule]

- [Who can access — role, user type]
- [Who cannot in v1]
- Mirror on server routes and client visibility (tabs, buttons).

### Feature flag

`[ENV_VAR_NAME]` — gate API, worker, and UI until production-ready.

---

## Data model (sketch)

### `[table_name]`

| Column | Notes |
| --- | --- |
| `id` | UUID |
| … | … |

### `[table_name]` (if applicable)

| Column | Notes |
| --- | --- |
| … | … |

**[Domain rule]:** [How rows are derived, deduped, or snapshotted]

---

## Shared contract (`packages/shared`)

| Type | Purpose |
| --- | --- |
| `T…` | [enum or status] |
| `I…` | [request/response body] |
| … | … |

---

## API (sketch)

| Method | Path | Notes |
| --- | --- | --- |
| `POST` | `/admin/…` | [status code, headers, auth] |
| `GET` | `/admin/…` | [purpose] |
| … | … | … |

---

## [Real-time / events] (if applicable)

Extend `[path/to/stream-types.ts]`:

- Event type: `[event.name]`
- Payload: `{ … }`

[Who receives events, throttle rules, client handler file, polling fallback endpoint]

---

## [Worker / job queue] (if applicable)

- Queue name: `[queue-name]`
- Process: [separate worker command — not in API process]
- Rate limiter: [alignment with external quota]
- Retries: [backoff, max attempts, transient vs permanent errors]
- Reuse: [existing send/storage modules]

---

## UI — [surface name] (if applicable)

1. **[Screen / section]** — [behavior]
2. **[Screen / section]** — [behavior]
3. …

[Tab/route file, permission gate]

---

## Phased rollout

### Phase 0 — Foundation (no user-facing feature)

**Goal:** [Infrastructure and contracts without exposing the feature]

- [ ] [Task]
- [ ] [Task]
- [ ] [Task]

**Exit criteria:** [Testable checks — migrations, tests pass, connects, no UI]

---

### Phase 1 — Backend pipeline ([API/script only])

**Goal:** [End-to-end core path without UI]

- [ ] [Task]
- [ ] [Task]

**Exit criteria:** [e.g. verify via script/Postman; DB + external service correct]

**Optional Phase 1b — [name]:** [Sub-phase only if it unblocks QA]

---

### Phase 2 — [SSE / progress / webhooks]

**Goal:** [Live updates before full UI]

- [ ] [Task]
- [ ] [Task]

**Exit criteria:** [Events on connected session; GET restores state after refresh]

---

### Phase 3 — [UI surface] MVP

**Goal:** [First usable UI]

- [ ] [Task]
- [ ] [Task]

**Exit criteria:** [User completes happy path; no long blocking spinner; history visible]

---

### Phase 4 — Hardening

**Goal:** Production-safe.

| Concern | Action |
| --- | --- |
| Rate limits | […] |
| Idempotency | […] |
| Dedupe | […] |
| Observability | […] |
| … | … |

**Exit criteria:** [Load test target; failure modes documented]

---

### Phase 5 — Enhancements (post-launch)

- [Deferred item]
- [Deferred item]

---

## What not to do

- Do **not** [specific anti-pattern tied to this feature]
- Do **not** […]
- …

---

## Safest sequencing summary

1. **[Rule]** — [one line]
2. **[Rule]** — [one line]
3. …
