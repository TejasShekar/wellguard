package com.wellguard.modules

import android.content.Intent
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.wellguard.services.CycleState
import com.wellguard.services.CycleStateStore
import com.wellguard.services.TimerForegroundService

class TimerServiceModule(reactContext: ReactApplicationContext) :
  NativeTimerServiceSpec(reactContext) {

  private val ctx get() = reactApplicationContext
  private val store by lazy { CycleStateStore(ctx) }

  override fun startCycle(
    packageName: String,
    useMinutes: Double,
    freezeMinutes: Double,
    promise: Promise,
  ) {
    try {
      val intent = Intent(ctx, TimerForegroundService::class.java).apply {
        putExtra(TimerForegroundService.EXTRA_ACTION, TimerForegroundService.ACTION_START)
        putExtra(TimerForegroundService.EXTRA_PACKAGE_NAME, packageName)
        putExtra(TimerForegroundService.EXTRA_USE_MINUTES, useMinutes)
        putExtra(TimerForegroundService.EXTRA_FREEZE_MINUTES, freezeMinutes)
      }
      ContextCompat.startForegroundService(ctx, intent)
      promise.resolve(null)
    } catch (e: Exception) {
      promise.reject("START_CYCLE_FAILED", e.message, e)
    }
  }

  override fun stopCycle(packageName: String, promise: Promise) {
    try {
      val intent = Intent(ctx, TimerForegroundService::class.java).apply {
        putExtra(TimerForegroundService.EXTRA_ACTION, TimerForegroundService.ACTION_STOP)
        putExtra(TimerForegroundService.EXTRA_PACKAGE_NAME, packageName)
      }
      ContextCompat.startForegroundService(ctx, intent)
      promise.resolve(null)
    } catch (e: Exception) {
      promise.reject("STOP_CYCLE_FAILED", e.message, e)
    }
  }

  override fun isRunning(packageName: String, promise: Promise) {
    val state = store.load(packageName)
    promise.resolve(state != null && state.phase != CycleState.Phase.IDLE)
  }
}
