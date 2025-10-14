#!/usr/bin/env bash
set -euo pipefail

# Simple dev up script: kill known ports, start Paris -> Venice -> Bob.
# No retries; prints URLs when started.

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT_DIR"

echo "[dev-up] Killing stale listeners on 3000,3001,3002 (if any)"
for p in 3000 3001 3002; do
  PIDS=$(lsof -ti tcp:$p -sTCP:LISTEN 2>/dev/null || true)
  if [ -n "$PIDS" ]; then
    echo "[dev-up] Killing $PIDS on port $p"
    kill -9 $PIDS || true
  fi
done

SUPABASE_URL=${SUPABASE_URL:-http://127.0.0.1:54321}
SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY:-sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz}
NEXT_PUBLIC_PARIS_URL=${NEXT_PUBLIC_PARIS_URL:-http://localhost:3001}
NEXT_PUBLIC_VENICE_URL=${NEXT_PUBLIC_VENICE_URL:-http://localhost:3002}
PUBLISHABLE=${PUBLISHABLE:-sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH}

echo "[dev-up] Starting Paris (3001)"
PORT=3001 nohup pnpm --filter @clickeen/paris dev > CURRENTLY_EXECUTING/paris.dev.log 2>&1 &
PARIS_PID=$!
echo "[dev-up] Paris PID: $PARIS_PID"
# wait for healthz to respond
for i in {1..15}; do
  if curl -sf "http://localhost:3001/api/healthz" >/dev/null; then break; fi
  sleep 0.5
done

echo "[dev-up] Starting Venice (3002)"
PORT=3002 NEXT_PUBLIC_PARIS_URL="$NEXT_PUBLIC_PARIS_URL" nohup pnpm --filter @clickeen/venice dev > CURRENTLY_EXECUTING/venice.dev.log 2>&1 &
VENICE_PID=$!
echo "[dev-up] Venice PID: $VENICE_PID"
# wait for TCP acceptance
for i in {1..15}; do
  if curl -sI "http://localhost:3002" >/dev/null 2>&1; then break; fi
  sleep 0.5
done

echo "[dev-up] Starting Bob (3000)"
DEV_JWT=$(curl -sS -X POST "$SUPABASE_URL/auth/v1/token?grant_type=password" -H "apikey: $PUBLISHABLE" -H 'Content-Type: application/json' --data '{"email":"dev@local","password":"devdevdev"}' | jq -r .access_token || true)
PORT=3000 NEXT_PUBLIC_VENICE_URL="$NEXT_PUBLIC_VENICE_URL" NEXT_PUBLIC_PARIS_URL="$NEXT_PUBLIC_PARIS_URL" PARIS_DEV_JWT="${PARIS_DEV_JWT:-$DEV_JWT}" nohup pnpm --filter @clickeen/bob dev > CURRENTLY_EXECUTING/bob.dev.log 2>&1 &
BOB_PID=$!
echo "[dev-up] Bob PID: $BOB_PID"
# wait for health
for i in {1..15}; do
  if curl -sf "http://localhost:3000/api/healthz" >/dev/null; then break; fi
  sleep 0.5
done

echo "[dev-up] URLs:" 
echo "  Paris:  http://localhost:3001/api/healthz"
echo "  Venice: http://localhost:3002/e/wgt_0uel2n?ts=1"
echo "  Bob:    http://localhost:3000/bob"
