# Income calculation rules

Short-stay reservations only. All amounts are rounded to 2 decimal places.

## Building blocks

| Term | Formula |
|------|---------|
| **Room total** | Stored lodging amount for the stay (what operators enter from booking confirmations) |
| **Avg / night** | `room total ÷ nights` (display only, not stored) |
| **Taxable base** | `room total + cleaning fee` |
| **Taxes** | Each property tax rate applied to the taxable base (e.g. Sales tax, Resort tax) |
| **Total taxes** | Sum of all tax line amounts |
| **Resort tax** | The tax line named `Resort tax` (matched by name) |
| **Commission base** | Usually `taxable base` (room total + cleaning fee); **Expedia uses room total only** |
| **Commission** | `commission base × channel commission rate` |

---

## Standard rules (Booking, Direct, …)

Resort tax is treated like any other tax. Commission is calculated on **taxable base** (room total + cleaning fee).

| Metric | Formula |
|--------|---------|
| **Gross income** | `taxable base + total taxes` |
| **Net income** | `taxable base − total taxes − commission` |
| **Net payout** | `taxable base − commission` |

Net payout is also `net income + total taxes` — taxes are removed in net income, then added back for payout.

**Example** — base `1000`, taxes `100` (incl. resort `40`), commission `150`:

- Gross = **1100**
- Net income = **750**
- Net payout = **850**

---

## Expedia — Commission base exception

Expedia commission is calculated on **room total only**. Cleaning fee is included in taxable base and taxes, but **excluded from commission**.

| Metric | Formula |
|--------|---------|
| **Commission base** | `room total` (cleaning fee excluded) |
| **Commission** | `room total × Expedia commission rate` |
| **Gross income** | `taxable base + total taxes` (unchanged) |
| **Net income** | `taxable base − total taxes − commission` |
| **Net payout** | `taxable base − commission` |

**Example** — room total `900`, cleaning fee `100`, taxable base `1000`, taxes `100`, Expedia rate `15%`:

- Commission = 900 × 0.15 = **135** (not 1000 × 0.15 = 150)
- Net income = 1000 − 100 − 135 = **765**
- Net payout = 1000 − 135 = **865**

---

## Airbnb — Resort tax exception (current)

Airbnb remits Resort tax directly, so it is handled differently.

| Metric | Formula |
|--------|---------|
| **Gross income** | `taxable base + total taxes − resort tax` |
| **Net income** | `taxable base − total taxes − commission − resort tax` |
| **Net payout** | `taxable base − commission − resort tax` |

Resort tax is **excluded from gross** and **deducted again in net payout** (on top of the normal tax treatment).

**Same example** — base `1000`, sales tax `60`, resort tax `40`, total taxes `100`, commission `155`:

- Gross = 1000 + (100 − 40) = **1060**
- Net income = 1000 − 100 − 155 − 40 = **705**
- Net payout = 1000 − 155 − 40 = **805**

---

## Quick comparison

| Channel | Commission base | Gross includes resort tax? | Net payout subtracts resort tax? |
|---------|-----------------|:--------------------------:|:--------------------------------:|
| **Booking, Direct, …** | Room total + cleaning fee | Yes | No |
| **Expedia** | Room total only | Yes | No |
| **Airbnb** | Room total + cleaning fee | No | Yes |

---

## Other income

Misc income lines have no taxes or commission: `gross income = net income = amount`.

## Source of truth

Shared formulas live in `packages/shared` (`property-income-utils.ts`) and `apps/server/src/services/property-income-calculator.ts`.
