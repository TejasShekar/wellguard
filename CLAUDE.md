# WellGuard — Claude Code Project Prompt

## Who You Are Working With
You are assisting a **lead frontend engineer** (React, TypeScript, Next.js, Redux/RTK) who is **new to mobile/Android development**. They are comfortable with JS/TS ecosystems but have no prior React Native or Kotlin experience. Adjust explanations accordingly — don't oversimplify JS/TS concepts, but be explicit and educational about anything Android/Kotlin/mobile-specific.

---

## What We Are Building

**WellGuard** is a personal Android app that acts as a friction-based digital wellbeing tool. It extends Android's built-in Digital Wellbeing by enforcing app usage cycles that cannot be bypassed — not even by uninstalling the app.

### The Core Mechanic
- User sets a **use window** (e.g. 10 min) and a **freeze window** (e.g. 60 min) per app
- The cycle runs autonomously: `use → freeze → use → freeze → ...`
- During freeze, the app is blocked at the **Android package level** via `DevicePolicyManager`
- Blocking **survives app uninstall + reinstall** because it is enforced by Android OS, not by WellGuard itself
- Any change to the schedule or emergency unblock requires approval from an **Accountability Partner (AP)**

### The Accountability Partner Model
- User invites an AP via a link (SMS or manual share)
- AP uses a **companion PWA** (React, hosted on Firebase Hosting) to approve/deny requests
- Emergency unblock sends a **15–20 min temporary window** after AP approves
- AP notification chain: FCM push → SMS fallback (device SmsManager, no API) → WhatsApp deep link

---

## Target Platform
- **Android only** (personal use, sideloaded — not Play Store)
- Minimum SDK: Android 10 (API 29)
- Device Owner mode enabled via **one-time ADB setup** during onboarding

---

## Tech Stack

### Android App
| Layer | Choice |
|---|---|
| Framework | React Native 0.85+ (bare workflow, **New Architecture enabled by default**) |
| Language | TypeScript (JS layer) + Kotlin (native modules via TurboModules) |
| State | Zustand 5.x |
| Local DB | react-native-mmkv 4.x (config/state) + WatermelonDB 0.28 (usage history) |
| Charts | Victory Native (Skia backend available for GPU-accelerated rendering) |
| Navigation | React Navigation v7 |
| Backend (RN app) | `@react-native-firebase` v24 (`/app`, `/auth`, `/firestore`, `/messaging`) |
| Notifications | `@notifee/react-native` (local notification display + background handler) |
| MMKV peer dep | `react-native-nitro-modules` 0.35+ (required by react-native-mmkv v4) |

### Native Kotlin Modules (Android-specific)
| Module | API Used | Purpose |
|---|---|---|
| `DevicePolicyModule` | `DevicePolicyManager` | **Primary blocking** — suspend/unsuspend apps via `setPackagesSuspended()` |
| `TimerService` | Android `Service` (Foreground) | Run use/freeze cycle, survive battery optimization |
| `WellGuardAccessibility` | `AccessibilityService` | **Fallback only** — overlay blocking when Device Owner is unavailable |
| `UsageStatsModule` | `UsageStatsManager` | Read per-app usage data (~30 lines Kotlin — simple TurboModule) |
| `SmsModule` | `SmsManager` | Send SMS silently via device SIM (~30 lines Kotlin — simple TurboModule) |

### Backend
| Layer | Choice |
|---|---|
| Database | Firebase Firestore |
| Push notifications | Firebase Cloud Messaging (FCM) |
| Auth | Firebase Auth (email/password) — uid survives reinstall/wipe; AP signs in to PWA with their own email; no Google account required on device (which would break Device Owner) |
| Hosting | Firebase Hosting (for AP companion PWA) |

