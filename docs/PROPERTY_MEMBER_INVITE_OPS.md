# Property member invites — operator guide

How property owners invite teammates to the admin app using the token-based invite flow.

## Overview

Invites are stored in `property_invites` until the invitee **explicitly accepts**. There is no silent auto-join on signup or login.

- **New user** (`pending_invite`): magic link → inline signup on `/accept-invite` → accept
- **Existing user** (`pending_acceptance`): magic link → sign in → accept or decline
- **Already a member**: add-member API adds them directly (no invite row)

## Operator workflow

### 1. Send an invite

1. Open **Property → Members**.
2. Click **Add Member**, enter email + role (Owner / Manager / Accountant).
3. If the email is not on the platform, an invite row appears as **Pending** and an email is sent.

**409 conflict** if a pending invite already exists for that email on the property — use **Resend** instead.

### 2. Manage invites on property detail

Each email shows **one row** (canonical invite; older revoked/declined rows are kept in the DB for audit but hidden in the UI).

| Status | Actions |
|--------|---------|
| Pending / Email failed | **Resend**, **Revoke** |
| Declined / Revoked / Expired | **Invite again** (creates a new invite) |

### 3. Invitee experience

1. Email contains a link to `{PLATFORM_APP_URL}/accept-invite?token=…`
2. Invitee reviews property + role summary.
3. **New user**: Google sign-up or name/password on the accept page (no OTP).
4. **Existing user**: Sign in, then **Accept** or **Decline**.
5. On accept, they become a property member with the invited role.

### 4. Expiry

Pending invites expire after **30 days** (cron marks them `expired`). Operator can **Invite again** from property detail.

## Email templates

| Template | When used |
|----------|-----------|
| `property-invite-new.html` | No platform account — accept URL with inline signup |
| `property-invite-existing.html` | Account exists — accept URL with sign-in |

Legacy `property-invite.html` (generic signup CTA, auto-accept copy) has been removed.

## API reference (admin)

| Action | Method | Path |
|--------|--------|------|
| Add member / send invite | `POST` | `/properties/:propertyId/members` |
| Resend | `POST` | `/properties/:propertyId/member-invites/:inviteId/resend` |
| Revoke | `POST` | `/properties/:propertyId/member-invites/:inviteId/revoke` |
| Preview (public) | `GET` | `/invites/preview?token=` |
| Register + accept (public) | `POST` | `/invites/register`, `/invites/register/google` |
| Accept when signed in | `POST` | `/invites/redeem` or `/me/invites/:inviteId/accept` |
| Decline | `POST` | `/me/invites/:inviteId/decline` |

## Observability

Structured logs (Datadog / Winston):

- `property_member_invite.invited`
- `property_member_invite.resent`
- `property_member_invite.revoked`
- `property_member_invite.accepted`
- `property_member_invite.declined`

## Related docs

- Phased rollout: [`PROPERTY_MEMBER_INVITE_PHASES.md`](./PROPERTY_MEMBER_INVITE_PHASES.md)
- Tenant portal invite pattern (reference): [`TENANT_PORTAL_PHASES.md`](./TENANT_PORTAL_PHASES.md)
