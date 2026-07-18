# Stripe Connect Standard OAuth — Implementation Phases

Add **Standard Connect OAuth** alongside the existing **Express Account Links** flow so property owners can either create a new Express account or connect an **existing Stripe account**. Admin settings shows **two explicit buttons** with distinct labels; checkout/webhooks keep using the same `stripe_account_id` destination charge path.

**Related code today**

- Express onboarding service: `apps/server/src/services/property-stripe-connect-service.ts` — `accounts.create({ type: "express" })` + `accountLinks.create`
- Connect routes: `apps/server/src/routes/admin/property-stripe-connect-routes.ts`
- Connect DB: `apps/server/src/db/property-stripe-accounts.ts`, migration in `apps/server/src/db/migrations.ts` (`property_stripe_accounts`)
- Shared contracts: `packages/shared/src/tenant-rent-payment-types.ts` (`IPropertyStripeConnectStatusResponse`)
- Admin UI: `apps/admin/src/components/settings/property-stripe-connect-section.tsx`, `apps/admin/src/pages/property-settings-page.tsx` (return URL handling via `?stripe_connect=return|refresh`)
- Admin API client: `apps/admin/src/lib/api-client.ts` (`propertyStripeConnectApi`)
- UI status helpers: `apps/admin/src/lib/property-stripe-connect-utils.ts`
- Checkout uses connected account: `apps/server/src/services/tenant-rent-payment-service.ts` (`transfer_data.destination`)
- Connect config/flags: `apps/server/src/lib/stripe-connect-config.ts`, `STRIPE_CONNECT_ENABLED`, optional `STRIPE_CONNECT_CLIENT_ID` in `apps/server/src/env.d.ts`
- Permissions: `apps/admin/src/hooks/use-property-permissions.ts` (`canManageStripeConnect` = owner or platform admin)
- Parent plan: `docs/TENANT_STRIPE_RENT_PAYMENTS.md` (Express chosen for v1; this doc extends onboarding only)

---

## Goals

- Property owners choose between **two onboarding paths** with unambiguous button copy:
  - **Set up new Stripe account** (Express — existing flow, relabeled)
  - **Connect existing Stripe account** (Standard OAuth — new)
- OAuth completes end-to-end: authorize → callback → persisted `stripe_account_id` → status sync → tenant rent payments enabled when `charges_enabled`.
- Status API exposes **account type** (`express` | `standard`) so UI can show the right follow-up actions.
- Existing checkout, webhooks, and rent ledger **unchanged** — both account types use the same destination charge model.
- Return UX matches Express today (`property settings ?stripe_connect=return` toast + status refresh).

## Non-goals (initial release)

- Switching account type after connect (Express ↔ Standard) without support/offboarding
- Disconnect / “change connected account” self-service
- Manager/accountant Connect management (owners + platform admins only, same as today)
- ACH, application fees, multi-currency
- Stripe Connect Custom accounts
- Showing Standard users a Stripe Express-style embedded onboarding inside PropertyOS

---

## Guiding principles

1. **One connected account per property** — `property_stripe_accounts.property_id` stays PK; first successful path wins; block the other path once connected.
2. **Checkout stays account-type agnostic** — only `stripe_account_id` + capability flags matter for `createCheckout`.
3. **OAuth state is single-use and bound** — state token includes `propertyId`, initiating `userId`, nonce; reject reuse/expiry/mismatch.
4. **Secrets stay server-side** — OAuth code exchange uses `STRIPE_SECRET_KEY`; client never sees authorization codes.
5. **Label clarity over brevity** — button text must tell users _which path_ they’re on; helper text under each button explains when to use it.
6. **Feature-gate Standard OAuth** — show “Connect existing Stripe account” only when `STRIPE_CONNECT_CLIENT_ID` is configured (and flag on).

---

## Target architecture

```
Admin settings
  ├─ "Set up new Stripe account" (Express)
  │     → POST /properties/:id/stripe/connect/express/onboarding-link
  │     → stripe.accounts.create(express) + accountLinks.create
  │     → Stripe hosted onboarding → return to admin settings
  │
  └─ "Connect existing Stripe account" (Standard OAuth)
        → POST /properties/:id/stripe/connect/oauth/authorize-url
        → redirect to connect.stripe.com/oauth/authorize
        → GET /stripe/connect/oauth/callback (API public route)
        → stripe.oauth.token → upsert property_stripe_accounts (type=standard)
        → redirect to admin settings ?stripe_connect=return

Tenant checkout (unchanged)
  → uses property_stripe_accounts.stripe_account_id
  → destination charge to connected account
```

