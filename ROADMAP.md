# WellGuard — Roadmap & Design Notes

This is the **thinking behind the code** — decisions made, alternatives rejected and why,
and the designs for features that aren't built yet. The code says *what*; this says *why*,
so that whoever picks this up next (including future-you after a long gap) doesn't have to
re-derive it or repeat a dead end.

Companion docs: [`CLAUDE.md`](./CLAUDE.md) (architecture + data models),
[`RELEASING.md`](./RELEASING.md) (how to ship), [`README.md`](./README.md) (public pitch).

**Last updated:** 2026-08-02 · **State:** v1 alpha feature-complete, release not yet cut.

---

## 1. Where things stand

### Built and validated on-device (Pixel 9 AVD, API 36)

| Area | Status | Evidence |
|---|---|---|
| DevicePolicy TurboModule (suspend/unsuspend, Device Owner checks) | Done | Instagram/Chrome blocked + unblocked from JS |
| `TimerForegroundService` use→freeze cycle engine | Done | Survives reboot; Doze transition fired +17ms late; two packages cycling concurrently transitioned 70ms apart |
| Permission gate / onboarding | Done | Device Owner, notifications, usage access, battery-opt whitelist, DO-prereqs checklist |
| Zen mode (allowlist morning-block) | Done | Engage: `suspended=18 failed=3`. Disengage: `unsuspended=18 keptFrozen=0` |
| UI — minimal-mono, light/dark, tab shell | Done | Guards / Zen / Settings |
| OSS packaging — GPL-3.0, README, release signing | Done | `keystore.properties` wiring falls back to debug signing on fresh clones |

### Not validated

