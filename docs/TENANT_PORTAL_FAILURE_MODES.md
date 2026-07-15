# Tenant portal failure modes

Operational reference for lease portal invites (admin Tenants tab + tenant app).

## Architecture recap

1. Operator invites a primary/secondary occupant from the lease **Tenants** tab → `POST .../portal-invites` creates a `lease_tenant_memberships` row and emails a magic link.
2. New email → `pending_invite` (signup then redeem). Existing tenant account → `pending_acceptance` (accept in app).
3. Accept/redeem → `active` and **clears `invite_token_hash`** (single-use forever).
4. Admin end-lease → non-terminal memberships become `ended`; tenant can still **read** them under Past leases.

Statuses: `pending_invite` | `pending_acceptance` | `active` | `declined` | `revoked` | `ended` | `expired`.

See [TENANT_PORTAL_PHASES.md](./TENANT_PORTAL_PHASES.md) for the full rollout.

---

## Failure modes

### API returns 409 (Conflict) on invite create

**Cause:** A non-terminal membership already exists for the same `(lease_id, invite_email, role)` (`DuplicatePortalInviteError`).

**Recovery:** Use **Resend** on the pending row, or **Revoke** then invite again. Do not spam Invite on an occupant who already has Invite pending / Active.

### API returns 429 (Too Many Requests) on invite create

**Cause:** Per-lease create rate limit exceeded (`TENANT_PORTAL_INVITE_CREATE_RATE_LIMIT_MAX` within `TENANT_PORTAL_INVITE_CREATE_RATE_LIMIT_WINDOW_MS`, default 10 per 15 minutes). Resend is not counted.

**Recovery:** Wait for `Retry-After` and retry. Normal Tenants-tab usage stays under the default.

### API returns 429 on tenant register/start or login

**Cause:** Tighter Redis limits on `/tenant/auth/register/start` and `/tenant/auth/login` (per IP + per email; see `TENANT_AUTH_*` in `apps/server/.env.example`).

**Recovery:** Wait for `Retry-After`. Operator invite flow is unaffected.

### Invite preview / redeem: invalid or expired link

**Causes:**

- Token unknown (wrong URL, already used after accept — hash cleared)
- Membership already `expired` / `declined` / `revoked` / `ended` / `active`
- Pending invite past `expires_at` (lazy expiry flips row to `expired` in DB)

**Recovery:** Operator **Resend** (pending) or **Invite** again (terminal / expired). Old link stays dead after accept.

### Invite email never arrives

**Checks:** SES sandbox / suppression, `TENANT_APP_URL` set (accept link build fails without it), invite create `emailSent` / `emailError` on response.

**Recovery:** Fix email on lease if wrong; **Resend** or revoke → re-invite. Structured logs: `tenant_portal.invited` / `.resent`.

### Tenant cannot see lease after accept

**Checks:** Membership `status = active` and `tenant_user_id` matches; session is **tenant** JWT (not operator).

**Recovery:** Re-login on tenant app. If operator **Revoked**, access is gone until a new invite is accepted.

### Secondary tenant missing from portal

**Cause:** Not selected in Invite / Invite all, or missing/invalid email on secondary row.

**Recovery:** Add email on lease, then Invite that secondary index.

---

## Wrong-email playbook (v1)

There is **no** tenant self-removal. Operator owns corrections:

1. If access is **active** or invite is **pending**: **Revoke** from the Tenants tab row.
2. Edit the occupant email on the lease (primary `tenantEmail` or secondary tenant).
3. **Invite** again to the corrected address (new membership row; terminal statuses allow re-invite).
4. Tenant accepts with the account for the **new** email (or registers if new).

Do **not** tell the wrong recipient to “just ignore” an active membership — revoke first so portal access is cut.

---

## Manual test matrix

| Scenario | Steps | Expected |
| --- | --- | --- |
| New user | Invite primary with no `tenant_users` row → open email link → register → redeem | `pending_invite` → `active`; lease on Active list; invite token single-use |
| Returning user | Invite email that already has tenant account → login → accept | `pending_acceptance` → `active` |
| Decline | Pending → Decline in tenant app | `declined`; accept blocked until operator invite again |
| Revoke | Active → Revoke in Tenants tab | `revoked`; lease detail 403 / gone from active list; may Invite again |
| Lease end | End lease in admin | Memberships `ended`; Active empty; lease under Past leases (read-only) |
| Secondary tenant | Invite secondary with valid email | Separate membership; accepted independently of primary |
| Expired invite | Pending past TTL (or sweep) | Status `expired` in DB + admin badge; preview/accept blocked; **Invite** available again |
| Duplicate invite | Invite same pending occupant twice | **409** Conflict |
| Resend | Pending → Resend | New token; old link invalid after resend; email resent |
| Rate limit | Burst `POST .../portal-invites` | **429** + `Retry-After` |

Checklist: new user · returning user · decline · revoke · lease end · secondary · expired · 409 · resend.

---

## Observability (grep keys)

| Event | When |
| --- | --- |
| `tenant_portal.invited` | Create invite succeeded |
| `tenant_portal.resent` | Resend succeeded |
| `tenant_portal.revoked` | Revoke succeeded |
| `tenant_portal.accepted` | Accept / redeem succeeded |
| `tenant_portal.declined` | Decline succeeded |
| `tenant_portal.ended` | End-lease membership transition |

Context always includes normalized `inviteEmail`, `leaseId`, `membershipId`. Raw invite tokens must not appear in logs/RUM (`token` query redaction).

---

## Related code

| Area | Path |
| --- | --- |
| Invite service | `apps/server/src/services/tenant-portal-invite-service.ts` |
| Membership / accept | `apps/server/src/services/tenant-portal-membership-service.ts` |
| Happy-path tests | `apps/server/src/services/tenant-portal-happy-path.test.ts` |
| Invite unit tests | `apps/server/src/services/tenant-portal-invite-service.test.ts` |
| Rate limits | `apps/server/src/services/tenant-portal-invite-create-rate-limit.ts`, `tenant-auth-rate-limit.ts` |
| Phased plan | [TENANT_PORTAL_PHASES.md](./TENANT_PORTAL_PHASES.md) |
