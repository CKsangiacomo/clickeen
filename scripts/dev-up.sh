#!/usr/bin/env bash
set -euo pipefail

# Simple dev up script: stop stale listeners, then start Tokyo CDN + Workers + UIs.
# Logs go to Logs/ and URLs are printed at the end.

DEV_UP_FULL_REBUILD=0
DEV_UP_PRAGUE_L10N=0
for arg in "$@"; do
  case "$arg" in
    --full|--rebuild-all)
      DEV_UP_FULL_REBUILD=1
      ;;
    --prague-l10n|--l10n)
      DEV_UP_PRAGUE_L10N=1
      ;;
    --help|-h)
      echo "Usage: scripts/dev-up.sh [--full] [--prague-l10n]"
      echo ""
      echo "Options:"
      echo "  --full        Runs 'pnpm -w build' before starting dev servers."
      echo "  --prague-l10n Verifies Prague l10n overlays and starts regeneration in the background (requires SanFrancisco + OPENAI_API_KEY)."
      exit 0
      ;;
    *)
      echo "[dev-up] Unknown argument: $arg" >&2
      exit 1
      ;;
  esac
done

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT_DIR"

mkdir -p Execution_Pipeline_Docs
LOG_DIR="$ROOT_DIR/Logs"
mkdir -p "$LOG_DIR"
WRANGLER_PERSIST_DIR="$ROOT_DIR/.wrangler/state"
mkdir -p "$WRANGLER_PERSIST_DIR"
TOKYO_WORKER_INSPECTOR_PORT=9231
PARIS_INSPECTOR_PORT=9232
SANFRANCISCO_INSPECTOR_PORT=9233
DEV_UP_HEALTH_ATTEMPTS="${DEV_UP_HEALTH_ATTEMPTS:-60}"
DEV_UP_HEALTH_INTERVAL="${DEV_UP_HEALTH_INTERVAL:-1}"
DEV_UP_STATUS_INTERVAL="${DEV_UP_STATUS_INTERVAL:-15}"
NEEDS_PRAGUE_L10N_TRANSLATE=0

wait_for_url() {
  local url="$1"
  local label="$2"
  local i

  for i in $(seq 1 "$DEV_UP_HEALTH_ATTEMPTS"); do
    if curl -sf "$url" >/dev/null 2>&1; then
      return 0
    fi
    sleep "$DEV_UP_HEALTH_INTERVAL"
  done

  echo "[dev-up] Timeout waiting for $label @ $url"
  return 1
}

run_with_status() {
  local label="$1"
  shift
  local start_ts
  start_ts=$(date +%s)
  echo "[dev-up] ${label}"
  (
    while true; do
      sleep "$DEV_UP_STATUS_INTERVAL"
      now=$(date +%s)
      elapsed=$((now - start_ts))
      echo "[dev-up] ${label}... (${elapsed}s elapsed)"
    done
  ) &
  local status_pid=$!
  set +e
  "$@"
  local exit_code=$?
  set -e
  kill "$status_pid" >/dev/null 2>&1 || true
  wait "$status_pid" >/dev/null 2>&1 || true
  if [ "$exit_code" -ne 0 ]; then
    return "$exit_code"
  fi
  local end_ts
  end_ts=$(date +%s)
  echo "[dev-up] ${label} done ($((end_ts - start_ts))s)"
}

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
PARIS_DEV_JWT_FILE="$ROOT_DIR/Execution_Pipeline_Docs/paris.dev.jwt"
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

# Default TOKYO_DEV_JWT to the Paris dev token for local workflows.
if [ -z "${TOKYO_DEV_JWT:-}" ]; then
  TOKYO_DEV_JWT="$PARIS_DEV_JWT"
fi

# Shared HMAC used for Paris grants -> SanFrancisco verification.
AI_GRANT_HMAC_SECRET_FILE="$ROOT_DIR/Execution_Pipeline_Docs/ai.grant.hmac.secret"
if [ -z "${AI_GRANT_HMAC_SECRET:-}" ]; then
  if [ -f "$AI_GRANT_HMAC_SECRET_FILE" ]; then
    AI_GRANT_HMAC_SECRET="$(cat "$AI_GRANT_HMAC_SECRET_FILE")"
  fi
