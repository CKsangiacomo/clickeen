#!/usr/bin/env bash
set -euo pipefail

# Canonical local startup script.
# Keeps local bring-up boring:
# - load env
# - start the DevStudio operating lane
# - seed required local platform state
# - health checks + verification

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT_DIR"

LOG_DIR="$ROOT_DIR/Logs"
mkdir -p "$LOG_DIR"
WRANGLER_PERSIST_DIR="$ROOT_DIR/.wrangler/state"
mkdir -p "$WRANGLER_PERSIST_DIR"
LOCK_DIR="$ROOT_DIR/.dev-up.lock"

TOKYO_WORKER_INSPECTOR_PORT=9231
BERLIN_INSPECTOR_PORT=9234

DEV_UP_HEALTH_ATTEMPTS="${DEV_UP_HEALTH_ATTEMPTS:-60}"
DEV_UP_HEALTH_INTERVAL="${DEV_UP_HEALTH_INTERVAL:-1}"
DEV_UP_FULL_REBUILD=0
DEV_UP_RESET=0
STARTED_PID=""
STACK_PORTS=(3000 3005 4000 5173 8791)

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
          *'--port 3001'*|*'--port 3005'*|*'--port 8791'*)
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
    echo "[dev-up] Existing local DevStudio lane detected ($listeners listening ports)."
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
  local ports=(3000 3005 4000 5173 8791)

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

  echo "[dev-up] ERROR: local DevStudio lane failed readiness checks."
  for port in "${failed_ports[@]}"; do
    echo "[dev-up]   failed health check on port $port"
  done
  tail_log "$LOG_DIR/tokyo.dev.log"
  tail_log "$LOG_DIR/tokyo-worker.dev.log"
  tail_log "$LOG_DIR/berlin.dev.log"
  tail_log "$LOG_DIR/bob.dev.log"
  tail_log "$LOG_DIR/devstudio.dev.log"
  return 1
}

is_stack_service_healthy() {
  local port="$1"
  local url=""
  case "$port" in
    3000) url="http://localhost:3000" ;;
    3001) url="http://localhost:3001/api/healthz" ;;
    3005) url="http://localhost:3005/internal/healthz" ;;
    4000) url="http://localhost:4000/healthz" ;;
    5173) url="http://localhost:5173" ;;
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
    # Skip non-widget support folders in tokyo/widgets.
    if [[ "$widget" == _* ]] || [ "$widget" = "shared" ]; then
      continue
    fi

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

for arg in "$@"; do
  case "$arg" in
    --full|--rebuild-all)
      DEV_UP_FULL_REBUILD=1
      ;;
    --reset)
      DEV_UP_RESET=1
      ;;
    --help|-h)
      echo "Usage: bash scripts/dev-up.sh [--full] [--reset]"
      echo ""
      echo "Options:"
      echo "  --full        Runs workspace build before starting services."
      echo "  --reset       Force a clean restart of the local DevStudio lane managed by dev-up."
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
preflight_existing_stack

if [ -f "$ROOT_DIR/.env.local" ]; then
  echo "[dev-up] Loading $ROOT_DIR/.env.local"
  set -a
  # shellcheck disable=SC1091
  source "$ROOT_DIR/.env.local"
  set +a
fi

CK_INTERNAL_SERVICE_JWT_FILE="$ROOT_DIR/Execution_Pipeline_Docs/internal.service.jwt"
if [ -z "${CK_INTERNAL_SERVICE_JWT:-}" ] && [ -f "$CK_INTERNAL_SERVICE_JWT_FILE" ]; then
  CK_INTERNAL_SERVICE_JWT="$(cat "$CK_INTERNAL_SERVICE_JWT_FILE")"
fi
if [ -z "${CK_INTERNAL_SERVICE_JWT:-}" ]; then
  echo "[dev-up] Missing CK_INTERNAL_SERVICE_JWT."
  echo "[dev-up] Set CK_INTERNAL_SERVICE_JWT in $ROOT_DIR/.env.local (recommended) or create $CK_INTERNAL_SERVICE_JWT_FILE."
  exit 1
fi

