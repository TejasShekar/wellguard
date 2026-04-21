package com.wellguard.services

import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.Log
import androidx.core.app.NotificationCompat
import com.wellguard.R
import com.wellguard.receivers.DeviceAdminReceiver
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Owns the use/freeze cycle for a single packageName. One service instance
 * multiplexes over any number of packages — each has its own CycleState
 * persisted via CycleStateStore.
 *
 * Primary timer: Handler.postDelayed (accurate while service is alive).
 * Fallback: AlarmManager.setExactAndAllowWhileIdle (Doze-safe; fires if
 * the OEM kills the service). Both end up calling onPhaseTransition —
 * whichever fires first wins, the other sees an already-progressed state
 * and no-ops.
 */
class TimerForegroundService : Service() {

  private val handler = Handler(Looper.getMainLooper())
  private val pendingTransitions = mutableMapOf<String, Runnable>()

  private lateinit var store: CycleStateStore
  private lateinit var dpm: DevicePolicyManager
  private lateinit var alarmManager: AlarmManager
  private lateinit var adminComponent: ComponentName

  override fun onCreate() {
    super.onCreate()
    store = CycleStateStore(this)
    dpm = getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
    alarmManager = getSystemService(Context.ALARM_SERVICE) as AlarmManager
    adminComponent = ComponentName(this, DeviceAdminReceiver::class.java)
    ensureChannel()
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val action = intent?.getStringExtra(EXTRA_ACTION) ?: ACTION_START
    val packageName = intent?.getStringExtra(EXTRA_PACKAGE_NAME)

    Log.i(TAG, "onStartCommand action=$action pkg=$packageName")

    // startForeground must be called within a few seconds of startForegroundService —
    // do this unconditionally so we don't get killed by ANR.
    startForeground(NOTIFICATION_ID, buildNotification("WellGuard running"))

    when (action) {
      ACTION_START -> if (packageName != null) {
        val useMin = intent.getDoubleExtra(EXTRA_USE_MINUTES, DEFAULT_USE_MIN)
        val freezeMin = intent.getDoubleExtra(EXTRA_FREEZE_MINUTES, DEFAULT_FREEZE_MIN)
        startCycle(packageName, useMin, freezeMin)
      }
      ACTION_STOP -> if (packageName != null) stopCycle(packageName)
      ACTION_TRANSITION -> if (packageName != null) onPhaseTransition(packageName)
      ACTION_RESUME -> resumeAllFromStore()
    }

    refreshNotification()

    // If no active cycles remain, let the service exit — foreground service should
    // not linger with no work.
    if (store.allActive().isEmpty()) {
      Log.i(TAG, "no active cycles, stopping self")
      stopForeground(STOP_FOREGROUND_REMOVE)
      stopSelf()
    }

    return START_STICKY
  }

  override fun onBind(intent: Intent?) = null

  override fun onDestroy() {
    pendingTransitions.values.forEach { handler.removeCallbacks(it) }
    pendingTransitions.clear()
    super.onDestroy()
  }

  // ----- Cycle lifecycle -----

  private fun startCycle(packageName: String, useMin: Double, freezeMin: Double) {
    val now = System.currentTimeMillis()
    val state = CycleState(
      packageName = packageName,
      phase = CycleState.Phase.USE,
      phaseStartedAt = now,
      phaseEndsAt = now + (useMin * MS_PER_MINUTE).toLong(),
      useWindowMinutes = useMin,
      freezeWindowMinutes = freezeMin,
    )
    store.save(state)
    applyPhase(state)
    scheduleNextTransition(state)
  }

  private fun stopCycle(packageName: String) {
    cancelScheduled(packageName)
    // Always unsuspend on stop so the user isn't left with a frozen app.
    runCatching { dpm.setPackagesSuspended(adminComponent, arrayOf(packageName), false) }
      .onFailure { Log.w(TAG, "stopCycle: unsuspend failed: ${it.message}") }
    store.clear(packageName)
  }

  private fun onPhaseTransition(packageName: String) {
    val current = store.load(packageName) ?: run {
      Log.w(TAG, "transition fired for $packageName but no state")
      return
    }
    val now = System.currentTimeMillis()
    if (now < current.phaseEndsAt - TRANSITION_SLOP_MS) {
      Log.i(TAG, "transition for $packageName fired early (now=$now end=${current.phaseEndsAt}); ignoring")
      return
    }

    val nextPhase = when (current.phase) {
      CycleState.Phase.USE -> CycleState.Phase.FREEZE
      CycleState.Phase.FREEZE -> CycleState.Phase.USE
      CycleState.Phase.IDLE -> return
    }
    val nextDurationMs = when (nextPhase) {
      CycleState.Phase.USE -> (current.useWindowMinutes * MS_PER_MINUTE).toLong()
      CycleState.Phase.FREEZE -> (current.freezeWindowMinutes * MS_PER_MINUTE).toLong()
      CycleState.Phase.IDLE -> 0L
    }
    val next = current.copy(
      phase = nextPhase,
      phaseStartedAt = now,
      phaseEndsAt = now + nextDurationMs,
    )
    store.save(next)
    applyPhase(next)
    scheduleNextTransition(next)
  }

