package com.cdmafrique.live.data.repository

import android.content.Context
import com.cdmafrique.live.BuildConfig
import com.cdmafrique.live.data.api.BackendApiClient
import com.cdmafrique.live.data.local.AppCacheStore
import com.cdmafrique.live.data.model.Analysis
import com.cdmafrique.live.data.model.AppDiagnostic
import com.cdmafrique.live.data.model.Article
import com.cdmafrique.live.data.model.CommentaryItem
import com.cdmafrique.live.data.model.ContentResult
import com.cdmafrique.live.data.model.Match
import com.cdmafrique.live.data.model.MatchEvent
import com.cdmafrique.live.data.model.MatchLineups
import com.cdmafrique.live.data.model.MatchStats
import com.cdmafrique.live.data.model.Prediction
import com.cdmafrique.live.data.model.StandingGroup
import com.cdmafrique.live.data.model.toDomain

class MatchRepository(
    context: Context? = null,
    private val api: BackendApiClient = BackendApiClient()
) {
    private val temporaryError = "Serveur temporairement indisponible, reessayez."
    private val cache = context?.applicationContext?.let { AppCacheStore(it) }

    suspend fun getLiveMatches(): Result<List<Match>> = try {
        val matches = api.getLiveMatches().map { it.toDomain() }
        if (matches.isNotEmpty()) cache?.saveMatches("live", matches)
        Result.success(matches)
    } catch (e: Exception) {
        val cached = cache?.getFreshLiveMatches().orEmpty()
        if (cached.isNotEmpty()) Result.success(cached) else Result.failure(Exception(userFriendlyMessage(e)))
    }

    suspend fun getTodayMatches(): Result<List<Match>> = try {
        val matches = api.getTodayMatches().map { it.toDomain() }
        if (matches.isNotEmpty()) cache?.saveMatches("today", matches)
        if (matches.isNotEmpty()) cache?.markFallbackUsed(false)
        Result.success(matches.ifEmpty { cache?.getMatches("today").orEmpty() })
    } catch (e: Exception) {
        val cached = cache?.getMatches("today").orEmpty()
        if (cached.isNotEmpty()) {
            cache?.markFallbackUsed(false)
            Result.success(cached)
        } else {
            Result.failure(Exception(userFriendlyMessage(e)))
        }
    }

    suspend fun getUpcomingMatches(): Result<List<Match>> = try {
        val matches = api.getUpcomingMatches().map { it.toDomain() }
        if (matches.isNotEmpty()) cache?.saveMatches("upcoming", matches)
        if (matches.isNotEmpty()) cache?.markFallbackUsed(false)
        Result.success(matches.ifEmpty { cache?.getMatches("upcoming").orEmpty() })
    } catch (e: Exception) {
        val cached = cache?.getMatches("upcoming").orEmpty()
        if (cached.isNotEmpty()) {
            cache?.markFallbackUsed(false)
            Result.success(cached)
        } else {
            Result.failure(Exception(userFriendlyMessage(e)))
        }
    }

    suspend fun getMatchById(matchId: String): Result<Match?> = try {
        Result.success(api.getMatchById(matchId)?.toDomain())
    } catch (e: Exception) {
        Result.failure(Exception(userFriendlyMessage(e)))
    }

    suspend fun getMatchEvents(matchId: String): Result<List<MatchEvent>> = try {
        Result.success(api.getMatchEvents(matchId).map { it.toDomain() })
    } catch (e: Exception) {
        Result.failure(Exception(userFriendlyMessage(e)))
    }

    suspend fun getMatchStats(matchId: String): Result<MatchStats?> = try {
        Result.success(api.getMatchStats(matchId)?.toDomain())
    } catch (e: Exception) {
        Result.failure(Exception(userFriendlyMessage(e)))
    }

    suspend fun getMatchLineups(matchId: String): Result<MatchLineups?> = try {
        Result.success(api.getMatchLineups(matchId)?.toDomain())
    } catch (e: Exception) {
        Result.failure(Exception(userFriendlyMessage(e)))
    }

    suspend fun getStandings(): Result<List<StandingGroup>> = try {
        val groups = api.getStandings()?.groups?.map { it.toDomain() }.orEmpty()
        if (groups.isNotEmpty()) cache?.saveStandings(groups)
        if (groups.isNotEmpty()) cache?.markFallbackUsed(false)
        Result.success(groups.ifEmpty { cache?.getStandings().orEmpty() })
    } catch (e: Exception) {
        val cached = cache?.getStandings().orEmpty()
        if (cached.isNotEmpty()) {
            cache?.markFallbackUsed(false)
            Result.success(cached)
        } else {
            Result.failure(Exception(userFriendlyMessage(e)))
        }
    }

    suspend fun getCommentary(matchId: String): Result<List<CommentaryItem>> = try {
        Result.success(api.getCommentary(matchId)?.items?.map { it.toDomain() }.orEmpty())
    } catch (e: Exception) {
        Result.failure(Exception(userFriendlyMessage(e)))
    }

    suspend fun getAnalysis(matchId: String): Result<Analysis?> = try {
        Result.success(api.getAnalysis(matchId)?.toDomain())
    } catch (e: Exception) {
        Result.failure(Exception(userFriendlyMessage(e)))
    }

    suspend fun getPrediction(matchId: String): Result<Prediction?> = try {
        Result.success(api.getPrediction(matchId)?.toDomain())
    } catch (e: Exception) {
        Result.failure(Exception(userFriendlyMessage(e)))
    }

    suspend fun getInjuries(matchId: String): Result<List<ContentResult>> = try {
        Result.success(api.getInjuries(matchId)?.items?.map { it.toDomain() }.orEmpty())
    } catch (e: Exception) {
        Result.failure(Exception(userFriendlyMessage(e)))
    }

    suspend fun getInterviews(matchId: String): Result<List<ContentResult>> = try {
        Result.success(api.getInterviews(matchId)?.items?.map { it.toDomain() }.orEmpty())
    } catch (e: Exception) {
        Result.failure(Exception(userFriendlyMessage(e)))
    }

    suspend fun getTraining(matchId: String): Result<List<ContentResult>> = try {
        Result.success(api.getTraining(matchId)?.items?.map { it.toDomain() }.orEmpty())
    } catch (e: Exception) {
        Result.failure(Exception(userFriendlyMessage(e)))
    }

    suspend fun getMedia(matchId: String): Result<List<ContentResult>> = try {
        Result.success(api.getMedia(matchId)?.items?.map { it.toDomain() }.orEmpty())
    } catch (e: Exception) {
        Result.failure(Exception(userFriendlyMessage(e)))
    }

    suspend fun getArticles(): Result<List<Article>> = try {
        val items = api.getArticles()?.items?.map { it.toDomain() }.orEmpty()
        if (items.isNotEmpty()) cache?.saveArticles(items)
        if (items.isNotEmpty()) cache?.markFallbackUsed(false)
        Result.success(items.ifEmpty { cache?.getArticles().orEmpty() })
    } catch (e: Exception) {
        val cached = cache?.getArticles().orEmpty()
        if (cached.isNotEmpty()) {
            cache?.markFallbackUsed(false)
            Result.success(cached)
        } else {
            Result.failure(Exception(userFriendlyMessage(e)))
        }
    }

    suspend fun getVideos(): Result<List<ContentResult>> = getCachedContent("videos") { api.getVideos()?.items?.map { it.toDomain() }.orEmpty() }

    suspend fun getGlobalInterviews(): Result<List<ContentResult>> =
        getCachedContent("interviews") { api.getGlobalInterviews()?.items?.map { it.toDomain() }.orEmpty() }

    suspend fun getGlobalInjuries(): Result<List<ContentResult>> =
        getCachedContent("injuries") { api.getGlobalInjuries()?.items?.map { it.toDomain() }.orEmpty() }

    suspend fun getGlobalTraining(): Result<List<ContentResult>> =
        getCachedContent("training") { api.getGlobalTraining()?.items?.map { it.toDomain() }.orEmpty() }

    private suspend fun getCachedContent(
        bucket: String,
        remote: suspend () -> List<ContentResult>
    ): Result<List<ContentResult>> = try {
        val items = remote()
        if (items.isNotEmpty()) cache?.saveContent(bucket, items)
        if (items.isNotEmpty()) cache?.markFallbackUsed(false)
        Result.success(items.ifEmpty { cache?.getContent(bucket).orEmpty() })
    } catch (e: Exception) {
        val cached = cache?.getContent(bucket).orEmpty()
        if (cached.isNotEmpty()) {
            cache?.markFallbackUsed(false)
            Result.success(cached)
        } else {
            Result.failure(Exception(userFriendlyMessage(e)))
        }
    }

    suspend fun getDiagnostic(): AppDiagnostic = try {
        val health = api.checkHealth()
        val routes = api.checkDiagnosticRoutes()
        val snapshot = cache?.snapshot()
        val globalOk = health?.status.equals("ok", ignoreCase = true) &&
            routes.any { it.path == "/matches/today" && it.ok && it.itemCount > 0 } &&
            routes.any { it.path == "/matches/upcoming?days=60" && it.ok && it.itemCount > 0 } &&
            routes.any { it.path == "/matches/standings" && it.ok && it.itemCount >= 12 } &&
            routes.any { it.path == "/news" && it.ok && it.itemCount > 0 } &&
            routes.any { it.path == "/videos" && it.ok && it.itemCount > 0 }
        if (globalOk) cache?.markFallbackUsed(false)
        AppDiagnostic(
            backendStatus = health?.status ?: "unreachable",
            backendUptime = health?.uptime,
            backendVersion = health?.version,
            apiCallCount = api.apiCallCount,
            lastError = if (globalOk) null else api.lastError,
            appVersion = BuildConfig.VERSION_NAME,
            cacheSummary = snapshot?.summary().orEmpty(),
            lastSyncAt = snapshot?.lastSyncAt,
            workManagerStatus = snapshot?.workManagerStatus ?: "Non planifie",
            foregroundServiceActive = snapshot?.liveTrackingActive ?: false,
            fcmTokenRegistered = snapshot?.fcmTokenRegistered ?: false,
            localFallbackUsed = if (globalOk) false else snapshot?.localFallbackUsed ?: false,
            routes = routes
        )
    } catch (e: Exception) {
        val snapshot = cache?.snapshot()
        AppDiagnostic(
            backendStatus = "unreachable",
            backendUptime = null,
            backendVersion = null,
            apiCallCount = api.apiCallCount,
            lastError = userFriendlyMessage(e),
            appVersion = BuildConfig.VERSION_NAME,
            cacheSummary = snapshot?.summary().orEmpty(),
            lastSyncAt = snapshot?.lastSyncAt,
            workManagerStatus = snapshot?.workManagerStatus ?: "Non planifie",
            foregroundServiceActive = snapshot?.liveTrackingActive ?: false,
            fcmTokenRegistered = snapshot?.fcmTokenRegistered ?: false,
            localFallbackUsed = snapshot?.localFallbackUsed ?: false,
            routes = emptyList()
        )
    }

    suspend fun registerFcmToken(token: String): Boolean {
        val ok = api.registerFcmToken(token)
        cache?.markFcmTokenRegistered(ok)
        return ok
    }

    fun cachedLiveMatches(): List<Match> = cache?.getFreshLiveMatches().orEmpty()
    fun cachedTodayMatches(): List<Match> = cache?.getMatches("today").orEmpty()
    fun cachedUpcomingMatches(): List<Match> = cache?.getMatches("upcoming").orEmpty()
    fun cachedStandings(): List<StandingGroup> = cache?.getStandings().orEmpty()
    fun cachedArticles(): List<Article> = cache?.getArticles().orEmpty()
    fun cachedVideos(): List<ContentResult> = cache?.getContent("videos").orEmpty()
    fun cachedInterviews(): List<ContentResult> = cache?.getContent("interviews").orEmpty()
    fun cachedInjuries(): List<ContentResult> = cache?.getContent("injuries").orEmpty()
    fun cachedTraining(): List<ContentResult> = cache?.getContent("training").orEmpty()

    fun markFallbackUsed(value: Boolean) {
        cache?.markFallbackUsed(value)
    }

    fun isLiveTrackingActive(): Boolean = cache?.snapshot()?.liveTrackingActive ?: false

    private fun userFriendlyMessage(e: Exception): String = when {
        e.message?.contains("resolve host", ignoreCase = true) == true -> temporaryError
        e.message?.contains("BEGIN", ignoreCase = true) == true -> temporaryError
        e.message?.contains("Json", ignoreCase = true) == true -> temporaryError
        e.message?.contains("timeout", ignoreCase = true) == true -> temporaryError
        e.message?.contains("SSL", ignoreCase = true) == true -> temporaryError
        else -> temporaryError
    }
}