fi
if [ -z "${AI_GRANT_HMAC_SECRET:-}" ]; then
  echo "[dev-up] AI_GRANT_HMAC_SECRET not set; AI copilots will be disabled in local dev."
fi

USAGE_EVENT_HMAC_SECRET_FILE="$ROOT_DIR/Execution_Pipeline_Docs/usage.event.hmac.secret"
if [ -z "${USAGE_EVENT_HMAC_SECRET:-}" ]; then
  if [ -f "$USAGE_EVENT_HMAC_SECRET_FILE" ]; then
    USAGE_EVENT_HMAC_SECRET="$(cat "$USAGE_EVENT_HMAC_SECRET_FILE")"
  fi
fi
if [ -z "${USAGE_EVENT_HMAC_SECRET:-}" ]; then
  echo "[dev-up] USAGE_EVENT_HMAC_SECRET not set; view metering will be disabled in local dev."
  echo "[dev-up] Set USAGE_EVENT_HMAC_SECRET in $ROOT_DIR/.env.local or create $USAGE_EVENT_HMAC_SECRET_FILE."
fi

SF_BASE_URL=""
if [ -n "${AI_GRANT_HMAC_SECRET:-}" ]; then
  SF_BASE_URL="http://localhost:3002"
fi

if [ "$DEV_UP_FULL_REBUILD" = "1" ]; then
  echo "[dev-up] Full rebuild requested (--full): running workspace build"
  pnpm -w build
else
  echo "[dev-up] Building Dieter directly into tokyo/dieter"
  (
    cd "$ROOT_DIR"
    pnpm --filter @ck/dieter build
  )

  echo "[dev-up] Building i18n bundles into tokyo/i18n"
  node "$ROOT_DIR/scripts/i18n/build.mjs"
  node "$ROOT_DIR/scripts/i18n/validate.mjs"

  echo "[dev-up] Verifying Prague l10n overlays (non-blocking by default)"
  PRAGUE_L10N_VERIFY_LOG="$LOG_DIR/prague-l10n.verify.log"
  if node "$ROOT_DIR/scripts/prague-l10n/verify.mjs" > "$PRAGUE_L10N_VERIFY_LOG" 2>&1; then
    echo "[dev-up] Prague l10n overlays OK"
  else
    echo "[dev-up] Prague l10n overlays missing/out-of-date (startup will continue)"
    echo "[dev-up] See $PRAGUE_L10N_VERIFY_LOG"
    if [ "$DEV_UP_PRAGUE_L10N" = "1" ]; then
      NEEDS_PRAGUE_L10N_TRANSLATE=1
    else
      echo "[dev-up] To generate overlays (requires SanFrancisco + OPENAI_API_KEY):"
      echo "[dev-up]   node scripts/prague-l10n/translate.mjs"
      echo "[dev-up] Or rerun: scripts/dev-up.sh --prague-l10n"
    fi
  fi
fi

echo "[dev-up] Killing stale listeners on 3000,3001,3002,3003,4000,4321,5173,8790,8791 (if any)"
for p in 3000 3001 3002 3003 4000 4321 5173 8790 8791; do
  PIDS=$(lsof -ti tcp:$p -sTCP:LISTEN 2>/dev/null || true)
  if [ -n "$PIDS" ]; then
    echo "[dev-up] Killing $PIDS on port $p"
    kill -9 $PIDS || true
  fi
done

# Wrangler/workerd can get stuck in a broken state without holding the LISTEN socket
# (e.g. after a crash/reload loop). Kill them by commandline as a backstop.
echo "[dev-up] Killing stale wrangler/workerd processes (ports 3001/3002/8790/8791)"
pkill -f "wrangler.*dev.*--port 3001" || true
pkill -f "wrangler.*dev.*--port 3002" || true
pkill -f "wrangler.*dev.*--port 8790" || true
pkill -f "wrangler.*dev.*--port 8791" || true
pkill -f "workerd serve.*entry=localhost:3001" || true
pkill -f "workerd serve.*entry=localhost:3002" || true
pkill -f "workerd serve.*entry=localhost:8790" || true
pkill -f "workerd serve.*entry=localhost:8791" || true

