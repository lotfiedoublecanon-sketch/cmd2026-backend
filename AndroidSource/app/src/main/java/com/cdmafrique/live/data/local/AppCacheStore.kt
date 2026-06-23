package com.cdmafrique.live.data.local

import android.content.Context
import com.cdmafrique.live.data.model.Article
import com.cdmafrique.live.data.model.ContentResult
import com.cdmafrique.live.data.model.Match
import com.cdmafrique.live.data.model.StandingGroup
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import java.time.Instant

data class CacheSnapshot(
    val liveCount: Int,
    val todayCount: Int,
    val upcomingCount: Int,
    val standingsCount: Int,
    val articlesCount: Int,
    val videosCount: Int,
    val interviewsCount: Int,
    val injuriesCount: Int,
    val trainingCount: Int,
    val lastSyncAt: String?,
    val localFallbackUsed: Boolean,
    val fcmTokenRegistered: Boolean,
    val liveTrackingActive: Boolean,
    val workManagerStatus: String
) {
    fun summary(): String = listOf(
        "Live: $liveCount",
        "Aujourd'hui: $todayCount",
        "A venir: $upcomingCount",
        "Groupes: $standingsCount",
        "News: $articlesCount",
        "Videos: $videosCount",
        "Interviews: $interviewsCount",
        "Blessures: $injuriesCount",
        "Training: $trainingCount"
    ).joinToString("\n")
}

class AppCacheStore(context: Context) {
    private val appContext = context.applicationContext
    private val prefs = appContext.getSharedPreferences("cdm2026_v511_cache", Context.MODE_PRIVATE)
    private val gson = Gson()

    fun saveMatches(bucket: String, items: List<Match>, replaceEmpty: Boolean = false) {
        saveList("matches_$bucket", items, replaceEmpty)
    }

    fun getMatches(bucket: String): List<Match> =
        readList("matches_$bucket", object : TypeToken<List<Match>>() {}.type)

    fun getFreshLiveMatches(maxAgeMillis: Long = 60_000L): List<Match> {
        val cachedAt = prefs.getLong("matches_live.cachedAt", 0L)
        if (cachedAt == 0L || System.currentTimeMillis() - cachedAt > maxAgeMillis) return emptyList()
        return getMatches("live")
    }

    fun saveStandings(items: List<StandingGroup>) =
        saveList("standings", items, replaceEmpty = false)

    fun getStandings(): List<StandingGroup> =
        readList("standings", object : TypeToken<List<StandingGroup>>() {}.type)

    fun saveArticles(items: List<Article>) =
        saveList("articles", items, replaceEmpty = false)

    fun getArticles(): List<Article> =
        readList("articles", object : TypeToken<List<Article>>() {}.type)

    fun saveContent(bucket: String, items: List<ContentResult>) =
        saveList("content_$bucket", items, replaceEmpty = false)

    fun getContent(bucket: String): List<ContentResult> =
        readList("content_$bucket", object : TypeToken<List<ContentResult>>() {}.type)

    fun markFallbackUsed(value: Boolean) {
        prefs.edit().putBoolean("localFallbackUsed", value).apply()
    }

    fun markFcmTokenRegistered(value: Boolean) {
        prefs.edit().putBoolean("fcmTokenRegistered", value).apply()
    }

    fun setLiveTrackingActive(value: Boolean) {
        prefs.edit()
            .putBoolean("liveTrackingActive", value)
            .putLong("liveTrackingHeartbeatAt", if (value) System.currentTimeMillis() else 0L)
            .apply()
    }

    fun touchLiveTrackingHeartbeat() {
        prefs.edit()
            .putBoolean("liveTrackingActive", true)
            .putLong("liveTrackingHeartbeatAt", System.currentTimeMillis())
            .apply()
    }

    fun isLiveTrackingActive(): Boolean {
        val active = prefs.getBoolean("liveTrackingActive", false)
        val heartbeatAt = prefs.getLong("liveTrackingHeartbeatAt", 0L)
        return active && heartbeatAt > 0L && System.currentTimeMillis() - heartbeatAt < 120_000L
    }

    fun markWorkScheduled() {
        prefs.edit()
            .putString("workManagerStatus", "Planifie")
            .putString("workManagerLastScheduledAt", Instant.now().toString())
            .apply()
    }

    fun snapshot(): CacheSnapshot = CacheSnapshot(
        liveCount = getMatches("live").size,
        todayCount = getMatches("today").size,
        upcomingCount = getMatches("upcoming").size,
        standingsCount = getStandings().size,
        articlesCount = getArticles().size,
        videosCount = getContent("videos").size,
        interviewsCount = getContent("interviews").size,
        injuriesCount = getContent("injuries").size,
        trainingCount = getContent("training").size,
        lastSyncAt = prefs.getString("lastSyncAt", null),
        localFallbackUsed = prefs.getBoolean("localFallbackUsed", false),
        fcmTokenRegistered = prefs.getBoolean("fcmTokenRegistered", false),
        liveTrackingActive = isLiveTrackingActive(),
        workManagerStatus = prefs.getString("workManagerStatus", "Non planifie") ?: "Non planifie"
    )

    private fun <T> saveList(key: String, items: List<T>, replaceEmpty: Boolean) {
        if (items.isEmpty() && !replaceEmpty) return
        prefs.edit()
            .putString(key, gson.toJson(items))
            .putLong("$key.cachedAt", System.currentTimeMillis())
            .putString("lastSyncAt", Instant.now().toString())
            .apply()
    }

    private fun <T> readList(key: String, type: java.lang.reflect.Type): List<T> {
        val json = prefs.getString(key, null) ?: return emptyList()
        return runCatching { gson.fromJson<List<T>>(json, type).orEmpty() }.getOrDefault(emptyList())
    }
}
