# Home Workspace UI Polish — Implementation Phases

Visual-only redesign so admin **Home** feels like a modern command surface (dense, elegant, fast to click) instead of a dashboard of padded cards. Behavior, destinations, permissions, and hooks stay as they are today.

**Related code today**

- [`apps/admin/src/pages/home-page.tsx`](../apps/admin/src/pages/home-page.tsx) — Home stack (invites, admin stats, Continue, launcher, admin cards)
- [`apps/admin/src/components/home/home-workspace-continue-section.tsx`](../apps/admin/src/components/home/home-workspace-continue-section.tsx) — Continue rows
- [`apps/admin/src/components/home/home-property-workspace-card.tsx`](../apps/admin/src/components/home/home-property-workspace-card.tsx) — Property workspace tiles
- [`apps/admin/src/components/home/home-workspace-launcher.tsx`](../apps/admin/src/components/home/home-workspace-launcher.tsx) — Properties section + grid
- [`apps/admin/src/components/admin-page-layout.tsx`](../apps/admin/src/components/admin-page-layout.tsx) / [`admin-page-intro.tsx`](../apps/admin/src/components/admin-page-intro.tsx) — layout gap + intro
- Hooks unchanged: `useHomeWorkspaceProperties`, `getVisiblePropertyLauncherDestinations`, `buildPropertyResumePath`

---

## Goals

- Continue and property launchers feel **compact and premium** — less empty space, no card sprawl
- Preserve all current navigation behavior (resume paths, role-aware shortcuts, favorite toggle, stale-recent remove, launcher error/retry)
- First laptop viewport shows greeting + Continue + several properties without excess scroll
- Light, intentional motion (not decorative noise)

## Non-goals

- API / workspace-summary widgets / bringing back Find property or Portfolio reports
- Changing destination config or permission logic
- Redesigning sidebar, header switcher, or Cmd+K
- New animation libraries (use existing Tailwind `animate-in` / transitions)

## Guiding principles

1. **No nested cards for primary actions** — rows and tiles are the hit targets; borders/shadows only where needed for grouping.
2. **One primary click per surface** — Continue row resumes; property tile opens Overview; shortcuts are secondary text links.
3. **Quieter chrome** — section labels as small uppercase muted text; display font reserved for the greeting.
4. **Same contracts** — restyle components; do not fork destination builders.

---

## Phase 0 — Shared polish utilities

- [x] Write this phases doc
- [x] Add `formatHomeGreeting` in [`apps/admin/src/lib/home-greeting.ts`](../apps/admin/src/lib/home-greeting.ts) + tests
- [x] Extract [`HomeSectionHeader`](../apps/admin/src/components/home/home-section-header.tsx) (label + optional tip)

**Exit criteria:** Greeting helper tested; phases doc exists.

---

## Phase 1 — Continue compact rows

- [x] Rewrite Continue as full-width links in one grouped list (no Card / Resume button)
- [x] Stale rows: compact muted row + icon remove only
- [x] First-row mount highlight

**Exit criteria:** Continue has no Card/Resume CTA; resume + stale remove work; focus visible on rows.

---

## Phase 2 — Property workspace tiles

- [x] Dense tiles; tile click → Overview; shortcuts as text links; drop Open property
- [x] Quieter launcher header + `⌘K to search` tip; tighter grid; stagger animation
- [x] Skeleton/error/empty parity with new density

**Exit criteria:** No Open property button; no secondary pill shortcuts; favorite + shortcuts + tile click work.

---

## Phase 3 — Page hierarchy + admin density

- [x] Wire greeting `intro` + `gap={6}` on Home
- [x] Tighten admin invite/stats/shortcut blocks
- [x] Verify motion (Continue highlight + tile stagger)

**Exit criteria:** Home first paint feels intentional; admin paths unchanged; lint/build pass.

---

## Phase 4 — Cloudflare-style hub clone

- [x] Extract `useWorkspaceCommandSearch` shared by Home hero search and global modal
- [x] Hero search with inline results + `⌘K`/`Ctrl K` chips; columns hidden while search active
- [x] Three columns: Properties, Continue, Suggested
- [x] Route-aware ⌘K on `/home` focuses hero search via `HomeSearchFocusContext`
- [x] Delete orphaned Home components (financial overview, tiles, greeting, portfolio KPI, etc.)

**Exit criteria:** Home matches hub layout; global palette unchanged off Home; no dead imports.

---

## What not to do

- Do not reintroduce Recharts / portfolio KPI / Find property on Home
- Do not wrap Continue rows or tiles in nested `Card` + `CardHeader`/`CardContent`
- Do not use pill clusters / glow / purple gradient themes for “wow”
- Do not add `useMemo`/`useCallback` solely for referential stability
- Do not change `property-launcher-destinations` or server contracts for this polish
- Do not add framer-motion — stick to Tailwind animate utilities

## Completion notes

- **2026-07-20:** Home hub third column replaced **Suggested** nav shortcuts with **Recent Communications** (recent tenant email campaigns). See [`HOME_RECENT_COMMUNICATIONS_PHASES.md`](./HOME_RECENT_COMMUNICATIONS_PHASES.md).

## Safest sequencing

1. Doc + greeting helper (no UI risk)
2. Continue rows (highest UX impact, isolated file)
3. Property tiles + launcher skeleton/grid
4. Page intro + gap + admin chrome pass
