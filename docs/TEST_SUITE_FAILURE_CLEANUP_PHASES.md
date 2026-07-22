# Test suite failure cleanup phases

Plan to clear the ~121 fails / ~34 errors from a full-repo `bun test` run (observed after deposit / money-display work). Most failures share a few root causes — do **not** treat each failing test as a product bug.

## Phase 0 — Diagnose

Confirm buckets with **isolated** runs before changing production code or bulk-editing tests.

```bash
# A) Money formatting (real assertion drift)
cd apps/admin && bun test \
  src/lib/lease-deposit-display.test.ts \
  src/lib/lease-rent-schedule-display.test.ts \
  src/lib/start-lease-rent-billing.test.ts \
  src/lib/lease-proration-display.test.ts

# B) Hotel Tax CSV (missing fixture)
cd apps/server && bun test src/lib/income-hotel-tax-calculator-csv-extractor.test.ts

# C) DB / mappers cascade
cd apps/server && bun test \
  src/db/property-long-stays-rent-schedule.test.ts \
  src/db/property-long-stays-update-terms.test.ts

# D) Service tests that looked “random” in the full suite
cd apps/server && bun test \
  src/services/tenant-portal-access.test.ts \
  src/lib/stripe-connect-oauth-state.test.ts
```

**Expected**

| Bucket | Isolated result                                 |
| ------ | ----------------------------------------------- |
| A      | Fails with `$1,500` vs `$1,500.00` (or similar) |
| B      | Fails with `ENOENT` on the root CSV path        |
| C / D  | Pass                                            |

**Exit criteria:** Root causes confirmed; no speculative edits to `getRentSchedule` / `updateTerms` / tenant-access tests yet.

### Phase 0 results (2026-07-22)

Ran the four buckets in isolation. Root causes match the plan, with one extra leftover in D.

| Bucket             | Result               | Detail                                                                                                                                                                                                                                      |
| ------------------ | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A** Money        | **8 fail / 50 pass** | Confirmed `.00` drift. Examples: expected `$1,500.00` received `$1,500`; `$600.00` → `$600`; top-up `(+$300.00)` → `(+$300)`.                                                                                                               |
| **B** Hotel CSV    | **8 fail / 6 pass**  | Confirmed `ENOENT` on `…/sanem Final_Hotel_Tax_Calculator 3 (1)-Hotel Tax Calculator.csv`. Pure parse tests (`parseIncomeCsvDate`, `parseCsvMoney`) pass.                                                                                   |
| **C** DB / mappers | **29 pass / 0 fail** | `getRentSchedule` + `updateTerms` are green alone — full-suite fails are cascade, not schedule/terms bugs.                                                                                                                                  |
| **D** Services     | **12 pass / 1 fail** | `tenant-portal-access` all pass. `consumeStripeConnectOAuthState` “single-use” fails in isolation: test queues a second successful `getdel` mock, so reuse still returns a payload (test bug / leftover for Phase 4 — not mappers cascade). |

**Phase 0 complete.** Proceed to Phase 1 (money expectations). Do not edit rent-schedule / updateTerms / tenant-access tests based on the full-suite log.

---

## Phase 1 — Money display expectations

**Cause:** `formatMoney` omits trailing `.00` for whole dollars (`$1,500` not `$1,500.00`).

**Action:** Update expectations only — do **not** revert `formatMoney`.

Likely files:

- [`apps/admin/src/lib/lease-deposit-display.test.ts`](apps/admin/src/lib/lease-deposit-display.test.ts)
- [`apps/admin/src/lib/lease-rent-schedule-display.test.ts`](apps/admin/src/lib/lease-rent-schedule-display.test.ts)
- [`apps/admin/src/lib/start-lease-rent-billing.test.ts`](apps/admin/src/lib/start-lease-rent-billing.test.ts)
- [`apps/admin/src/lib/lease-proration-display.test.ts`](apps/admin/src/lib/lease-proration-display.test.ts)
- Any server email / notification tests still asserting `.00` for whole dollars

**Exit criteria:** Those files are green in isolation (~8–12 fails cleared).

### Phase 1 results (2026-07-22)

Updated admin expectations to match whole-dollar `formatMoney` (no trailing `.00`).

| File | Changes |
| ---- | ------- |
| `lease-deposit-display.test.ts` | `$1,500.00` → `$1,500`, `$0.00` → `$0`, balance row labels |
| `lease-rent-schedule-display.test.ts` | top-up `(+$300.00)` → `(+$300)` |
| `start-lease-rent-billing.test.ts` | first week/month preview amounts |
| `lease-proration-display.test.ts` | final/first week preview amounts |

**Skipped (still correct with `.00`):** server `lease-notifications` / `transactional-emails` — they use a separate `Intl.NumberFormat` that still shows cents. Hotel CSV `parseCsvMoney("$0.00")` is input parsing, not display.

