# S3 Notification Lambda

Forwards native AWS S3 event notifications to the propertyos API `POST /s3-notification` endpoint.

## Environment variables

| Variable              | Required | Description                                                          |
| --------------------- | -------- | -------------------------------------------------------------------- |
| `API_PUBLIC_URL`      | Yes      | API base URL without trailing slash (e.g. `https://api.example.com`) |
| `AWS_INTERNAL_SECRET` | Yes      | Must match `AWS_INTERNAL_SECRET` on the API server                   |

## Deploy (manual)

1. Create a Lambda function (Node.js 20.x+, no dependencies).
2. Paste `index.mjs` as the handler (`index.handler`).
3. Set the environment variables above.
4. Execution role: CloudWatch Logs only (this function does not read S3 directly).
5. Add an S3 bucket notification:
   - Event type: `s3:ObjectCreated:*`
   - Prefix filter: `support/`
   - Destination: this Lambda
6. Grant S3 permission to invoke the Lambda (resource-based policy on the function).

## Test

Upload a file under the `support/` prefix in the bucket. CloudWatch should show a successful invocation and the API should mark the matching staged upload as `confirmed`.

## Local development

Use MinIO instead of Lambda. See [`docs/MINIO_WEBHOOK_SETUP.md`](../../docs/MINIO_WEBHOOK_SETUP.md) and run:

```bash
AWS_INTERNAL_SECRET=your-secret API_URL=http://localhost:3001 bash scripts/setup-minio-s3-notifications.sh
```
