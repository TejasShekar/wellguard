package com.wellguard.modules

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

class SmsPackage : BaseReactPackage() {

  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? =
    if (name == NAME) SmsModule(reactContext) else null

  override fun getReactModuleInfoProvider(): ReactModuleInfoProvider =
    ReactModuleInfoProvider {
      mapOf(
        NAME to ReactModuleInfo(
          NAME,
          SmsModule::class.java.name,
          false,
          false,
          false,
          true,
        )
      )
    }

  private companion object {
    const val NAME = "Sms"
  }
}