if [ -z "${TOKYO_DEV_JWT:-}" ]; then
  TOKYO_DEV_JWT="$CK_INTERNAL_SERVICE_JWT"
fi

echo "[dev-up] Ensuring Supabase local DB is running"
if ! supabase status >/dev/null 2>&1; then
  supabase start
fi

echo "[dev-up] Applying pending Supabase migrations (non-destructive)"
supabase migration up

echo "[dev-up] Loading local Supabase connection values"
# shellcheck disable=SC2046
eval "$(supabase status --output env | grep -E '^[A-Z_]+=' || true)"
SUPABASE_URL=${API_URL:-${SUPABASE_URL:-}}
SUPABASE_SERVICE_ROLE_KEY=${SECRET_KEY:-${SUPABASE_SERVICE_ROLE_KEY:-}}
SUPABASE_ANON_KEY_VALUE="${ANON_KEY:-${SUPABASE_ANON_KEY:-${NEXT_PUBLIC_SUPABASE_ANON_KEY:-}}}"

# Older/newer Supabase CLI builds may emit an https API_URL for the local stack
# even when Kong is listening in plain http on loopback. Normalize that here so
# local helper scripts do not fail TLS handshakes against the local gateway.
if [ -n "${SUPABASE_URL:-}" ]; then
  case "$SUPABASE_URL" in
    https://127.0.0.1:*|https://localhost:*)
      SUPABASE_URL="http://${SUPABASE_URL#https://}"
      ;;
  esac
fi
echo "[dev-up] Using local Supabase"

if [ -z "${SUPABASE_URL:-}" ] || [ -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]; then
  echo "[dev-up] Failed to resolve SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY from Supabase status"
  exit 1
fi

if [ -z "${SUPABASE_ANON_KEY_VALUE:-}" ]; then
  echo "[dev-up] Failed to resolve SUPABASE_ANON_KEY from Supabase status / env"
  exit 1
fi

echo "[dev-up] Runtime data target: local Supabase"
echo "[dev-up] Skipping local persona seed (local auth bootstrap is deprecated; DevStudio/Bob are tool-trusted)"