### Permissions

- **Can manage Connect:** platform admin or property **owner** (`canManageStripeConnect` / `assertPropertyStructureAccess`) — unchanged.
- **Managers/accountants:** read-only status only if product adds that later; no OAuth/onboarding in v1.

### Feature flags / env

| Variable                   | Purpose                                                             |
| -------------------------- | ------------------------------------------------------------------- |
| `STRIPE_CONNECT_ENABLED`   | Master gate (existing)                                              |
| `STRIPE_SECRET_KEY`        | API + OAuth token exchange (existing)                               |
| `STRIPE_CONNECT_CLIENT_ID` | Standard OAuth client id (**required for Standard path**)           |
| `API_PUBLIC_URL`           | OAuth redirect URI base (existing pattern for webhooks/unsubscribe) |
| `PLATFORM_APP_URL`         | Post-OAuth redirect back to admin settings (existing)               |

Optional: `STRIPE_CONNECT_STANDARD_OAUTH_ENABLED=true` to dark-launch Standard path in prod before exposing the second button.

---

## Data model (sketch)

### Migration: extend `property_stripe_accounts`

| Column         | Notes                                                                            |
| -------------- | -------------------------------------------------------------------------------- |
| `account_type` | New enum/text: `express` \| `standard`, NOT NULL, default `express` for backfill |
| (existing)     | `stripe_account_id`, capability flags unchanged                                  |

**Rule:** On OAuth success, upsert row with `account_type = 'standard'`. On Express create, `account_type = 'express'`.

### OAuth state (pick one in Phase 0)

| Option              | Table / key                                    | Notes                                                          |
| ------------------- | ---------------------------------------------- | -------------------------------------------------------------- |
| **A (recommended)** | Redis key `stripe:oauth:state:{nonce}` TTL 10m | Reuse `apps/server/src/queues/redis-connection.ts`             |
| B                   | Postgres `stripe_connect_oauth_states`         | `nonce`, `property_id`, `user_id`, `expires_at`; delete on use |

Payload stored server-side; `state` query param = signed opaque nonce (HMAC with `JWT_SECRET` or dedicated pepper).

---

## Shared contract (`packages/shared`)

| Type                                           | Purpose                                               |
| ---------------------------------------------- | ----------------------------------------------------- |
| `TPropertyStripeAccountType`                   | `"express" \| "standard"`                             |
| `IPropertyStripeConnectStatusResponse`         | Add `accountType: TPropertyStripeAccountType \| null` |
| `IPropertyStripeConnectAuthorizeUrlResponse`   | `{ url: string }` for Standard OAuth start            |
| `IPropertyStripeConnectOnboardingLinkResponse` | Keep `{ url: string }` (Express)                      |

Rename route naming in API client for clarity (optional): `createExpressOnboardingLink` vs `createStandardOAuthUrl`.

---

## API (sketch)

| Method     | Path                                                             | Notes                                                                        |
| ---------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `GET`      | `/properties/:propertyId/stripe/connect/status`                  | Include `accountType`; sync from Stripe when connected                       |
| `POST`     | `/properties/:propertyId/stripe/connect/express/onboarding-link` | **Rename** from `/onboarding-link` (keep alias temporarily)                  |
| `POST`     | `/properties/:propertyId/stripe/connect/oauth/authorize-url`     | Returns Stripe OAuth URL; 409 if already connected                           |
| `GET`      | `/stripe/connect/oauth/callback`                                 | **Public** (no JWT); validates `state`, exchanges `code`, redirects to admin |
| (existing) | Stripe webhooks                                                  | Add `account.updated` handler in Phase 2                                     |

**OAuth authorize URL params (server-built):**

- `response_type=code`
- `client_id=STRIPE_CONNECT_CLIENT_ID`
- `scope=read_write`
- `redirect_uri=${API_PUBLIC_URL}/stripe/connect/oauth/callback`
- `state={signedNonce}`

**Callback errors:** redirect to settings with `?stripe_connect=error&reason=...` (mapped safe codes); toast in admin.

---

## Real-time / events

N/A for v1. Status refresh on settings return + optional `account.updated` webhook (Phase 2). No SSE required.

---

## UI — Property settings (`PropertyStripeConnectSection`)

### Definitive button labels (v1)

**When not connected** — show both options side by side (stack on mobile):

