package com.wellguard.services

import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.util.Log
import com.wellguard.receivers.DeviceAdminReceiver

/**
 * Enforces Zen mode: during a window, suspend EVERYTHING except the allowlist
 * (the inverse of the cycle engine's block-a-named-set). Pure enforcement — no
 * scheduling here; the foreground service drives engage()/disengage() via alarms.
 *
 * DPM refuses to suspend system-critical packages (emergency dialer, SystemUI,
 * Settings) and returns them in its failed list, so an over-aggressive allowlist
 * cannot brick the phone.
 */
class ZenController(private val context: Context) {

  private val pm: PackageManager get() = context.packageManager
  private val dpm: DevicePolicyManager
    get() = context.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
  private val admin: ComponentName get() = ComponentName(context, DeviceAdminReceiver::class.java)
  private val stateStore by lazy { ZenStateStore(context) }
  private val cycleStore by lazy { CycleStateStore(context) }

  fun isActive(): Boolean = stateStore.isActive()

  /**
   * Engage Zen: suspend all launchable packages outside the allowlist, then
   * record exactly what was suspended (requested minus DPM's failed set).
   */
  fun engage(schedule: ZenSchedule, sessionEndsAt: Long) {
    val allow = HashSet(schedule.allowedPackages)
    allow.add(context.packageName) // never suspend ourselves
    if (schedule.allowBrowser) resolveDefaultBrowser()?.let { allow.add(it) }

    val toSuspend = launchablePackages().filter { it !in allow }
    if (toSuspend.isEmpty()) {
      Log.w(TAG, "engage: nothing to suspend (allowlist covers everything?)")
    }

    val failed: Set<String> = runCatching {
      dpm.setPackagesSuspended(admin, toSuspend.toTypedArray(), true)?.toSet() ?: emptySet()
    }.getOrElse {
      Log.e(TAG, "engage: setPackagesSuspended failed: ${it.message}")
      emptySet()
    }

    val actuallySuspended = toSuspend.filter { it !in failed }
    stateStore.save(
      ZenState(
        sessionStartedAt = System.currentTimeMillis(),
        sessionEndsAt = sessionEndsAt,
        suspendedByZen = actuallySuspended,
      )
    )
    Log.i(TAG, "Zen engaged: suspended=${actuallySuspended.size} failed=${failed.size} endsAt=$sessionEndsAt")
  }

  /**
   * Disengage Zen: restore each app Zen suspended to whatever its cycle now
   * requires. An app whose cycle is mid-FREEZE stays suspended; everything else
   * is unsuspended. Never blanket-unsuspends.
   */
  fun disengage() {
    val state = stateStore.load()
    if (state == null) {
      Log.i(TAG, "disengage: no active Zen state")
      return
    }
    val toUnsuspend = state.suspendedByZen.filter { pkg ->
      val cycle = cycleStore.load(pkg)
      cycle == null || cycle.phase != CycleState.Phase.FREEZE
    }
    runCatching {
      dpm.setPackagesSuspended(admin, toUnsuspend.toTypedArray(), false)
    }.onFailure { Log.w(TAG, "disengage: unsuspend failed: ${it.message}") }

    stateStore.clear()
    Log.i(TAG, "Zen disengaged: unsuspended=${toUnsuspend.size} keptFrozen=${state.suspendedByZen.size - toUnsuspend.size}")
  }

  fun resolveDefaultBrowser(): String? {
    val browse = Intent(Intent.ACTION_VIEW, Uri.parse("http://example.com"))
    val info = pm.resolveActivity(browse, PackageManager.MATCH_DEFAULT_ONLY)
    val pkg = info?.activityInfo?.packageName
    return if (pkg == null || pkg == "android") null else pkg
  }

  private fun launchablePackages(): List<String> {
    val query = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
    return pm.queryIntentActivities(query, 0)
      .map { it.activityInfo.packageName }
      .distinct()
  }

  private companion object {
    const val TAG = "WellGuardZen"
  }
}
