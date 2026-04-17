package com.wellguard.modules

import android.util.Log
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext

/**
 * Stub — real foreground service implementation lands in Milestone 1B.
 * These methods resolve immediately so JS callers don't crash while the
 * cycle engine isn't built yet.
 */
class TimerServiceModule(reactContext: ReactApplicationContext) :
  NativeTimerServiceSpec(reactContext) {

  override fun startCycle(packageName: String, promise: Promise) {
    Log.w(TAG, "startCycle($packageName) — stub; foreground service lands in Milestone 1B")
    promise.resolve(null)
  }

  override fun stopCycle(packageName: String, promise: Promise) {
    Log.w(TAG, "stopCycle($packageName) — stub; foreground service lands in Milestone 1B")
    promise.resolve(null)
  }

  override fun isRunning(packageName: String, promise: Promise) {
    promise.resolve(false)
  }

  private companion object {
    const val TAG = "TimerServiceStub"
  }
}
