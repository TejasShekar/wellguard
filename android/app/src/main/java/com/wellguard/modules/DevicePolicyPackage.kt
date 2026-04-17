package com.wellguard.modules

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

class DevicePolicyPackage : BaseReactPackage() {

  override fun getModule(name: String, reactContext: ReactApplicationContext): NativeModule? =
    if (name == NAME) DevicePolicyModule(reactContext) else null

  override fun getReactModuleInfoProvider(): ReactModuleInfoProvider =
    ReactModuleInfoProvider {
      mapOf(
        NAME to ReactModuleInfo(
          NAME,
          DevicePolicyModule::class.java.name,
          false, // canOverrideExistingModule
          false, // needsEagerInit
          false, // isCxxModule
          true,  // isTurboModule
        )
      )
    }

  private companion object {
    const val NAME = "DevicePolicy"
  }
}
