#!/usr/bin/env bash
set -euo pipefail

# Canonical local startup script.
# Starts local services only and keeps startup concerns boring:
# - load env
# - start services
# - health checks

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT_DIR"

LOG_DIR="$ROOT_DIR/Logs"
mkdir -p "$LOG_DIR"
WRANGLER_PERSIST_DIR="$ROOT_DIR/.wrangler/state"
mkdir -p "$WRANGLER_PERSIST_DIR"
LOCK_DIR="$ROOT_DIR/.dev-up.lock"

TOKYO_WORKER_INSPECTOR_PORT=9231
PARIS_INSPECTOR_PORT=9232
SANFRANCISCO_INSPECTOR_PORT=9233
BERLIN_INSPECTOR_PORT=9234

DEV_UP_HEALTH_ATTEMPTS="${DEV_UP_HEALTH_ATTEMPTS:-60}"
DEV_UP_HEALTH_INTERVAL="${DEV_UP_HEALTH_INTERVAL:-1}"
DEV_UP_FULL_REBUILD=0
DEV_UP_PRAGUE_L10N=0
DEV_UP_RESET=0
NEEDS_PRAGUE_L10N_TRANSLATE=0
STARTED_PID=""
STACK_PORTS=(3000 3001 3002 3003 3004 3005 4000 4321 5173 8790 8791)

ensure_lock() {
  if [ -d "$LOCK_DIR" ]; then
    local stale=1
    if [ -f "$LOCK_DIR/pid" ]; then
      local existing_pid
      existing_pid=$(cat "$LOCK_DIR/pid" 2>/dev/null || true)
      if [ -n "$existing_pid" ] && kill -0 "$existing_pid" >/dev/null 2>&1; then
        stale=0
      fi
    fi
    if [ "$stale" = "1" ]; then
      rm -rf "$LOCK_DIR"
    fi
  fi
  if ! mkdir "$LOCK_DIR" >/dev/null 2>&1; then
    local owner_pid
    owner_pid=$(cat "$LOCK_DIR/pid" 2>/dev/null || true)
    if [ -n "$owner_pid" ]; then
      echo "[dev-up] Another dev-up run is in progress (pid $owner_pid)."
    else
      echo "[dev-up] Another dev-up run is in progress."
    fi
    exit 1
  fi
  echo "$$" > "$LOCK_DIR/pid"
}

cleanup_lock() {
  rm -rf "$LOCK_DIR"
}

is_port_listening() {
  local port="$1"
  lsof -ti tcp:"$port" -sTCP:LISTEN >/dev/null 2>&1
}

count_stack_listeners() {
  local count=0
  local port
  for port in "${STACK_PORTS[@]}"; do
    if is_port_listening "$port"; then
      count=$((count + 1))
    fi
  done
  echo "$count"
}

print_stack_port_status() {
  local port
  echo "[dev-up] Port status:"
  for port in "${STACK_PORTS[@]}"; do
    if is_port_listening "$port"; then
      echo "  $port: up"
    else
      echo "  $port: down"
    fi
  done
}

register_pid() {
  # Process metadata tracking is intentionally disabled; readiness and lifecycle are port-based.
  :
}

stop_pid_tree() {
  local pid="$1"
  if [ -z "$pid" ]; then
    return 0
  fi
  if ! kill -0 "$pid" >/dev/null 2>&1; then
    return 0
  fi

  local child
  while IFS= read -r child; do
    [ -z "$child" ] && continue
    stop_pid_tree "$child"
  done < <(pgrep -P "$pid" 2>/dev/null || true)

  kill "$pid" >/dev/null 2>&1 || true
  local i
  for i in 1 2 3; do
    if ! kill -0 "$pid" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  kill -9 "$pid" >/dev/null 2>&1 || true
}

list_repo_wrangler_pids() {
  local row pid cmd
  while IFS= read -r row; do
    pid="${row%% *}"
    cmd="${row#* }"
    case "$cmd" in
      *"$ROOT_DIR"*wrangler*' dev --local '*)
        case "$cmd" in
          *'--port 3001'*|*'--port 3002'*|*'--port 3005'*|*'--port 8790'*|*'--port 8791'*)
            echo "$pid"
            ;;
        esac
        ;;
    esac
  done < <(ps -axo pid=,command=)
}

stop_repo_wrangler_processes() {
  local pids
  pids=$(list_repo_wrangler_pids | awk 'NF')
  if [ -z "$pids" ]; then
    return 0
  fi
  echo "[dev-up] Stopping stale wrangler wrappers: $(echo "$pids" | tr '\n' ' ')"
  local pid
  while IFS= read -r pid; do
    [ -z "$pid" ] && continue
    stop_pid_tree "$pid"
  done <<<"$pids"
}

