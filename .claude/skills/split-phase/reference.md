# Split-phase reference — templates and examples

## Ask-mode proposal output (paste to user before editing)

Use this shape in Step 1 so the user can review quickly:

```markdown
## Proposed split: Phase N — [title]

**Parent goal (unchanged or refined):** …

### Already shipped (will document, not re-build)

| Concern | Status |
| --- | --- |
| … | … |

### Sub-phases

#### Phase N.1 — [title]
**Goal:** …
**Tasks:** (bullets)
**Exit criteria:** …

#### Phase N.2 — [title]
…

### Suggested order
N.1 → N.2 → …

### Minimal release cuts (optional)
1. **N.1 + N.2** — …
2. **N.3 + N.4** — …

### Doc sections to update
- Safest sequencing summary: …
- Phase dependency diagram: …
- Where to start: …
```

---

## Agent-mode parent + sub-phase template

Replace the monolithic `### Phase N` body with:

```markdown
### Phase N — [Parent title]

**Goal:** [One paragraph — outcome of the whole phase.]

[Optional: one line explaining sub-phases are for safe, incremental delivery.]

**Already shipped (Phase X / Y — do not re-implement):**

| Concern | Status |
| --- | --- |
| … | … |

---

#### Phase N.1 — [Sub-phase title]

**Goal:** [Single shippable outcome.]

**Tasks**

- [ ] …
- [ ] …

**Exit criteria:** [Concrete verification.]

---

#### Phase N.2 — [Sub-phase title]

…

---

**Phase N overall exit criteria:** [Roll-up of sub-phases.]

**Suggested implementation order:** N.1 → N.2 → …

**Minimal three-release cut:**

1. **N.1 + N.2** — …
2. **N.3 + N.4** — …
3. **N.5 + N.6** — …
```

---

## Annotated example — Phase 4 (hardening)

Source: `docs/TENANT_PORTAL_PHASES.md`. Patterns to copy:

**Parent keeps roll-up goal + already-shipped table:**

```markdown
### Phase 4 — Hardening + lifecycle polish

**Goal:** Production-safe invites and clear lease-end behavior. Split into sub-phases so each slice is shippable and testable before the next.

**Already shipped (Phase 1 / 3 — do not re-implement):**

| Concern | Status |
| --- | --- |
| Idempotency / 409 | Duplicate pending invite → `DuplicatePortalInviteError` → 409 |
| … | … |
```

**Each sub-phase is independently verifiable:**

```markdown
#### Phase 4.1 — Invite expiry (DB + admin truth)

**Goal:** Expired invites are `expired` in the DB, not only rejected at read time.

**Tasks**

- [ ] `expirePendingPortalInvites()` in `lease-tenant-memberships` — …
- [ ] Cron (mirror `property-export-expiry-cron`) **or** lazy sweep on …
- [ ] Tests: pending past TTL → `expired`; admin badge **Expired**

**Exit criteria:** Admin Tenants tab status matches DB; accept/preview still blocked after TTL.
```

**Tail: roll-up + order + release cuts:**

```markdown
**Phase 4 overall exit criteria:** Failure modes documented; invite TTL works in DB; …

**Suggested implementation order:** 4.1 → 4.2 → 4.3 → 4.4 → 4.5 → 4.6 → 4.7 (optional).

**Minimal three-release cut:**

1. **4.1 + 4.2** — TTL in DB + observable logs
2. **4.3 + 4.4** — abuse protection + token hardening
3. **4.5 + 4.6** — archive + documentation
```

---

## Annotated example — Phase 2 (UI)

Source: `docs/TENANT_PORTAL_PHASES.md`. UI phases split by **demoable browser milestone**:

| Sub-phase | Milestone |
| --------- | --------- |
| 2.1 | Both apps render; shared theme |
| 2.2 | API client + session (no UI feature yet) |
| 2.3 | Login/register OTP |
| 2.4 | Accept invite (primary user milestone) |
| 2.5 | Portal home |
| 2.6 | Polish / Docker (optional / defer) |

Parent may include **shared package strategy** prose before sub-phases — keep that at parent
level when it applies to all children.

---

## Sequencing summary lines

Expand one parent bullet into sub-phase bullets:

```markdown
11. **Phase 4.1 — Invite expiry (DB)** — pending rows transition to `expired`; admin truth.
12. **Phase 4.2 — Observability** — `tenant_portal.*` structured logs.
…
```

---

## Dependency diagram fragment

```text
Phase 3 (Tenants tab badges + lease detail)
    ↓
Phase 4.1 (invite expiry DB)
    ↓
Phase 4.2 (observability)
    ↓
Phase 4.3 (rate limits) → Phase 4.4 (security)
    ↓
Phase 4.5 (ended-lease archive) → Phase 4.6 (docs + E2E)
    ↓
Phase 4.7 (load / soak, optional)
    ↓
Phase 5 (enhancements)
```

---

## Usage examples

**Minimal invocation:**

```
/split-phase

### Phase 5 — Enhancements + scale (post-launch)

docs/TENANT_PORTAL_PHASES.md
```

**With custom prompt:**

```
/split-phase

### Phase 4 — Hardening + lifecycle polish

This is a big phase to implement at once — phase it out into smaller sub-phases so nothing goes wrong during development.
```

**After Ask-mode proposal — user approves:**

```
Go ahead and update the doc.
```

Agent then runs Step 2 only (edits the markdown, no code).