echo "[dev-up] Cleaning Bob build artifacts (.next/.next-dev) to avoid stale chunk mismatches"
rm -rf "$ROOT_DIR/bob/.next" "$ROOT_DIR/bob/.next-dev" || true

echo "[dev-up] Cleaning Venice build artifacts (.next/.next-dev) to avoid stale edge sandbox mismatches"
rm -rf "$ROOT_DIR/venice/.next" "$ROOT_DIR/venice/.next-dev" || true

# Local dev always uses the local Tokyo CDN stub.
TOKYO_URL=${TOKYO_URL:-http://localhost:4000}

echo "[dev-up] Starting Tokyo CDN stub on 4000"
(
  cd "$ROOT_DIR/tokyo"
  PORT=4000 nohup node dev-server.mjs > "$LOG_DIR/tokyo.dev.log" 2>&1 &
  TOKYO_PID=$!
  echo "[dev-up] Tokyo PID: $TOKYO_PID"
)
if ! wait_for_url "http://localhost:4000/healthz" "Tokyo"; then
  exit 1
fi

echo "[dev-up] Starting Tokyo Worker (8791) for l10n publishing"
(
  cd "$ROOT_DIR/tokyo-worker"
  VARS=(--var "SUPABASE_URL:$SUPABASE_URL" --var "SUPABASE_SERVICE_ROLE_KEY:$SUPABASE_SERVICE_ROLE_KEY")
  VARS+=(--var "TOKYO_L10N_HTTP_BASE:$TOKYO_URL")
  VARS+=(--var "VENICE_BASE_URL:http://localhost:3003")
  if [ -n "${TOKYO_DEV_JWT:-}" ]; then
    VARS+=(--var "TOKYO_DEV_JWT:$TOKYO_DEV_JWT")
  fi
  nohup pnpm exec wrangler dev --local --env local --port 8791 --persist-to "$WRANGLER_PERSIST_DIR" --inspector-port "$TOKYO_WORKER_INSPECTOR_PORT" \
    "${VARS[@]}" \
    > "$LOG_DIR/tokyo-worker.dev.log" 2>&1 &
  TOKYO_WORKER_PID=$!
  echo "[dev-up] Tokyo Worker PID: $TOKYO_WORKER_PID"
)
if ! wait_for_url "http://localhost:8791/healthz" "Tokyo Worker"; then
  exit 1
fi

echo "[dev-up] Starting Paris Worker (3001)"
(
  cd "$ROOT_DIR/paris"
  VARS=(--var "SUPABASE_URL:$SUPABASE_URL" --var "SUPABASE_SERVICE_ROLE_KEY:$SUPABASE_SERVICE_ROLE_KEY" --var "PARIS_DEV_JWT:$PARIS_DEV_JWT")
  VARS+=(--var "TOKYO_BASE_URL:$TOKYO_URL")
  VARS+=(--var "TOKYO_WORKER_BASE_URL:http://localhost:8791")
  VARS+=(--var "TOKYO_DEV_JWT:$TOKYO_DEV_JWT")
  VARS+=(--var "ENV_STAGE:local")
  if [ -n "$SF_BASE_URL" ]; then
    VARS+=(--var "SANFRANCISCO_BASE_URL:$SF_BASE_URL")
  fi
  if [ -n "${AI_GRANT_HMAC_SECRET:-}" ]; then
    VARS+=(--var "AI_GRANT_HMAC_SECRET:$AI_GRANT_HMAC_SECRET")
  fi
  if [ -n "${USAGE_EVENT_HMAC_SECRET:-}" ]; then
    VARS+=(--var "USAGE_EVENT_HMAC_SECRET:$USAGE_EVENT_HMAC_SECRET")
  fi

  nohup pnpm exec wrangler dev --local --env local --port 3001 --persist-to "$WRANGLER_PERSIST_DIR" --inspector-port "$PARIS_INSPECTOR_PORT" \
    "${VARS[@]}" \
    > "$LOG_DIR/paris.dev.log" 2>&1 &
  PARIS_PID=$!
  echo "[dev-up] Paris PID: $PARIS_PID"
)
if ! wait_for_url "http://localhost:3001/api/healthz" "Paris"; then
  exit 1
fi

echo "[dev-up] Note: instances are created/edited from DevStudio Local (human-driven)"

echo "[dev-up] Starting Venice embed runtime (3003)"
(
  cd "$ROOT_DIR/venice"
  PORT=3003 PARIS_URL="http://localhost:3001" PARIS_DEV_JWT="$PARIS_DEV_JWT" TOKYO_URL="$TOKYO_URL" USAGE_EVENT_HMAC_SECRET="${USAGE_EVENT_HMAC_SECRET:-}" nohup pnpm dev > "$LOG_DIR/venice.dev.log" 2>&1 &
  VENICE_PID=$!
  echo "[dev-up] Venice PID: $VENICE_PID"
)
if ! wait_for_url "http://localhost:3003/dieter/tokens/tokens.css" "Venice"; then
  exit 1
fi

if [ -n "${AI_GRANT_HMAC_SECRET:-}" ] || [ "$NEEDS_PRAGUE_L10N_TRANSLATE" = "1" ]; then
  SF_REQUIRED=0
  if [ -n "${AI_GRANT_HMAC_SECRET:-}" ]; then
    SF_REQUIRED=1
  fi
  echo "[dev-up] Starting SanFrancisco Worker (3002)"
  (
    cd "$ROOT_DIR/sanfrancisco"
    # DEEPSEEK_API_KEY is required for real executions; missing key is still useful for boot verification.
    VARS=()
    if [ -n "${AI_GRANT_HMAC_SECRET:-}" ]; then
      VARS+=(--var "AI_GRANT_HMAC_SECRET:$AI_GRANT_HMAC_SECRET")
    fi
    if [ -n "${DEEPSEEK_API_KEY:-}" ]; then
      VARS+=(--var "DEEPSEEK_API_KEY:$DEEPSEEK_API_KEY")
    fi
    if [ -n "${OPENAI_API_KEY:-}" ]; then
      VARS+=(--var "OPENAI_API_KEY:$OPENAI_API_KEY")
    fi
    if [ -n "${OPENAI_MODEL:-}" ]; then
      VARS+=(--var "OPENAI_MODEL:$OPENAI_MODEL")
    fi
    VARS+=(--var "PARIS_BASE_URL:http://localhost:3001")
    VARS+=(--var "PARIS_DEV_JWT:$PARIS_DEV_JWT")
    VARS+=(--var "TOKYO_BASE_URL:$TOKYO_URL")
    if [ -n "${TOKYO_DEV_JWT:-}" ]; then
      VARS+=(--var "TOKYO_DEV_JWT:$TOKYO_DEV_JWT")
    fi

    nohup pnpm exec wrangler dev --local --env local --port 3002 --persist-to "$WRANGLER_PERSIST_DIR" --inspector-port "$SANFRANCISCO_INSPECTOR_PORT" "${VARS[@]}" \
      > "$LOG_DIR/sanfrancisco.dev.log" 2>&1 &
    SF_PID=$!
    echo "[dev-up] SanFrancisco PID: $SF_PID"
  )
  if ! wait_for_url "http://localhost:3002/healthz" "SanFrancisco"; then
    if [ "$SF_REQUIRED" = "1" ]; then
      exit 1
    fi
    echo "[dev-up] SanFrancisco failed to start; continuing startup"
  fi
fi

(
  cd "$ROOT_DIR/bob"
  if [ -n "$SF_BASE_URL" ]; then
    # Always prefer local Workers in local dev (avoid accidentally pointing at Cloudflare URLs from .env.local).
    PORT=3000 PARIS_BASE_URL="http://localhost:3001" PARIS_DEV_JWT="$PARIS_DEV_JWT" TOKYO_DEV_JWT="$TOKYO_DEV_JWT" SANFRANCISCO_BASE_URL="$SF_BASE_URL" NEXT_PUBLIC_TOKYO_URL="$TOKYO_URL" nohup pnpm dev > "$LOG_DIR/bob.dev.log" 2>&1 &
  else
    PORT=3000 PARIS_BASE_URL="http://localhost:3001" PARIS_DEV_JWT="$PARIS_DEV_JWT" TOKYO_DEV_JWT="$TOKYO_DEV_JWT" NEXT_PUBLIC_TOKYO_URL="$TOKYO_URL" nohup pnpm dev > "$LOG_DIR/bob.dev.log" 2>&1 &
  fi
  BOB_PID=$!
  echo "[dev-up] Bob PID: $BOB_PID"
)
if ! wait_for_url "http://localhost:3000" "Bob"; then
  exit 1
fi

(
  cd "$ROOT_DIR/admin"
  PORT=5173 TOKYO_URL="$TOKYO_URL" nohup pnpm dev > "$LOG_DIR/devstudio.dev.log" 2>&1 &
  DEVSTUDIO_PID=$!
  echo "[dev-up] DevStudio PID: $DEVSTUDIO_PID"
)
if ! wait_for_url "http://localhost:5173" "DevStudio"; then
  exit 1
fi

echo "[dev-up] Starting Pitch Agent worker (8790)"
(
  cd "$ROOT_DIR/pitch"
  nohup pnpm dev > "$LOG_DIR/pitch.dev.log" 2>&1 &
  PITCH_PID=$!
  echo "[dev-up] Pitch PID: $PITCH_PID"
)
if ! wait_for_url "http://localhost:8790/healthz" "Pitch"; then
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

if [ "$NEEDS_PRAGUE_L10N_TRANSLATE" = "1" ]; then
  if [ -z "${OPENAI_API_KEY:-}" ]; then
    echo "[dev-up] Prague l10n translate requested but OPENAI_API_KEY is missing; skipping"
  elif ! wait_for_url "http://localhost:3002/healthz" "SanFrancisco (for Prague l10n)"; then
    echo "[dev-up] Prague l10n translate requested but SanFrancisco is not reachable; skipping"
  else
    echo "[dev-up] Starting Prague l10n translate in background (requested)"
    PRAGUE_L10N_TRANSLATE_LOG="$LOG_DIR/prague-l10n.translate.log"
    PRAGUE_L10N_VERIFY_LOG="$LOG_DIR/prague-l10n.verify.log"
    nohup bash -lc "SANFRANCISCO_BASE_URL=\"http://localhost:3002\" node \"$ROOT_DIR/scripts/prague-l10n/translate.mjs\" > \"$PRAGUE_L10N_TRANSLATE_LOG\" 2>&1 && node \"$ROOT_DIR/scripts/prague-l10n/verify.mjs\" > \"$PRAGUE_L10N_VERIFY_LOG\" 2>&1" >/dev/null 2>&1 &
    PRAGUE_L10N_PID=$!
    echo "[dev-up] Prague l10n PID: $PRAGUE_L10N_PID"
    echo "[dev-up] Tail logs: tail -f $PRAGUE_L10N_TRANSLATE_LOG"
  fi
fi

echo "[dev-up] Starting Prague marketing site (4321)"
(
  cd "$ROOT_DIR/prague"
  PORT=4321 PUBLIC_TOKYO_URL="$TOKYO_URL" PUBLIC_BOB_URL="http://localhost:3000" PUBLIC_VENICE_URL="http://localhost:3003" nohup pnpm dev > "$LOG_DIR/prague.dev.log" 2>&1 &
  PRAGUE_PID=$!
  echo "[dev-up] Prague PID: $PRAGUE_PID"
)
if ! wait_for_url "http://localhost:4321" "Prague"; then
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
echo "  Prague:    http://localhost:4321/us/en/widgets/faq"
