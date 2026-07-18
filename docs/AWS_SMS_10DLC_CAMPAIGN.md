# AWS SMS: 10DLC brand, campaign, and PropertyOS setup

This document describes how **Edgium LLC** registers **10DLC** messaging for **PropertyOS** on AWS, what to do before and after brand vetting, and how the Node.js server sends SMS.

**Legal entity (brand):** Edgium LLC  
**Product (campaign):** PropertyOS — `https://propertyos.app`  
**Support:** `support@propertyos.app`  
**AWS region:** `us-east-1` (must match phone number and SNS client)

---

## Architecture overview

```text
Edgium LLC (Brand registration, once)
    └── PropertyOS campaign (per app / use case)
            └── 10DLC phone number (US long code)
                    └── Linked to approved campaign
                            └── SNS Publish → recipients
```

| Layer                  | What it is                                                                                          |
| ---------------------- | --------------------------------------------------------------------------------------------------- |
| **Brand**              | Legal business (Edgium LLC). One registration shared across apps.                                   |
| **Campaign**           | A specific messaging program (use case, samples, opt-in). One per app or per message type if split. |
| **Origination number** | The US phone number recipients see. Required before any SMS (including sandbox OTP).                |
| **Sandbox**            | New accounts start here; only verified destination numbers receive SMS until production.            |

**US rule:** Recipients see a **phone number**, not “PropertyOS” as the sender ID. Put the product name in the message body.

---

## Order of operations

