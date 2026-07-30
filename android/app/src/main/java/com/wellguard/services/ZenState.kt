package com.wellguard.services

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

/**
 * In-flight state for an ACTIVE Zen session. Written by the native controller,
 * read on resume/boot. suspendedByZen records EXACTLY which packages Zen
 * suspended, so on exit we restore precisely (an app a cycle wants kept frozen
 * is not blanket-unsuspended).
 */
data class ZenState(
  val sessionStartedAt: Long,
  val sessionEndsAt: Long,
  val suspendedByZen: List<String>,
) {
  fun toJson(): String = JSONObject().apply {
    put("sessionStartedAt", sessionStartedAt)
    put("sessionEndsAt", sessionEndsAt)
    put("suspendedByZen", JSONArray(suspendedByZen))
  }.toString()

  companion object {
    fun fromJson(raw: String): ZenState {
      val o = JSONObject(raw)
      val arr = o.getJSONArray("suspendedByZen")
      return ZenState(
        sessionStartedAt = o.getLong("sessionStartedAt"),
        sessionEndsAt = o.getLong("sessionEndsAt"),
        suspendedByZen = (0 until arr.length()).map { arr.getString(it) },
      )
    }
  }
}

class ZenStateStore(context: Context) {
  private val prefs =
    context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

  fun save(state: ZenState) {
    prefs.edit().putString(KEY, state.toJson()).apply()
  }

  fun load(): ZenState? =
    prefs.getString(KEY, null)?.let { runCatching { ZenState.fromJson(it) }.getOrNull() }

  fun clear() {
    prefs.edit().remove(KEY).apply()
  }

  fun isActive(): Boolean = prefs.contains(KEY)

  private companion object {
    const val PREFS_NAME = "wellguard.zen.state"
    const val KEY = "state"
  }
}
