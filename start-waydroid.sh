#!/usr/bin/env bash
set -euo pipefail

if ! command -v waydroid >/dev/null 2>&1; then
  echo "Missing required command: waydroid" >&2
  exit 1
fi

echo "Starting Waydroid session..."
waydroid session start >/dev/null 2>&1 || true
sleep 2

echo "Opening Waydroid UI..."
waydroid show-full-ui
