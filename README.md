# WellGuard

Personal Android app that enforces use/freeze cycles on distracting apps at the OS level via `DevicePolicyManager`. Android-only, sideloaded (not Play Store), React Native 0.85 (New Architecture) + Kotlin TurboModules.

For product scope, architecture, and data models see [`CLAUDE.md`](./CLAUDE.md).

## Prerequisites

- **Node 22.x** (via `nvm use 22`)
- **Android Studio** with the Android SDK (Platform 36, Build-Tools 36.x)
- **Java 17** (bundled with Android Studio — `JAVA_HOME` should point at it)
- An **Android emulator** (Pixel 9 API 36 recommended) created via Android Studio's Device Manager

### Emulator requirements (important)

Device Owner mode — which WellGuard relies on for OS-level app blocking — **cannot be set** if any of these exist on the device:

- Google accounts signed in (Settings → Passwords & accounts)
- A work profile (employer MDM)
- Guest user, private space, or cloned app profiles

Use a fresh AVD with none of the above. Skip signing into Google when the setup wizard prompts.

## First-time setup

```sh
nvm use 22
npm install
```

## Running the app

Dev uses three terminals. Start once; keep them running through the session.

**Terminal 1 — Android Emulator**

Either start from Android Studio's Device Manager (easiest) or from the CLI:

```sh
~/Library/Android/sdk/emulator/emulator -avd Pixel_9
```

Wait for the home screen.

**Terminal 2 — Metro**

```sh
npm start
```

Metro's logs stay visible here. Press `r` to reload JS, `d` to open the dev menu.

**Terminal 3 — Build + install**

```sh
npm run android
```

This runs `./gradlew :app:installDebug` and launches `MainActivity`. Re-run only when native code (Kotlin / `AndroidManifest.xml` / new TurboModule specs) changes. For pure JS/TS changes, Metro's Fast Refresh handles it.

### One-time Device Owner setup

After the first install, set WellGuard as Device Owner so it can suspend other apps:

```sh
adb shell dpm set-device-owner com.wellguard/.receivers.DeviceAdminReceiver
```

This must succeed for the app to function. If it fails, re-check the emulator requirements above.

## Permissions

The in-app onboarding gate surfaces each required permission with a button to grant it:

- **Device Owner** — via the ADB command above
- **Notifications** — runtime prompt
- **Usage Access** — deep-links to Settings → Digital Wellbeing → Usage access
- **Battery Optimization** — one-tap system dialog to whitelist WellGuard; on aggressive OEMs (OnePlus, Xiaomi, Samsung) the in-app OEM steps link points to [dontkillmyapp.com](https://dontkillmyapp.com) for per-device instructions

## Troubleshooting

| Symptom | Fix |
|---|---|
| `EADDRINUSE: address already in use :::8081` | Kill stale Metro: `kill $(lsof -i :8081 -t)` |
| Emulator stuck at `adb: device offline` | Kill stale qemu (`pkill -f "qemu-system.*Pixel_9"`) and cold-boot (`emulator -avd Pixel_9 -no-snapshot-load`) |
| App shows red-box "Unable to load script" | Run `adb reverse tcp:8081 tcp:8081`, then reload in app |
| `dpm set-device-owner` fails | Remove Google accounts / work profile / guest user from the emulator, then retry |
| Device Owner apps can't be force-stopped | Reinstall via `npm run android` to restart the process |

## Testing the native cycle engine directly (dev-only)

`android/app/src/debug/AndroidManifest.xml` exports `TimerForegroundService` (debug builds only, protected by `android.permission.DUMP`) so you can drive cycles from `adb` without touching the UI:

```sh
# start a 1-min use / 1-min freeze cycle for Chrome
adb shell am start-foreground-service \
  -n com.wellguard/.services.TimerForegroundService \
  --es action start \
  --es packageName com.android.chrome \
  --ed useMinutes 1.0 \
  --ed freezeMinutes 1.0

# inspect persisted cycle state
adb shell run-as com.wellguard cat /data/data/com.wellguard/shared_prefs/wellguard.cycle.xml

# stop
adb shell am start-foreground-service \
  -n com.wellguard/.services.TimerForegroundService \
  --es action stop \
  --es packageName com.android.chrome
```

Release builds do not export this service.
