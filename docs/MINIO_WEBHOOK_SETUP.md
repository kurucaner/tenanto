# MinIO S3 Notification Setup (Local Development)

Last updated: **2026-07-06**

PropertyOS handles S3 upload notifications on the main API server at `POST /s3-notification`. Support attachment uploads under the `support/` prefix are confirmed event-driven via the `support_staged_uploads` table.

---

## Prerequisites

- MinIO running locally (API on `:9000`, console on `:9001`)
- `mc` (MinIO Client): `brew install minio/stable/mc`
- propertyos server running (default `http://localhost:3001`)
- `AWS_INTERNAL_SECRET` set in `apps/server/.env` (same value used for webhook auth)

---

## Quick setup (recommended)

From the repo root:

```bash
export AWS_INTERNAL_SECRET=your-local-secret
export MINIO_ACCESS_KEY=minioadmin
export MINIO_SECRET_KEY=minioadmin
export MINIO_BUCKET=propertyos
export API_URL=http://localhost:3001

bash scripts/setup-minio-s3-notifications.sh
```

Or from `apps/server`:

```bash
bun run setup:minio-notifications
```

### Docker dev note

If MinIO runs on the host and the server runs in Docker, point the webhook at the host:

```bash
export API_URL=http://host.docker.internal:3001
bash scripts/setup-minio-s3-notifications.sh
```

---

## What the script does

1. Configures `mc` alias (default `local`)
2. Creates the bucket if missing
3. Registers webhook target `notify_webhook:propertyos` → `{API_URL}/s3-notification`
4. Restarts MinIO to apply config
5. Adds bucket event: `put` events with prefix `support/`

Auth: MinIO sends `Authorization: Bearer {AWS_INTERNAL_SECRET}` which the API accepts alongside `X-Internal-Secret`.

---

## Manual MinIO install (macOS)

```bash
brew install minio/stable/minio
mkdir -p ~/minio-data
export MINIO_ROOT_USER=minioadmin
export MINIO_ROOT_PASSWORD=minioadmin
minio server ~/minio-data --console-address ":9001"
```

---

## Verify

1. Presign a support attachment via the admin UI (or API).
2. Upload the file (client PUT to MinIO).
3. Check server logs or DB: `support_staged_uploads.status` should become `confirmed`.
4. Submit the support request — attachment appears in the thread.

Manual upload test:

```bash
mc cp ./test.png local/propertyos/support/test-user-id/test-object-id
```

---

## Production (AWS)

Do not use MinIO webhooks in production. Deploy the Lambda forwarder instead:

- [`lambda/s3-notification/index.mjs`](../lambda/s3-notification/index.mjs)
- [`lambda/s3-notification/README.md`](../lambda/s3-notification/README.md)

Configure S3 bucket notifications on `s3:ObjectCreated:*` with prefix `support/` to invoke the Lambda.

---

## Troubleshooting

| Issue                         | Fix                                                                                    |
| ----------------------------- | -------------------------------------------------------------------------------------- |
| 401 from `/s3-notification`   | Ensure `AWS_INTERNAL_SECRET` matches on server and in `mc admin config`                |
| No events received            | Run `mc event list local/propertyos` and restart MinIO after config changes            |
| Upload works but ticket fails | Notification may be slow — create still falls back to `headObject` for pending uploads |
| CORS errors on browser PUT    | Configure MinIO bucket CORS to allow `PUT` from your admin origin                      |