TOKYO_URL=${TOKYO_URL:-http://localhost:4000}
BERLIN_URL=${BERLIN_URL:-http://localhost:3005}
BERLIN_ISSUER=${BERLIN_ISSUER:-$BERLIN_URL}
BERLIN_AUDIENCE=${BERLIN_AUDIENCE:-clickeen.product}

if [ "$DEV_UP_FULL_REBUILD" = "1" ]; then
  echo "[dev-up] Full rebuild requested (--full): running workspace build"
  pnpm -w build
else
  echo "[dev-up] Building Dieter assets for local Tokyo"
  pnpm --filter @ck/dieter build

  echo "[dev-up] Building i18n bundles"
  node "$ROOT_DIR/scripts/i18n/build.mjs"
  node "$ROOT_DIR/scripts/i18n/validate.mjs"
fi

echo "[dev-up] Stopping stale listeners"
for p in 3000 3001 3002 3003 3005 4000 4321 5173 8790 8791; do
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
  VARS+=(--var "TOKYO_DEV_JWT:$TOKYO_DEV_JWT")
  VARS+=(--var "CK_INTERNAL_SERVICE_JWT:$CK_INTERNAL_SERVICE_JWT")
  VARS+=(--var "BERLIN_BASE_URL:$BERLIN_URL")
  start_detached "$LOG_DIR/tokyo-worker.dev.log" pnpm exec wrangler dev --local --env local --port 8791 --persist-to "$WRANGLER_PERSIST_DIR" --inspector-port "$TOKYO_WORKER_INSPECTOR_PORT" \
    "${VARS[@]}"
  TOKYO_WORKER_PID="$STARTED_PID"
  echo "[dev-up] Tokyo Worker PID: $TOKYO_WORKER_PID"
  register_pid "tokyo-worker" "$TOKYO_WORKER_PID" "8791" "$LOG_DIR/tokyo-worker.dev.log"
)
wait_for_url "http://localhost:8791/healthz" "Tokyo Worker" "$LOG_DIR/tokyo-worker.dev.log"

if [ ! -f "$ROOT_DIR/berlin/.dev.vars" ]; then
  echo "[dev-up] Generating Berlin signing keys (first run)"
  node "$ROOT_DIR/scripts/dev/generate-berlin-keys.mjs"
fi

echo "[dev-up] Starting Berlin Worker (3005)"
(
  cd "$ROOT_DIR/berlin"
  VARS=(--var "SUPABASE_URL:$SUPABASE_URL" --var "SUPABASE_ANON_KEY:$SUPABASE_ANON_KEY_VALUE")
  VARS+=(--var "BERLIN_ISSUER:$BERLIN_ISSUER")
  VARS+=(--var "BERLIN_AUDIENCE:$BERLIN_AUDIENCE")
  VARS+=(--var "CK_INTERNAL_SERVICE_JWT:$CK_INTERNAL_SERVICE_JWT")
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

echo "[dev-up] Starting Bob (3000)"
(
  cd "$ROOT_DIR/bob"
  start_detached "$LOG_DIR/bob.dev.log" env PORT=3000 ENV_STAGE=local BERLIN_BASE_URL="$BERLIN_URL" SUPABASE_URL="$SUPABASE_URL" SUPABASE_ANON_KEY="$SUPABASE_ANON_KEY_VALUE" CK_SUPABASE_TARGET="local" TOKYO_DEV_JWT="$TOKYO_DEV_JWT" NEXT_PUBLIC_TOKYO_URL="$TOKYO_URL" pnpm dev
  BOB_PID="$STARTED_PID"
  echo "[dev-up] Bob PID: $BOB_PID"
  register_pid "bob" "$BOB_PID" "3000" "$LOG_DIR/bob.dev.log"
)
wait_for_url "http://localhost:3000" "Bob" "$LOG_DIR/bob.dev.log"
prewarm_bob_routes

echo "[dev-up] Starting DevStudio (5173)"
(
  cd "$ROOT_DIR/admin"
  start_detached "$LOG_DIR/devstudio.dev.log" env CI=1 PORT=5173 CK_INTERNAL_SERVICE_JWT="$CK_INTERNAL_SERVICE_JWT" TOKYO_URL="$TOKYO_URL" TOKYO_DEV_JWT="$TOKYO_DEV_JWT" pnpm dev
  DEVSTUDIO_PID="$STARTED_PID"
  echo "[dev-up] DevStudio PID: $DEVSTUDIO_PID"
  register_pid "devstudio" "$DEVSTUDIO_PID" "5173" "$LOG_DIR/devstudio.dev.log"
)
wait_for_url "http://localhost:5173" "DevStudio" "$LOG_DIR/devstudio.dev.log"

echo "[dev-up] URLs:"
echo "  Tokyo URL: $TOKYO_URL"
echo "  Tokyo local stub: http://localhost:4000/healthz"
echo "  Berlin:    http://localhost:3005/internal/healthz"
echo "  Bob:       http://localhost:3000"
echo "  DevStudio: http://localhost:5173"
echo "  DevStudio tools: http://localhost:5173/#/tools/bob-ui-native and http://localhost:5173/#/tools/entitlements"
echo "[dev-up] Local boot will seed local platform state before completion."
echo "[dev-up] Logs:      $LOG_DIR/*.dev.log"
print_stack_port_status

if ! ensure_stack_ports_healthy "$DEV_UP_HEALTH_ATTEMPTS" "$DEV_UP_HEALTH_INTERVAL"; then
  echo "[dev-up] Startup failed health checks. Cleaning listeners."
  stop_repo_wrangler_processes
  for p in "${STACK_PORTS[@]}"; do
    stop_port "$p"
  done
  exit 1
fi

echo "[dev-up] Seeding local platform state"
if ! node "$ROOT_DIR/scripts/dev/seed-local-platform-state.mjs" --persist-to "$WRANGLER_PERSIST_DIR"; then
  echo "[dev-up] Local platform seeding failed. Cleaning listeners."
  stop_repo_wrangler_processes
  for p in "${STACK_PORTS[@]}"; do
    stop_port "$p"
  done
  exit 1
fi