| Button   | Label                               | Helper (CardDescription or text below)                                              |
| -------- | ----------------------------------- | ----------------------------------------------------------------------------------- |
| Express  | **Set up new Stripe account**       | Use this if you don’t have Stripe yet. Stripe will guide you through a quick setup. |
| Standard | **Connect existing Stripe account** | Use this if you already manage a Stripe account and want rent paid into it.         |

**When connected — Express**

| Status           | Button                    |
| ---------------- | ------------------------- |
| Setup incomplete | **Continue Stripe setup** |
| Ready            | **Update Stripe details** |

**When connected — Standard**

| Status           | Button / copy                                                                                                                                                                                                              |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Setup incomplete | **Finish connecting Stripe account** (re-run OAuth or link to Stripe Dashboard message)                                                                                                                                    |
| Ready            | No onboarding button; show **Connected to your existing Stripe account** + link **Open Stripe Dashboard** (optional `accounts.createLoginLink` only works for Express — Standard users open stripe.com/dashboard directly) |

**Status badge additions**

- Show account type: `Express` | `Standard` next to existing Ready / Setup incomplete badge.

**Guardrails in UI**

- If `stripeAccountId` exists, **hide** the other onboarding path (not both buttons).
- If `STRIPE_CONNECT_CLIENT_ID` missing, hide Standard button + one-line note: “Connecting an existing Stripe account is not configured for this environment.”

---

## Phased rollout

Each parent phase below is split into **sub-phases** sized for **one PR each** (~3–11 files). Ship in order unless noted. Phase 2 stays a single PR (~3–5 files).

### Recommended PR sequence

```
0a → 0b → 0c → 1a → 1b → 1c → 1d → [Phase 2] → 3a → 3b → 3c → 3d → 4a → 4b → 4c → 4d
```

**Optional merges** (fewer PRs): `0a+0b`, `0c+1b`, `1c+1d`, `3a+3b`, `3c+3d`, `4a+4b+4c`.

---

### Phase 0 — Foundation (no user-facing feature)

**Goal:** Schema + contracts + config helpers without exposing Standard OAuth in UI.

**Parent exit criteria:** Migration applies; types compile; tests pass; no UI/API exposure yet.

#### Phase 0a — Schema + shared contract (~5–6 files)

**Goal:** DB and types exist; behavior unchanged.

- [x] Migration: add `account_type` to `property_stripe_accounts`; backfill existing rows to `express`
- [x] Extend `IPropertyStripeAccount`, mappers, `toConnectStatusResponse` with `accountType`
- [x] Shared: `TPropertyStripeAccountType`, extend `IPropertyStripeConnectStatusResponse`
- [x] Express upsert sets `account_type = 'express'` (minor service touch)

**Exit criteria:** `GET …/connect/status` returns `accountType: "express"` for existing rows; no OAuth code yet.

#### Phase 0b — Config + feature gates (~3–4 files)

**Goal:** Server knows whether Standard OAuth is allowed.

- [x] `isStripeConnectStandardOAuthEnabled()` / `requireStripeConnectStandardOAuthConfigured()`
- [x] Optional `STRIPE_CONNECT_STANDARD_OAUTH_ENABLED` in `env.d.ts`
- [x] Unit tests for config matrix (flag off, client id missing, both set)

**Exit criteria:** Config tests pass; no new routes; admin unchanged.

#### Phase 0c — OAuth state machinery (~2–3 new files)

**Goal:** State create/consume works in isolation (no HTTP routes).

- [x] Redis (or PG) store: `createOAuthState(propertyId, userId)`, `consumeOAuthState(nonce)`
- [x] HMAC/signed `state` param helper
- [x] Unit tests: TTL, single-use, wrong signature, wrong user

**Exit criteria:** Pure lib tests green; nothing callable from HTTP yet.

**Order:** 0a → 0b → 0c (strict).

---

### Phase 1 — Backend OAuth pipeline (API only)

**Goal:** Standard OAuth works without UI beyond manual URL test.

**Parent exit criteria:** Postman/Stripe test mode completes OAuth; DB row shows `standard` + `acct_…`; status endpoint returns correct flags.

#### Phase 1a — Express path cleanup (~3–4 files)

**Goal:** Express flow explicit; safe rename before adding Standard.

- [x] Rename route to `POST …/express/onboarding-link`; keep old `/onboarding-link` as alias
- [x] Ensure new Express accounts persist `account_type = 'express'`
- [x] 409 if property already connected and user tries Express again
- [x] Update service tests

