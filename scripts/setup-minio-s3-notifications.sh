#!/usr/bin/env bash
set -euo pipefail

MINIO_ALIAS="${MINIO_ALIAS:-local}"
MINIO_ENDPOINT="${MINIO_ENDPOINT:-http://localhost:9000}"
MINIO_BUCKET="${MINIO_BUCKET:-tenanto}"
API_URL="${API_URL:-http://localhost:3001}"
MINIO_ACCESS_KEY="${MINIO_ACCESS_KEY:-${MINIO_ROOT_USER:-minioadmin}}"
MINIO_SECRET_KEY="${MINIO_SECRET_KEY:-${MINIO_ROOT_PASSWORD:-minioadmin}}"
AWS_INTERNAL_SECRET="${AWS_INTERNAL_SECRET:-}"

if ! command -v mc >/dev/null 2>&1; then
  echo "Error: mc (MinIO Client) is not installed. Run: brew install minio/stable/mc" >&2
  exit 1
fi

if [[ -z "$AWS_INTERNAL_SECRET" ]]; then
  echo "Error: AWS_INTERNAL_SECRET must be set (same value as apps/server .env)." >&2
  exit 1
fi

echo "Using alias=$MINIO_ALIAS endpoint=$MINIO_ENDPOINT bucket=$MINIO_BUCKET api=$API_URL"

mc alias set "$MINIO_ALIAS" "$MINIO_ENDPOINT" "$MINIO_ACCESS_KEY" "$MINIO_SECRET_KEY"

mc mb --ignore-existing "$MINIO_ALIAS/$MINIO_BUCKET"

mc admin config set "$MINIO_ALIAS" notify_webhook:tenanto \
  enable="on" \
  endpoint="${API_URL%/}/s3-notification" \
  auth_token="$AWS_INTERNAL_SECRET" \
  queue_limit="0" \
  comment="Tenanto support attachment upload notifications"

if ! mc admin service restart "$MINIO_ALIAS"; then
  echo "Warning: could not restart MinIO automatically. Restart MinIO manually, then re-run this script." >&2
fi

if mc event list "$MINIO_ALIAS/$MINIO_BUCKET" 2>/dev/null | grep -q 'arn:minio:sqs::tenanto:webhook'; then
  echo "Bucket event notification already configured for support/ prefix."
else
  mc event add "$MINIO_ALIAS/$MINIO_BUCKET" \
    arn:minio:sqs::tenanto:webhook \
    --event put \
    --prefix support/
fi

echo ""
echo "Configured bucket notifications:"
mc event list "$MINIO_ALIAS/$MINIO_BUCKET"
echo ""
echo "Done. Uploads under support/ will POST to ${API_URL%/}/s3-notification"
