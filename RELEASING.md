# Releasing WellGuard

How to cut a signed, installable release. WellGuard is sideloaded (not on the Play
Store), so a "release" = a **signed release APK** attached to a **GitHub Release**.
This works from any machine — macOS or Windows.

> The repo is set up so signing secrets never touch git: `keystore.properties` and
> `*.jks` are git-ignored, and `keystore.properties.template` is committed. Release
> builds fall back to debug signing when no key is present, so a fresh clone still
> builds — only the maintainer's published APK needs the real key.

---

## Prerequisites (to build a release APK)

- **Node 22.x**
- **JDK 17** (ships `keytool`; also required by Gradle)
- **Android Studio** with the Android SDK (Platform 36, Build-Tools 36.x) + NDK
- `ANDROID_HOME` (Windows) / `ANDROID_SDK_ROOT` env var pointing at the SDK
- `npm install` run once in the repo

The release build **bundles the JS itself** — Metro does **not** need to be running.

---

## 1. Generate the release keystore — do this ONCE, ever

Android requires the **same** signing key for every future update of the app. Generate
it once and keep it forever.

Pick a home for it **outside the repo** so it can never be committed.

**macOS / Linux:**
```sh
mkdir -p ~/keys && cd ~/keys
keytool -genkeypair -v \
  -keystore wellguard-release.jks \
  -alias wellguard \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -storetype PKCS12
```

**Windows (PowerShell):**
```powershell
mkdir "$env:USERPROFILE\keys" -Force; cd "$env:USERPROFILE\keys"
keytool -genkeypair -v `
  -keystore wellguard-release.jks `
  -alias wellguard `
  -keyalg RSA -keysize 2048 -validity 10000 `
  -storetype PKCS12
```

Prompts:
1. **Keystore password** (twice) — choose a strong one.
2. Name / org / city / state / **2-letter country code** — cosmetic for signing; put your
   name and country, Enter to skip the rest, confirm `yes`.
3. With PKCS12 the key password equals the store password (no separate prompt).

Result: `wellguard-release.jks` with alias `wellguard`.

---

## 2. Configure `keystore.properties`

In the repo's `android/` folder, copy the template and fill in real values:

```sh
cd android
cp keystore.properties.template keystore.properties   # Windows: copy
```

Edit `android/keystore.properties` — **use forward slashes in the path on every OS**
(Gradle handles them cross-platform; backslashes need escaping in `.properties` files):

```properties
# macOS
storeFile=/Users/you/keys/wellguard-release.jks
# Windows
storeFile=C:/Users/you/keys/wellguard-release.jks

storePassword=<your keystore password>
keyAlias=wellguard
keyPassword=<same password>
```

`keystore.properties` is git-ignored — it stays on your machine only.

---

## 3. Back up the keystore — CRITICAL

The keystore + password are the **only** irreplaceable artifact in this project. They are
deliberately not in git. If you lose either, you can **never** ship an update under the
same app identity — there is no recovery.

Back up to **at least two places**:
- Your password manager (attach the `.jks` file **and** store the password)
- A second encrypted location (encrypted cloud folder, external drive)

Do this before you rely on the machine it's on.

---

## 4. Build the signed release APK

```sh
# from the repo root
npx react-native build-android --mode=release
```

or directly with Gradle:

```sh
# macOS / Linux
cd android && ./gradlew assembleRelease
# Windows
cd android && gradlew.bat assembleRelease
```

Output:

```
android/app/build/outputs/apk/release/app-release.apk
```

> Optional size reduction: minification is off by default
> (`enableProguardInReleaseBuilds` in `android/gradle.properties`). You can enable it to
> shrink the APK, but test thoroughly first — ProGuard/R8 can break reflection or native
> modules. Leave it off for early alphas.

---

## 5. Verify the APK before publishing

```sh
# confirm it's signed with YOUR key (not the debug key)
# macOS/Linux path to apksigner may vary by build-tools version:
~/Library/Android/sdk/build-tools/36.0.0/apksigner verify --print-certs \
  android/app/build/outputs/apk/release/app-release.apk

# install on a connected device/emulator and smoke-test
adb install -r android/app/build/outputs/apk/release/app-release.apk
```

Sanity checks:
- App launches, gate → Guards / Zen / Settings all render.
- The dev-only `TimerForegroundService` export is **absent** in release (it lives in
  `android/app/src/debug/AndroidManifest.xml`, which only applies to debug builds).
- Device Owner still required: `adb shell dpm set-device-owner com.wellguard/.receivers.DeviceAdminReceiver`.

---

## 6. Tag and publish the GitHub Release

Tag the exact commit and push the tag:

```sh
git tag v0.1.0-alpha
git push origin v0.1.0-alpha
```

Then, on **github.com/TejasShekar/wellguard**:

1. **Releases → Draft a new release**
2. **Choose a tag** → `v0.1.0-alpha`
3. Title: `v0.1.0-alpha`
4. **Check "Set as a pre-release"** (it's an alpha)
5. Paste release notes (what's in it, how to install, the ADB Device Owner step)
6. **Attach** `app-release.apk` as a binary
7. **Publish release**

(If `gh` CLI is ever installed: `gh release create v0.1.0-alpha app-release.apk --prerelease --title "v0.1.0-alpha" --notes-file notes.md`.)

---

## Cutting future releases

Every published build must bump the version in `android/app/build.gradle` → `defaultConfig`:

- **`versionCode`** — integer, **must increase** every release (1 → 2 → 3 …). Android
  refuses to install an update with a lower/equal versionCode.
- **`versionName`** — human string (`0.1.0-alpha` → `0.2.0-beta` → `1.0.0`).

Then repeat steps 4–6. The keystore never changes — same key, forever.

---

## If you lose the keystore

There is no recovery. A new key produces a different app identity, so existing installs
can't be updated — users would have to uninstall and reinstall. This is why step 3 exists.
Back it up.