preflight_existing_stack() {
  local listeners
  listeners=$(count_stack_listeners)

  if [ "$DEV_UP_RESET" = "1" ]; then
    echo "[dev-up] --reset requested: forcing clean local restart"
    stop_repo_wrangler_processes
    local p
    for p in "${STACK_PORTS[@]}"; do
      stop_port "$p"
    done
    return 0
  fi

  if [ "$listeners" -ge 4 ]; then
    echo "[dev-up] Existing local stack detected ($listeners listening ports)."
    echo "[dev-up] Re-run with --reset to force a clean restart."
    print_stack_port_status
    exit 0
  fi

  local orphan_count
  orphan_count=$(list_repo_wrangler_pids | awk 'NF { c++ } END { print c + 0 }')
  if [ "$listeners" -eq 0 ] && [ "$orphan_count" -gt 0 ]; then
    echo "[dev-up] Cleaning stale wrangler wrappers left by older runs"
    stop_repo_wrangler_processes
  fi
}

ensure_stack_ports_healthy() {
  local attempts="${1:-8}"
  local interval_seconds="${2:-1}"
  local include_sf="${3:-0}"
  local ports=(3000 3001 3003 3004 3005 4000 4321 5173 8790 8791)
  if [ "$include_sf" = "1" ]; then
    ports+=(3002)
  fi

  local attempt port
  local failed_ports=()
  for attempt in $(seq 1 "$attempts"); do
    failed_ports=()
    for port in "${ports[@]}"; do
      if ! is_stack_service_healthy "$port"; then
        failed_ports+=("$port")
      fi
    done
    if [ "${#failed_ports[@]}" -eq 0 ]; then
      return 0
    fi
    if [ "$attempt" -lt "$attempts" ]; then
      sleep "$interval_seconds"
    fi
  done

  echo "[dev-up] ERROR: local stack failed readiness checks."
  for port in "${failed_ports[@]}"; do
    echo "[dev-up]   failed health check on port $port"
  done
  tail_log "$LOG_DIR/tokyo.dev.log"
  tail_log "$LOG_DIR/tokyo-worker.dev.log"
  tail_log "$LOG_DIR/berlin.dev.log"
  tail_log "$LOG_DIR/paris.dev.log"
  tail_log "$LOG_DIR/venice.dev.log"
  tail_log "$LOG_DIR/bob.dev.log"
  tail_log "$LOG_DIR/devstudio.dev.log"
  tail_log "$LOG_DIR/pitch.dev.log"
  tail_log "$LOG_DIR/roma.dev.log"
  tail_log "$LOG_DIR/prague.dev.log"
  if [ "$include_sf" = "1" ]; then
    tail_log "$LOG_DIR/sanfrancisco.dev.log"
  fi
  return 1
}

is_stack_service_healthy() {
  local port="$1"
  local url=""
  case "$port" in
    3000) url="http://localhost:3000" ;;
    3001) url="http://localhost:3001/api/healthz" ;;
    3002) url="http://localhost:3002/healthz" ;;
    3003) url="http://localhost:3003/dieter/tokens/tokens.css" ;;
    3004) url="http://localhost:3004/home" ;;
    3005) url="http://localhost:3005/internal/healthz" ;;
    4000) url="http://localhost:4000/healthz" ;;
    4321) url="http://localhost:4321" ;;
    5173) url="http://localhost:5173" ;;
    8790) url="http://localhost:8790/healthz" ;;
    8791) url="http://localhost:8791/healthz" ;;
  esac

  if [ -n "$url" ]; then
    curl -sf "$url" >/dev/null 2>&1
    return $?
  fi
  is_port_listening "$port"
}

tail_log() {
  local log_file="${1:-}"
  if [ -n "$log_file" ] && [ -f "$log_file" ]; then
    echo "[dev-up] Last log lines from $log_file:"
    tail -n 40 "$log_file" || true
  fi
}

wait_for_url() {
  local url="$1"
  local label="$2"
  local log_file="${3:-}"
  local i

  for i in $(seq 1 "$DEV_UP_HEALTH_ATTEMPTS"); do
    if curl -sf "$url" >/dev/null 2>&1; then
      return 0
    fi
    sleep "$DEV_UP_HEALTH_INTERVAL"
  done

  echo "[dev-up] Timeout waiting for $label @ $url"
  tail_log "$log_file"
  return 1
}