**Exit criteria:** Existing admin “Connect with Stripe” still works via alias; status shows `accountType`.

#### Phase 1b — Standard OAuth start (~4–5 files)

**Goal:** Owner can get a Stripe OAuth URL; callback not implemented yet.

- [x] `createStandardOAuthAuthorizeUrl(propertyId, userId)` using state from 0c
- [x] `POST …/oauth/authorize-url` (owner-only, gated by 0b)
- [x] Optional: expose `standardOAuthEnabled` on status response for UI gating
- [x] Service + route tests (mock URL build; no token exchange)

**Exit criteria:** Postman returns `{ url }`; Stripe authorize page opens; callback 404/501 expected until 1c.

#### Phase 1c — OAuth callback + persistence (~4–6 files)

**Goal:** Full Standard path works end-to-end (no admin UI).

- [x] `GET /stripe/connect/oauth/callback` (public; register in `server.ts`)
- [x] Validate state → `stripe.oauth.token` → upsert `account_type = standard`
- [x] `syncAccountStatus(propertyId)` → redirect to settings `?stripe_connect=return`
- [x] Error redirects: `?stripe_connect=error&reason=…`

**Exit criteria:** Manual Stripe test-mode OAuth completes; DB + status flags correct.

#### Phase 1d — Error mapping + conflict rules (~3–4 files)

**Goal:** Edge cases polished before UI.

- [x] Map Stripe OAuth errors to stable `reason` codes
- [x] Reject Standard if Express connected (and vice versa) with clear 409/message
- [x] Idempotent callback (safe refresh/retry)
- [x] Expand service tests

**Exit criteria:** Denied OAuth, invalid grant, duplicate connect behave predictably.

**Order:** 1a first; then **1b → 1c → 1d** (1d may merge into 1c if preferred).

---

### Phase 2 — Webhook sync for Connect accounts

**Goal:** Capability flags stay accurate without relying on return URL alone.

- [x] Handle Stripe webhook `account.updated` in `stripe-webhook-service.ts`
- [x] Resolve `property_stripe_accounts` by `stripe_account_id`; update flags
- [x] Register `account.updated` in Stripe Dashboard webhook config (document in ops notes)
- [x] Tests: webhook updates `charges_enabled` / `details_submitted`

**Exit criteria:** Simulated `account.updated` event updates property status; Express + Standard both supported.

**Size:** ~3–5 files — keep as one PR. Ship after **1c** and before **3b**.

---

### Phase 3 — Admin UI MVP (dual buttons + labels)

**Goal:** Shippable settings UX with clear copy.

**Parent exit criteria:** Owner completes both paths in test mode from UI; labels match spec; wrong path hidden when already connected.

#### Phase 3a — Read-only UI: account type + Express label (~5–6 files)

**Goal:** UI reflects backend; still one onboarding button.

- [x] `api-client`: optional rename `createExpressOnboardingLink`; status includes `accountType`
- [x] Badge/utils: show **Express** / **Standard** when connected
- [x] Relabel single button → **Set up new Stripe account** (Express only for now)
- [x] Hide Standard button until backend exposes Standard OAuth as enabled

**Exit criteria:** Connected Express shows type; disconnected users see clearer Express label only.

#### Phase 3b — Dual buttons when disconnected (~2–3 files)

**Goal:** Two clear entry points.

- [x] `createStandardOAuthAuthorizeUrl` in API client + second mutation
- [x] When `not_connected` + Standard enabled: both buttons + helper text from spec
- [x] When connected: hide the other path’s button

**Exit criteria:** Both paths launch from UI in test mode; labels match spec table.

**Requires:** Phase 1c complete.

#### Phase 3c — Connected-state UX by account type (~3–4 files)

**Goal:** Correct follow-up actions per type.

- [x] Express incomplete: **Continue Stripe setup**; ready: **Update Stripe details**
- [x] Standard incomplete: **Finish connecting Stripe account** (re-OAuth)
- [x] Standard ready: copy + **Open Stripe Dashboard** (external link)
- [x] Status badge shows account type

**Exit criteria:** All four states (express/standard × incomplete/ready) render correctly.

#### Phase 3d — Settings return + error handling (~1–2 files)

**Goal:** Return URLs feel finished.

- [x] Handle `?stripe_connect=error&reason=…` on `property-settings-page.tsx`
- [x] Toasts for return / refresh / error; invalidate status query on all outcomes

**Exit criteria:** OAuth cancel/failure shows helpful message; success path unchanged.

