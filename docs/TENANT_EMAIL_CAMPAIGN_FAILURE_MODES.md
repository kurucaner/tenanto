# Tenant email campaign failure modes

Operational reference for property tenant email campaigns (Communications tab).

## Architecture recap

1. Admin POST creates a campaign row + recipient rows in Postgres, then enqueues BullMQ jobs.
2. A separate worker process (`bun run worker:email`) sends via SES and updates recipient/campaign rows.
3. Progress is pushed to the sender over SSE (`tenant_email_campaign.updated`).

If the API or worker restarts, queued DB rows remain the source of truth; jobs can be re-enqueued from `queued` recipients.

Production on Railway: separate worker service — see [RAILWAY_TENANT_EMAIL_WORKER.md](./RAILWAY_TENANT_EMAIL_WORKER.md).

## Failure modes

### API returns 429 (Too Many Requests)

**Cause:** Per-user/per-property create rate limit exceeded (`TENANT_EMAIL_CAMPAIGN_CREATE_RATE_LIMIT_MAX` within `TENANT_EMAIL_CAMPAIGN_CREATE_RATE_LIMIT_WINDOW_MS`, default 5 per 15 minutes).

**Recovery:** Wait for `Retry-After` seconds and submit again with a new `Idempotency-Key` if starting a new campaign.

### API returns 400 — max recipients

**Cause:** Active leases resolve to more recipients than allowed. Production default: 500 (`TENANT_EMAIL_CAMPAIGN_MAX_RECIPIENTS`). Non-production default cap: 50 (`TENANT_EMAIL_CAMPAIGN_DEV_MAX_RECIPIENTS`).

**Recovery:** Reduce audience (future: filters) or raise env caps intentionally.

### Campaign stuck in `queued` / `sending`

**Cause:** Worker not running, Redis unavailable, or jobs failed to enqueue.

**Checks:**

- Redis reachable (`REDISHOST` / `REDISPORT` or `REDIS_URL`)
- Worker process running: `cd apps/server && bun run worker:email`
- BullMQ queue has pending jobs

**Recovery:** Start worker; it re-enqueues queued recipients on startup. Use **Retry delivery** in campaign details, `POST .../tenant-email-campaigns/:campaignId/reenqueue`, or resubmit with the same `Idempotency-Key` (re-enqueues without creating a duplicate campaign).

### Individual recipient `failed`

**Cause:** Permanent SES error (invalid address, suppression, etc.) after retries exhausted.

**Visibility:** Campaign detail drawer lists failed rows first with `last_error`. Campaign status becomes `completed_with_errors` when any send fails.

**Recovery:** Fix tenant email on the lease; send a new campaign (idempotency does not block new campaigns).

### Individual recipient `skipped`

**Causes:**

- No/invalid email at resolve time (preview shows skipped tenants)
- Duplicate normalized email in the same campaign audience
- Recipient on global unsubscribe list at send time (`email_unsubscribes`)

**Recovery:** Update lease email or remove unsubscribe; new campaign required to retry delivery.

### High failure rate alert

**Cause:** When a campaign completes, structured logs emit `tenant_email_campaign.high_failure_rate` if `failed / (sent + failed) >= TENANT_EMAIL_CAMPAIGN_FAILURE_ALERT_RATE` (default 20%) and at least `TENANT_EMAIL_CAMPAIGN_FAILURE_ALERT_MIN_RECIPIENTS` (default 10) deliverable attempts occurred.

**Recovery:** Inspect SES bounce/complaint metrics, sandbox limits, and failed recipient errors in campaign detail.

### SSE progress missing

**Cause:** Notification stream disconnected, or throttling suppressed intermediate events.

**Recovery:** Reconnect stream; `GET /properties/:propertyId/tenant-email-campaigns/:campaignId` restores full state.

### Duplicate campaign on double-click

**Mitigation:** Client sends `Idempotency-Key` header; DB unique on `(property_id, idempotency_key)` returns the original campaign.

## Required env (send path)

| Variable                                      | Purpose                   |
| --------------------------------------------- | ------------------------- |
| `TENANT_EMAIL_CAMPAIGNS_ENABLED`              | Feature flag              |
| `REDISHOST` / `REDISPORT` or `REDIS_URL`      | Queue + create rate limit |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | SES                       |
| `API_PUBLIC_URL`                              | List-Unsubscribe links    |
| `AWS_INTERNAL_SECRET`                         | Unsubscribe token signing |

## Load testing (~500 recipients)

1. Shared resolver test validates 500 unique lease emails resolve correctly (`tenant-email-recipient-resolver.test.ts`).
2. For end-to-end: seed 500 active leases with unique emails, enable feature flag, run worker, POST campaign with `Idempotency-Key`, monitor logs for `tenant_email_campaign.completed` and SSE events.

Dev environments cap at 50 recipients unless `TENANT_EMAIL_CAMPAIGN_DEV_MAX_RECIPIENTS=0`.
