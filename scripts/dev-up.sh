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
eval "$(supabase status --output env | rg '^[A-Z_]+=' || true)"
SUPABASE_URL=${SUPABASE_URL:-${API_URL:-}}
SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY:-${SECRET_KEY:-}}
if [ -n "$ORIG_SUPABASE_URL" ]; then
  SUPABASE_URL="$ORIG_SUPABASE_URL"
fi
if [ -n "$ORIG_SUPABASE_SERVICE_ROLE_KEY" ]; then
  SUPABASE_SERVICE_ROLE_KEY="$ORIG_SUPABASE_SERVICE_ROLE_KEY"
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

echo "[dev-up] Building Dieter directly into tokyo/dieter"
(
  cd "$ROOT_DIR"
  pnpm --filter @ck/dieter build
)

echo "[dev-up] Killing stale listeners on 3000,3001,3002,4000,5173 (if any)"
for p in 3000 3001 3002 4000 5173; do
  PIDS=$(lsof -ti tcp:$p -sTCP:LISTEN 2>/dev/null || true)
  if [ -n "$PIDS" ]; then
    echo "[dev-up] Killing $PIDS on port $p"
    kill -9 $PIDS || true
  fi
done

echo "[dev-up] Cleaning Bob build artifacts (.next) to avoid stale chunk mismatches"
rm -rf "$ROOT_DIR/bob/.next" || true

TOKYO_URL=${TOKYO_URL:-http://localhost:4000}
TOKYO_URL=${NEXT_PUBLIC_TOKYO_URL:-$TOKYO_URL}

echo "[dev-up] Starting Tokyo CDN stub on 4000"
(
  cd "$ROOT_DIR/tokyo"
  PORT=4000 nohup node dev-server.mjs > "$ROOT_DIR/CurrentlyExecuting/tokyo.dev.log" 2>&1 &
  TOKYO_PID=$!
  echo "[dev-up] Tokyo PID: $TOKYO_PID"
)
for i in {1..30}; do
  if curl -sI "http://localhost:4000/healthz" >/dev/null 2>&1; then break; fi
  sleep 0.5
done
if ! curl -sI "http://localhost:4000/healthz" >/dev/null 2>&1; then
  echo "[dev-up] Timeout waiting for Tokyo @ http://localhost:4000/healthz"
  exit 1
fi

echo "[dev-up] Starting Paris Worker (3001)"
(
  cd "$ROOT_DIR/paris"
  VARS=(--var "SUPABASE_URL:$SUPABASE_URL" --var "SUPABASE_SERVICE_ROLE_KEY:$SUPABASE_SERVICE_ROLE_KEY" --var "PARIS_DEV_JWT:$PARIS_DEV_JWT")
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
  if curl -sI "http://localhost:3001/api/healthz" >/dev/null 2>&1; then break; fi
  sleep 0.5
done
if ! curl -sI "http://localhost:3001/api/healthz" >/dev/null 2>&1; then
echo "[dev-up] Timeout waiting for Paris @ http://localhost:3001/api/healthz"
  exit 1
fi

SF_BASE_URL=""
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
    if curl -sI "http://localhost:3002/healthz" >/dev/null 2>&1; then break; fi
    sleep 0.5
  done
  if ! curl -sI "http://localhost:3002/healthz" >/dev/null 2>&1; then
    echo "[dev-up] Timeout waiting for SanFrancisco @ http://localhost:3002/healthz"
    exit 1
  fi
  SF_BASE_URL="http://localhost:3002"
fi

(
  cd "$ROOT_DIR/bob"
  if [ -n "$SF_BASE_URL" ]; then
    PORT=3000 PARIS_BASE_URL="${PARIS_BASE_URL:-http://localhost:3001}" PARIS_DEV_JWT="$PARIS_DEV_JWT" SANFRANCISCO_BASE_URL="${SANFRANCISCO_BASE_URL:-$SF_BASE_URL}" NEXT_PUBLIC_TOKYO_URL="$TOKYO_URL" nohup pnpm dev > "$ROOT_DIR/CurrentlyExecuting/bob.dev.log" 2>&1 &
  else
    PORT=3000 PARIS_BASE_URL="${PARIS_BASE_URL:-http://localhost:3001}" PARIS_DEV_JWT="$PARIS_DEV_JWT" NEXT_PUBLIC_TOKYO_URL="$TOKYO_URL" nohup pnpm dev > "$ROOT_DIR/CurrentlyExecuting/bob.dev.log" 2>&1 &
  fi
  BOB_PID=$!
  echo "[dev-up] Bob PID: $BOB_PID"
)
for i in {1..30}; do
  if curl -sI "http://localhost:3000" >/dev/null 2>&1; then break; fi
  sleep 0.5
done
if ! curl -sI "http://localhost:3000" >/dev/null 2>&1; then
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
  if curl -sI "http://localhost:5173" >/dev/null 2>&1; then break; fi
  sleep 0.5
done
if ! curl -sI "http://localhost:5173" >/dev/null 2>&1; then
  echo "[dev-up] Timeout waiting for DevStudio @ http://localhost:5173"
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
