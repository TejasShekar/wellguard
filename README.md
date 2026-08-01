# WellGuard

**A friction-based digital wellbeing tool for Android that you can't wriggle out of.**

Most screen-time apps are a suggestion — you disable them the moment willpower dips. WellGuard blocks apps at the **operating-system level** using Android's `DevicePolicyManager`, so the wall holds even if you try to force-stop or uninstall it. It's a commitment device: you set the rules while you're clear-headed, and your future self can't quietly undo them.

> ⚠️ **Alpha.** Android-only, sideloaded (not on the Play Store), and requires a one-time ADB setup. Built for people who want *real* enforcement and don't mind a terminal. `WellGuard` is a working title.

**License:** [GPL-3.0](./LICENSE) · **Platform:** Android 10+ (API 29) · **Stack:** React Native 0.85 (New Architecture) + Kotlin TurboModules

---

## What it does

- **Guards** — per-app **use → freeze** cycles. Give Instagram 10 minutes of use, then 60 minutes frozen, on repeat. During freeze the app is suspended at the OS level and simply won't open. Cycles survive reboots and Doze.
- **Zen mode** — a scheduled **allowlist window**. Between (say) 23:00 and 09:00, *everything* except a handful of apps you choose — calls, messages, camera — is suspended. The phone drops to "basic mode" so your morning doesn't start on a doomscroll.
- **Unbypassable by design** — because enforcement is OS-level via Device Owner, Android greys out the uninstall button and force-stop doesn't stop the blocking. Removing it is deliberately effortful (ADB or factory reset), not a moment-of-weakness tap.

Enforcement runs entirely in a native foreground service — it keeps working even if the JavaScript layer is dead.

## How the blocking works

WellGuard runs as an Android **Device Owner** (set once over ADB). That privilege lets it call `DevicePolicyManager.setPackagesSuspended()` to suspend/unsuspend apps at the package level. Android refuses to suspend system-critical packages (the emergency dialer, System UI, Settings), so no configuration can brick the phone — emergency calling always survives.

## Status & roadmap

**In this alpha:** the cycle engine, Zen mode, the permission/onboarding flow, and a minimal light/dark UI.

**Planned (v2):**
- **Accountability partner** — schedule changes and emergency unblocks gated behind approval from a trusted person, fully offline via TOTP (no backend required).
- Usage insights, an AccessibilityService fallback for devices where Device Owner can't be set, and multi-schedule "focus profiles".

---

## Development

### Prerequisites

- **Node 22.x** (`nvm use 22`)
- **Android Studio** with the Android SDK (Platform 36, Build-Tools 36.x)
- **Java 17** (bundled with Android Studio — `JAVA_HOME` should point at it)
- An **Android emulator** (Pixel 9 API 36 recommended) or a real device

### Emulator / device requirements (important)

Device Owner **cannot be set** if any of these exist on the device:

- Google accounts signed in (Settings → Passwords & accounts)
- A work profile (employer MDM)
- Guest user, private space, or cloned app profiles

Use a fresh device/AVD with none of the above. Skip signing into Google when the setup wizard prompts.

### First-time setup

```sh
nvm use 22
npm install
```

### Running (three terminals)

**1 — Emulator** (or plug in a device): from Android Studio's Device Manager, or:
```sh
~/Library/Android/sdk/emulator/emulator -avd Pixel_9
```

**2 — Metro:**
```sh
npm start
```

**3 — Build + install:**
```sh
npm run android
```

Re-run terminal 3 only when native code changes (Kotlin / `AndroidManifest.xml` / new TurboModule specs). Pure JS/TS changes hot-reload via Metro.

### One-time Device Owner setup

After the first install:

```sh
adb shell dpm set-device-owner com.wellguard/.receivers.DeviceAdminReceiver
```

This must succeed for the app to function. If it fails, re-check the requirements above.

### Permissions

The in-app setup gate surfaces each one with a button:

- **Device Owner** — the ADB command above
- **Notifications** — runtime prompt (foreground-service + pre-freeze warnings)
- **Usage Access** — deep-links to Settings
- **Battery Optimization** — one-tap whitelist; aggressive OEMs (OnePlus, Xiaomi, Samsung) may need extra steps ([dontkillmyapp.com](https://dontkillmyapp.com))

### Troubleshooting

| Symptom | Fix |
|---|---|
| `EADDRINUSE: address already in use :::8081` | Kill stale Metro: `kill $(lsof -i :8081 -t)` |
| Emulator stuck at `adb: device offline` | `pkill -f "qemu-system.*Pixel_9"` then cold-boot: `emulator -avd Pixel_9 -no-snapshot-load` |
| Red-box "Unable to load script" | `adb reverse tcp:8081 tcp:8081`, then reload |
| `dpm set-device-owner` fails | Remove Google accounts / work profile / guest user, retry |
| Device Owner app won't force-stop | Expected — reinstall via `npm run android` to restart the process |

### Testing the native engine directly (dev-only)

`android/app/src/debug/AndroidManifest.xml` exports `TimerForegroundService` in **debug builds only** (guarded by `android.permission.DUMP`) so you can drive cycles from `adb` without the UI:

```sh
# start a 1-min use / 1-min freeze cycle for Chrome
adb shell am start-foreground-service \
  -n com.wellguard/.services.TimerForegroundService \
  --es action start --es packageName com.android.chrome \
  --ed useMinutes 1.0 --ed freezeMinutes 1.0

# inspect persisted cycle state
adb shell run-as com.wellguard cat /data/data/com.wellguard/shared_prefs/wellguard.cycle.xml
```

Release builds do not export this service.

## Contributing

Issues and PRs welcome. This is early alpha — expect rough edges and moving APIs. Architecture, data models, and build order live in [`CLAUDE.md`](./CLAUDE.md). Maintainer release steps (signing, building the APK, cutting a GitHub Release) are in [`RELEASING.md`](./RELEASING.md).

## License

[GPL-3.0](./LICENSE) — a freedom tool that stays free. If you distribute a modified version, it must stay open too.

## Disclaimer

WellGuard changes device-administration settings and suspends apps. It's provided as-is, with no warranty. A factory reset always removes it. Use at your own risk.
