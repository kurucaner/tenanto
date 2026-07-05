# Register flow: email OTP (“email 2FA”)

This document describes how **email-based one-time codes** work during **email/password registration**: API contracts, validation rules, timing, email delivery (Amazon SES), and rough cost context versus other providers.

---

## End-to-end flow

1. **Client** collects email, display name, and password on create-account, then calls **`POST /auth/register`**.
2. **Server** validates input, ensures the email is not already registered, enforces send cooldown, generates a **6-digit numeric OTP**, stores a **bcrypt hash** of the code with a **10-minute** expiry, and sends the plaintext code **once** via **Amazon SES**.
3. **Client** navigates to **Verify Email**, where the user enters the code and submits **`POST /auth/register/verify`** with email, name, OTP, and password.
4. **Server** validates the OTP against the stored hash and expiry, creates the user, issues **access + refresh tokens**, and returns the **user** object.

Implementation references:

- Server routes: `apps/server/src/routes/auth/auth-routes.ts`
- OTP DB helpers: `apps/server/src/db/auth-otps.ts`
- Validators: `apps/server/src/routes/auth/validators.ts`
- SES send + templates: `apps/server/src/ses/transactional-emails.ts`, `apps/server/src/ses/ses.ts`
- Mobile API client: `apps/mobile/lib/api.ts`
- Verify screen + resend UX: `apps/mobile/app/auth/verify-otp.tsx`, `apps/mobile/hooks/use-resend-countdown.ts`
- Schema migration: `apps/server/src/db/migrations.ts` (migration `add_email_auth`)

---

## Database: `auth_otps` table

Defined in PostgreSQL by migration **`add_email_auth`** (`apps/server/src/db/migrations.ts`).

| Column       | Type                       | Notes                                                                                   |
| ------------ | -------------------------- | --------------------------------------------------------------------------------------- |
| `id`         | `UUID`                     | Primary key, default `gen_random_uuid()`.                                             |
| `email`      | `VARCHAR(255)`             | Stored normalized in queries as `LOWER(TRIM(email))`.                                   |
| `code_hash`  | `VARCHAR(255)`             | Bcrypt hash of the OTP; plaintext is never persisted.                                   |
| `purpose`    | `VARCHAR(50)`              | Application values: `register`, `reset_password` (see `OtpPurpose` in `auth-otps.ts`). |
| `expires_at` | `TIMESTAMP WITH TIME ZONE` | OTP invalid after this instant (`expires_at > NOW()` required for lookup).               |
| `created_at` | `TIMESTAMP WITH TIME ZONE` | Default `CURRENT_TIMESTAMP`; used for cooldown (`findMostRecentCreatedAt`).             |

**Index:** `idx_auth_otps_email_purpose` on `(LOWER(TRIM(email)), purpose)` for lookups by email + purpose.

### Resend and `/auth/register`: new row or update?

There is **no `UPDATE`**. Each successful OTP send (initial or resend) runs **`DELETE`** for all rows matching that email + purpose, then **`INSERT`** one new row (`deleteByEmailAndPurpose` → `create` in `auth-routes.ts`). The previous row is removed and replaced by a **new** `id`, hash, `expires_at`, and `created_at`.

After successful **`POST /auth/register/verify`**, the consumed OTP row is **`DELETE`**d by id (`deleteById`).

### User never verifies: expiration and cleanup

- **Verification** only matches rows where **`expires_at > NOW()`** (`findValidByEmailAndPurpose`). After expiry, the old code **cannot** be used, even though the row may still exist.
- **There is no background worker or cron** in this codebase that deletes expired `auth_otps` rows. Cleanup is **lazy**:
  - removed when the user **verifies** (delete by id), or
  - removed when a **new** code is sent for the same email + purpose (delete-all-then-insert replaces rows for that purpose).

Abandoned OTPs may **linger in the table** past `expires_at` until one of those events. For strict TTL hygiene at scale you could add a scheduled job (not implemented today).

---

## API endpoints

Base URL is whatever your deployment exposes (e.g. `EXPO_PUBLIC_API_URL` on mobile). Paths below are **relative** to that host.