  /** Called on cold-start by BootReceiver. Replays all persisted active cycles. */
  private fun resumeAllFromStore() {
    val active = store.allActive()
    Log.i(TAG, "resumeAllFromStore active=${active.size}")
    val now = System.currentTimeMillis()
    active.forEach { state ->
      if (now >= state.phaseEndsAt) {
        // We missed a transition while powered off; fast-forward.
        onPhaseTransition(state.packageName)
      } else {
        applyPhase(state)
        scheduleNextTransition(state)
      }
    }
  }

  // ----- Side effects -----

  private fun applyPhase(state: CycleState) {
    val suspended = state.phase == CycleState.Phase.FREEZE
    runCatching {
      dpm.setPackagesSuspended(adminComponent, arrayOf(state.packageName), suspended)
    }.onFailure {
      Log.e(TAG, "applyPhase failed for ${state.packageName}: ${it.message}")
    }
  }

  // ----- Scheduling -----

  private fun scheduleNextTransition(state: CycleState) {
    cancelScheduled(state.packageName)
    val delay = (state.phaseEndsAt - System.currentTimeMillis()).coerceAtLeast(0L)

    // Primary: in-process Handler.
    val runnable = Runnable {
      val self = Intent(this, TimerForegroundService::class.java).apply {
        putExtra(EXTRA_ACTION, ACTION_TRANSITION)
        putExtra(EXTRA_PACKAGE_NAME, state.packageName)
      }
      startService(self)
    }
    handler.postDelayed(runnable, delay)
    pendingTransitions[state.packageName] = runnable

    // Fallback: AlarmManager for Doze-safe wake.
    val pi = transitionPendingIntent(state.packageName)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !alarmManager.canScheduleExactAlarms()) {
      alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, state.phaseEndsAt, pi)
    } else {
      alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, state.phaseEndsAt, pi)
    }
  }

  private fun cancelScheduled(packageName: String) {
    pendingTransitions.remove(packageName)?.let { handler.removeCallbacks(it) }
    alarmManager.cancel(transitionPendingIntent(packageName))
  }

  private fun transitionPendingIntent(packageName: String): PendingIntent {
    val intent = Intent(this, TimerForegroundService::class.java).apply {
      action = "$ACTION_TRANSITION:$packageName"
      putExtra(EXTRA_ACTION, ACTION_TRANSITION)
      putExtra(EXTRA_PACKAGE_NAME, packageName)
    }
    return PendingIntent.getService(
      this,
      packageName.hashCode(),
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
  }

  // ----- Notification -----

  private fun ensureChannel() {
    val mgr = getSystemService(NotificationManager::class.java)
    if (mgr.getNotificationChannel(CHANNEL_ID) == null) {
      mgr.createNotificationChannel(
        NotificationChannel(CHANNEL_ID, "WellGuard cycle", NotificationManager.IMPORTANCE_LOW)
          .apply { description = "Persistent notification while a cycle is running" }
      )
    }
  }

  private fun refreshNotification() {
    val active = store.allActive()
    val body = when {
      active.isEmpty() -> "Idle"
      active.size == 1 -> {
        val s = active.first()
        val endsAt = SimpleDateFormat("HH:mm:ss", Locale.US).format(Date(s.phaseEndsAt))
        "${s.packageName} · ${s.phase.name.lowercase()} until $endsAt"
      }
      else -> "${active.size} cycles running"
    }
    val mgr = getSystemService(NotificationManager::class.java)
    mgr.notify(NOTIFICATION_ID, buildNotification(body))
  }

  private fun buildNotification(body: String) =
    NotificationCompat.Builder(this, CHANNEL_ID)
      .setContentTitle("WellGuard")
      .setContentText(body)
      .setSmallIcon(R.mipmap.ic_launcher)
      .setOngoing(true)
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .build()

  companion object {
    private const val TAG = "WellGuardTimer"
    private const val CHANNEL_ID = "wellguard_timer"
    private const val NOTIFICATION_ID = 9101
    private const val MS_PER_MINUTE = 60_000L
    private const val TRANSITION_SLOP_MS = 500L
    private const val DEFAULT_USE_MIN = 10.0
    private const val DEFAULT_FREEZE_MIN = 60.0

    const val EXTRA_ACTION = "action"
    const val EXTRA_PACKAGE_NAME = "packageName"
    const val EXTRA_USE_MINUTES = "useMinutes"
    const val EXTRA_FREEZE_MINUTES = "freezeMinutes"

    const val ACTION_START = "start"
    const val ACTION_STOP = "stop"
    const val ACTION_TRANSITION = "transition"
    const val ACTION_RESUME = "resume"
  }
}
