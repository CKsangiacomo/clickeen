#!/usr/bin/env bash
set -euo pipefail

# Simple dev up script: stop stale listeners, then start Tokyo CDN + Workers + UIs.
# Logs go to CurrentlyExecuting/ and URLs are printed at the end.

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT_DIR"

mkdir -p CurrentlyExecuting

if [ -f "$ROOT_DIR/.env.local" ]; then
  echo "[dev-up] Loading $ROOT_DIR/.env.local"
  set -a
  # shellcheck disable=SC1091
  source "$ROOT_DIR/.env.local"
  set +a
fi

echo "[dev-up] Ensuring Supabase local DB is running"
if ! supabase status >/dev/null 2>&1; then
  supabase start
fi

echo "[dev-up] Loading local Supabase connection values"
ORIG_SUPABASE_URL="${SUPABASE_URL:-}"
ORIG_SUPABASE_SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY:-}"
DEV_UP_USE_REMOTE_SUPABASE="${DEV_UP_USE_REMOTE_SUPABASE:-}"
# Avoid depending on ripgrep (rg) in dev environments; plain grep is sufficient.
# shellcheck disable=SC2046
eval "$(supabase status --output env | grep -E '^[A-Z_]+=' || true)"
# Prefer the local Supabase values from `supabase status`; only fall back to existing env vars
# (and even then, only when DEV_UP_USE_REMOTE_SUPABASE=1 below).
SUPABASE_URL=${API_URL:-${SUPABASE_URL:-}}
SUPABASE_SERVICE_ROLE_KEY=${SECRET_KEY:-${SUPABASE_SERVICE_ROLE_KEY:-}}
if [ -n "$ORIG_SUPABASE_URL" ] || [ -n "$ORIG_SUPABASE_SERVICE_ROLE_KEY" ]; then
  if [ "$DEV_UP_USE_REMOTE_SUPABASE" = "1" ] || [ "$DEV_UP_USE_REMOTE_SUPABASE" = "true" ]; then
    if [ -z "$ORIG_SUPABASE_URL" ] || [ -z "$ORIG_SUPABASE_SERVICE_ROLE_KEY" ]; then
      echo "[dev-up] DEV_UP_USE_REMOTE_SUPABASE=1 requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in $ROOT_DIR/.env.local"
      exit 1
    fi
    SUPABASE_URL="$ORIG_SUPABASE_URL"
    SUPABASE_SERVICE_ROLE_KEY="$ORIG_SUPABASE_SERVICE_ROLE_KEY"
    echo "[dev-up] Using Supabase values from $ROOT_DIR/.env.local (remote mode)"
  else
    echo "[dev-up] Using local Supabase (ignoring SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY from $ROOT_DIR/.env.local)"
    echo "[dev-up] To use remote Supabase in local dev, set DEV_UP_USE_REMOTE_SUPABASE=1"
  fi
fi
if [ -z "${SUPABASE_URL:-}" ] || [ -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]; then
  echo "[dev-up] Failed to resolve SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY from Supabase status"
  exit 1
fi

# Dev auth token shared by Bob -> Paris requests.
PARIS_DEV_JWT_FILE="$ROOT_DIR/CurrentlyExecuting/paris.dev.jwt"
if [ -z "${PARIS_DEV_JWT:-}" ]; then
  if [ -f "$PARIS_DEV_JWT_FILE" ]; then
    PARIS_DEV_JWT="$(cat "$PARIS_DEV_JWT_FILE")"
  fi
fi
if [ -z "${PARIS_DEV_JWT:-}" ]; then
  echo "[dev-up] Missing PARIS_DEV_JWT."
  echo "[dev-up] Set PARIS_DEV_JWT in $ROOT_DIR/.env.local (recommended) or create $PARIS_DEV_JWT_FILE."
  exit 1
fi

# Shared HMAC used for Paris grants -> SanFrancisco verification.
AI_GRANT_HMAC_SECRET_FILE="$ROOT_DIR/CurrentlyExecuting/ai.grant.hmac.secret"
if [ -z "${AI_GRANT_HMAC_SECRET:-}" ]; then
  if [ -f "$AI_GRANT_HMAC_SECRET_FILE" ]; then
    AI_GRANT_HMAC_SECRET="$(cat "$AI_GRANT_HMAC_SECRET_FILE")"
  fi
