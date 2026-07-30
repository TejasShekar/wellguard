package com.wellguard.services

import android.content.Context
import java.util.Calendar
import org.json.JSONArray
import org.json.JSONObject

/**
 * The recurring rule that defines a Zen window (allowlist morning-block).
 * Configured by JS (ZenModule) and persisted locally so the native controller
 * can enforce it even when the JS layer is dead.
 *
 * A window may cross midnight (endMinuteOfDay <= startMinuteOfDay), e.g.
 * 23:00 -> 09:00. daysOfWeek lists the START days (0=Sun..6=Sat; empty=every day).
 */
data class ZenSchedule(
  val startMinuteOfDay: Int,
  val endMinuteOfDay: Int,
  val daysOfWeek: List<Int>,
  val allowedPackages: List<String>,
  val allowBrowser: Boolean,
  val isActive: Boolean,
) {
  /** True when [end] is at or before [start] on the clock, i.e. the window spans midnight. */
  val wrapsMidnight: Boolean get() = endMinuteOfDay <= startMinuteOfDay

  fun toJson(): String = JSONObject().apply {
    put("startMinuteOfDay", startMinuteOfDay)
    put("endMinuteOfDay", endMinuteOfDay)
    put("daysOfWeek", JSONArray(daysOfWeek))
    put("allowedPackages", JSONArray(allowedPackages))
    put("allowBrowser", allowBrowser)
    put("isActive", isActive)
  }.toString()

  companion object {
    fun fromJson(raw: String): ZenSchedule {
      val o = JSONObject(raw)
      return ZenSchedule(
        startMinuteOfDay = o.getInt("startMinuteOfDay"),
        endMinuteOfDay = o.getInt("endMinuteOfDay"),
        daysOfWeek = o.getJSONArray("daysOfWeek").toIntList(),
        allowedPackages = o.getJSONArray("allowedPackages").toStringList(),
        allowBrowser = o.optBoolean("allowBrowser", false),
        isActive = o.optBoolean("isActive", false),
      )
    }

    private fun JSONArray.toIntList(): List<Int> = (0 until length()).map { getInt(it) }
    private fun JSONArray.toStringList(): List<String> = (0 until length()).map { getString(it) }
  }
}

class ZenScheduleStore(context: Context) {
  private val prefs =
    context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

  fun save(schedule: ZenSchedule) {
    prefs.edit().putString(KEY, schedule.toJson()).apply()
  }

  fun load(): ZenSchedule? =
    prefs.getString(KEY, null)?.let { runCatching { ZenSchedule.fromJson(it) }.getOrNull() }

  fun clear() {
    prefs.edit().remove(KEY).apply()
  }

  private companion object {
    const val PREFS_NAME = "wellguard.zen"
    const val KEY = "schedule"
  }
}

/**
 * Pure time math for Zen windows. Kept separate + stateless so the midnight-wrap
 * and day-of-week logic can be reasoned about (and unit-tested) in isolation.
 *
 * Convention: minutes-of-day are local; day-of-week is 0=Sun..6=Sat.
 */
object ZenTime {

  private fun minuteOfDay(cal: Calendar): Int =
    cal.get(Calendar.HOUR_OF_DAY) * 60 + cal.get(Calendar.MINUTE)

  /** 0=Sun..6=Sat from a Calendar (whose DAY_OF_WEEK is 1=Sun..7=Sat). */
  private fun dayOfWeek(cal: Calendar): Int = cal.get(Calendar.DAY_OF_WEEK) - 1

  private fun atMinuteOfDay(base: Calendar, minute: Int): Calendar =
    (base.clone() as Calendar).apply {
      set(Calendar.HOUR_OF_DAY, minute / 60)
      set(Calendar.MINUTE, minute % 60)
      set(Calendar.SECOND, 0)
      set(Calendar.MILLISECOND, 0)
    }

  /** Is [nowMillis] inside an active instance of [schedule] (time band AND start-day match)? */
  fun isWithinWindow(schedule: ZenSchedule, nowMillis: Long): Boolean {
    if (!schedule.isActive) return false
    val now = Calendar.getInstance().apply { timeInMillis = nowMillis }
    val nowMin = minuteOfDay(now)

    val inBand =
      if (!schedule.wrapsMidnight) {
        nowMin >= schedule.startMinuteOfDay && nowMin < schedule.endMinuteOfDay
      } else {
        nowMin >= schedule.startMinuteOfDay || nowMin < schedule.endMinuteOfDay
      }
    if (!inBand) return false

    // Which calendar day did THIS window instance start on? If we are in the
    // post-midnight tail of a wrapping window, the start day was yesterday.
    val startDay = (now.clone() as Calendar)
    if (schedule.wrapsMidnight && nowMin < schedule.endMinuteOfDay) {
      startDay.add(Calendar.DAY_OF_YEAR, -1)
    }
    return schedule.daysOfWeek.isEmpty() || schedule.daysOfWeek.contains(dayOfWeek(startDay))
  }

  /** First future instant (> now) whose clock time equals [minute]. */
  fun nextTimeAtMinute(minute: Int, nowMillis: Long): Long {
    val now = Calendar.getInstance().apply { timeInMillis = nowMillis }
    val candidate = atMinuteOfDay(now, minute)
    if (candidate.timeInMillis <= nowMillis) candidate.add(Calendar.DAY_OF_YEAR, 1)
    return candidate.timeInMillis
  }

  /** Next window START that is in the future and lands on an allowed day. */
  fun nextStartMillis(schedule: ZenSchedule, nowMillis: Long): Long {
    for (offset in 0..7) {
      val day = Calendar.getInstance().apply {
        timeInMillis = nowMillis
        add(Calendar.DAY_OF_YEAR, offset)
      }
      val start = atMinuteOfDay(day, schedule.startMinuteOfDay)
      if (start.timeInMillis <= nowMillis) continue
      if (schedule.daysOfWeek.isEmpty() || schedule.daysOfWeek.contains(dayOfWeek(start))) {
        return start.timeInMillis
      }
    }
    // Fallback (should never hit within a week): tomorrow at start.
    return nextTimeAtMinute(schedule.startMinuteOfDay, nowMillis)
  }

  /** Concrete end of the window that is active now, or the next one's end. */
  fun sessionEndMillis(schedule: ZenSchedule, nowMillis: Long): Long =
    nextTimeAtMinute(schedule.endMinuteOfDay, nowMillis)
}
