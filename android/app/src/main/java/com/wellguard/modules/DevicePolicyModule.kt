package com.wellguard.modules

import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.ApplicationInfo
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReadableArray
import com.wellguard.receivers.DeviceAdminReceiver

class DevicePolicyModule(reactContext: ReactApplicationContext) :
  NativeDevicePolicySpec(reactContext) {

  private val adminComponent: ComponentName
    get() = ComponentName(reactApplicationContext, DeviceAdminReceiver::class.java)

  private val dpm: DevicePolicyManager
    get() = reactApplicationContext
      .getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager

  override fun isDeviceOwner(promise: Promise) {
    promise.resolve(dpm.isDeviceOwnerApp(reactApplicationContext.packageName))
  }

  override fun clearDeviceOwner(promise: Promise) {
    try {
      dpm.clearDeviceOwnerApp(reactApplicationContext.packageName)
      promise.resolve(null)
    } catch (e: Exception) {
      promise.reject("CLEAR_DO_FAILED", e.message, e)
    }
  }

  override fun setPackagesSuspended(
    packageNames: ReadableArray,
    suspended: Boolean,
    promise: Promise,
  ) {
    try {
      val pkgs = Array(packageNames.size()) { packageNames.getString(it) }
      val failed = dpm.setPackagesSuspended(adminComponent, pkgs, suspended)
      val result = Arguments.createArray()
      failed?.forEach { result.pushString(it) }
      promise.resolve(result)
    } catch (e: SecurityException) {
      promise.reject("NOT_DEVICE_OWNER", e.message, e)
    }
  }

  override fun getInstalledUserApps(promise: Promise) {
    try {
      val pm = reactApplicationContext.packageManager
      val query = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
      val resolved = pm.queryIntentActivities(query, 0)
      val selfPackage = reactApplicationContext.packageName
      val seen = HashSet<String>()
      val out = Arguments.createArray()
      for (info in resolved) {
        val pkg = info.activityInfo.packageName
        if (pkg == selfPackage) continue
        if (!seen.add(pkg)) continue
        val appInfo = info.activityInfo.applicationInfo
        val isSystem = (appInfo.flags and ApplicationInfo.FLAG_SYSTEM) != 0
        val entry = Arguments.createMap()
        entry.putString("packageName", pkg)
        entry.putString("appName", info.loadLabel(pm).toString())
        entry.putBoolean("isSystem", isSystem)
        out.pushMap(entry)
      }
      promise.resolve(out)
    } catch (e: Exception) {
      promise.reject("GET_INSTALLED_APPS_FAILED", e.message, e)
    }
  }
}