fi
if [ -z "${AI_GRANT_HMAC_SECRET:-}" ]; then
  echo "[dev-up] AI_GRANT_HMAC_SECRET not set; AI copilots will be disabled in local dev."
fi

SF_BASE_URL=""
if [ -n "${AI_GRANT_HMAC_SECRET:-}" ]; then
  SF_BASE_URL="http://localhost:3002"
fi

echo "[dev-up] Building Dieter directly into tokyo/dieter"
(
  cd "$ROOT_DIR"
  pnpm --filter @ck/dieter build
)

echo "[dev-up] Building i18n bundles into tokyo/i18n"
node "$ROOT_DIR/scripts/i18n/build.mjs"
node "$ROOT_DIR/scripts/i18n/validate.mjs"

echo "[dev-up] Building l10n overlays into tokyo/l10n"
node "$ROOT_DIR/scripts/l10n/build.mjs"
node "$ROOT_DIR/scripts/l10n/validate.mjs"

echo "[dev-up] Killing stale listeners on 3000,3001,3002,3003,4000,4321,5173,8790 (if any)"
for p in 3000 3001 3002 3003 4000 4321 5173 8790; do
  PIDS=$(lsof -ti tcp:$p -sTCP:LISTEN 2>/dev/null || true)
  if [ -n "$PIDS" ]; then
    echo "[dev-up] Killing $PIDS on port $p"
    kill -9 $PIDS || true
  fi
done

# Wrangler/workerd can get stuck in a broken state without holding the LISTEN socket
# (e.g. after a crash/reload loop). Kill them by commandline as a backstop.
echo "[dev-up] Killing stale wrangler/workerd processes (ports 3001/3002/8790)"
pkill -f "wrangler.*dev.*--port 3001" || true
pkill -f "wrangler.*dev.*--port 3002" || true
pkill -f "wrangler.*dev.*--port 8790" || true
pkill -f "workerd serve.*entry=localhost:3001" || true
pkill -f "workerd serve.*entry=localhost:3002" || true
pkill -f "workerd serve.*entry=localhost:8790" || true

echo "[dev-up] Cleaning Bob build artifacts (.next/.next-dev) to avoid stale chunk mismatches"
rm -rf "$ROOT_DIR/bob/.next" "$ROOT_DIR/bob/.next-dev" || true

echo "[dev-up] Cleaning Venice build artifacts (.next/.next-dev) to avoid stale edge sandbox mismatches"
rm -rf "$ROOT_DIR/venice/.next" "$ROOT_DIR/venice/.next-dev" || true

