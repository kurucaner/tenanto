---
name: release-notes
description: Bump the app version and write the "What's changed" release notes for everything shipped since the last version. Use when the user asks to update the version, cut a release, or generate/refresh release notes / changelog for the tenanto admin app.
---

# Release notes & version bump

Produce a new release: pick the next version, gather every user-facing change since the
last release, write it in plain non-technical language, and update the two files that
drive the in-app "What's changed" dialog and version label.

## Files this touches
- `package.json` (repo root) — `version`. This is the single source of truth for the
  in-app version: `apps/admin/vite.config.ts` reads it into `VITE_APP_VERSION`, shown in
  the sidebar. **Bump this, not `apps/admin/package.json`.**
- `apps/admin/src/config/release-notes.ts` — the `RELEASE_NOTES` array. Newest release is
  the **first** entry; `LATEST_RELEASE_ID` derives from it automatically. Its file header
  holds the canonical writing guidelines — follow them.

## Steps

1. **Find the current/last release.** Read the top entry of `RELEASE_NOTES` in
   `apps/admin/src/config/release-notes.ts` — its `id` is the last shipped version. Confirm
   it matches the root `package.json` `version`.

2. **Find the commit range since that release.** The commit that introduced the last note
   is the anchor:
   ```bash
   git log -S'id: "<LAST_VERSION>"' --oneline -- apps/admin/src/config/release-notes.ts | head -1
   ```
   Then list candidate changes since it:
   ```bash
   git log <ANCHOR_COMMIT>..HEAD --oneline
   ```
   Also glance at uncommitted work (`git status`, `git diff --stat`) — a feature finished
   this session but not yet committed still belongs in the notes if it's user-visible.

3. **Filter to user-facing changes.** Keep things a property manager would notice or do.
   **Drop** pure refactors, performance/lint/type fixes, tests, build/CI, dependency
   bumps, and internal renames. When a commit message is technical, open the diff enough to
   judge the user impact. Merge several commits that add up to one feature into a single
   note (e.g. many "long stay" commits → one "record long-term stays" note).

4. **Write the copy** following the guidelines in the release-notes.ts header:
   - Email-a-property-manager tone; no jargon (API, cache, migration, endpoint, refactor…).
   - Short, active sentences: "You can now…", "Fixed an issue where…".
   - Group each item as `new` | `improved` | `fixed`.
   - Add a one-line `summary` naming the headline changes.
   - Prefer describing the current capability over narrating internal history (e.g. if a
     feature was reworked, describe what the user gets now, not that it was removed).

5. **Pick the next version.** Scheme is calendar-flavored `YYYY.MINOR.0` (e.g.
   `2026.4.0` → `2026.5.0`). Bump the minor for a normal feature release; ask the user only
   if the jump is ambiguous (e.g. a new year or a patch-only release).

6. **Apply the edits.**
   - Root `package.json`: set `version` to the new version.
   - `release-notes.ts`: prepend a new `ReleaseNote` object as the first array element, with
     `id` and `version` both equal to the new version, `publishedAt` = today's date
     (`YYYY-MM-DD`), the `summary`, and the grouped `changes`.

7. **Verify.**
   - `cd apps/admin && npx eslint src/config/release-notes.ts` — must pass.
   - Confirm root `package.json` `version` === the new top `RELEASE_NOTES[0].id`.
   - Present the final notes to the user for a quick read; version numbers and copy are
     easy to tweak.

## Notes
- Do not commit or tag unless the user asks.
- Keep entries balanced — a few `new`, a few `improved`, a few `fixed` reads better than a
  long undifferentiated list. If there's genuinely nothing in a category, omit it.