### 1. Request OTP (register)

| Method | Path             | Auth |
| ------ | ---------------- | ---- |
| `POST` | `/auth/register` | None |

**Request body (JSON)**

| Field      | Type   | Rules                                                                                   |
| ---------- | ------ | --------------------------------------------------------------------------------------- |
| `email`    | string | Required, trimmed, max 255 chars, format checked (`EMAIL_REGEX` in vault constants).    |
| `name`     | string | Required, trimmed, max 255 chars.                                                       |
| `password` | string | Min 8 chars; must include **at least one letter** and **one digit** (`PASSWORD_REGEX`). |

Example:

```json
{
  "email": "user@example.com",
  "name": "Ada Lovelace",
  "password": "correcthorse1"
}
```

**Success response**

- **HTTP 200**
- Body:

```json
{
  "message": "Check your email"
}
```

**Error responses (representative)**

| HTTP  | Condition                                         | Body shape                                                               |
| ----- | ------------------------------------------------- | ------------------------------------------------------------------------ |
| `400` | Invalid email, name, or password                  | `{ "error": "<validator message>" }`                                     |
| `409` | Email already registered                          | `{ "error": "Email already registered" }`                                |
| `429` | Another send in flight for this email             | `{ "error": "A verification code is already being sent. Please wait." }` |
| `429` | Cooldown: last code sent less than 60 seconds ago | `{ "error": "Please wait 1 minute before requesting another code" }`     |

---

### 2. Verify OTP and complete registration

| Method | Path                    | Auth |
| ------ | ----------------------- | ---- |
| `POST` | `/auth/register/verify` | None |

**Request body (JSON)**

| Field      | Type   | Rules                               |
| ---------- | ------ | ----------------------------------- |
| `email`    | string | Same validation as register.        |
| `name`     | string | Same validation as register.        |
| `password` | string | Same validation as register.        |
| `otp`      | string | Exactly **6 digits** (`/^\d{6}$/`). |

Example:

```json
{
  "email": "user@example.com",
  "name": "Ada Lovelace",
  "password": "correcthorse1",
  "otp": "482913"
}
```

**Success response**

- **HTTP 200**
- Body (matches `IAuthResponse` in `apps/mobile/lib/api.ts`):

```json
{
  "accessToken": "<jwt>",
  "refreshToken": "<opaque>",
  "user": { "...": "IUser shape from shared package" }
}
```

(`accountLinked` / `accountRecovered` are omitted for this path unless added later.)

**Error responses (representative)**

| HTTP  | Condition                                        | Body shape                                |
| ----- | ------------------------------------------------ | ----------------------------------------- |
| `400` | Invalid email, name, password, or OTP format     | `{ "error": "<validator message>" }`      |
| `401` | No valid OTP row, wrong code, or OTP past expiry | `{ "error": "Invalid or expired OTP" }`   |
| `409` | Email became registered before verify completed  | `{ "error": "Email already registered" }` |

---

## Server-side validation and timing

Constants (see `auth-routes.ts`):

| Constant               | Value  | Meaning                                                                                  |
| ---------------------- | ------ | ---------------------------------------------------------------------------------------- |
| `OTP_COOLDOWN_SECONDS` | **60** | Minimum time between **successful** OTP sends for the same email + purpose (`register`). |
| `OTP_EXPIRY_MINUTES`   | **10** | OTP row `expires_at` = now + 10 minutes.                                                 |

Additional behavior:

