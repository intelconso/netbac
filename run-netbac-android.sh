#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$ROOT_DIR"
DEVICE_ID="${1:-}"
METRO_PORT="${METRO_PORT:-8081}"
EXPO_DEV_PORT="${EXPO_DEV_PORT:-19000}"
EXPO_WS_PORT="${EXPO_WS_PORT:-19001}"
SDK_CANDIDATE_1="$HOME/Android/Sdk"
SDK_CANDIDATE_2="$HOME/Android/sdk"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

adb_state() {
  local device_id="$1"
  adb devices | awk -v device="$device_id" 'NR>1 && $1==device {print $2; exit}'
}

list_ready_devices() {
  adb devices | awk 'NR>1 && $2=="device" {print $1}'
}

ensure_android_sdk() {
  if [[ -n "${ANDROID_HOME:-}" || -n "${ANDROID_SDK_ROOT:-}" ]]; then
    return 0
  fi

  if [[ -d "$SDK_CANDIDATE_1" ]]; then
    export ANDROID_HOME="$SDK_CANDIDATE_1"
    export ANDROID_SDK_ROOT="$SDK_CANDIDATE_1"
    return 0
  fi

  if [[ -d "$SDK_CANDIDATE_2" ]]; then
    export ANDROID_HOME="$SDK_CANDIDATE_2"
    export ANDROID_SDK_ROOT="$SDK_CANDIDATE_2"
    return 0
  fi

  echo "Android SDK not found. Set ANDROID_HOME or ANDROID_SDK_ROOT first." >&2
  exit 1
}

ensure_waydroid_adb() {
  local attempts=20
  local i

  for ((i=1; i<=attempts; i++)); do
    waydroid adb connect >/dev/null 2>&1 || true
    sleep 2

    if [[ -n "$DEVICE_ID" ]]; then
      local state
      state="$(adb_state "$DEVICE_ID")"
      if [[ "$state" == "device" ]]; then
        return 0
      fi
    else
      local auto_device
      auto_device="$(list_ready_devices | head -n 1)"
      if [[ -n "$auto_device" ]]; then
        DEVICE_ID="$auto_device"
        return 0
      fi
    fi
  done

  echo "Waydroid adb connection was not ready." >&2
  echo "Run 'waydroid adb connect' and then 'adb devices' to confirm a device appears." >&2
  exit 1
}

choose_device() {
  mapfile -t devices < <(list_ready_devices)

  if [[ "${#devices[@]}" -eq 0 ]]; then
    echo "No adb devices found. Start Waydroid first, then run 'adb devices'." >&2
    exit 1
  fi

  echo "Available adb devices:"
  local i
  for i in "${!devices[@]}"; do
    printf "  %d. %s\n" "$((i + 1))" "${devices[$i]}"
  done

  printf "Choose device number: "
  read -r choice

  if [[ ! "$choice" =~ ^[0-9]+$ ]] || (( choice < 1 || choice > ${#devices[@]} )); then
    echo "Invalid selection." >&2
    exit 1
  fi

  DEVICE_ID="${devices[$((choice - 1))]}"
}

require_cmd adb
require_cmd npx
require_cmd waydroid

if [[ ! -d "$APP_DIR" ]]; then
  echo "App directory not found: $APP_DIR" >&2
  exit 1
fi

ensure_android_sdk

echo "Connecting adb to Waydroid..."
ensure_waydroid_adb

if [[ -z "$DEVICE_ID" ]]; then
  choose_device
fi

echo "Using adb device: $DEVICE_ID"
echo "Configuring adb reverse for Metro and Expo..."
adb -s "$DEVICE_ID" reverse "tcp:$METRO_PORT" "tcp:$METRO_PORT"
adb -s "$DEVICE_ID" reverse "tcp:$EXPO_DEV_PORT" "tcp:$EXPO_DEV_PORT"
adb -s "$DEVICE_ID" reverse "tcp:$EXPO_WS_PORT" "tcp:$EXPO_WS_PORT"

cd "$APP_DIR"
echo "Building, installing, and opening NETBAC on $DEVICE_ID..."
if [[ "$(list_ready_devices | wc -l)" -eq 1 ]]; then
  exec npx expo run:android --no-bundler
fi

exec npx expo run:android --device --no-bundler
