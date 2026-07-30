package com.wellguard

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.wellguard.modules.DevicePolicyPackage
import com.wellguard.modules.SmsPackage
import com.wellguard.modules.TimerServicePackage
import com.wellguard.modules.UsageStatsPackage
import com.wellguard.modules.ZenPackage

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          add(DevicePolicyPackage())
          add(TimerServicePackage())
          add(UsageStatsPackage())
          add(SmsPackage())
          add(ZenPackage())
        },
    )
  }

  override fun onCreate() {
    super.onCreate()
    loadReactNative(this)
  }
}
