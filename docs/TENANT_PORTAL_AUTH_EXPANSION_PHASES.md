# Tenant Portal Auth Expansion (Google / Apple / Phone OTP) — Implementation Phases

Expand tenant portal sign-in beyond email/password while keeping a hard boundary with operator auth. Tenants still get `JwtAudience.TENANT` sessions via `issueTenantSession`; token verify stays `authenticateTenant`. Google/Apple reuse existing ID-token verification (`verifyGoogleToken` / `verifyAppleToken`) but **always resolve against `tenant_users`**, never `users`. Phone OTP uses SNS SMS for **login and bind of existing email-backed tenant accounts** — phone-only invites stay deferred; phone is gated by `TENANT_PHONE_AUTH_ENABLED`. Google/Apple tenant auth is always on (no feature flag). Stack: Postgres + Fastify + Redis rate limits + SNS + existing Google/Apple client IDs.

**Mapping:** Enhancements Phase 3 → this doc. Parent: [TENANT_PORTAL_ENHANCEMENTS_PHASES.md](./TENANT_PORTAL_ENHANCEMENTS_PHASES.md). Portal invite pipeline: [TENANT_PORTAL_PHASES.md](./TENANT_PORTAL_PHASES.md).

**Related code today**

- `apps/server/src/auth/google.ts` — verify Google ID token (`GOOGLE_WEB_CLIENT_ID`)
- `apps/server/src/auth/apple.ts` — verify Apple identity token
- `apps/server/src/auth/tenant-jwt.ts` — `signTenantAccessToken` / `authenticateTenant` (`aud === TENANT`)
- `apps/server/src/auth/jwt.ts` — platform JWT + refresh helpers (audience-separated)
- `apps/server/src/routes/auth/auth-routes.ts` — `/auth/google`, `/auth/apple` → `userDb.findOrCreateBy*` → platform session
- `apps/server/src/routes/tenant/tenant-auth-routes.ts` — registers email/password paths under `/tenant/auth/*`
- `apps/server/src/services/auth-realms/tenant-email-auth-realm.ts` — tenant realm into shared email/password handlers
- `apps/server/src/services/tenant-auth-service.ts` — `issueTenantSession` / `issueTenantAccessToken`
- `apps/server/src/services/tenant-auth-rate-limit.ts` — Redis IP + email limits (`login` | `register_start`)
- `apps/server/src/db/tenant-users.ts` — CRUD; `phone` already exists; no `google_id` / `apple_id`
- `apps/server/src/db/users.ts` — `findOrCreateByGoogle` / `findOrCreateByApple` + link helpers (pattern to mirror, not call)
- `apps/server/src/db/auth-otps.ts` — email-keyed OTP (`register` | `reset_password` | `tenant_register`)
- `apps/server/src/services/auth-otp-service.ts` — cooldown + SES email send
- `apps/server/src/sns/sns.ts` — `sendSms` + E.164 normalize (ready for OTP SMS)
- `apps/server/src/services/tenant-portal-membership-service.ts` — accept/redeem requires invite email match to `tenantUser.email`
- `packages/shared/src/tenant-portal-types.ts` — `ITenantUser`, auth bodies, session response
- `packages/shared/src/phone.ts` — E.164 helpers shared with SNS
- `apps/tenant/src/pages/login-page.tsx` / `register-page.tsx` — email/password UI only
- `apps/admin/src/components/auth/google-sign-in-button.tsx` — reference UX for Google button (platform audience)

---

## Goals

- Tenants can sign in with **Google** and **Apple** and receive a tenant session interchangeable with email/password login.
- Existing tenants can **bind a phone** and sign in with **SMS OTP** (no password) when phone auth flag is on.
- Operator (platform) Google/Apple tokens **never** authorize `/tenant/*` lease routes; tenant tokens never authorize `/properties/*`.
- Invite accept/redeem stays email-matched; phone does not become a second invite identity in v1.
- Phone OTP routes return 404/403 when `TENANT_PHONE_AUTH_ENABLED` is off.

## Non-goals (initial release)

- Phone-only invites or leases without `invite_email`.
- Creating `tenant_users` rows with nullable email for phone-only accounts.
- Linking a single human across `users` and `tenant_users` (no shared identity table).
- Changing invite email matching to “any verified contact method.”
- Passwordless email magic links (separate idea).
- Replacing platform `/auth/google` / `/auth/apple` or sharing session cookies between admin and tenant apps.
- Expo/mobile Google native client IDs beyond what `verifyGoogleToken` already supports (reuse current web client unless product requires mobile).

---

