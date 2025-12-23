#!/usr/bin/env bash
set -euo pipefail

# Simple dev up script: stop stale listeners, then start Denver CDN + DevStudio UI.
# Logs go to CurrentlyExecuting/ and URLs are printed at the end.

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT_DIR"

mkdir -p CurrentlyExecuting

echo "[dev-up] Building Dieter directly into denver/dieter"
(
  cd "$ROOT_DIR"
  pnpm --filter @ck/dieter build
) || {
  echo "[dev-up] Failed to build Dieter; continuing but styles/scripts may be missing"
}

echo "[dev-up] Killing stale listeners on 3000,3001,4000,5173 (if any)"
for p in 3000 3001 4000 5173; do
  PIDS=$(lsof -ti tcp:$p -sTCP:LISTEN 2>/dev/null || true)
  if [ -n "$PIDS" ]; then
    echo "[dev-up] Killing $PIDS on port $p"
    kill -9 $PIDS || true
  fi
done

echo "[dev-up] Cleaning Bob build artifacts (.next) to avoid stale chunk mismatches"
rm -rf "$ROOT_DIR/bob/.next" || true

DENVER_URL=${DENVER_URL:-http://localhost:4000}

echo "[dev-up] Starting Denver CDN stub on 4000"
(
  cd "$ROOT_DIR/denver"
  PORT=4000 nohup node dev-server.mjs > "$ROOT_DIR/CurrentlyExecuting/denver.dev.log" 2>&1 &
  DENVER_PID=$!
  echo "[dev-up] Denver PID: $DENVER_PID"
)
for i in {1..30}; do
  if curl -sI "http://localhost:4000/healthz" >/dev/null 2>&1; then break; fi
  sleep 0.5
done
if ! curl -sI "http://localhost:4000/healthz" >/dev/null 2>&1; then
  echo "[dev-up] Timeout waiting for Denver @ http://localhost:4000/healthz"
  exit 1
fi

echo "[dev-up] Starting DevStudio (5173) with DENVER_URL=$DENVER_URL"
(
  cd "$ROOT_DIR/paris"
  PORT=3001 nohup pnpm dev > "$ROOT_DIR/CurrentlyExecuting/paris.dev.log" 2>&1 &
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

(
  cd "$ROOT_DIR/bob"
  PORT=3000 PARIS_BASE_URL="http://localhost:3001" NEXT_PUBLIC_DENVER_URL="$DENVER_URL" nohup pnpm dev > "$ROOT_DIR/CurrentlyExecuting/bob.dev.log" 2>&1 &
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
  PORT=5173 DENVER_URL="$DENVER_URL" nohup pnpm dev > "$ROOT_DIR/CurrentlyExecuting/devstudio.dev.log" 2>&1 &
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
echo "  Denver:   http://localhost:4000/healthz"
echo "  Paris:     http://localhost:3001"
echo "  Bob:       http://localhost:3000"
echo "  DevStudio: http://localhost:5173"
