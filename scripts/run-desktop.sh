#!/usr/bin/env bash
set -euo pipefail

# Cursor / some tools set this and break Electron
unset ELECTRON_RUN_AS_NODE
export ELECTRON_RUN_AS_NODE=

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "ShopDesk offline launcher"

find_url() {
  for p in 3005 3010 3000 3001 3456; do
    if curl -sf "http://127.0.0.1:${p}/" 2>/dev/null | grep -q "ShopDesk"; then
      echo "http://127.0.0.1:${p}"
      return 0
    fi
  done
  return 1
}

URL="$(find_url || true)"
NEXT_PID=""

cleanup() {
  # Keep existing servers; only kill one we started
  if [[ -n "${NEXT_PID}" ]] && kill -0 "${NEXT_PID}" 2>/dev/null; then
    kill "${NEXT_PID}" 2>/dev/null || true
  fi
}
trap cleanup EXIT

if [[ -z "${URL}" ]]; then
  # Stop stale next lock for this project if present
  if [[ -f .next/dev/lock ]]; then
    OLD_PID="$(lsof -t -iTCP:3005 -sTCP:LISTEN 2>/dev/null || true)"
    if [[ -n "${OLD_PID}" ]]; then
      echo "Using existing Next.js on port 3005 (pid ${OLD_PID})"
      URL="http://127.0.0.1:3005"
    fi
  fi
fi

if [[ -z "${URL}" ]]; then
  PORT="${SHOPDESK_PORT:-3010}"
  URL="http://127.0.0.1:${PORT}"
  echo "Starting Next.js on port ${PORT}..."
  npx next dev -p "${PORT}" -H 127.0.0.1 >/tmp/shopdesk-next.log 2>&1 &
  NEXT_PID=$!
  for i in $(seq 1 90); do
    if curl -sf "${URL}/" 2>/dev/null | grep -q "ShopDesk"; then
      echo "Next.js ready"
      break
    fi
    if ! kill -0 "${NEXT_PID}" 2>/dev/null; then
      # Maybe another instance took over — try discover again
      URL="$(find_url || true)"
      if [[ -n "${URL}" ]]; then
        NEXT_PID=""
        break
      fi
      echo "Next.js failed to start. See /tmp/shopdesk-next.log"
      cat /tmp/shopdesk-next.log || true
      exit 1
    fi
    sleep 0.4
  done
fi

if [[ -z "${URL}" ]]; then
  # Last resort: any listening next on 3005
  if curl -sf "http://127.0.0.1:3005/" >/dev/null 2>&1; then
    URL="http://127.0.0.1:3005"
  else
    echo "Could not find ShopDesk UI server"
    exit 1
  fi
fi

echo "Opening ShopDesk window → ${URL}"
export SHOPDESK_DEV_URL="${URL}"
# Don't kill Next when Electron exits if we didn't start it
if [[ -z "${NEXT_PID}" ]]; then
  trap - EXIT
fi
exec ./node_modules/.bin/electron .