## Guiding principles

1. **Audience forever** — Social/phone success paths call only `issueTenantSession`; handlers never call `issuePlatformSession` or `userDb.findOrCreateBy*`.
2. **Reuse verify, fork identity** — Share `verifyGoogleToken` / `verifyAppleToken`; own `tenantUsersDb.findOrCreateByGoogle|Apple` mirroring platform conflict rules.
3. **Email remains the invite key** — `lease_tenant_memberships.invite_email` ↔ `tenant_users.email` stays the accept rule; phone is an alternate login for that row.
4. **Flag phone on both sides** — `TENANT_PHONE_AUTH_ENABLED` gates phone routes and tenant UI; Google/Apple are always available once routes ship (same as email/password).
5. **Rate-limit like tenant auth** — Extend `tenant-auth-rate-limit` with actions for social + phone (IP + email or phone key), reuse Redis fixed-window helper.
6. **Idempotent link** — Same Google/Apple subject or phone always resolves to one `tenant_users` row; conflict when email already tied to a different provider id.

---

## Target architecture

```
[Google / Apple ID token] --> verifyGoogleToken / verifyAppleToken
                                      |
                                      v
                         tenantUsersDb.findOrCreateBy*
                                      |
                                      v
                            issueTenantSession  --> JwtAudience.TENANT
                                      |
                                      v
                         [apps/tenant auth store]

[Phone start] --> rate limit --> write phone OTP --> SNS sendSms
[Phone verify] --> rate limit --> verify OTP --> findByPhone / bind
                                      |
                                      v
                            issueTenantSession  (login)
                         or update phone         (authenticated bind)
```

### Invite / phone policy (locked for v1)

| Flow                 | Rule                                                                                                               |
| -------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Portal invite create | Still requires lease emails; unchanged                                                                             |
| Accept / redeem      | Email normalize match only (`membership-service`)                                                                  |
| Phone OTP login      | Target row must already exist with email (typically after register or social)                                      |
| Phone bind           | Authenticated tenant (`authenticateTenant`); set `phone` if null or same number; conflict if phone owned elsewhere |
| Phone-only invite    | **Deferred** (Enhancements out of scope until email nullable + invite key redesign)                                |

### Permissions

- Social login (Google/Apple): unauthenticated public routes under `/tenant/auth/*` (always registered once Phase 1 ships).
- Phone login/bind: unauthenticated/authenticated routes gated by `TENANT_PHONE_AUTH_ENABLED`.
- No admin UI required for v1 (phone flag is env-only).
- Mirror phone UI visibility with `VITE_TENANT_PHONE_AUTH_ENABLED` (must match server).

### Feature flags

| Flag                        | Gates                                                                            |
| --------------------------- | -------------------------------------------------------------------------------- |
| `TENANT_PHONE_AUTH_ENABLED` | `POST /tenant/auth/phone/start`, `/verify`, authenticated bind routes + phone UI |

Google/Apple tenant auth is **not** feature-flagged. Document the phone flag in `apps/server/.env.example` and `apps/tenant/.env.example`.

---

## Data model (sketch)

### `tenant_users` (extend)

| Column              | Notes                                                                                                |
| ------------------- | ---------------------------------------------------------------------------------------------------- |
| `google_id`         | `VARCHAR` UNIQUE nullable — mirror `users.google_id`                                                 |
| `apple_id`          | `VARCHAR` UNIQUE nullable — mirror `users.apple_id`                                                  |
| `phone`             | Already exists (`VARCHAR(50)`); store **E.164**; add unique index on normalized phone where not null |
| `phone_verified_at` | `TIMESTAMPTZ` nullable — set on successful OTP verify / bind                                         |

`email` stays `NOT NULL` + unique lower(trim) — social create still needs provider email.

### Phone OTP storage

`auth_otps` today is **email + purpose** and SES-only. Prefer a **sibling** table (clearer than overloading `email` with phone strings):

### `auth_phone_otps` (new)

| Column                      | Notes                                       |
| --------------------------- | ------------------------------------------- |
| `phone`                     | E.164                                       |
| `code_hash`                 | Same hashing pattern as `auth_otps`         |
| `purpose`                   | `tenant_phone_login` \| `tenant_phone_bind` |
| `expires_at` / `created_at` | Match email OTP TTLs                        |

Index `(phone, purpose)` for lookup/delete + cooldown.

**Domain rule:** OTP verify deletes/consumes the row; cooldown via most-recent `created_at` (same as email OTP service).

---

## Shared contract (`packages/shared`)