**Verify:** `cd apps/admin && bun test` on the four files → **58 pass / 0 fail**.

**Phase 1 complete.** Proceed to Phase 2 (Hotel Tax CSV fixture).

---

## Phase 2 — Hotel Tax Calculator CSV fixture

**Cause:** Tests read a repo-root personal export that is not in the tree:

`sanem Final_Hotel_Tax_Calculator 3 (1)-Hotel Tax Calculator.csv`

Referenced from [`apps/server/src/lib/income-hotel-tax-calculator-csv-extractor.test.ts`](apps/server/src/lib/income-hotel-tax-calculator-csv-extractor.test.ts).

**Action (prefer in order):**

1. Commit a **small** sample under e.g. `apps/server/src/lib/fixtures/` and point the test at it, **or**
2. Restore the local file temporarily, **or**
3. `test.skip` fixture-dependent cases until a fixture exists

Do **not** change extractor logic for `ENOENT`.

**Exit criteria:** Hotel Tax CSV describe is green (~8 fails cleared).

### Phase 2 results (2026-07-22)

Committed a small sample fixture and pointed tests at it:

- New: [`apps/server/src/lib/fixtures/hotel-tax-calculator-sample.csv`](apps/server/src/lib/fixtures/hotel-tax-calculator-sample.csv) (6 importable rows + 1 `Err:522` junk row)
- Updated [`income-hotel-tax-calculator-csv-extractor.test.ts`](apps/server/src/lib/income-hotel-tax-calculator-csv-extractor.test.ts) path + counts (`6` rows; stayed/canceled/no-show/refunded = 3/2/1/1)

Extractor logic unchanged. **Verify:** `bun test src/lib/income-hotel-tax-calculator-csv-extractor.test.ts` → **14 pass / 0 fail**.

**Phase 2 complete.** Proceed to Phase 3 (`mappers` / mock cascade).

---

## Phase 3 — `mappers` SyntaxError / mock cascade

**Cause:** Full-suite unhandled errors:

```text
Export named 'mapPropertyReservationRow' not found in .../mappers.ts
Export named 'mapPropertyExpenseRow' not found in .../mappers.ts
```

Those exports exist in [`apps/server/src/db/mappers.ts`](apps/server/src/db/mappers.ts). Something earlier in the run breaks or partially mocks the module (often Bun `mock.module` pollution). That cascades into:

- `propertyLongStaysDb` (`updateTerms`, `extendLease`, `getRentSchedule`, security deposit, pagination, create)
- Income lines / catalog mapper tests
- Downstream services (tenant access, invites, JWT, phone bind, etc.)

**Action:**

1. Find the first test/file that loads a broken `mappers` (bisect order; search `mock.module` touching DB/`mappers`).
2. Fix isolation: complete mocks, avoid partial re-exports of `mappers`, restore modules between files if needed.
3. Prefer running tests **per app** in CI/scripts:

   ```bash
   cd apps/admin && bun test
   cd apps/server && bun test
   ```

   instead of one giant root `bun test` if root order stays flaky.

**Exit criteria:** `cd apps/server && bun test` is clean (or only intentional skips). This should clear most of the remaining ~90+ fails and the 34 errors.

**Do not** rewrite rent-schedule / updateTerms / tenant-access assertions in this phase unless an **isolated** run still fails.

---

## Phase 4 — Leftovers

Re-run the full suite (or per-app suites). Anything still red after Phase 3 is a **real** failure — fix one by one.

Known Phase 0 leftover (already fails in isolation):

- [`apps/server/src/lib/stripe-connect-oauth-state.test.ts`](apps/server/src/lib/stripe-connect-oauth-state.test.ts) — `returns payload once then null on reuse`: second `getdel` is mocked to return the payload again; either return `null` on the second call or drop the extra `mockResolvedValueOnce`.

**Exit criteria:** No unexplained fails; each remaining case has a dedicated fix or an explicit skip with a reason.

---

## Phase 5 — Guardrails

- Document: no reliance on uncommitted personal CSV fixtures at repo root.
- Split CI (or local scripts) into admin / server / shared when helpful.
- Keep money test expectations aligned with whole-dollar `formatMoney`.

**Exit criteria:** Future full runs don’t regress into the same cascade or missing-fixture noise.

---

## Impact summary

| Phase                    | Roughly clears         | Effort      |
| ------------------------ | ---------------------- | ----------- |
| 0 Diagnose               | —                      | Low         |
| 1 Money expectations     | ~8–12 fails            | Low         |
| 2 Hotel CSV fixture      | ~8 fails               | Low         |
| 3 Mappers / mock cascade | ~90+ fails + 34 errors | Medium–high |
| 4 Leftovers              | hopefully 0            | Low         |
| 5 Guardrails             | prevention             | Low         |