- **Concurrency guard**: `otpSendInProgress` blocks overlapping sends for the same normalized email with **429** while a send is in progress.
- **Storage**: Only **bcrypt hashes** of the OTP are stored (`bcrypt.hash(otp, 10)`). Plain codes exist only in memory and in the outbound email.
- **Lookup**: `findValidByEmailAndPurpose` requires `expires_at > NOW()` and takes the latest row (see [Database: `auth_otps` table](#database-auth_otps-table)).
- **Replacement on send**: Before each new OTP insert, all rows for that email + `register` are deleted—**replace via delete + insert**, not SQL `UPDATE`; see [Resend and `/auth/register`](#resend-and-authregister-new-row-or-update).

OTP format:

- Generated as `100000`–`999999` (six digits, string).

The email copy uses **`OTP_EXPIRY_MINUTES = 10`** in `transactional-emails.ts` for the “expires in … minutes” text—keep this aligned with the server expiry when changing either.

---

## Client: resend countdown (verify screen)

The mobile app uses **`useResendCooldown`** with **`COOLDOWN_SECONDS = 60`**, starting **on mount** of the verify screen so the user sees **“Resend in Ns”** after the initial send.

- **Resend** calls the same **`POST /auth/register`** with email, name, and password (same payload as create-account).
- The UI disables rapid resend locally; the **server** still enforces the **60 s** rule and returns **429** if violated.

---

## Email delivery: Amazon SES

### How mail is sent

- **SDK**: `@aws-sdk/client-sesv2`, **`SendEmailCommand`** with **raw** MIME (multipart alternative: plain + HTML).
- **Region**: `us-east-1` (`apps/server/src/ses/ses.ts`).
- **Credentials**: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`.
- **From**: `Locklet <noreply@locklet.app>` (`FROM_NAME`, `FROM_EMAIL`).

### Register OTP email content

- **Subject**: `Your Locklet verification code`
- **Template**: `otp.html` via `renderTemplate`, with plain-text fallback.
- **Purpose** passed to `sendOtpEmail`: `"register"`.

`WEB_APP_URL` is used for assets/links inside HTML templates where applicable.

---

## Cost context (verify before budgeting)

Pricing changes frequently; use vendor pages as source of truth.

### Amazon SES

- SES is typically priced **per 1,000 emails sent** (plus possible data transfer, dedicated IPs, add-ons). See **[AWS SES pricing](https://aws.amazon.com/ses/pricing/)**.
- **Free tier**: New AWS accounts often get limited **free outbound** volume for the **first 12 months** (details on the same page—confirm eligibility and caps).

**Rough order of magnitude for OTP volume**: each registration attempt that triggers a send is **one outbound message**. Resends are additional messages. Example: **10,000** verification emails/month at **$0.10 per 1,000** is on the order of **$1/month** for the message charge alone—plus any other AWS line items you use.

### “Competitors” (transactional email APIs)

These are **not** drop-in replacements for “SES only”—they bundle deliverability, dashboards, and support; **list prices are usually higher per thousand** than raw SES for comparable send volume, but can reduce operational load.

| Provider                                  | Notes                                                                                                                       |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **Twilio SendGrid**                       | Popular ESP; pricing tiers and overages—see **[Twilio Email API pricing](https://www.twilio.com/en-us/pricing/email-api)**. |
| **Mailgun**                               | API-first; see **[Mailgun pricing](https://www.mailgun.com/pricing/)**.                                                     |
| **Postmark**                              | Strong focus on transactional mail; see **[Postmark pricing](https://postmarkapp.com/pricing)**.                            |
| **Resend**, **Amazon SES** (direct), etc. | Compare **per-message**, **included monthly volume**, **dedicated IP** costs, and **support** SLAs.                         |

For **OTP-only** traffic, cost is usually dominated by **volume** and **deliverability** needs (inbox placement, bounce handling), not the few cents per thousand—still, SES direct send tends to be among the **lowest per-message** options when you operate your own integration.

---

## Quick troubleshooting checklist

| Symptom                  | Things to check                                                                     |
| ------------------------ | ----------------------------------------------------------------------------------- |
| “Please wait 1 minute…”  | Wait **60 s** between sends; align client cooldown with server.                     |
| “Invalid or expired OTP” | Code wrong, more than **10 minutes** old, or newer OTP replaced the row.            |
| Email never arrives      | SES sandbox limits, domain verification, bounce/complaint suppression, spam folder. |
| 429 while sending        | Parallel requests for same email; retry after short delay.                          |

---

## Related flows (same OTP machinery)

Password reset uses the same OTP shape, **`OTP_COOLDOWN_SECONDS`**, **`OTP_EXPIRY_MINUTES`**, and SES helpers with purpose **`reset_password`** (`/auth/forgot-password`, `/auth/reset-password`). This doc focuses on **register** only.
