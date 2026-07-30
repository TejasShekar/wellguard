package com.wellguard.receivers

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import androidx.core.content.ContextCompat
import com.wellguard.services.CycleStateStore
import com.wellguard.services.TimerForegroundService
import com.wellguard.services.ZenScheduleStore

/**
 * Fires on device reboot. If any persisted cycle is still active (phase != IDLE),
 * restart TimerForegroundService with ACTION_RESUME so it can replay state and
 * reschedule transitions.
 */
class BootReceiver : BroadcastReceiver() {

  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action != Intent.ACTION_BOOT_COMPLETED) return

    val activeCycles = CycleStateStore(context).allActive()
    val zenSchedule = ZenScheduleStore(context).load()
    val hasZen = zenSchedule != null && zenSchedule.isActive
    Log.i(TAG, "BOOT_COMPLETED — active cycles: ${activeCycles.size}, zen: $hasZen")
    if (activeCycles.isEmpty() && !hasZen) return

    // ACTION_RESUME replays cycles AND re-arms Zen (engaging immediately if the
    // current time is inside a Zen window).
    val serviceIntent = Intent(context, TimerForegroundService::class.java).apply {
      putExtra(TimerForegroundService.EXTRA_ACTION, TimerForegroundService.ACTION_RESUME)
    }
    ContextCompat.startForegroundService(context, serviceIntent)
  }

  private companion object { const val TAG = "WellGuardBoot" }
}
