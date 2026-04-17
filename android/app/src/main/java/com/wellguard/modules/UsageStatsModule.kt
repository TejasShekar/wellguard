package com.wellguard.modules

import android.app.AppOpsManager
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.os.Process
import android.provider.Settings
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext

class UsageStatsModule(reactContext: ReactApplicationContext) :
  NativeUsageStatsSpec(reactContext) {

  private val ctx: Context get() = reactApplicationContext

  override fun getUsageStats(startTime: Double, endTime: Double, promise: Promise) {
    try {
      val manager = ctx.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
      val stats = manager.queryUsageStats(
        UsageStatsManager.INTERVAL_BEST,
        startTime.toLong(),
        endTime.toLong(),
      )
      val out = Arguments.createArray()
      stats?.forEach { usage ->
        val entry = Arguments.createMap()
        entry.putString("packageName", usage.packageName)
        entry.putDouble("totalTimeInForegroundMs", usage.totalTimeInForeground.toDouble())
        entry.putDouble("lastTimeUsed", usage.lastTimeUsed.toDouble())
        out.pushMap(entry)
      }
      promise.resolve(out)
    } catch (e: Exception) {
      promise.reject("USAGE_STATS_FAILED", e.message, e)
    }
  }

  override fun hasUsageStatsPermission(promise: Promise) {
    try {
      val appOps = ctx.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
      val mode = appOps.unsafeCheckOpNoThrow(
        AppOpsManager.OPSTR_GET_USAGE_STATS,
        Process.myUid(),
        ctx.packageName,
      )
      promise.resolve(mode == AppOpsManager.MODE_ALLOWED)
    } catch (e: Exception) {
      promise.reject("USAGE_STATS_PERMISSION_CHECK_FAILED", e.message, e)
    }
  }

  override fun openUsageStatsSettings(promise: Promise) {
    try {
      val intent = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS).apply {
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      }
      ctx.startActivity(intent)
      promise.resolve(null)
    } catch (e: Exception) {
      promise.reject("OPEN_SETTINGS_FAILED", e.message, e)
    }
  }
}