**Order:** **3a → 3b → 3c → 3d** (3a can ship before 1c if only Express is shown).

---

### Phase 4 — Hardening

**Goal:** Production-safe dual-path Connect.

**Parent exit criteria:** Failure modes documented; rate limits tested; no PII/secrets in logs.

#### Phase 4a — Rate limits + abuse (~2–3 files)

- [x] Fixed-window limit on `authorize-url` and `express/onboarding-link` (reuse Redis limiter)
- [x] Tests for throttle

**Exit criteria:** Repeated clicks return 429; legitimate use unaffected.

#### Phase 4b — Observability (~2 files)

- [x] Structured logs: `connect_oauth_started`, `completed`, `failed` with `propertyId`, `accountType`
- [x] No secrets in logs

**Exit criteria:** Log lines appear in dev for happy and failed OAuth paths.

#### Phase 4c — Ops + docs (~1–2 files)

- [ ] Runbook: Stripe Dashboard redirect URI, test/live client IDs, webhook `account.updated`
- [ ] US-only constraint; failure mode table

**Exit criteria:** Ops can configure test and live Connect without reading source.

#### Phase 4d — Integration / regression (~2–4 files)

- [ ] Extend connect service tests for `standard` fixture
- [ ] Confirm checkout still works with Standard connected account (no payment code change expected)

**Exit criteria:** CI covers both account types; rent checkout smoke test passes.

**Order:** 4a–4d can parallelize after Phase 3; **4c** can start anytime.

| Concern                 | Sub-phase           |
| ----------------------- | ------------------- |
| CSRF / session fixation | 0c (+ verify in 4d) |
| Idempotency             | 1d                  |
| Conflicts (409)         | 1a, 1d              |
| Rate limits             | 4a                  |
| Observability           | 4b                  |
| Ops                     | 4c                  |

---

### Phase 5 — Enhancements (post-launch)

- Disconnect / replace connected account (support workflow)
- “Open Stripe Dashboard” for Express via login link
- Country selection per property
- Manager read-only Connect status in admin

---

### Approximate file counts (unique, cumulative)

| Parent phase  | Sub-phases | Approx. files | Notes                        |
| ------------- | ---------- | ------------- | ---------------------------- |
| 0             | 0a, 0b, 0c | 8–11          | Server + shared only         |
| 1             | 1a–1d      | 7–10          | No admin                     |
| 2             | —          | 3–5           | Webhook only                 |
| 3             | 3a–3d      | 6–8           | Admin only                   |
| 4             | 4a–4d      | 5–8           | Mostly edits to prior phases |
| **0–4 total** | —          | **~20–25**    | Overlap across PRs           |

**Untouched in 0–4:** `tenant-rent-payment-service.ts`, tenant pay UI, payment webhook handlers (except `account.updated` in Phase 2).

---

## What not to do

- Do **not** replace Express with Standard-only — product decision is **both** paths.
- Do **not** run OAuth code exchange in the admin SPA — callback must be a server route with the secret key.
- Do **not** store OAuth `code` or access tokens long-term — only persist `stripe_account_id`.
- Do **not** allow Standard OAuth when `STRIPE_CONNECT_CLIENT_ID` is unset — hide the button, don’t fail at click time.
- Do **not** create a second Connect account if `property_stripe_accounts` already exists — return 409 with clear message.
- Do **not** change checkout/webhook payment logic per account type unless Stripe capability differences require it.
- Do **not** use vague labels like “Connect with Stripe” when two buttons are visible.

---

## Safest sequencing summary

1. **Schema + shared types first (0a)** — `account_type` before any OAuth callback writes.
2. **Config and state before routes (0b → 0c)** — gates and CSRF machinery before public callback.
3. **Express path safe rename (1a)** — don’t break existing onboarding until alias exists.
4. **OAuth callback on API host before UI (1b → 1c)** — prove token exchange with Postman/Stripe test mode.
5. **Webhook sync before dual-button UI (Phase 2 before 3b)** — Standard users often finish requirements in Stripe Dashboard after OAuth.
6. **UI in thin slices (3a → 3d)** — read-only type display before second button; errors last.
7. **Hardening after happy path (4a–4d)** — rate limits and ops once both paths work from UI.

---

## Stripe Dashboard prep (before Phase 1 testing)

1. Enable Connect → OAuth settings in test mode.
2. Add redirect URI: `{API_PUBLIC_URL}/stripe/connect/oauth/callback`.
3. Set `STRIPE_CONNECT_CLIENT_ID` in server env.
