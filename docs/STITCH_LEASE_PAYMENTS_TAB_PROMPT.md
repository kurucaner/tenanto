# Stitch prompt: Lease Details — Payments tab

Copy everything below the horizontal rule into [Google Stitch](https://stitch.withgoogle.com/).

---

**Design a complete UI for the Payments tab on a Lease Details page in PropertyOS**, a property-management admin web app for rental operators.

### Product context

- Desktop-first admin SPA (also usable on tablet/mobile).
- Page chrome above the tab (for layout context only — do not redesign the whole app):
  - Back link: “← Back to leases”
  - Lease header: tenant name, status badge (`Active` / `Ended`), optional `Holdover` badge
  - Subtitle: unit label · current rent with `/mo` or `/wk` · optional “Contract ended”
  - Actions (when active + can manage): `Extend Lease`, `End Lease`
  - Optional amber settlement banner (ended lease with unsettled deposit): title “Security deposit still needs settlement”, body “$X collected — refund and/or withhold from Income.”, CTA `Settle deposit`
  - Tabs: Overview · Tenants · **Payments** · Terms
- **Focus: redesign only the Payments tab content** as a complete, production-ready screen composition.

### Design direction

- Light mode only.
- Soft inspiration from **Cloudflare dashboard**: clean density, clear hierarchy, quiet borders, strong scanability, purposeful whitespace — not flashy marketing UI.
- Do not over-prescribe style. Propose a polished, modern admin layout that fits a serious B2B product.
- Typography available in product: **Geist** (UI/body), **Cormorant** (optional display/heading). Prefer Geist for this operational screen.
- Corner radius ~10px (`0.625rem`).

### Light color scheme (use these tokens)

| Token | Hex (approx) | OKLCH |
| --- | --- | --- |
| Background | `#FDFCF9` | `oklch(0.99 0.004 85)` |
| Foreground | `#0F171F` | `oklch(0.2 0.02 250)` |
| Card | `#FFFFFD` | `oklch(1 0.003 85)` |
| Primary | `#193550` | `oklch(0.32 0.06 250)` |
| Primary foreground | `#FDFCF8` | `oklch(0.99 0.005 85)` |
| Secondary | `#F6F3ED` | `oklch(0.965 0.008 85)` |
| Secondary foreground | `#1D2A37` | `oklch(0.28 0.03 250)` |
| Muted | `#F4F1ED` | `oklch(0.96 0.006 85)` |
| Muted foreground | `#555F69` | `oklch(0.48 0.02 250)` |
| Accent | `#F4F0E7` | `oklch(0.955 0.012 85)` |
| Accent foreground | `#122334` | `oklch(0.25 0.04 250)` |
| Destructive | `#E7000B` | `oklch(0.577 0.245 27.325)` |
| Border / Input | `#E4E1DA` | `oklch(0.91 0.01 85)` |
| Ring | `#607489` | `oklch(0.55 0.04 250)` |
| Sidebar (ambient) | `#FAF7F3` | `oklch(0.978 0.006 85)` |

Semantic accents already used in product (you may keep or refine):

- Success/paid check: green (~`#16A34A`)
- Warning/settlement banner: amber surface (`amber-50` / `amber-200` border / `amber-900` text)

Currency display: USD-style money (e.g. `$1,850.00`).

---

### What the Payments tab must display (complete information inventory)

The tab has **two main blocks**: Security deposit + Rent payment schedule. Design both as one cohesive Payments experience.

#### A) Security deposit block

**Section label:** “Security deposit”

**Status badge** (when status ≠ `None`):

- `Due` — expected amount, nothing collected yet
- `Partial` — some collected, still outstanding
- `Held` — fully collected / currently held
- `Refunded` — deposit returned (fully or after withhold handling elsewhere)
- `None` — no contractual deposit (badge usually hidden)

**Balance fields (always show when relevant):**

- Expected — money amount, or “None” if no deposit
- Collected — money amount
- Outstanding — money amount still to collect

**Helper copy (conditional):**

- When deposit is Held, Refunded, or any amount has been collected:  
  “Refunds are managed from **Income**.” (Income is a text link)

**Primary action (conditional):**

- `Record deposit` — only when lease is Active, user can manage, expected > 0, and outstanding > 0

#### B) Rent schedule block

Supports **monthly** or **weekly** billing. Labels switch accordingly (`month`/`months` vs `week`/`weeks`). Period labels look like:

- Monthly: `July 2026`
- Weekly: `Week of Jul 15, 2026`

**Holdover notice (conditional, Active lease past contract end):**  
“Holdover rent is estimated through today and updates daily until you end the lease with the actual move-out date.”

**Summary line (one of):**

1. Has unpaid due periods:  
   `{count} unpaid · {totalRemaining} remaining`  
   e.g. `2 unpaid · $3,200.00 remaining`
2. No unpaid due, but upcoming exist:  
   `All due {months|weeks} are paid · {n} upcoming`
3. Everything paid (no upcoming):  
   `All rent {months|weeks} are paid.`
4. Empty schedule:  
   `No rent {months|weeks} in this lease.`
5. Loading: skeleton placeholders for a few rows

**Schedule is partitioned into three groups:**

1. **Unpaid** (due on/before current period, not fully paid)
2. **Upcoming** (after current period, not yet paid)
3. **Paid** (fully paid) — collapsed by default behind a toggle:
   - `Show N paid {month|week|months|weeks}`
   - or `Hide paid {months|weeks}`

**Each rent period row shows:**

- Visual paid/unpaid affordance (check when paid; empty circle when not)
- Period label (`July 2026` / `Week of Jul 15, 2026`)
- Optional badge: `Prorated`
- Optional badge: `Partial` (some paid, not fully paid)
- Amount subtitle:
  - If any paid: `{paid} / {expected}` e.g. `$900.00 / $1,850.00`
  - Else: `{expected}` e.g. `$1,850.00`
- If prorated: secondary line `{occupiedDays}/{daysInMonth} days` e.g. `12/31 days`
- Trailing action/status:
  - Paid group → badge `Paid`
  - Upcoming group → badge `Upcoming`
  - Unpaid + can record → button `Record`
  - Unpaid + cannot record → badge `Missing`

**Permissions / state rules that affect UI:**

- `Record` / `Record deposit` only when user can manage **and** lease is Active
- Ended leases are read-only for recording
- Partial payments allowed (same period can be recorded again until remaining is $0)

---

### Deliverables requested

Design a **complete Payments tab**, including:

1. Default Active lease with mixed unpaid / upcoming / paid periods (monthly example)
2. Security deposit in `Partial` with `Record deposit` visible
3. At least one prorated row and one partial-payment row
4. Paid section collapsed + expanded treatment
5. Weekly billing variant (or annotated how labels change)
6. Holdover state with notice
7. Fully paid / no unpaid state
8. Empty schedule state
9. Loading skeleton
10. Ended lease read-only treatment (no Record CTAs)
11. Deposit statuses coverage: Due, Held, Refunded, None (can be variants/annotations)

Also specify:

- Desktop layout (~1280+ wide content area)
- Narrow/mobile stacking
- Component anatomy (summary, lists, badges, CTAs, empty/loading)
- Visual hierarchy so operators can answer in seconds: “What’s unpaid?”, “How much remaining?”, “What’s the deposit status?”

Do not invent unrelated features (no payment gateway UI, no charts required). Focus on clarity of deposit balance + rent schedule operations.