- **OEM battery-optimization kill resilience.** The emulator would not let us kill the
  foreground service (`adb root` refused on a production build; `kill` → "Operation not
  permitted"), so the `START_STICKY` + AlarmManager watchdog restart path is **untested**.
  This is the single highest-risk unknown, and it can only be tested on a real
  OnePlus/Xiaomi/Samsung device. See [dontkillmyapp.com](https://dontkillmyapp.com).
- **Long-horizon Zen.** Zen was validated with short (1-minute) windows. A real overnight
  23:00→09:00 window crossing midnight, through a reboot, has not been run end-to-end.

### Immediate next step

Cut `v0.1.0-alpha` — the only blocker is generating the release keystore, which must happen
in the maintainer's own terminal (the password must never enter a log or tool call). Full
procedure in [`RELEASING.md`](./RELEASING.md).

---

## 2. v2 — Accountability, offline (the big one)

### The problem v1 leaves open

v1 enforcement rests entirely on Device Owner: Android greys out uninstall, and force-stop
doesn't stop the blocking. But **the user configures freely**. Nothing stops them from
opening WellGuard and setting the freeze window to zero at the exact moment willpower dips.
The wall is real; the gate is unlocked from the inside.

The original design closed this with an **Accountability Partner (AP)** — a trusted person
who had to approve schedule changes and emergency unblocks. That was cut from v1 because it
was built on Firebase.

### Why Firebase was rejected (don't revisit this)

Not a technical failure — a **licensing/distribution** one. Firebase requires a per-project
`google-services.json`. In an open-source app that means **every person who forks or builds
from source must create their own Firebase project** before the app will even compile. That
is a fatal barrier to contribution and completely at odds with GPL-3.0's spirit. It also
adds a backend to an app whose entire value proposition is that it works offline and can't
be tampered with.

The Firebase Auth/Firestore/FCM scaffolding is preserved on the local branch
`feature/firebase-auth` if any of the UI is ever worth salvaging (the `AuthScreen` layout
could be reused for a TOTP pairing flow).

### The TOTP approach

**Core insight:** accountability needs a *secret the user doesn't hold*, not a *server*.
TOTP (RFC 6238 — the thing Authy/Google Authenticator do) gives exactly that, and works
**entirely offline** — no internet, no backend, no accounts, no cost, nothing to run.

How it works:

1. **Pairing, once, at first setup.** WellGuard generates a random secret, shows it as a QR
   code, and the AP scans it into *their* authenticator app on *their* phone. WellGuard
   stores the secret and **never displays it again**.
2. **To change a schedule or request an unblock**, the user must enter the current 6-digit
   code — which only the AP's phone can produce. The user has to actually talk to a human
   being, out loud, and say why they want to weaken their own rules. That conversation *is*
   the accountability mechanism.
3. **Verification is local arithmetic** — HMAC-SHA1 over a 30-second time counter. No
   network call. Works on a plane, in a tunnel, with the SIM removed.

**Critical constraint: pairing must be one-shot.** If the user can re-run pairing, they
just scan the QR into their *own* authenticator and the whole thing is theatre. So pairing
is available only when no secret exists, and there is no "re-pair" button. This is what
makes it work — and it's also the source of the next problem.

### The dead-end problem (unsolved — think hard before building)

If pairing is one-shot and the AP loses their phone, dies, moves away, or you simply fall
out with them, **the user is permanently locked out of their own settings**. That's not
tough love, that's a bricked configuration. Some ideas, none fully worked out:

- **Recovery codes.** Generate N single-use codes at pairing; give them to the *AP* (or seal
  them in an envelope). Restores access, but each one is a bypass token — if the user keeps
  a photo of them, the scheme is dead.
- **Time-delayed self-recovery — most promising.** The user can always request a change
  *without* a code, but it takes effect after a long, non-cancellable cooling-off period
  (say 7 days) with a persistent notification the whole time. This substitutes **delay for
  approval**: it defeats impulse (the entire point — nobody's craving survives a week) while
  guaranteeing nobody is ever permanently stuck. It needs no second person at all, which
  means it also works for users who have no AP. **Consider shipping this *instead of* TOTP,
  or as the always-available floor beneath it.** It is strictly simpler and has no failure
  mode.
- **Multiple APs.** Any one of K can approve, so no single point of failure. Multiplies
  pairing complexity.

**Worst-case bound, worth remembering:** factory reset always removes Device Owner. So the
true worst case is never "phone permanently crippled" — it's "you must factory-reset to
escape." Extreme, deliberate, effortful. That ceiling is what makes aggressive friction
ethically defensible.

### Recommended build order for v2

1. **Time-delayed self-recovery first.** Simpler, no second party, no dead end, and it
   closes the "user weakens their own rules on impulse" hole on its own. Ship it, live with
   it, see whether TOTP is even needed.
2. TOTP on top only if delay proves insufficient in real use.

---

## 3. Other deferred work

**AccessibilityService fallback (was milestone 1C).** A no-ADB mode: intercept
`TYPE_WINDOW_STATE_CHANGED` and draw a blocking overlay. Weaker (the user can turn the
service off in Settings) and no uninstall protection, but it removes the ADB barrier and
would widen the audience enormously. Deliberately cut from v1 to keep the story honest:
alpha targets technical early adopters who accept the ADB step.

> Note: DPM suspension and the overlay are mutually exclusive by nature — a DPM-suspended
> app can't launch, so there's no window-state event to intercept. Never run both.

**Usage insights.** `UsageStatsModule` is already built and exposed to JS but nothing
consumes it. Victory Native charts, per-app streaks, a daily digest notification. This is
the "reward" half of the app — v1 is all stick, no carrot.

**Focus profiles.** v1 ships a single `ZenSchedule`. Multiple named schedules the user
swaps between (work hours / weekend / sleep). The native side already handles one schedule
generically; this is mostly a store + UI change.

**Launcher icon.** Still the default React Native icon. Fine for alpha, embarrassing for
beta. Must be fixed before any public sharing beyond a dev audience.

**Dependency cleanup.** `react-navigation` and `@notifee/react-native` are still in
`package.json` but unused — the tab bar is hand-rolled and notifications are native-side.
Kept deliberately (both are plausibly re-adopted: notifee for pre-freeze warnings,
react-navigation if screens get deeper than three tabs). Drop them if that doesn't happen.

**Untested-at-scale risk.** WatermelonDB was planned for usage history but never installed;
its React Native New Architecture support is unverified. If usage insights get built,
evaluate alternatives (RxDB, TinyBase, Realm) before committing.

---

## 4. Naming

`WellGuard` is a **working title** and should change before v1.0.0 stable. It's a crowded
name — multiple registered companies and unrelated products use it, so it doesn't stand out
or search well.

**Already checked and taken** (don't waste time re-checking): TouchGrass (iOS app +
touchgrass.now), Fallow, Tend, Unscroll, LockIn.

**Verified clear but not chosen:** Loam, Curfew, Napp.

**The direction that felt right but wasn't found yet:** the WhatsApp pattern — a name that
*sounds like* a natural spoken phrase, so it's instantly memorable and self-explaining
("WhatsApp" ← "what's up"). Or the Claude pattern — an ordinary word whose meaning the
product repurposes entirely. Broad-appeal, not Gen-Z-coded slang that alienates older users
or dates badly.

**The internal package id stays `com.wellguard` regardless of the rename.** Changing an
`applicationId` breaks every existing install's upgrade path, invalidates the signing
identity relationship, and touches Kotlin package paths, the manifest, the Device Owner
component name, and the ADB command in every doc. Not worth it. Users never see it.

---

## 5. Things that bit us (so they don't bite again)

- **Metro `EADDRINUSE :::8081`** — a stale detached Metro from a previous run.
  `kill $(lsof -i :8081 -t)`.
- **Emulator stuck at `adb: device offline`** — a killed emulator saved a dirty snapshot.
  `pkill -f "qemu-system.*Pixel_9"`, then cold-boot with `-no-snapshot-load`.
- **`am start-foreground-service` → "Requires permission not exported from uid"** — the
  service isn't exported. Fixed by `android/app/src/debug/AndroidManifest.xml`, which
  exports it in **debug builds only**, guarded by `android.permission.DUMP`. This is how all
  native validation was driven without the UI; it is absent from release builds.
- **Logcat tags are `WellGuardTimer` / `WellGuardBoot`** — not `WG.Timer` / `WG.Boot`.
- **MMKV v4's delete method is `.remove()`**, not `.delete()`.
- **`react-native/no-inline-styles` is disabled in `.eslintrc.js`** on purpose — it's
  fundamentally incompatible with runtime theming via `useColorScheme()`, which needs style
  objects built per-render from the active palette.
- **Git identity.** The global `~/.gitconfig` is a work identity; the personal one only
  auto-loads for paths under `~/Personal/`. This repo sits outside that, so early commits
  were authored with the wrong email and needed a history rewrite. **If this repo ever moves
  machines or directories, check `git config user.email` before the first commit.**

---

## 6. Honest assessment

**What's genuinely good here:** enforcement lives entirely in native code, so it survives
the JS layer being dead — that's the right architectural call and it's what makes the
"unbypassable" claim true rather than marketing. The dual-timer pattern (`Handler` primary,
`AlarmManager.setExactAndAllowWhileIdle` as the Doze-safe fallback, with a 500ms slop window
to dedupe) is a real solution to a real Android problem, and it was validated, not assumed.
Zen mode's allowlist inversion — suspending `installedLaunchable − allowlist` rather than a
named set — reuses the exact same primitive for the opposite purpose, which is why it was
cheap to build on top of the cycle engine.

**What's weakest:** the OEM-kill path is unvalidated and it's the failure mode most likely
to make the app quietly stop working for a real user — silently, which is the worst kind.
And v1 has no accountability at all, so a determined user just edits their own schedule.
v1 is a **commitment device for people who want one**, not a system that defeats a motivated
adversary. The README should never over-promise past that.

**If you only do one more thing:** test on a real OnePlus or Xiaomi device. Everything else
is features; that one is whether the core promise holds.
