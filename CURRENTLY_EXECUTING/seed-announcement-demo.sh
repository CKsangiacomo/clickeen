#!/usr/bin/env bash
set -euo pipefail

# Seed a minimal Announcement widget instance in Paris and (optionally) publish it.
# Usage:
#   PARIS_BASE=http://localhost:3001 JWT=eyJ... ./seed-announcement-demo.sh [publish]

PARIS_BASE=${PARIS_BASE:-"http://localhost:3001"}
JWT=${JWT:-""}
WORKSPACE_ID=${WORKSPACE_ID:-""}

if [[ -z "${JWT}" ]]; then
  echo "[seed] Missing JWT. Set JWT env to a dev user token (Supabase)." >&2
  exit 1
fi

echo "[seed] Paris base: ${PARIS_BASE}" >&2

if [[ -n "${WORKSPACE_ID}" ]]; then
  CREATE_PAYLOAD='{
    "workspaceId": "'"${WORKSPACE_ID}"'",
    "widgetType": "engagement.announcement",
    "templateId": "announcement-banner",
    "schemaVersion": "2025-09-01",
    "overrides": { "title": "Hello from seed", "message": "This is a dev instance." }
  }'
else
  CREATE_PAYLOAD='{
    "widgetType": "engagement.announcement",
    "templateId": "announcement-banner",
    "schemaVersion": "2025-09-01",
    "overrides": { "title": "Hello from seed", "message": "This is a dev instance." }
  }'
fi

RESP=$(curl -sS -X POST "${PARIS_BASE}/api/instance/from-template" \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer ${JWT}" \
  --data "${CREATE_PAYLOAD}")

PUBLIC_ID=$(printf '%s' "$RESP" | jq -r '.instance.publicId' 2>/dev/null || true)
DRAFT_TOKEN=$(printf '%s' "$RESP" | jq -r '.draftToken' 2>/dev/null || true)

if [[ -z "${PUBLIC_ID}" || "${PUBLIC_ID}" == "null" ]]; then
  echo "[seed] Failed to parse publicId. Full response:" >&2
  echo "$RESP" >&2
  exit 2
fi

echo "[seed] Created instance: ${PUBLIC_ID}" >&2
echo "publicId=${PUBLIC_ID}"
echo "draftToken=${DRAFT_TOKEN}"

if [[ "${1:-}" == "publish" ]]; then
  echo "[seed] Publishing ${PUBLIC_ID}" >&2
  PUBLISH_RESP=$(curl -sS -X PUT "${PARIS_BASE}/api/instance/${PUBLIC_ID}" \
    -H 'Content-Type: application/json' \
    -H "Authorization: Bearer ${JWT}" \
    --data '{"status":"published"}')
  echo "[seed] Publish response:" >&2
  echo "$PUBLISH_RESP" >&2
  echo "preview_url=http://localhost:3002/e/${PUBLIC_ID}" >&2
fi