| Step                           | Can do before brand vetting?                    | Action                                                              |
| ------------------------------ | ----------------------------------------------- | ------------------------------------------------------------------- |
| 1. Brand registration          | Submit; wait for vetting                        | Edgium LLC in AWS End User Messaging → 10DLC → Brands               |
| 2. Campaign registration       | **Draft only**; submit after brand **Approved** | See [PropertyOS campaign fields](#propertyos-campaign-fields) below |
| 3. Request 10DLC number        | **No**                                          | After campaign approved                                             |
| 4. Associate number ↔ campaign | **No**                                          | After number is active                                              |
| 5. SMS sandbox                 | **Partial**                                     | Add destinations only **after** you have an origination number      |
| 6. Exit sandbox (production)   | **Partial**                                     | Request production access after origination + compliance            |

### Parallel path for early testing

If sandbox verification fails with **“No origination entities available to send”**, request a **US toll-free SMS number** and complete toll-free registration while 10DLC vetting finishes. Toll-free is separate from 10DLC but provides origination for sandbox OTPs.

---

## AWS console checklist

### 1. Brand (Edgium LLC)

- **Console:** AWS → **End User Messaging SMS** (or SNS → Text messaging) → **10DLC** → **Registrations** → **Create brand registration**
- **Entity:** Private profit company, Edgium LLC
- **EIN / address:** Must match IRS / formation documents
- **Private profit:** Leave stock symbol and exchange **empty** (avoid `CONDITIONAL_FIELD_NOT_ALLOWED`)
- Wait for status **Approved / Vetted** before campaign can pass

### 2. Campaign (PropertyOS)

- **Console:** **10DLC** → **Campaigns** → **Create campaign**
- Link brand: **Edgium LLC**
- Copy field values from [PropertyOS campaign fields](#propertyos-campaign-fields)

### 3. Phone number

- **Console:** **Phone numbers** → **Request originator**
- Type: **10DLC long code**, region **us-east-1**
- After approval: associate with PropertyOS campaign under **Origination identities**

### 4. Sandbox

- **Console:** SNS → **Text messaging** → **Sandbox destination phone numbers**
- Requires active origination number to send verification OTP
- Add up to 10 verified numbers for testing

### 5. Production

- **Console:** Account settings → request moving out of SMS sandbox
- Requires compliant origination, campaign, and opt-in/opt-out handling

---

## PropertyOS campaign fields

Use these when registering the **PropertyOS** transactional campaign. Adjust if you split OTP and rent alerts into separate campaigns.

### Campaign description

```text
Edgium LLC, operating the PropertyOS platform (https://propertyos.app), sends transactional SMS messages to users who have explicitly opted in within the PropertyOS application.

Sender: Edgium LLC (PropertyOS)
Recipients: Property managers, owners, and tenants who add and verify a mobile phone number in their PropertyOS account settings.

Purpose: To deliver account-related transactional messages only, including:
- One-time passcodes (OTP) for sign-in and account verification
- Rent payment and lease-related notifications initiated by property activity
- Maintenance visit and work-order appointment notifications
- Important account and property alerts the user has enabled

Opt-in: Users opt in by entering their phone number in PropertyOS and accepting our Terms of Service and Privacy Policy (https://propertyos.app/terms-of-service, https://propertyos.app/privacy-policy). SMS is optional; users can manage or remove their phone number in account settings.

Opt-out: Users may reply STOP at any time. Message frequency varies based on account activity. Msg & data rates may apply.
```

### Vertical

**Real Estate** (alternatives: Professional Services, Financial Services if Real Estate is unavailable)

### Opt-in / Help / Stop messages

**Opt-in confirmation (≤255 chars):**

```text
PropertyOS: You're subscribed to account SMS alerts (OTP & transactional notices). Msg frequency varies. Msg & data rates may apply. Reply HELP for help, STOP to cancel.
```

**Help (≤255 chars):**

```text
PropertyOS: Help at support@propertyos.app or https://propertyos.app. Msg & data rates may apply. Reply STOP to unsubscribe.
```

**Stop (≤255 chars):**

```text
PropertyOS: You're unsubscribed from SMS alerts. No further messages will be sent. Add your number again in PropertyOS settings to re-subscribe.
```

### Campaign opt-in workflow

```text
PropertyOS (operated by Edgium LLC) uses a single opt-in, in-app consent flow. SMS is never enabled by default.

1) Account creation
The user creates a PropertyOS account at https://propertyos.app and accepts our Terms of Service and Privacy Policy before using the service.

2) Voluntary phone entry
The user optionally adds a mobile phone number in PropertyOS account settings (or when entering tenant contact details for property management). Phone number entry is not required to use PropertyOS.

3) Explicit SMS consent
Before SMS is enabled, the user must check an unchecked consent box (not pre-selected) with disclosure text similar to:
"I agree to receive transactional SMS from PropertyOS, including verification codes and account notifications. Message frequency varies. Message and data rates may apply. Reply STOP to opt out or HELP for help. See our Terms of Service and Privacy Policy."

4) Confirmation message
After consent, PropertyOS sends one opt-in confirmation SMS to the provided number confirming subscription and including STOP/HELP instructions.

5) Ongoing control
Users can disable SMS at any time by removing their phone number in PropertyOS settings or replying STOP. Opt-out is processed immediately and confirmed via SMS.

6) No third-party list buying
Phone numbers are collected directly from users within PropertyOS. We do not purchase, scrape, or upload external contact lists for SMS.

Privacy Policy: https://propertyos.app/privacy-policy
Terms of Service: https://propertyos.app/terms-of-service
Support: support@propertyos.app
```

### Use case and compliance toggles

| Field                                  | Value                  | Notes                                                              |
| -------------------------------------- | ---------------------- | ------------------------------------------------------------------ |
| **Use case**                           | `ACCOUNT_NOTIFICATION` | Use `2FA` if campaign is OTP-only                                  |
| **Sub use case**                       | _(blank)_              | Only if use case is `MIXED` or `LOW_VOLUME`                        |
| **Subscriber opt-in**                  | Yes                    |                                                                    |
| **Subscriber opt-out**                 | Yes                    | STOP + in-app removal                                              |
| **Subscriber help**                    | Yes                    | HELP auto-reply                                                    |
| **Direct lending or loan arrangement** | No                     | PropertyOS sends notices; it does not arrange loans                |
| **Embedded link**                      | No*                    | *Yes + `https://propertyos.app` if any message body includes a URL |
| **Embedded phone number**              | No                     | Unless message bodies include phone numbers                        |
| **Age-gated content**                  | No                     |                                                                    |

### Message samples (≥20 chars each)

**Sample 1 — OTP:**

```text
PropertyOS: Your verification code is [OTP Code]. It expires in 10 minutes. Do not share this code.
```

**Sample 2 — Opt-in confirmation:**

```text
PropertyOS: You're subscribed to account SMS alerts (OTP and transactional notices). Msg frequency varies. Msg & data rates may apply. Reply HELP for help, STOP to cancel.
```

**Sample 3 — Rent payment recorded:**

```text
PropertyOS: A rent payment of $[Amount] was recorded for [Property Name], Unit [Unit].
```

**Sample 4 — Lease / account alert:**

```text
PropertyOS: Your lease at [Property Address] has been updated. Sign in to your account for details.
```

**Sample 5 — Maintenance visit scheduled:**

```text
PropertyOS: A team member will arrive at [Property Address], Unit [Unit], on [Date] at [Time] for a maintenance visit.
```

Samples must match **actual** message content sent in production.

---

## Node.js / server setup

Implementation lives in:

- `apps/server/src/sns/sns.ts` — `sendSms()`, E.164 validation
- `apps/server/sns-testing.ts` — manual send script
- `apps/server/src/sns/sns.test.ts` — unit tests

### Environment variables

```env
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
# Default PropertyOS 10DLC number (E.164). Override per send with fromPhoneNumber.
SNS_SMS_ORIGINATION_NUMBER=+15551234567
```

### IAM policy (minimum)

```json
{
  "Effect": "Allow",
  "Action": ["sns:Publish"],
  "Resource": "*"
}
```

### Test send (sandbox)

Destination number must be **verified in the SMS sandbox** until production.

```bash
cd apps/server && bun sns-testing.ts
```

Update the `toPhone` constant in `sns-testing.ts` to your sandbox-verified number.

### Application usage

```typescript
import { sendSms } from "./src/sns/sns";

// Uses SNS_SMS_ORIGINATION_NUMBER from env when fromPhoneNumber is omitted
await sendSms({
  phoneNumber: "+15551234567",
  message: "PropertyOS: Your verification code is 847291. It expires in 10 minutes.",
});

// Explicit origination number (e.g. another app / campaign number)
await sendSms({
  fromPhoneNumber: "+15559876543",
  phoneNumber: "+15551234567",
  message: "PropertyOS: Your verification code is 847291. It expires in 10 minutes.",
});
```

Per-message origination uses the SNS message attribute `AWS.MM.SMS.OriginationNumber`. Each number must be provisioned in AWS and linked to its campaign.

---

## Troubleshooting

### “No origination entities available to send”

**Cause:** No active US origination number on the account in the region you use.

**Fix:**

1. Request toll-free (faster for sandbox) **or** wait for brand → campaign → 10DLC number.
2. Confirm number status is **Active** in **us-east-1**.
3. Retry sandbox destination verification.

### Campaign stuck in review

- Brand must be **Approved** first.
- Campaign description, samples, and opt-in workflow must match real product behavior.
- Stock symbol/exchange must be empty for private companies on brand registration.

### SMS succeeds in API but nothing arrives

- Check sandbox: destination must be verified.
- Check campaign ↔ number association.
- Check carrier filtering; message must match registered samples.

---

## Multiple apps under Edgium LLC

One **brand** (Edgium LLC), separate **campaigns** per app or use case (e.g. PropertyOS transactional, future products). Do not duplicate brands. Each campaign typically gets its own 10DLC number.

Keep **transactional** and **marketing** campaigns separate.

---

## Related docs

- Email OTP (reference for message patterns): [REGISTER_EMAIL_OTP.md](./REGISTER_EMAIL_OTP.md)
- Rent receipt email (future SMS parity): `apps/server/templates/rent-payment-recorded.html`

---

## Pre-launch checklist

- [ ] Edgium LLC brand **Approved**
- [ ] PropertyOS campaign **Approved**
- [ ] 10DLC number **Active** and linked to campaign
- [ ] Sandbox destinations verified (dev/staging)
- [ ] Production access granted (prod)
- [ ] In-app SMS opt-in checkbox + disclosure implemented
- [ ] STOP / HELP handling implemented (AWS keyword responses or application logic)
- [ ] Privacy policy and terms mention SMS
- [ ] Message copy matches registered samples
