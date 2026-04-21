#!/usr/bin/env bash
#
# WellGuard dev bootstrap. Idempotent — safe to re-run anytime.
#
#   Ensures Metro is running, emulator is online, app is installed,
#   Device Owner is set, notifications are granted, app is launched.
#
# Usage:
#   npm run dev
#
set -euo pipefail

# Move to repo root (parent of scripts/)
cd "$(dirname "$0")/.."

# Activate Node 22 via nvm (fresh shells may land on older default)
# shellcheck disable=SC1090
source "$HOME/.nvm/nvm.sh" >/dev/null 2>&1 || true
nvm use 22 >/dev/null 2>&1 || true

ADB="$HOME/Library/Android/sdk/platform-tools/adb"
EMULATOR="$HOME/Library/Android/sdk/emulator/emulator"
AVD="Pixel_9"
PKG="com.wellguard"
ADMIN_COMPONENT="$PKG/.receivers.DeviceAdminReceiver"
APK="android/app/build/outputs/apk/debug/app-debug.apk"

log()  { printf "\033[1;34m→\033[0m %s\n" "$*"; }
ok()   { printf "\033[1;32m✓\033[0m %s\n" "$*"; }
warn() { printf "\033[1;33m!\033[0m %s\n" "$*"; }
fail() { printf "\033[1;31m✗\033[0m %s\n" "$*" >&2; exit 1; }

# --- 1. Metro --------------------------------------------------------------
if lsof -i :8081 -sTCP:LISTEN >/dev/null 2>&1; then
  ok "Metro already running on :8081"
else
  log "Starting Metro in a new Terminal window…"
  osascript <<OSA >/dev/null
tell application "Terminal"
  do script "cd '$(pwd)' && source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && npm start"
  activate
end tell
OSA
  # Wait up to 20s for Metro to bind :8081
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    sleep 2
    if lsof -i :8081 -sTCP:LISTEN >/dev/null 2>&1; then
      ok "Metro is up"
      break
    fi
  done
  lsof -i :8081 -sTCP:LISTEN >/dev/null 2>&1 || warn "Metro didn't bind :8081 in 20s; continuing anyway"
fi

# --- 2. Emulator -----------------------------------------------------------
emulator_online() {
  "$ADB" devices | grep -qE "emulator-5554[[:space:]]+device"
}

if emulator_online; then
  ok "Emulator already online"
else
  if pgrep -f "qemu-system.*${AVD}" >/dev/null; then
    warn "Emulator process running but adb reports offline; will wait"
  else
    log "Booting $AVD…"
    nohup "$EMULATOR" -avd "$AVD" >/tmp/wg-emulator.log 2>&1 &
    disown || true
  fi
fi

# --- 3. Wait for boot ------------------------------------------------------
log "Waiting for emulator to come online…"
"$ADB" wait-for-device

log "Waiting for boot completion…"
for _ in $(seq 1 60); do
  booted="$("$ADB" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r' || true)"
  if [ "$booted" = "1" ]; then
    ok "Emulator booted"
    break
  fi
  sleep 2
done
[ "${booted:-}" = "1" ] || fail "Emulator did not finish booting in 120s"

# --- 4. adb reverse --------------------------------------------------------
"$ADB" reverse tcp:8081 tcp:8081 >/dev/null
ok "adb reverse tcp:8081 → Metro"

# --- 5. Install ------------------------------------------------------------
if "$ADB" shell pm list packages "$PKG" | grep -q "$PKG"; then
  ok "$PKG already installed"
else
  if [ ! -f "$APK" ]; then
    log "Building debug APK (first run — ~2 min)…"
    (cd android && ./gradlew assembleDebug)
  fi
  log "Installing $PKG…"
  "$ADB" install -r "$APK" >/dev/null
  ok "Installed $PKG"
fi

# --- 6. Device Owner -------------------------------------------------------
if "$ADB" shell dpm list-owners 2>/dev/null | grep -q "$PKG/.receivers.DeviceAdminReceiver.*DeviceOwner"; then
  ok "Device Owner already set"
else
  log "Setting Device Owner…"
  set +e
  do_out="$("$ADB" shell dpm set-device-owner "$ADMIN_COMPONENT" 2>&1)"
  do_rc=$?
  set -e
  if [ $do_rc -eq 0 ] || echo "$do_out" | grep -qi "already"; then
    ok "Device Owner set"
  else
    warn "dpm set-device-owner failed: $do_out"
    warn "Check: no Google accounts, no work profile, fresh-booted AVD."
  fi
fi

# --- 7. Runtime permissions (idempotent) -----------------------------------
"$ADB" shell pm grant "$PKG" android.permission.POST_NOTIFICATIONS 2>/dev/null || true
ok "POST_NOTIFICATIONS granted"

# --- 8. Launch -------------------------------------------------------------
"$ADB" shell monkey -p "$PKG" -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1
ok "Launched $PKG"

echo
log "Done. Metro runs in its own Terminal window; edit JS to hot-reload."
