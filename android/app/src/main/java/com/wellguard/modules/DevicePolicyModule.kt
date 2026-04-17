package com.wellguard.modules

import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
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
}