| Type                                       | Purpose                                                                                                               |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| `ITenantGoogleAuthBody`                    | `{ idToken: string }`                                                                                                 |
| `ITenantAppleAuthBody`                     | `{ identityToken: string; name?: string }` (Apple may omit name after first auth)                                     |
| `ITenantPhoneAuthStartBody`                | `{ phone: string }`                                                                                                   |
| `ITenantPhoneAuthVerifyBody`               | `{ phone: string; code: string }`                                                                                     |
| `ITenantPhoneBindStartBody` / `VerifyBody` | Authenticated bind variants (or reuse start/verify with session)                                                      |
| `ITenantAuthSessionResponse`               | Unchanged — social/phone return the same shape                                                                        |
| `ITenantUser`                              | Document `phone`; optional expose of provider-linked state only if UI needs it (prefer omit provider ids from client) |

---

## API (sketch)

| Method   | Path                             | Notes                                                                      |
| -------- | -------------------------------- | -------------------------------------------------------------------------- |
| `POST`   | `/tenant/auth/google`            | Flag; verify → findOrCreate tenant → `issueTenantSession`                  |
| `POST`   | `/tenant/auth/apple`             | Flag; same                                                                 |
| `POST`   | `/tenant/auth/phone/start`       | Flag; rate limit; send SNS OTP (`tenant_phone_login`)                      |
| `POST`   | `/tenant/auth/phone/verify`      | Flag; verify OTP; **existing** user by phone → session; 404/401 if no user |
| `POST`   | `/tenant/auth/phone/bind/start`  | Flag + `authenticateTenant`; OTP purpose `tenant_phone_bind`               |
| `POST`   | `/tenant/auth/phone/bind/verify` | Flag + auth; set phone + `phone_verified_at`                               |
| Existing | `/tenant/auth/login` etc.        | Unchanged                                                                  |

Error mapping: mirror platform identity conflicts (`409`) when Google email matches a tenant row already linked to a different `google_id`.

Flags off → `404` (preferred) or `403` with stable code — pick one and use for all gated tenant auth routes.

---

## Real-time / events

N/A — auth expansion does not publish portal stream events. (Invite still drives SSE/push from Enhancements Phase 2.)

---

## Worker / job queue

N/A — SNS publish is sync in the request path; keep OTP send short. If SMS latency becomes painful later, queue behind BullMQ (out of scope).

---

## UI — Tenant SPA

1. **Login** — Google + Apple buttons always shown; “Sign in with phone” when phone flag on.
2. **Register** — Same social buttons (findOrCreate covers first-time); phone register alone is **not** offered in v1.
3. **Account** — “Add phone” bind flow when phone flag on and `user.phone` null.
4. **Invite accept** — Unchanged; still requires matching email session (social users with matching email work; phone-only session with wrong/missing email does not unlock invite).

Reuse admin Google button patterns where possible; extract to `packages/app-ui` only if both apps share identical markup after tenant work (don’t block Phase 3 on extraction).

---

## Phased rollout

### Phase 0 — Foundation (flags, schema, contracts)

**Goal:** Types and schema ready; no public social/phone routes yet.

- [x] Env flags in server + tenant `.env.example`; phone flag helper (`isTenantPhoneAuthEnabled()`); social auth always on (no flag)
- [x] Migration: `tenant_users.google_id`, `apple_id`, `phone_verified_at`; unique index on E.164 `phone` where not null
- [x] Migration: `auth_phone_otps` + `OtpPurpose`-style phone purposes type
- [x] Shared request bodies exported from `packages/shared`
- [x] DB helpers: `findByGoogleId`, `findByAppleId`, `findByPhone`, `linkGoogleId` / `linkAppleId`, `setVerifiedPhone` (mirror `users.ts` conflict semantics without importing it)
- [x] Unit tests for phone normalize + unique conflict sketch

**Exit criteria:** Migrations apply; shared types compile; flags default off; no new routes registered.

---

### Phase 1 — Social backend (API only)

**Goal:** Google/Apple tenant sessions work via curl/Postman.

- [x] `POST /tenant/auth/google` + `/apple` (always registered; issue tenant session)
- [x] `tenantUsersDb.findOrCreateByGoogle|Apple` (email match + link, provider-id uniqueness, conflict codes)
- [x] Always `issueTenantSession`; password may remain null for social-only accounts
- [x] Rate limit actions `google` / `apple` (IP; optional email key after verify)
- [x] Tests: happy path; wrong/expired token; identity conflict; issued JWT `aud === TENANT`

**Exit criteria:** Staging token login returns tenant session; user row has `google_id`/`apple_id`; platform `/auth/google` untouched.

