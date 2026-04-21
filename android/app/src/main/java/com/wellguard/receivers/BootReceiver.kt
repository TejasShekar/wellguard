package com.wellguard.receivers

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import androidx.core.content.ContextCompat
import com.wellguard.services.CycleStateStore
import com.wellguard.services.TimerForegroundService

/**
 * Fires on device reboot. If any persisted cycle is still active (phase != IDLE),
 * restart TimerForegroundService with ACTION_RESUME so it can replay state and
 * reschedule transitions.
 */
class BootReceiver : BroadcastReceiver() {

  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action != Intent.ACTION_BOOT_COMPLETED) return

    val active = CycleStateStore(context).allActive()
    Log.i(TAG, "BOOT_COMPLETED — active cycles: ${active.size}")
    if (active.isEmpty()) return

    val serviceIntent = Intent(context, TimerForegroundService::class.java).apply {
      putExtra(TimerForegroundService.EXTRA_ACTION, TimerForegroundService.ACTION_RESUME)
    }
    ContextCompat.startForegroundService(context, serviceIntent)
  }

  private companion object { const val TAG = "WellGuardBoot" }
}
