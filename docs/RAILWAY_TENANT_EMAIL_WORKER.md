# Railway: tenant email worker (Option A)

The tenant email **API** runs on the existing `server` Railway service. **Sending** runs on a separate worker service that consumes BullMQ jobs from Redis.

## One-time Railway setup

1. **Redis** — already added to the project. Note the `REDIS_URL` variable (or reference `${{Redis.REDIS_URL}}`).

2. **New service** — in the same project:
   - **Add Service** → **GitHub Repo** → same repository as `server`
   - Name: e.g. `server-email-worker`
   - **Settings → Config file path:** `apps/server/railway.email-worker.toml`

3. **Environment variables** (worker service):
   - Copy from the `server` service: `DATABASE_URL`, AWS/SES vars, `API_PUBLIC_URL`, `AWS_INTERNAL_SECRET`, etc.
   - `REDIS_URL=${{Redis.REDIS_URL}}` (adjust service name if your Redis resource differs)
   - `NODE_ENV=production` (set by Dockerfile; optional explicit)

4. **Server service** — ensure the API also has:
   - `REDIS_URL` (create rate limit + enqueue)

5. **Deploy** both `server` and `server-email-worker`.

## Verify

Worker logs should include:

```text
[tenant-email-worker] started { reenqueuedCount: ... }
```

Send a campaign from Communications; status should move from **Queued** → **Sending** → **Completed**.

## Local dev equivalent

```bash
# Terminal 1
cd apps/server && bun run dev

# Terminal 2
cd apps/server && bun run worker:email
```

Redis: `docker compose up redis` or local Redis on `127.0.0.1:6379`.
