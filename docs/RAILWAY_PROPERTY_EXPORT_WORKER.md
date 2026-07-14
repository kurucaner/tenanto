# Railway: property export worker

The property export **API** runs on the existing `server` Railway service. **CSV generation** runs on a separate worker service that consumes BullMQ jobs from Redis.

## One-time Railway setup

1. **Redis** — already added to the project. Note the `REDIS_URL` variable (or reference `${{Redis.REDIS_URL}}`).

2. **New service** — in the same project:
   - **Add Service** → **GitHub Repo** → same repository as `server`
   - Name: e.g. `server-export-worker`
   - **Settings → Config file path:** `apps/server/railway.export-worker.toml`

3. **Environment variables** (worker service):
   - Copy from the `server` service: `DATABASE_URL`, AWS/S3 vars (`AWS_*`, `S3_*`, bucket/endpoint), etc.
   - `REDIS_URL=${{Redis.REDIS_URL}}` (adjust service name if your Redis resource differs)
   - Optional: `PROPERTY_EXPORT_PROCESSING_TIMEOUT_MS` (default 15 minutes)
   - `NODE_ENV=production` (set by Dockerfile; optional explicit)

4. **Server service** — ensure the API also has:
   - `REDIS_URL` (enqueue on export create)
   - Same `DATABASE_URL` and S3 vars as the worker

5. **S3 lifecycle (recommended)** — add a lifecycle rule on the `exports/` prefix to delete objects after 72h as a backup to the hourly expiry cron on the API.

6. **Deploy** both `server` and `server-export-worker`.

## Verify

Worker logs should include:

```text
[property-export-worker] started { reenqueuedCount: ..., timedOutCount: ... }
```

Queue an export from Expenses → **View export** on the Exports tab → status should move **Queued** → **Processing** → **Completed** → **Download** works.

Restart the worker during a large export — the job should be re-enqueued or timed out safely (not stuck in `processing` forever).

## Local dev equivalent

```bash
# Terminal 1 — API
cd apps/server && bun run dev

# Terminal 2 — export worker
cd apps/server && bun run worker:export
# or from repo root: bun run worker:export
```

Redis: `docker compose up redis` or local Redis on `127.0.0.1:6379`.

## Maintenance

| Concern | Where it runs |
| ------- | ------------- |
| Re-enqueue stuck `pending` / `processing` | Worker startup (`reenqueueAllStuckPropertyExports`) |
| Processing timeout → `failed` | Worker startup (`failTimedOutPropertyExports`) |
| Completed past `expires_at` → `expired` + S3 delete | API cron hourly (`startPropertyExportExpiryCron`, production only) |
| Duplicate active export | API `POST` rejects with **409** + existing `jobId` |
| Row cap (100k) | API pre-check + CSV stream enforcement |
