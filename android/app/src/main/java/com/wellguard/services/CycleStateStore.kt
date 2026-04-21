package com.wellguard.services

import android.content.Context
import org.json.JSONObject

data class CycleState(
  val packageName: String,
  val phase: Phase,
  val phaseStartedAt: Long,
  val phaseEndsAt: Long,
  val useWindowMinutes: Double,
  val freezeWindowMinutes: Double,
) {
  enum class Phase { USE, FREEZE, IDLE }

  fun toJson(): String = JSONObject().apply {
    put("packageName", packageName)
    put("phase", phase.name)
    put("phaseStartedAt", phaseStartedAt)
    put("phaseEndsAt", phaseEndsAt)
    put("useWindowMinutes", useWindowMinutes)
    put("freezeWindowMinutes", freezeWindowMinutes)
  }.toString()

  companion object {
    fun fromJson(raw: String): CycleState {
      val obj = JSONObject(raw)
      return CycleState(
        packageName = obj.getString("packageName"),
        phase = Phase.valueOf(obj.getString("phase")),
        phaseStartedAt = obj.getLong("phaseStartedAt"),
        phaseEndsAt = obj.getLong("phaseEndsAt"),
        useWindowMinutes = obj.getDouble("useWindowMinutes"),
        freezeWindowMinutes = obj.getDouble("freezeWindowMinutes"),
      )
    }
  }
}

class CycleStateStore(context: Context) {
  private val prefs =
    context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

  fun save(state: CycleState) {
    prefs.edit().putString(key(state.packageName), state.toJson()).apply()
  }

  fun load(packageName: String): CycleState? =
    prefs.getString(key(packageName), null)?.let(CycleState::fromJson)

  fun clear(packageName: String) {
    prefs.edit().remove(key(packageName)).apply()
  }

  /** All cycles not in IDLE phase — used by BootReceiver to resume. */
  fun allActive(): List<CycleState> =
    prefs.all.entries
      .filter { it.key.startsWith(KEY_PREFIX) && it.value is String }
      .mapNotNull { runCatching { CycleState.fromJson(it.value as String) }.getOrNull() }
      .filter { it.phase != CycleState.Phase.IDLE }

  private fun key(packageName: String) = "$KEY_PREFIX$packageName"

  private companion object {
    const val PREFS_NAME = "wellguard.cycle"
    const val KEY_PREFIX = "cycle:"
  }
}
