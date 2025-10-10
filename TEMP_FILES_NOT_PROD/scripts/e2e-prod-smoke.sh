#!/usr/bin/env bash
set -euo pipefail

# Config: defaults to prod URLs; allow override via env.
SITE_URL="${SITE_URL:-https://c-keen-site.vercel.app}"
EMBED_URL="${EMBED_URL:-https://c-keen-embed.vercel.app}"

command -v jq >/dev/null 2>&1 || { echo "jq is required"; exit 1; }

echo "1) Create anonymous widget on SITE..."
CREATE_RES="$(curl -sS -X POST "$SITE_URL/api/widgets/anonymous" \
  -H 'content-type: application/json' \
  --data '{"email":"smoke@clickeen.test","type":"contact-form","config":{}}')"

echo "Create response: $CREATE_RES"

PUBLIC_KEY="$(echo "$CREATE_RES" | jq -r '.publicKey // empty')"
PUBLIC_ID="$(echo "$CREATE_RES" | jq -r '.publicId // empty')"

if [[ -z "$PUBLIC_KEY" || -z "$PUBLIC_ID" ]]; then
  echo "✗ Missing keys from anon create"; exit 1
fi
echo "✓ Keys: publicKey=$PUBLIC_KEY  publicId=$PUBLIC_ID"

echo
echo "2) Check prod embed headers for $PUBLIC_ID..."
curl -sS -I "$EMBED_URL/api/e/$PUBLIC_ID?v=1" \
| tr -d '\r' \
| grep -Ei '^(cache-control|x-cache-ttl|x-cache-fresh|x-template-version):' \
|| { echo "✗ Missing expected headers"; exit 1; }
echo "✓ Headers OK"

echo
echo "3) Submit a form via the embed endpoint (expects { ok: true })..."
SUBMIT_RES="$(curl -sS -X POST "$EMBED_URL/api/form/$PUBLIC_ID" \
  -H 'content-type: application/json' \
  -d '{"test":"data"}')"
echo "Submit response: $SUBMIT_RES"

echo "$SUBMIT_RES" | jq -e '.ok == true' >/dev/null \
  && echo "✓ E2E smoke passed" \
  || { echo "✗ Submission failed"; exit 1; }

# End of script


