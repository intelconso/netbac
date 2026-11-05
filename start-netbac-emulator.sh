#!/usr/bin/env bash
# Lance l'émulateur Android (GPU matériel), installe l'APK de dev déjà
# construit s'il est plus récent que celui de l'appareil, et démarre Metro.
#
#   ./start-netbac-emulator.sh              # Pixel5_API35
#   AVD=Tablet10_API35 ./start-netbac-emulator.sh
#   REBUILD=1 ./start-netbac-emulator.sh    # reconstruit l'APK d'abord
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AVD="${AVD:-Pixel5_API35}"
METRO_PORT="${METRO_PORT:-8081}"
APK="$ROOT_DIR/android/app/build/outputs/apk/debug/app-debug.apk"

export ANDROID_HOME="${ANDROID_HOME:-$HOME/Android/Sdk}"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
# Sans cette variable, -gpu host retombe en rendu logiciel (voir ~/.claude/CLAUDE.md).
export ANDROID_EMULATOR_USE_SYSTEM_LIBS=1
ADB="$ANDROID_HOME/platform-tools/adb"
EMULATOR="$ANDROID_HOME/emulator/emulator"

if [[ "${REBUILD:-0}" == "1" || ! -f "$APK" ]]; then
  echo "Construction de l'APK de dev…"
  (cd "$ROOT_DIR/android" && ./gradlew assembleDebug -q)
fi

if ! "$ADB" devices | awk 'NR>1 && $2=="device"' | grep -q emulator; then
  echo "Démarrage de l'émulateur $AVD…"
  nohup "$EMULATOR" -avd "$AVD" -gpu host >/dev/null 2>&1 &
fi

echo "Attente du démarrage complet…"
"$ADB" wait-for-device
until [[ "$("$ADB" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" == "1" ]]; do sleep 2; done

echo "Installation de l'APK…"
"$ADB" install -r "$APK" >/dev/null
"$ADB" reverse "tcp:$METRO_PORT" "tcp:$METRO_PORT"

# Ouvre l'app une fois Metro prêt (le dev client se connecte tout seul via adb reverse).
( sleep 8; "$ADB" shell monkey -p com.halalapps.netbac -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1 ) &

cd "$ROOT_DIR"
exec npx expo start --dev-client --port "$METRO_PORT"