### AP Companion (PWA)
- React + TypeScript PWA
- Hosted on Firebase Hosting
- Uses **Firebase JS SDK v12** (the web SDK — different from the RN app's `@react-native-firebase`)
- Both the RN app and PWA share the **same Firebase project** and Firestore database
- FCM tokens differ by platform — store with a `platform: 'android' | 'web'` field
- No install required for AP — works as a web link

---

## Project Structure

```
wellguard/
├── android/                        # Android native project
│   └── app/src/main/
│       ├── java/com/wellguard/     # Kotlin files live here (java/ dir is standard even for .kt)
│       │   ├── modules/
│       │   │   ├── DevicePolicyModule.kt
│       │   │   ├── DevicePolicyPackage.kt     # TurboModule registration
│       │   │   ├── TimerServiceModule.kt      # JS bridge to start/stop foreground service
│       │   │   ├── TimerServicePackage.kt
│       │   │   ├── UsageStatsModule.kt
│       │   │   ├── UsageStatsPackage.kt
│       │   │   ├── SmsModule.kt
│       │   │   └── SmsPackage.kt
│       │   ├── receivers/
│       │   │   ├── DeviceAdminReceiver.kt     # Required for Device Owner
│       │   │   └── BootReceiver.kt            # BOOT_COMPLETED handler
│       │   ├── services/
│       │   │   └── TimerForegroundService.kt
│       │   └── accessibility/
│       │       └── WellGuardAccessibilityService.kt  # Fallback only
│       ├── res/xml/
│       │   ├── device_admin.xml               # Device admin policies metadata
│       │   └── accessibility_service_config.xml  # Fallback mode config
│       └── AndroidManifest.xml
├── specs/                          # TurboModule Codegen specs (scanned by codegenConfig)
│   ├── NativeDevicePolicy.ts       # Spec → generates NativeDevicePolicySpec.kt
│   ├── NativeTimerService.ts
│   ├── NativeUsageStats.ts
│   └── NativeSms.ts
├── src/
│   ├── modules/                    # Convenience re-exports of TurboModule specs
│   │   ├── DevicePolicy.ts
│   │   ├── TimerService.ts
│   │   ├── UsageStats.ts
│   │   └── Sms.ts
│   ├── screens/
│   │   ├── Onboarding/             # ADB setup guide, permissions
│   │   ├── Dashboard/              # Usage overview
│   │   ├── AppConfig/              # Set use/freeze windows per app
│   │   ├── Emergency/              # Request unblock
│   │   └── Settings/
│   ├── store/                      # Zustand stores
│   │   ├── appConfigStore.ts       # Per-app cycle configs
│   │   ├── timerStore.ts           # Active timer states
│   │   └── apStore.ts              # AP relationship state
│   ├── services/
│   │   ├── firebase.ts             # @react-native-firebase setup
│   │   ├── cycleEngine.ts          # JS-side cycle orchestration
│   │   └── notifications.ts        # FCM + @notifee local notifications
│   ├── utils/
│   └── App.tsx
├── companion-pwa/                  # AP companion web app (uses Firebase JS SDK v12)
│   ├── src/
│   │   ├── pages/
│   │   │   ├── ApproveRequest.tsx  # Approve/deny unblock
│   │   │   └── History.tsx
│   │   └── App.tsx
│   └── package.json
└── package.json                    # Must include codegenConfig pointing to specs/
```

### package.json codegenConfig
```json
{
  "codegenConfig": {
    "name": "WellGuardSpecs",
    "type": "modules",
    "jsSrcsDir": "specs",
    "android": {
      "javaPackageName": "com.wellguard.modules"
    }
  }
}
```

---

## Data Models

### AppConfig (Firestore + local MMKV)
```typescript
interface AppConfig {
  packageName: string;       // e.g. "com.instagram.android"
  appName: string;           // e.g. "Instagram"
  useWindowMinutes: number;  // e.g. 10
  freezeWindowMinutes: number; // e.g. 60
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
}
```

### CycleState (local MMKV only — must be fast)
```typescript
interface CycleState {
  packageName: string;
  phase: 'use' | 'freeze' | 'idle';
  phaseStartedAt: number;    // unix timestamp ms
  phaseEndsAt: number;       // unix timestamp ms
  lastUpdatedAt: number;     // when this state was last written — detects missed transitions after crash
  configVersion: number;     // incremented when AppConfig changes — detects stale config
}
```

#### MMKV Multi-Process Mode (CRITICAL)
Both JS and Kotlin access the same MMKV instance. **Without multi-process mode, the Kotlin foreground service will read stale data.**

JS side:
```typescript
import { MMKV, MMKVMode } from 'react-native-mmkv';
const storage = new MMKV({ id: 'wellguard', mode: MMKVMode.MULTI_PROCESS });
```

Kotlin side:
```kotlin
val mmkv = MMKV.mmkvWithID("wellguard", MMKV.MULTI_PROCESS_MODE)
```

CycleState is stored as a JSON string under the key `cycle:<packageName>`. JS serializes with `JSON.stringify()`, Kotlin deserializes with `JSONObject` or `kotlinx.serialization`.

### AppConfig Sync Strategy
AppConfig exists in both Firestore and MMKV. The sync is **one-directional**:
1. **Firestore is the source of truth** — AP-approved changes land here
2. **JS layer is the sync bridge** — listens via `onSnapshot`, writes updates to MMKV
3. **Kotlin foreground service reads MMKV only** — it never touches Firestore directly
4. **No conflicts possible** — writes only flow Firestore → JS → MMKV (never the reverse)

### UnblockRequest (Firestore)
```typescript
interface UnblockRequest {
  id: string;
  userId: string;
  apId: string;
  packageName: string;
  appName: string;
  requestedDurationMinutes: number; // 15 or 20
  status: 'pending' | 'approved' | 'denied' | 'expired';
  createdAt: number;
  resolvedAt?: number;
}
```

### User (Firestore)
```typescript
interface User {
  uid: string;
  email?: string;
  apIds: string[];           // linked accountability partners
  fcmToken: string;
  createdAt: number;
}
```

### RemovalRequest (Firestore)
```typescript
interface RemovalRequest {
  id: string;
  userId: string;
  apId: string;
  status: 'pending' | 'approved' | 'denied' | 'expired';
  createdAt: number;
  resolvedAt?: number;
  expiresAt: number;         // createdAt + 30 minutes
}
```

### AccountabilityPartner (Firestore)
```typescript
interface AccountabilityPartner {
  id: string;
  userId: string;            // the user they are guarding
  name: string;
  phone?: string;            // for SMS fallback
  fcmToken?: string;         // if they installed PWA
  inviteToken: string;       // used to generate invite link
  status: 'pending' | 'active';
}
```

---

## Key Behaviors & Rules

### App Blocking Strategy
WellGuard uses a **two-tier blocking approach**:

**Primary (Device Owner mode):** `DevicePolicyManager.setPackagesSuspended()` (API 24+)
- App icon stays visible but greyed out in the launcher
- Tapping a suspended app shows a system "app suspended" dialog — the app cannot launch
- This is OS-level enforcement — the user cannot bypass it without ADB access
- Preferred over `setApplicationHidden()` which completely hides the app (confusing UX)

**Fallback (no Device Owner):** `WellGuardAccessibilityService` overlay
- Only used when Device Owner mode cannot be set (e.g., work profile conflict)
- Intercepts `TYPE_WINDOW_STATE_CHANGED` events and draws a blocking overlay
- Weaker enforcement — user can disable the AccessibilityService in Settings

> **Why not both?** If DPM suspends an app, it literally cannot launch — there is no window state change event for the AccessibilityService to intercept. Running both is redundant. Use DPM as primary; AccessibilityService is fallback only.

### Cycle Engine Rules
1. Cycle state is stored in MMKV (not Firestore) — must survive process death
2. `TimerForegroundService` is the source of truth for current phase
3. On app reboot, service reads MMKV state and resumes from correct point in cycle
4. Phase transitions trigger `DevicePolicyModule.setPackagesSuspended(adminComponent, packageNames, suspended)` — this is the primary blocking mechanism
5. Emergency unblock temporarily suspends the freeze phase — cycle resumes normally after the unblock window expires

#### Timer Dual-Pattern (Required for Reliability)
The foreground service uses **two timer mechanisms** working together:
- **Primary: `Handler.postDelayed()`** — accurate in-process timer while the service is alive. Handles all phase transitions during normal operation.
- **Fallback: `AlarmManager.setExactAndAllowWhileIdle()`** — scheduled as a safety net for each phase transition. If the service is killed by OEM battery optimization, this alarm fires and restarts it. The alarm is rate-limited (~1 per 9 min in Doze), but this is acceptable because it only fires if the primary Handler missed the transition.

When the service is alive, the Handler fires the transition. When the alarm fires and the service is already running, it's a no-op (check MMKV state, see transition already happened). This avoids the rate-limit issue entirely for normal operation.

#### TimerServiceModule (JS Bridge)
The foreground service is a separate Android component from the TurboModules. A `TimerServiceModule` TurboModule acts as a controller:
```kotlin
// Starts the foreground service from JS
fun startCycle(packageName: String) {
    val intent = Intent(reactApplicationContext, TimerForegroundService::class.java)
    intent.putExtra("packageName", packageName)
    reactApplicationContext.startForegroundService(intent)
}
```

### AP Approval Rules
1. User **cannot change** any AppConfig without AP approval
2. AP approval requests expire after **10 minutes** if not acted on
3. An emergency unblock grants exactly the requested duration (15 or 20 min) — no extensions
4. AP receives notification via: FCM first → if undelivered after 120s → SMS via SmsModule
5. WellGuard **removal requires AP approval** — 30 min expiry window
6. If Device Owner is lost without an approved RemovalRequest, AP is notified immediately as a breach alert

### Onboarding (Critical Path)
The app **will not function** without Device Owner mode. Onboarding must:
1. Check if Device Owner is already set → if yes, skip
2. Show step-by-step ADB instructions with the exact command:
   ```
   adb shell dpm set-device-owner com.wellguard/.receivers.DeviceAdminReceiver
   ```
3. Verify success by calling `DevicePolicyModule.isDeviceOwner()` → navigate only if true
4. Then request: `PACKAGE_USAGE_STATS` (Settings redirect) + Accessibility Service enable (fallback mode only)
5. Prompt user to **disable battery optimization** for WellGuard — link to per-OEM instructions (reference: https://dontkillmyapp.com)

#### Prerequisites for `dpm set-device-owner`
The ADB command will **fail** if any of these exist on the device:
- Any Google accounts (must be removed from Settings → Accounts first, can re-add after)
- A work profile (employer MDM) — must be removed first
- Guest user, private space (Android 15+), or cloned app profiles

The onboarding screen should warn the user about these prerequisites before showing the ADB command.

#### DeviceAdminReceiver Manifest Declaration
A `DeviceAdminReceiver` must be declared in `AndroidManifest.xml` with the correct intent filters and a `device_admin.xml` metadata file. The component name in the ADB command (`com.wellguard/.receivers.DeviceAdminReceiver`) must **exactly match** the manifest declaration — a mismatch means Device Owner setup silently fails.

### Uninstall Protection (AP-Locked)

**Android prevents uninstallation of the Device Owner app by default.** The OS greys out the uninstall button in Settings and the Play Store as long as Device Owner status is active. The user cannot uninstall WellGuard impulsively — this is intentional and is a core feature.

To fully remove WellGuard, the user must go through an **AP-approved removal flow**:

#### Removal Flow
1. User taps "Remove WellGuard" in Settings screen
2. App shows a warning: _"This will disable all cycle enforcement. Your AP will be notified."_
3. A `RemovalRequest` is created in Firestore and AP is notified via FCM + SMS fallback
4. AP must approve within **30 minutes** (longer window than unblock requests — this is serious)
5. Only after AP approval does the app call `DevicePolicyModule.clearDeviceOwner()` and then self-uninstall via `Intent(Intent.ACTION_DELETE)`

#### If the User Tries to Bypass via ADB
The user technically can run:
```
adb shell dpm remove-active-admin com.wellguard/.receivers.DeviceAdminReceiver
```
This cannot be prevented — ADB is always an escape hatch on a non-rooted device. However:
- This requires a computer + USB cable — it's a deliberate, effortful action
- The app should detect Device Owner loss on next resume and notify the AP automatically:
  ```
  "WellGuard Device Owner status was removed on [device] at [time]. 
   App enforcement is no longer active."
  ```
- AP gets this notification via FCM + SMS so they are always aware

#### Factory Reset
A factory reset will also remove Device Owner status. This is unavoidable and acceptable — a factory reset is an extreme action the user consciously chooses.

#### TurboModule Architecture (How Native Modules Work in RN 0.85+)

Every native module requires **4 files** working together:

1. **TypeScript Spec** (`specs/NativeXxx.ts`) — defines the API. Codegen reads this to generate a Kotlin abstract class.
2. **Kotlin Implementation** — extends the generated abstract class, implements the methods.
3. **Kotlin Package** — registers the module so RN can find it.
4. **MainApplication.kt** — adds the Package to the app's package list.

The spec file naming convention is strict: must start with `Native`, interface must be named `Spec`.

#### DevicePolicyModule — TurboModule Spec
```typescript
// specs/NativeDevicePolicy.ts
import { TurboModule, TurboModuleRegistry } from 'react-native';

export interface Spec extends TurboModule {
  isDeviceOwner(): Promise<boolean>;
  clearDeviceOwner(): Promise<void>;
  setPackagesSuspended(packageNames: string[], suspended: boolean): Promise<string[]>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('DevicePolicy');
```

#### DevicePolicyModule — Kotlin Implementation
```kotlin
// android/app/src/main/java/com/wellguard/modules/DevicePolicyModule.kt
package com.wellguard.modules

import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.Arguments
import com.wellguard.receivers.DeviceAdminReceiver

class DevicePolicyModule(reactContext: ReactApplicationContext)
    : NativeDevicePolicySpec(reactContext) {

    override fun getName(): String = "DevicePolicy"

    // ComponentName is REQUIRED by setPackagesSuspended() as the first parameter
    private val adminComponent: ComponentName
        get() = ComponentName(reactApplicationContext, DeviceAdminReceiver::class.java)

    private val dpm: DevicePolicyManager
        get() = reactApplicationContext.getSystemService(Context.DEVICE_POLICY_SERVICE)
                as DevicePolicyManager

    override fun isDeviceOwner(promise: Promise) {
        promise.resolve(dpm.isDeviceOwnerApp(reactApplicationContext.packageName))
    }

    override fun clearDeviceOwner(promise: Promise) {
        try {
            dpm.clearDeviceOwnerApp(reactApplicationContext.packageName)
            promise.resolve(null)
        } catch (e: Exception) {
            promise.reject("CLEAR_DO_FAILED", e.message)
        }
    }

    override fun setPackagesSuspended(packageNames: ReadableArray, suspended: Boolean, promise: Promise) {
        try {
            val pkgs = Array(packageNames.size()) { packageNames.getString(it) }
            // Returns String[] of packages that FAILED to suspend (system-critical apps are immune)
            val failed = dpm.setPackagesSuspended(adminComponent, pkgs, suspended)
            val result = Arguments.createArray()
            failed?.forEach { result.pushString(it) }
            promise.resolve(result)
        } catch (e: SecurityException) {
            promise.reject("NOT_DEVICE_OWNER", e.message)
        }
    }
}
```

#### DeviceAdminReceiver + Manifest Declaration
```kotlin
// android/app/src/main/java/com/wellguard/receivers/DeviceAdminReceiver.kt
package com.wellguard.receivers
import android.app.admin.DeviceAdminReceiver

class DeviceAdminReceiver : DeviceAdminReceiver()
// Empty class — required for Device Owner registration
```

```xml
<!-- In AndroidManifest.xml -->
<receiver
    android:name=".receivers.DeviceAdminReceiver"
    android:permission="android.permission.BIND_DEVICE_ADMIN"
    android:exported="true">
    <meta-data
        android:name="android.app.device_admin"
        android:resource="@xml/device_admin" />
    <intent-filter>
        <action android:name="android.app.action.DEVICE_ADMIN_ENABLED" />
    </intent-filter>
</receiver>
```

```xml
<!-- android/app/src/main/res/xml/device_admin.xml -->
<device-admin xmlns:android="http://schemas.android.com/apk/res/android">
    <uses-policies>
        <!-- Device Owner grants all policies via dpm command — this can be empty -->
    </uses-policies>
</device-admin>
```

#### Foreground Service Manifest Declaration
```xml
<!-- In AndroidManifest.xml -->
<service
    android:name=".services.TimerForegroundService"
    android:foregroundServiceType="specialUse"
    android:exported="false">
    <property
        android:name="android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE"
        android:value="App usage cycle enforcement timer for digital wellbeing" />
</service>
```

The app must check `isDeviceOwner()` on every resume. If it returns false unexpectedly (i.e. no removal flow was initiated), treat it as a breach and immediately notify AP.

### Work Profile Compatibility — IMPORTANT LIMITATION
The user has an Android work profile managed by their employer. **This conflicts with Device Owner setup:**

- `dpm set-device-owner` **will fail** if a work profile (secondary user) exists on the device
- Device Owner is a **device-wide** privilege, not profile-scoped — Android does not allow it to coexist with an independently-managed work profile
- `UsageStatsManager` returns personal profile app usage only — work apps are excluded (this part is correct)

**Development strategy:** Use an Android emulator (no work profile) for development. For final real-device testing, the work profile must be removed first, then `dpm set-device-owner` can be set.

**For daily use of WellGuard:** The app must run on a device without an active work profile, OR the user must accept the weaker AccessibilityService-only fallback mode (no uninstall protection).

### Permissions Required
| Permission | How to Grant | Used For |
|---|---|---|
| `PACKAGE_USAGE_STATS` | Settings → Digital Wellbeing → Usage access | UsageStatsManager |
| Device Owner | ADB command (one-time) | DevicePolicyManager |
| Accessibility Service | Settings → Accessibility | Freeze overlay (fallback mode only) |
| `RECEIVE_BOOT_COMPLETED` | Auto-granted | Restart foreground service on reboot |
| `FOREGROUND_SERVICE` | Auto-granted | Timer service |
| `FOREGROUND_SERVICE_SPECIAL_USE` | Auto-granted (declare in manifest) | Required for `specialUse` foreground service type (Android 14+) |
| `SCHEDULE_EXACT_ALARM` | Settings redirect (Android 13+) | `AlarmManager.setExactAndAllowWhileIdle()` for Doze-safe timers |
| `SEND_SMS` | Runtime prompt | SmsManager fallback |
| `POST_NOTIFICATIONS` | Runtime prompt (Android 13+) | Foreground service notification display |

---

## Build Order (Follow This Strictly)

### Phase 1 — Core Enforcement (Build First, Validate Early)
**Milestone 1A: Native Foundation**
- [ ] Scaffold React Native bare workflow project: `npx @react-native-community/cli@latest init WellGuard`
- [ ] Install core deps: `react-native-mmkv`, `react-native-nitro-modules`, `@react-native-firebase/app`, `@react-native-firebase/auth`, `@react-native-firebase/firestore`, `@react-native-firebase/messaging`, `@notifee/react-native`
- [ ] Configure `codegenConfig` in `package.json` pointing to `specs/` directory
- [ ] Write TurboModule spec: `specs/NativeDevicePolicy.ts`
- [ ] Write `DevicePolicyModule.kt` + `DevicePolicyPackage.kt` — expose `setPackagesSuspended()`, `isDeviceOwner()`, `clearDeviceOwner()` to JS
- [ ] Write `DeviceAdminReceiver.kt` + `device_admin.xml` + manifest declarations
- [ ] Write TurboModule spec + implementation for `UsageStatsModule` (~30 lines Kotlin wrapping `UsageStatsManager`)
- [ ] Write TurboModule spec + implementation for `SmsModule` (~30 lines Kotlin wrapping `SmsManager`)
- [ ] Register all Packages in `MainApplication.kt`
- [ ] **VALIDATE: Can you block/unblock Instagram from JS using `setPackagesSuspended()`?** ← Do not proceed until this works

**Milestone 1B: Timer Engine**
- [ ] Write `TimerForegroundService.kt` — reads MMKV config, manages use/freeze cycle, calls DevicePolicy
- [ ] Declare `foregroundServiceType="specialUse"` in `AndroidManifest.xml` with required `<property>` metadata
- [ ] Create notification channel (required Android 8+) for the foreground service persistent notification
- [ ] Use `AlarmManager.setExactAndAllowWhileIdle()` for phase transitions (survives Doze mode)
- [ ] Set up MMKV access from Kotlin side (`com.tencent.mmkv` dependency) with **MULTI_PROCESS_MODE** — ensure key/serialization format matches JS side
- [ ] Implement `START_STICKY` return from `onStartCommand()` + `AlarmManager` watchdog to restart if OEM battery optimization kills the service
- [ ] Expose `startCycle(packageName)` and `stopCycle(packageName)` to JS
- [ ] Handle `BOOT_COMPLETED` broadcast to restart service
- [ ] **VALIDATE: Does the cycle survive phone reboot?**
- [ ] **VALIDATE: Does the cycle survive 30+ minutes of screen-off Doze mode?**

**Milestone 1C: Accessibility Overlay (FALLBACK MODE ONLY)**
> This milestone is **optional** for the primary flow. Only needed as a fallback when Device Owner mode cannot be set (e.g., work profile conflict). Skip during initial development if Device Owner mode works on the emulator.
- [ ] Write `WellGuardAccessibilityService.kt` — detect app launch via `TYPE_WINDOW_STATE_CHANGED`, show blocking screen if in freeze phase
- [ ] Blocking screen shows app name, time remaining in freeze, and "Request Unblock" button
- [ ] **VALIDATE: Does blocking overlay appear when Instagram is opened during freeze (with DPM blocking DISABLED)?**

**Milestone 1D: Onboarding Flow**
- [ ] Build onboarding screens with ADB instructions + prerequisites checklist (remove accounts, no work profile, etc.)
- [ ] Permission check gates — app won't proceed without Device Owner + UsageStats
- [ ] Battery optimization whitelist prompt with per-OEM instructions (reference: dontkillmyapp.com)

**Milestone 1E: Core UI**
- [ ] App list screen — pick installed apps to configure
- [ ] AppConfig screen — set use/freeze windows, activate cycle
- [ ] Firebase setup — `@react-native-firebase` Auth, Firestore, FCM + `@notifee` for notification display
- [ ] AP invite flow — generate invite link, AP accepts via web
- [ ] Emergency unblock request flow — sends FCM to AP, SMS fallback

### Phase 2 — Insights + AP Companion
- [ ] Usage dashboard with Victory Native charts
- [ ] Habit streaks per app
- [ ] Scheduled daily digest notification
- [ ] AP companion PWA (React, Firebase Hosting)

### Phase 3 — Polish
- [ ] Focus profiles
- [ ] Multi-AP support
- [ ] WhatsApp deep link fallback

---

## Development Conventions

### TypeScript
- Strict mode enabled
- No `any` — use `unknown` and narrow properly
- Async operations always wrapped in try/catch with typed errors
- Zustand stores use the `immer` middleware for state mutations

### Kotlin / Native Modules
- Follow Android naming conventions
- React Native 0.85+ uses the **New Architecture** by default — native modules are written as **TurboModules**:
  1. Define a TypeScript spec in `specs/NativeXxx.ts` (interface must be named `Spec`)
  2. Run Codegen (happens automatically on build) → generates `NativeXxxSpec.kt` abstract class
  3. Kotlin implementation extends the generated abstract class
  4. Register via a Package class added to `MainApplication.kt`
- Every TurboModule needs 4 files: spec (TS), implementation (KT), package (KT), registration (MainApplication.kt)
- Foreground service must show a persistent notification (Android 8+ requirement) via a declared notification channel
- Foreground service must declare `foregroundServiceType="specialUse"` + `FOREGROUND_SERVICE_SPECIAL_USE` permission (Android 14+)
- Always check `Build.VERSION.SDK_INT` before using APIs introduced after minSdk
- MMKV access from Kotlin requires `com.tencent.mmkv` dependency + **`MULTI_PROCESS_MODE`** — keys and serialization must match the JS side exactly
- Use `kotlinx.serialization` for type-safe JSON deserialization of MMKV data in Kotlin

### Firebase
- **RN app uses `@react-native-firebase` v24** (native SDK wrappers) — NOT Firebase JS SDK
- **Companion PWA uses Firebase JS SDK v12** (web SDK) — same Firebase project, same Firestore
- All Firestore reads use `onSnapshot` for real-time — no polling
- Firestore offline persistence is enabled by default with `@react-native-firebase/firestore`
- Security rules: users can only read/write their own documents
- AP can only read `UnblockRequest` documents where `apId == their uid`
- FCM tokens differ by platform — store with `platform: 'android' | 'web'` field in Firestore
- Use `@react-native-firebase/messaging` for FCM + `@notifee/react-native` for notification display control

### Error Handling
- Native module failures must propagate to JS as typed errors — never silently fail
- If FCM delivery is unconfirmed after 120s, trigger SMS fallback automatically
- If Device Owner is lost (rare but possible), show a prominent re-setup banner

---

## What to Ask Claude Code

When working on this project with Claude Code, frame requests like:

- **"Implement Milestone 1A"** — it knows the exact scope
- **"Write DevicePolicyModule.kt and its TypeScript bridge"** — specific file task
- **"The foreground service is being killed by battery optimization on my OnePlus device — how do I fix it?"** — device-specific issue
- **"Set up Firebase Firestore with the data models defined in the project prompt"** — schema work
- **"Build the onboarding screen that guides the user through ADB setup"** — UI task with context

Always validate each milestone before moving to the next. The Kotlin modules are the riskiest — front-load them.

---

## Known Risks & Mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| Device Owner ADB setup fails on custom ROM | Medium | Test early; document fallback (Accessibility-only mode with weaker blocking) |
| Foreground service killed by aggressive battery optimization (OnePlus, Xiaomi, Samsung) | **High** | Battery optimization whitelist in onboarding + per-OEM steps (dontkillmyapp.com); `START_STICKY` + `AlarmManager` watchdog to auto-restart |
| Doze mode delays phase transitions | **High** | Use `AlarmManager.setExactAndAllowWhileIdle()` — note: rate-limited to ~1 per 9 min on Android 12+ |
| AccessibilityService disabled by system | Medium | Detect on app resume, show re-enable prompt. Only relevant in fallback mode (no Device Owner) |
| Firebase free tier limits hit | Low (personal use) | Firestore: 50k reads/day free — more than enough |
| Device Owner accidentally revoked | Low | Detect on startup, notify AP as breach, show re-setup flow |
| User bypasses via ADB removal | Low | Cannot be prevented; app detects loss on resume and fires AP breach notification via SMS (no internet needed) |
| **Work profile blocks Device Owner setup** | **Medium** | `dpm set-device-owner` fails when a work profile exists. Dev uses emulator; real-device testing requires removing work profile first |
| MMKV cross-language serialization mismatch | Medium | Both sides must use `MULTI_PROCESS_MODE` + identical keys and JSON format. Without multi-process mode, Kotlin reads stale data |
| **Kotlin complexity for JS/TS developer** | **High** | `TimerForegroundService.kt` is the highest-risk module (~3-5 weeks for a Kotlin beginner). UsageStats and SMS modules are simple (~30 lines each) |
| WatermelonDB New Architecture uncertainty | Medium | Last updated ~1 year ago. JSI-based so likely compatible, but not explicitly certified for RN 0.85. Alternatives if needed: RxDB, TinyBase, Realm |
| react-native-mmkv v4 Nitro Module issues | Low-Medium | v4 switched to Nitro Modules. Some initialization issues reported (#931, #985). Actively maintained — patches expected |

---

*WellGuard · Personal Android App · Build Plan v2.0 (reviewed & corrected)*