# Local dev always uses the local Tokyo CDN stub.
TOKYO_URL=${TOKYO_URL:-http://localhost:4000}

echo "[dev-up] Starting Tokyo CDN stub on 4000"
(
  cd "$ROOT_DIR/tokyo"
  PORT=4000 nohup node dev-server.mjs > "$ROOT_DIR/CurrentlyExecuting/tokyo.dev.log" 2>&1 &
  TOKYO_PID=$!
  echo "[dev-up] Tokyo PID: $TOKYO_PID"
)
for i in {1..30}; do
  if curl -sf "http://localhost:4000/healthz" >/dev/null 2>&1; then break; fi
  sleep 0.5
done
if ! curl -sf "http://localhost:4000/healthz" >/dev/null 2>&1; then
  echo "[dev-up] Timeout waiting for Tokyo @ http://localhost:4000/healthz"
  exit 1
fi

echo "[dev-up] Starting Paris Worker (3001)"
(
  cd "$ROOT_DIR/paris"
  VARS=(--var "SUPABASE_URL:$SUPABASE_URL" --var "SUPABASE_SERVICE_ROLE_KEY:$SUPABASE_SERVICE_ROLE_KEY" --var "PARIS_DEV_JWT:$PARIS_DEV_JWT")
  VARS+=(--var "TOKYO_BASE_URL:$TOKYO_URL")
  VARS+=(--var "ENV_STAGE:local")
  if [ -n "$SF_BASE_URL" ]; then
    VARS+=(--var "SANFRANCISCO_BASE_URL:$SF_BASE_URL")
  fi
  if [ -n "${AI_GRANT_HMAC_SECRET:-}" ]; then
    VARS+=(--var "AI_GRANT_HMAC_SECRET:$AI_GRANT_HMAC_SECRET")
  fi

  nohup pnpm exec wrangler dev --local --port 3001 \
    "${VARS[@]}" \
    > "$ROOT_DIR/CurrentlyExecuting/paris.dev.log" 2>&1 &
  PARIS_PID=$!
  echo "[dev-up] Paris PID: $PARIS_PID"
)
for i in {1..30}; do
  if curl -sf "http://localhost:3001/api/healthz" >/dev/null 2>&1; then break; fi
  sleep 0.5
done
if ! curl -sf "http://localhost:3001/api/healthz" >/dev/null 2>&1; then
echo "[dev-up] Timeout waiting for Paris @ http://localhost:3001/api/healthz"
  exit 1
fi

echo "[dev-up] Note: instances are usually created from DevStudio Local; optionally run: pnpm bootstrap:local-widgets"

echo "[dev-up] Starting Venice embed runtime (3003)"
(
  cd "$ROOT_DIR/venice"
  PORT=3003 PARIS_URL="http://localhost:3001" PARIS_DEV_JWT="$PARIS_DEV_JWT" TOKYO_URL="$TOKYO_URL" nohup pnpm dev > "$ROOT_DIR/CurrentlyExecuting/venice.dev.log" 2>&1 &
  VENICE_PID=$!
  echo "[dev-up] Venice PID: $VENICE_PID"
)
for i in {1..30}; do
  if curl -sf "http://localhost:3003/dieter/tokens/tokens.css" >/dev/null 2>&1; then break; fi
  sleep 0.5
done
if ! curl -sf "http://localhost:3003/dieter/tokens/tokens.css" >/dev/null 2>&1; then
  echo "[dev-up] Timeout waiting for Venice @ http://localhost:3003"
  exit 1
fi

if [ -n "${AI_GRANT_HMAC_SECRET:-}" ]; then
  echo "[dev-up] Starting SanFrancisco Worker (3002)"
  (
    cd "$ROOT_DIR/sanfrancisco"
    # DEEPSEEK_API_KEY is required for real executions; missing key is still useful for boot verification.
    VARS=(--var "AI_GRANT_HMAC_SECRET:$AI_GRANT_HMAC_SECRET")
    if [ -n "${DEEPSEEK_API_KEY:-}" ]; then
      VARS+=(--var "DEEPSEEK_API_KEY:$DEEPSEEK_API_KEY")
    fi

    nohup pnpm exec wrangler dev --local --port 3002 "${VARS[@]}" \
      > "$ROOT_DIR/CurrentlyExecuting/sanfrancisco.dev.log" 2>&1 &
    SF_PID=$!
    echo "[dev-up] SanFrancisco PID: $SF_PID"
  )
  for i in {1..30}; do
    if curl -sf "http://localhost:3002/healthz" >/dev/null 2>&1; then break; fi
    sleep 0.5
  done
  if ! curl -sf "http://localhost:3002/healthz" >/dev/null 2>&1; then
    echo "[dev-up] Timeout waiting for SanFrancisco @ http://localhost:3002/healthz"
    exit 1
  fi
fi

(
  cd "$ROOT_DIR/bob"
  if [ -n "$SF_BASE_URL" ]; then
    # Always prefer local Workers in local dev (avoid accidentally pointing at Cloudflare URLs from .env.local).
    PORT=3000 PARIS_BASE_URL="http://localhost:3001" PARIS_DEV_JWT="$PARIS_DEV_JWT" SANFRANCISCO_BASE_URL="$SF_BASE_URL" NEXT_PUBLIC_TOKYO_URL="$TOKYO_URL" nohup pnpm dev > "$ROOT_DIR/CurrentlyExecuting/bob.dev.log" 2>&1 &
  else
    PORT=3000 PARIS_BASE_URL="http://localhost:3001" PARIS_DEV_JWT="$PARIS_DEV_JWT" NEXT_PUBLIC_TOKYO_URL="$TOKYO_URL" nohup pnpm dev > "$ROOT_DIR/CurrentlyExecuting/bob.dev.log" 2>&1 &
  fi
  BOB_PID=$!
  echo "[dev-up] Bob PID: $BOB_PID"
)
for i in {1..30}; do
  if curl -sf "http://localhost:3000" >/dev/null 2>&1; then break; fi
  sleep 0.5
done
if ! curl -sf "http://localhost:3000" >/dev/null 2>&1; then
  echo "[dev-up] Timeout waiting for Bob @ http://localhost:3000"
  exit 1
fi

(
  cd "$ROOT_DIR/admin"
  PORT=5173 TOKYO_URL="$TOKYO_URL" nohup pnpm dev > "$ROOT_DIR/CurrentlyExecuting/devstudio.dev.log" 2>&1 &
  DEVSTUDIO_PID=$!
  echo "[dev-up] DevStudio PID: $DEVSTUDIO_PID"
)
for i in {1..30}; do
  if curl -sf "http://localhost:5173" >/dev/null 2>&1; then break; fi
  sleep 0.5
done
if ! curl -sf "http://localhost:5173" >/dev/null 2>&1; then
  echo "[dev-up] Timeout waiting for DevStudio @ http://localhost:5173"
  exit 1
fi

echo "[dev-up] Starting Pitch Agent worker (8790)"
(
  cd "$ROOT_DIR/pitch"
  nohup pnpm dev > "$ROOT_DIR/CurrentlyExecuting/pitch.dev.log" 2>&1 &
  PITCH_PID=$!
  echo "[dev-up] Pitch PID: $PITCH_PID"
)
for i in {1..30}; do
  if curl -sf "http://localhost:8790/healthz" >/dev/null 2>&1; then break; fi
  sleep 0.5
done
if ! curl -sf "http://localhost:8790/healthz" >/dev/null 2>&1; then
  echo "[dev-up] Timeout waiting for Pitch @ http://localhost:8790/healthz"
  exit 1
fi

if [ -n "${PITCH_SERVICE_KEY:-}" ] && [ -n "${OPENAI_API_KEY:-}" ]; then
  echo "[dev-up] Syncing pitch docs to local Pitch worker"
  (
    cd "$ROOT_DIR/pitch"
    PITCH_API_URL="http://localhost:8790" PITCH_SERVICE_KEY="$PITCH_SERVICE_KEY" pnpm -s sync-docs
  ) || echo "[dev-up] Pitch docs sync failed; continuing startup (non-fatal)"
else
  echo "[dev-up] Skipping pitch docs sync (requires PITCH_SERVICE_KEY + OPENAI_API_KEY in $ROOT_DIR/.env.local)"
fi

echo "[dev-up] Starting Prague marketing site (4321)"
(
  cd "$ROOT_DIR/prague"
  PORT=4321 PUBLIC_TOKYO_URL="$TOKYO_URL" PUBLIC_BOB_URL="http://localhost:3000" PUBLIC_VENICE_URL="http://localhost:3003" nohup pnpm dev > "$ROOT_DIR/CurrentlyExecuting/prague.dev.log" 2>&1 &
  PRAGUE_PID=$!
  echo "[dev-up] Prague PID: $PRAGUE_PID"
)
for i in {1..30}; do
  if curl -sf "http://localhost:4321" >/dev/null 2>&1; then break; fi
  sleep 0.5
done
if ! curl -sf "http://localhost:4321" >/dev/null 2>&1; then
  echo "[dev-up] Timeout waiting for Prague @ http://localhost:4321"
  exit 1
fi

echo "[dev-up] URLs:"
echo "  Tokyo:    http://localhost:4000/healthz"
echo "  Paris:     http://localhost:3001"
if [ -n "$SF_BASE_URL" ]; then
  echo "  SF:        http://localhost:3002/healthz"
fi
echo "  Bob:       http://localhost:3000"
echo "  DevStudio: http://localhost:5173"
echo "  Pitch:     http://localhost:8790/healthz"
echo "  Prague:    http://localhost:4321/en/widgets/faq"
