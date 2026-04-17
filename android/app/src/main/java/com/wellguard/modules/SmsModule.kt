package com.wellguard.modules

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.telephony.SmsManager
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext

class SmsModule(reactContext: ReactApplicationContext) : NativeSmsSpec(reactContext) {

  private val ctx: Context get() = reactApplicationContext

  override fun sendSms(phoneNumber: String, message: String, promise: Promise) {
    val granted = ContextCompat.checkSelfPermission(ctx, Manifest.permission.SEND_SMS) ==
      PackageManager.PERMISSION_GRANTED
    if (!granted) {
      promise.reject("SMS_PERMISSION_DENIED", "SEND_SMS runtime permission not granted")
      return
    }
    try {
      val smsManager = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        ctx.getSystemService(SmsManager::class.java)
      } else {
        @Suppress("DEPRECATION")
        SmsManager.getDefault()
      }
      smsManager.sendTextMessage(phoneNumber, null, message, null, null)
      promise.resolve(null)
    } catch (e: Exception) {
      promise.reject("SMS_SEND_FAILED", e.message, e)
    }
  }

  override fun hasSmsPermission(promise: Promise) {
    val granted = ContextCompat.checkSelfPermission(ctx, Manifest.permission.SEND_SMS) ==
      PackageManager.PERMISSION_GRANTED
    promise.resolve(granted)
  }
}
