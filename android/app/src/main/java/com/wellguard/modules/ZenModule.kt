package com.wellguard.modules

import android.content.Intent
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.wellguard.services.TimerForegroundService
import com.wellguard.services.ZenController
import com.wellguard.services.ZenSchedule
import com.wellguard.services.ZenScheduleStore
import com.wellguard.services.ZenStateStore

/**
 * JS bridge for Zen mode. Configuration only — enforcement lives entirely in
 * the foreground service / ZenController, so Zen still engages and disengages
 * on time even if the JS layer is dead.
 *
 * The schedule crosses the bridge as a JSON string (mirrors CycleState) to
 * avoid marshalling nested arrays through ReadableMap.
 */
class ZenModule(reactContext: ReactApplicationContext) : NativeZenSpec(reactContext) {

  private val ctx get() = reactApplicationContext
  private val scheduleStore by lazy { ZenScheduleStore(ctx) }
  private val stateStore by lazy { ZenStateStore(ctx) }

  override fun setSchedule(scheduleJson: String, promise: Promise) {
    try {
      val schedule = ZenSchedule.fromJson(scheduleJson)
      scheduleStore.save(schedule)
      sendServiceAction(TimerForegroundService.ACTION_ZEN_ARM)
      promise.resolve(null)
    } catch (e: Exception) {
      promise.reject("ZEN_SET_SCHEDULE_FAILED", e.message, e)
    }
  }

  override fun getSchedule(promise: Promise) {
    promise.resolve(scheduleStore.load()?.toJson() ?: "")
  }

  override fun clearSchedule(promise: Promise) {
    scheduleStore.clear()
    // ARM with no active schedule cancels alarms + disengages any live session.
    sendServiceAction(TimerForegroundService.ACTION_ZEN_ARM)
    promise.resolve(null)
  }

  override fun isZenActive(promise: Promise) {
    promise.resolve(stateStore.isActive())
  }

  override fun startZenNow(durationMinutes: Double, promise: Promise) {
    try {
      val intent = serviceIntent(TimerForegroundService.ACTION_ZEN_START_NOW).apply {
        putExtra(TimerForegroundService.EXTRA_DURATION_MINUTES, durationMinutes)
      }
      ContextCompat.startForegroundService(ctx, intent)
      promise.resolve(null)
    } catch (e: Exception) {
      promise.reject("ZEN_START_NOW_FAILED", e.message, e)
    }
  }

  override fun endZenNow(promise: Promise) {
    sendServiceAction(TimerForegroundService.ACTION_ZEN_END)
    promise.resolve(null)
  }

  override fun getDefaultBrowserPackage(promise: Promise) {
    promise.resolve(ZenController(ctx).resolveDefaultBrowser() ?: "")
  }

  private fun serviceIntent(action: String) =
    Intent(ctx, TimerForegroundService::class.java).apply {
      putExtra(TimerForegroundService.EXTRA_ACTION, action)
    }

  private fun sendServiceAction(action: String) {
    ContextCompat.startForegroundService(ctx, serviceIntent(action))
  }
}