---

### Phase 2 — Phone OTP backend (API only)

**Goal:** Bind + login by SMS for an existing email tenant user.

- [x] Phone OTP service (create/verify/cooldown) + `sendSms` message template (`APP_NAME` code)
- [x] `phone/start` + `phone/verify` for login (user must exist with that verified phone)
- [x] `phone/bind/start` + `bind/verify` for authenticated tenant
- [x] Extend `tenant-auth-rate-limit` with phone keys + actions
- [x] Tests: bind then login; unknown phone login rejected; phone conflict; flag off; cooldown

**Exit criteria:** Scripted bind → logout → phone login issues tenant session; email invite accept still email-only.

---

### Phase 3 — Tenant UI MVP

**Goal:** Google/Apple on tenant auth screens; phone UI behind flag.

- [ ] Google/Apple on login (and register if product wants parity) — always shown
- [ ] Phone login page/step behind phone flag
- [ ] Account bind-phone UI
- [ ] Clear copy: invites still require the invited email account
- [ ] Wire session into existing auth store (same as password login)

**Exit criteria:** Staging tenant app: social login works; phone bind/login when phone flag on (hidden/dead when off).

---

### Phase 4 — Hardening + audience proof

**Goal:** Production-safe and cross-audience rejection documented.

| Concern          | Action                                                                                                                                                                                                                                         |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Audience         | Integration tests: platform access token on `/tenant/me/*` → 401; tenant token on admin property routes → 401                                                                                                                                  |
| Rate limits      | Confirm Redis keys for social/phone under abuse                                                                                                                                                                                                |
| SMS cost / abuse | Strict IP + phone windows; no start without normalize; optional require existing phone on login start to avoid SMS bomb on random numbers (prefer: login start only sends if `findByPhone` exists — **enumeration tradeoff**; document choice) |
| Observability    | Structured logs `tenant_portal.auth_google                                                                                                                                                                                                     | apple | phone` without tokens/OTP codes |
| Apple name       | Handle missing name on subsequent Apple logins                                                                                                                                                                                                 |
| Log redaction    | Ensure ID tokens never logged                                                                                                                                                                                                                  |

**SMS enumeration default:** On `phone/start` for login, if no user, return **generic success** without sending SMS (anti-enumeration) **or** send only when user exists and still return generic message. Prefer **no SMS when unknown** + identical HTTP response.

**Exit criteria:** Audience matrix tests green; failure modes added to `docs/TENANT_PORTAL_FAILURE_MODES.md`; phone flag proven on/off in staging.

---

### Phase 5 — Enhancements (explicitly deferred)

- Phone-only invites / nullable `tenant_users.email`
- Invite accept by verified phone matching lease contact phone
- Shared `packages/app-ui` social button if both apps converge
- Native mobile Google client audience list expansion
- Passwordless email magic link

---

## What not to do

- Do **not** call `userDb.findOrCreateByGoogle` from tenant routes or issue platform JWTs to the tenant app.
- Do **not** relax accept/redeem to skip email match because the user verified a phone.
- Do **not** store raw OTP codes or log Google/Apple identity tokens.
- Do **not** reuse `auth_otps.email` column for phone numbers without a real channel model — use `auth_phone_otps` (or a generalized destination table).
- Do **not** ship phone UI when `TENANT_PHONE_AUTH_ENABLED` is off (or vice versa).
- Do **not** make `email` nullable in this series to “support phone users.”
- Do **not** auto-create a `tenant_users` row on phone verify for unknown numbers (that becomes phone-only account creation).

---

## Safest sequencing summary

1. **Schema + flags before routes** — columns and unique indexes first.
2. **Social API before phone** — reuses proven ID-token verify; lower infra risk than SMS.
3. **Phone bind before phone login** — guarantee an email-backed user owns the number.
4. **API before tenant UI** — Postman proves sessions before buttons.
5. **Audience tests before calling it done** — platform/tenant cross-rejection is the exit bar.
6. **Keep invite email policy frozen** — defer phone invites to Phase 5 of this doc.

---

## Decision record (Phase 3 parent checklist)

| Topic                 | Decision                                                                   |
| --------------------- | -------------------------------------------------------------------------- |
| Invite email vs phone | **Email only** for invite identity in v1                                   |
| Phone auth purpose    | Login + bind for **existing** `tenant_users`                               |
| Identity storage      | Columns on `tenant_users` (mirror `users`), not a cross-app identity table |
| Social verify         | Shared `verifyGoogleToken` / `verifyAppleToken`                            |