prewarm_bob_routes() {
  if [ "${DEV_UP_SKIP_PREWARM:-0}" = "1" ] || [ "${DEV_UP_SKIP_PREWARM:-}" = "true" ]; then
    echo "[dev-up] Skipping Bob prewarm (DEV_UP_SKIP_PREWARM set)"
    return 0
  fi

  local bob_base="http://localhost:3000"
  local widgets_dir="$ROOT_DIR/tokyo/widgets"
  local failed=0
  local widget_dir widget

  if [ ! -d "$widgets_dir" ]; then
    return 0
  fi

  echo "[dev-up] Prewarming Bob compile and asset routes"
  for widget_dir in "$widgets_dir"/*; do
    [ -d "$widget_dir" ] || continue
    widget="$(basename "$widget_dir")"

    if ! curl -sf "$bob_base/api/widgets/$widget/compiled" >/dev/null 2>&1; then
      echo "[dev-up] Prewarm warning: failed GET /api/widgets/$widget/compiled"
      failed=1
    fi

    if ! curl -sf "$bob_base/widgets/$widget/widget.html" >/dev/null 2>&1; then
      echo "[dev-up] Prewarm warning: failed GET /widgets/$widget/widget.html"
      failed=1
    fi
  done

  if ! curl -sf "$bob_base/dieter/tokens/tokens.css" >/dev/null 2>&1; then
    echo "[dev-up] Prewarm warning: failed GET /dieter/tokens/tokens.css"
    failed=1
  fi

  if [ "$failed" = "1" ]; then
    echo "[dev-up] Bob prewarm completed with warnings (non-blocking)"
  else
    echo "[dev-up] Bob prewarm completed"
  fi
}

start_detached() {
  local log_file="$1"
  shift
  nohup "$@" </dev/null >"$log_file" 2>&1 &
  STARTED_PID="$!"
}

stop_port() {
  local port="$1"
  local pids
  pids=$(lsof -ti tcp:"$port" -sTCP:LISTEN 2>/dev/null || true)
  if [ -z "$pids" ]; then
    return 0
  fi

  echo "[dev-up] Stopping listeners on port $port: $pids"
  kill $pids >/dev/null 2>&1 || true
  sleep 1
  pids=$(lsof -ti tcp:"$port" -sTCP:LISTEN 2>/dev/null || true)
  if [ -n "$pids" ]; then
    echo "[dev-up] Force-stopping listeners on port $port: $pids"
    kill -9 $pids >/dev/null 2>&1 || true
  fi
}

warn_dirty_widget_copy() {
  if ! command -v git >/dev/null 2>&1; then
    return 0
  fi

  local dirty
  dirty=$(git status --porcelain --untracked-files=all -- tokyo/widgets/*/pages/*.json 2>/dev/null || true)
  if [ -z "$dirty" ]; then
    return 0
  fi

  echo "[dev-up] WARNING: Uncommitted widget page copy changes detected."
  echo "[dev-up] WARNING: Local Prague may differ from committed/deployed previews."
  while IFS= read -r line; do
    [ -z "$line" ] && continue
    echo "[dev-up]   $line"
  done <<<"$dirty"
}

for arg in "$@"; do
  case "$arg" in
    --full|--rebuild-all)
      DEV_UP_FULL_REBUILD=1
      ;;
    --prague-l10n|--l10n)
      DEV_UP_PRAGUE_L10N=1
      ;;
    --reset)
      DEV_UP_RESET=1
      ;;
    --help|-h)
      echo "Usage: bash scripts/dev-up.sh [--full] [--prague-l10n] [--reset]"
      echo ""
      echo "Options:"
      echo "  --full        Runs workspace build before starting services."
      echo "  --prague-l10n Verifies Prague overlays and runs translation in the background if needed."
      echo "  --reset       Force a clean restart of the local stack managed by dev-up."
      exit 0
      ;;
    *)
      echo "[dev-up] Unknown argument: $arg" >&2
      exit 1
      ;;
  esac
done

ensure_lock
trap cleanup_lock EXIT
warn_dirty_widget_copy
preflight_existing_stack

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

echo "[dev-up] Applying pending Supabase migrations (non-destructive)"
supabase migration up

echo "[dev-up] Loading local Supabase connection values"
ORIG_SUPABASE_URL="${SUPABASE_URL:-}"
ORIG_SUPABASE_SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY:-}"
DEV_UP_USE_REMOTE_SUPABASE="${DEV_UP_USE_REMOTE_SUPABASE:-}"
# shellcheck disable=SC2046
eval "$(supabase status --output env | grep -E '^[A-Z_]+=' || true)"
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

SUPABASE_ANON_KEY_VALUE="${ANON_KEY:-${SUPABASE_ANON_KEY:-${NEXT_PUBLIC_SUPABASE_ANON_KEY:-}}}"
if [ -z "${SUPABASE_ANON_KEY_VALUE:-}" ]; then
  echo "[dev-up] Failed to resolve SUPABASE_ANON_KEY from Supabase status / env"
  exit 1
fi

if [ "$DEV_UP_USE_REMOTE_SUPABASE" = "1" ] || [ "$DEV_UP_USE_REMOTE_SUPABASE" = "true" ]; then
  echo "[dev-up] Skipping local persona seed (remote Supabase mode)"
else
  if [ -z "${CK_ADMIN_EMAIL:-}" ]; then
    CK_ADMIN_EMAIL="local.admin@clickeen.local"
    export CK_ADMIN_EMAIL
    echo "[dev-up] CK_ADMIN_EMAIL not set. Defaulting to $CK_ADMIN_EMAIL"
  fi
  if [ -z "${CK_ADMIN_PASSWORD:-}" ]; then
    if command -v openssl >/dev/null 2>&1; then
      CK_ADMIN_PASSWORD="Local-$(openssl rand -hex 12)!A9"
    else
      CK_ADMIN_PASSWORD="Local-${RANDOM}${RANDOM}-Fallback!A9"
    fi
    export CK_ADMIN_PASSWORD
    echo "[dev-up] CK_ADMIN_PASSWORD not set. Generated ephemeral local admin password for this run:"
    echo "[dev-up]   CK_ADMIN_EMAIL=$CK_ADMIN_EMAIL"
    echo "[dev-up]   CK_ADMIN_PASSWORD=$CK_ADMIN_PASSWORD"
  fi
  echo "[dev-up] Seeding deterministic local personas (non-destructive)"
  SUPABASE_URL="$SUPABASE_URL" SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY" SERVICE_ROLE_KEY="${SERVICE_ROLE_KEY:-}" CK_ADMIN_EMAIL="${CK_ADMIN_EMAIL:-}" CK_ADMIN_PASSWORD="${CK_ADMIN_PASSWORD:-}" \
    node "$ROOT_DIR/scripts/dev/seed-local-personas.mjs"
fi

PARIS_DEV_JWT_FILE="$ROOT_DIR/Execution_Pipeline_Docs/paris.dev.jwt"
if [ -z "${PARIS_DEV_JWT:-}" ] && [ -f "$PARIS_DEV_JWT_FILE" ]; then
  PARIS_DEV_JWT="$(cat "$PARIS_DEV_JWT_FILE")"
fi
if [ -z "${PARIS_DEV_JWT:-}" ]; then
  echo "[dev-up] Missing PARIS_DEV_JWT."
  echo "[dev-up] Set PARIS_DEV_JWT in $ROOT_DIR/.env.local (recommended) or create $PARIS_DEV_JWT_FILE."
  exit 1
fi

if [ -z "${TOKYO_DEV_JWT:-}" ]; then
  TOKYO_DEV_JWT="$PARIS_DEV_JWT"
fi

AI_GRANT_HMAC_SECRET_FILE="$ROOT_DIR/Execution_Pipeline_Docs/ai.grant.hmac.secret"
if [ -z "${AI_GRANT_HMAC_SECRET:-}" ] && [ -f "$AI_GRANT_HMAC_SECRET_FILE" ]; then
  AI_GRANT_HMAC_SECRET="$(cat "$AI_GRANT_HMAC_SECRET_FILE")"
fi
if [ -z "${AI_GRANT_HMAC_SECRET:-}" ]; then
  echo "[dev-up] AI_GRANT_HMAC_SECRET not set; SanFrancisco copilot services will stay disabled."
fi

USAGE_EVENT_HMAC_SECRET_FILE="$ROOT_DIR/Execution_Pipeline_Docs/usage.event.hmac.secret"
if [ -z "${USAGE_EVENT_HMAC_SECRET:-}" ] && [ -f "$USAGE_EVENT_HMAC_SECRET_FILE" ]; then
  USAGE_EVENT_HMAC_SECRET="$(cat "$USAGE_EVENT_HMAC_SECRET_FILE")"
fi
if [ -z "${USAGE_EVENT_HMAC_SECRET:-}" ]; then
  echo "[dev-up] USAGE_EVENT_HMAC_SECRET not set; view metering will be disabled in local dev."
fi

TOKYO_URL=${TOKYO_URL:-http://localhost:4000}
BERLIN_URL=${BERLIN_URL:-http://localhost:3005}
BERLIN_ISSUER=${BERLIN_ISSUER:-$BERLIN_URL}
BERLIN_AUDIENCE=${BERLIN_AUDIENCE:-clickeen.product}
SF_BASE_URL=""
if [ -n "${AI_GRANT_HMAC_SECRET:-}" ]; then
  SF_BASE_URL="http://localhost:3002"
fi

if [ "$DEV_UP_FULL_REBUILD" = "1" ]; then
  echo "[dev-up] Full rebuild requested (--full): running workspace build"
  pnpm -w build
else
  echo "[dev-up] Building Dieter assets for local Tokyo"
  pnpm --filter @ck/dieter build

  echo "[dev-up] Building i18n bundles"
  node "$ROOT_DIR/scripts/i18n/build.mjs"
  node "$ROOT_DIR/scripts/i18n/validate.mjs"

  echo "[dev-up] Verifying Prague l10n overlays (non-blocking)"
  PRAGUE_L10N_VERIFY_LOG="$LOG_DIR/prague-l10n.verify.log"
  if node "$ROOT_DIR/scripts/prague-l10n/verify.mjs" >"$PRAGUE_L10N_VERIFY_LOG" 2>&1; then
    echo "[dev-up] Prague l10n overlays OK"
  else
    echo "[dev-up] Prague l10n overlays are out of date. See $PRAGUE_L10N_VERIFY_LOG"
    if [ "$DEV_UP_PRAGUE_L10N" = "1" ]; then
      NEEDS_PRAGUE_L10N_TRANSLATE=1
    else
      echo "[dev-up] Re-run with --prague-l10n to regenerate overlays in background."
    fi
  fi
fi

echo "[dev-up] Stopping stale listeners"
for p in 3000 3001 3002 3003 3004 3005 4000 4321 5173 8790 8791; do
  stop_port "$p"
done

echo "[dev-up] Starting Tokyo CDN stub on 4000"
(
  cd "$ROOT_DIR/tokyo"
  start_detached "$LOG_DIR/tokyo.dev.log" env PORT=4000 TOKYO_WORKER_BASE_URL="http://localhost:8791" node dev-server.mjs
  TOKYO_PID="$STARTED_PID"
  echo "[dev-up] Tokyo PID: $TOKYO_PID"
  register_pid "tokyo" "$TOKYO_PID" "4000" "$LOG_DIR/tokyo.dev.log"
)
wait_for_url "http://localhost:4000/healthz" "Tokyo" "$LOG_DIR/tokyo.dev.log"

echo "[dev-up] Starting Tokyo Worker (8791)"
(
  cd "$ROOT_DIR/tokyo-worker"
  VARS=(--var "SUPABASE_URL:$SUPABASE_URL" --var "SUPABASE_SERVICE_ROLE_KEY:$SUPABASE_SERVICE_ROLE_KEY")
  VARS+=(--var "TOKYO_L10N_HTTP_BASE:$TOKYO_URL")
  VARS+=(--var "VENICE_BASE_URL:http://localhost:3003")
  VARS+=(--var "TOKYO_DEV_JWT:$TOKYO_DEV_JWT")
  VARS+=(--var "BERLIN_BASE_URL:$BERLIN_URL")
  VARS+=(--var "BERLIN_ISSUER:$BERLIN_ISSUER")
  VARS+=(--var "BERLIN_AUDIENCE:$BERLIN_AUDIENCE")
  start_detached "$LOG_DIR/tokyo-worker.dev.log" pnpm exec wrangler dev --local --env local --port 8791 --persist-to "$WRANGLER_PERSIST_DIR" --inspector-port "$TOKYO_WORKER_INSPECTOR_PORT" \
    "${VARS[@]}"
  TOKYO_WORKER_PID="$STARTED_PID"
  echo "[dev-up] Tokyo Worker PID: $TOKYO_WORKER_PID"
  register_pid "tokyo-worker" "$TOKYO_WORKER_PID" "8791" "$LOG_DIR/tokyo-worker.dev.log"
)
wait_for_url "http://localhost:8791/healthz" "Tokyo Worker" "$LOG_DIR/tokyo-worker.dev.log"

echo "[dev-up] Starting Berlin Worker (3005)"
(
  cd "$ROOT_DIR/berlin"
  VARS=(--var "SUPABASE_URL:$SUPABASE_URL" --var "SUPABASE_ANON_KEY:$SUPABASE_ANON_KEY_VALUE")
  VARS+=(--var "BERLIN_ISSUER:$BERLIN_ISSUER")
  VARS+=(--var "BERLIN_AUDIENCE:$BERLIN_AUDIENCE")
  if [ -n "${BERLIN_REFRESH_SECRET:-}" ]; then
    VARS+=(--var "BERLIN_REFRESH_SECRET:$BERLIN_REFRESH_SECRET")
  fi
  if [ -n "${BERLIN_ACCESS_PRIVATE_KEY_PEM:-}" ]; then
    VARS+=(--var "BERLIN_ACCESS_PRIVATE_KEY_PEM:$BERLIN_ACCESS_PRIVATE_KEY_PEM")
  fi
  if [ -n "${BERLIN_ACCESS_PUBLIC_KEY_PEM:-}" ]; then
    VARS+=(--var "BERLIN_ACCESS_PUBLIC_KEY_PEM:$BERLIN_ACCESS_PUBLIC_KEY_PEM")
  fi
  start_detached "$LOG_DIR/berlin.dev.log" pnpm exec wrangler dev --local --env local --port 3005 --persist-to "$WRANGLER_PERSIST_DIR" --inspector-port "$BERLIN_INSPECTOR_PORT" \
    "${VARS[@]}"
  BERLIN_PID="$STARTED_PID"
  echo "[dev-up] Berlin PID: $BERLIN_PID"
  register_pid "berlin" "$BERLIN_PID" "3005" "$LOG_DIR/berlin.dev.log"
)
wait_for_url "http://localhost:3005/internal/healthz" "Berlin" "$LOG_DIR/berlin.dev.log"

echo "[dev-up] Syncing Tokyo fonts to local R2"
if ! node "$ROOT_DIR/scripts/tokyo-fonts-sync.mjs" --local --persist-to "$WRANGLER_PERSIST_DIR"; then
  echo "[dev-up] WARNING: Tokyo font sync failed; special fonts may not load until sync succeeds."
fi

echo "[dev-up] Syncing missing Tokyo account assets to local R2"
if ! node "$ROOT_DIR/scripts/tokyo-assets-sync.mjs" --persist-to "$WRANGLER_PERSIST_DIR"; then
  echo "[dev-up] WARNING: Tokyo asset sync failed; some local /assets/v/* refs may return unavailable."
fi

echo "[dev-up] Starting Paris Worker (3001)"
(
  cd "$ROOT_DIR/paris"
  VARS=(--var "SUPABASE_URL:$SUPABASE_URL" --var "SUPABASE_SERVICE_ROLE_KEY:$SUPABASE_SERVICE_ROLE_KEY" --var "PARIS_DEV_JWT:$PARIS_DEV_JWT")
  VARS+=(--var "TOKYO_BASE_URL:$TOKYO_URL")
  VARS+=(--var "TOKYO_WORKER_BASE_URL:http://localhost:8791")
  VARS+=(--var "TOKYO_DEV_JWT:$TOKYO_DEV_JWT")
  VARS+=(--var "BERLIN_BASE_URL:$BERLIN_URL")
  VARS+=(--var "BERLIN_ISSUER:$BERLIN_ISSUER")
  VARS+=(--var "BERLIN_AUDIENCE:$BERLIN_AUDIENCE")
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
  start_detached "$LOG_DIR/paris.dev.log" pnpm exec wrangler dev --local --env local --port 3001 --persist-to "$WRANGLER_PERSIST_DIR" --inspector-port "$PARIS_INSPECTOR_PORT" \
    "${VARS[@]}"
  PARIS_PID="$STARTED_PID"
  echo "[dev-up] Paris PID: $PARIS_PID"
  register_pid "paris" "$PARIS_PID" "3001" "$LOG_DIR/paris.dev.log"
)
wait_for_url "http://localhost:3001/api/healthz" "Paris" "$LOG_DIR/paris.dev.log"

echo "[dev-up] Starting Venice embed runtime (3003)"
(
  cd "$ROOT_DIR/venice"
  start_detached "$LOG_DIR/venice.dev.log" env PORT=3003 PARIS_URL="http://localhost:3001" PARIS_DEV_JWT="$PARIS_DEV_JWT" TOKYO_URL="$TOKYO_URL" USAGE_EVENT_HMAC_SECRET="${USAGE_EVENT_HMAC_SECRET:-}" pnpm dev
  VENICE_PID="$STARTED_PID"
  echo "[dev-up] Venice PID: $VENICE_PID"
  register_pid "venice" "$VENICE_PID" "3003" "$LOG_DIR/venice.dev.log"
)
wait_for_url "http://localhost:3003/dieter/tokens/tokens.css" "Venice" "$LOG_DIR/venice.dev.log"

if [ -n "$SF_BASE_URL" ]; then
  echo "[dev-up] Starting SanFrancisco Worker (3002)"
  (
    cd "$ROOT_DIR/sanfrancisco"
    VARS=(--var "AI_GRANT_HMAC_SECRET:$AI_GRANT_HMAC_SECRET")
    if [ -n "${DEEPSEEK_API_KEY:-}" ]; then
      VARS+=(--var "DEEPSEEK_API_KEY:$DEEPSEEK_API_KEY")
    fi
    if [ -n "${OPENAI_API_KEY:-}" ]; then
      VARS+=(--var "OPENAI_API_KEY:$OPENAI_API_KEY")
    fi
    if [ -n "${OPENAI_MODEL:-}" ]; then
      VARS+=(--var "OPENAI_MODEL:$OPENAI_MODEL")
    fi
    if [ -n "${NOVA_API_KEY:-}" ]; then
      VARS+=(--var "NOVA_API_KEY:$NOVA_API_KEY")
    fi
    if [ -n "${NOVA_MODEL:-}" ]; then
      VARS+=(--var "NOVA_MODEL:$NOVA_MODEL")
    fi
    if [ -n "${NOVA_BASE_URL:-}" ]; then
      VARS+=(--var "NOVA_BASE_URL:$NOVA_BASE_URL")
    fi
    VARS+=(--var "PARIS_BASE_URL:http://localhost:3001")
    VARS+=(--var "PARIS_DEV_JWT:$PARIS_DEV_JWT")
    VARS+=(--var "TOKYO_BASE_URL:$TOKYO_URL")
    VARS+=(--var "TOKYO_DEV_JWT:$TOKYO_DEV_JWT")
    start_detached "$LOG_DIR/sanfrancisco.dev.log" pnpm exec wrangler dev --local --env local --port 3002 --persist-to "$WRANGLER_PERSIST_DIR" --inspector-port "$SANFRANCISCO_INSPECTOR_PORT" \
      "${VARS[@]}"
    SF_PID="$STARTED_PID"
    echo "[dev-up] SanFrancisco PID: $SF_PID"
    register_pid "sanfrancisco" "$SF_PID" "3002" "$LOG_DIR/sanfrancisco.dev.log"
  )
  wait_for_url "http://localhost:3002/healthz" "SanFrancisco" "$LOG_DIR/sanfrancisco.dev.log"
fi

if [ "$NEEDS_PRAGUE_L10N_TRANSLATE" = "1" ]; then
  if [ -z "${OPENAI_API_KEY:-}" ]; then
    echo "[dev-up] --prague-l10n requested, but OPENAI_API_KEY is missing. Skipping translation."
  elif ! wait_for_url "http://localhost:3002/healthz" "SanFrancisco (for Prague l10n)" "$LOG_DIR/sanfrancisco.dev.log"; then
    echo "[dev-up] --prague-l10n requested, but SanFrancisco is not reachable. Skipping translation."
  else
    echo "[dev-up] Starting Prague l10n translate in background"
    PRAGUE_L10N_TRANSLATE_LOG="$LOG_DIR/prague-l10n.translate.log"
    nohup bash -lc "SANFRANCISCO_BASE_URL='http://localhost:3002' node '$ROOT_DIR/scripts/prague-l10n/translate.mjs' > '$PRAGUE_L10N_TRANSLATE_LOG' 2>&1 && node '$ROOT_DIR/scripts/prague-l10n/verify.mjs' > '$LOG_DIR/prague-l10n.verify.log' 2>&1" >/dev/null 2>&1 &
    echo "[dev-up] Prague l10n translate PID: $!"
    echo "[dev-up] Tail logs: tail -f $PRAGUE_L10N_TRANSLATE_LOG"
  fi
fi

echo "[dev-up] Starting Bob (3000)"
(
  cd "$ROOT_DIR/bob"
  if [ -n "$SF_BASE_URL" ]; then
    start_detached "$LOG_DIR/bob.dev.log" env PORT=3000 ENV_STAGE=local PARIS_BASE_URL="http://localhost:3001" BERLIN_BASE_URL="$BERLIN_URL" PARIS_DEV_JWT="$PARIS_DEV_JWT" TOKYO_DEV_JWT="$TOKYO_DEV_JWT" SANFRANCISCO_BASE_URL="$SF_BASE_URL" NEXT_PUBLIC_TOKYO_URL="$TOKYO_URL" CK_ADMIN_EMAIL="${CK_ADMIN_EMAIL:-}" CK_ADMIN_PASSWORD="${CK_ADMIN_PASSWORD:-}" pnpm dev
  else
    start_detached "$LOG_DIR/bob.dev.log" env PORT=3000 ENV_STAGE=local PARIS_BASE_URL="http://localhost:3001" BERLIN_BASE_URL="$BERLIN_URL" PARIS_DEV_JWT="$PARIS_DEV_JWT" TOKYO_DEV_JWT="$TOKYO_DEV_JWT" NEXT_PUBLIC_TOKYO_URL="$TOKYO_URL" CK_ADMIN_EMAIL="${CK_ADMIN_EMAIL:-}" CK_ADMIN_PASSWORD="${CK_ADMIN_PASSWORD:-}" pnpm dev
  fi
  BOB_PID="$STARTED_PID"
  echo "[dev-up] Bob PID: $BOB_PID"
  register_pid "bob" "$BOB_PID" "3000" "$LOG_DIR/bob.dev.log"
)
wait_for_url "http://localhost:3000" "Bob" "$LOG_DIR/bob.dev.log"
prewarm_bob_routes

echo "[dev-up] Starting DevStudio (5173)"
(
  cd "$ROOT_DIR/admin"
  start_detached "$LOG_DIR/devstudio.dev.log" env PORT=5173 TOKYO_URL="$TOKYO_URL" pnpm dev
  DEVSTUDIO_PID="$STARTED_PID"
  echo "[dev-up] DevStudio PID: $DEVSTUDIO_PID"
  register_pid "devstudio" "$DEVSTUDIO_PID" "5173" "$LOG_DIR/devstudio.dev.log"
)
wait_for_url "http://localhost:5173" "DevStudio" "$LOG_DIR/devstudio.dev.log"

echo "[dev-up] Starting Pitch worker (8790)"
(
  cd "$ROOT_DIR/pitch"
  start_detached "$LOG_DIR/pitch.dev.log" pnpm dev
  PITCH_PID="$STARTED_PID"
  echo "[dev-up] Pitch PID: $PITCH_PID"
  register_pid "pitch" "$PITCH_PID" "8790" "$LOG_DIR/pitch.dev.log"
)
wait_for_url "http://localhost:8790/healthz" "Pitch" "$LOG_DIR/pitch.dev.log"

echo "[dev-up] Starting Roma (3004)"
(
  cd "$ROOT_DIR/roma"
  start_detached "$LOG_DIR/roma.dev.log" env PORT=3004 ENV_STAGE=local PARIS_BASE_URL="http://localhost:3001" BERLIN_BASE_URL="$BERLIN_URL" PARIS_DEV_JWT="$PARIS_DEV_JWT" NEXT_PUBLIC_TOKYO_URL="$TOKYO_URL" pnpm dev
  ROMA_PID="$STARTED_PID"
  echo "[dev-up] Roma PID: $ROMA_PID"
  register_pid "roma" "$ROMA_PID" "3004" "$LOG_DIR/roma.dev.log"
)
wait_for_url "http://localhost:3004/home" "Roma" "$LOG_DIR/roma.dev.log"

echo "[dev-up] Starting Prague (4321)"
(
  cd "$ROOT_DIR/prague"
  start_detached "$LOG_DIR/prague.dev.log" env PORT=4321 PUBLIC_TOKYO_URL="$TOKYO_URL" PUBLIC_BOB_URL="http://localhost:3000" PUBLIC_VENICE_URL="http://localhost:3003" PUBLIC_ROMA_URL="http://localhost:3004" pnpm dev
  PRAGUE_PID="$STARTED_PID"
  echo "[dev-up] Prague PID: $PRAGUE_PID"
  register_pid "prague" "$PRAGUE_PID" "4321" "$LOG_DIR/prague.dev.log"
)
wait_for_url "http://localhost:4321" "Prague" "$LOG_DIR/prague.dev.log"

echo "[dev-up] URLs:"
echo "  Tokyo:     http://localhost:4000/healthz"
echo "  Berlin:    http://localhost:3005/internal/healthz"
echo "  Paris:     http://localhost:3001"
if [ -n "$SF_BASE_URL" ]; then
  echo "  SF:        http://localhost:3002/healthz"
fi
echo "  Bob:       http://localhost:3000"
echo "  DevStudio: http://localhost:5173"
echo "  Pitch:     http://localhost:8790/healthz"
echo "  Roma:      http://localhost:3004/home"
echo "  Prague:    http://localhost:4321/us/en/widgets/faq"
echo "[dev-up] Logs:      $LOG_DIR/*.dev.log"
print_stack_port_status

HEALTH_WITH_SF=0
if [ -n "$SF_BASE_URL" ]; then
  HEALTH_WITH_SF=1
fi

if ! ensure_stack_ports_healthy "$DEV_UP_HEALTH_ATTEMPTS" "$DEV_UP_HEALTH_INTERVAL" "$HEALTH_WITH_SF"; then
  echo "[dev-up] Startup failed health checks. Cleaning listeners."
  stop_repo_wrangler_processes
  for p in "${STACK_PORTS[@]}"; do
    stop_port "$p"
  done
  exit 1
fi
