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
import com.cdmafrique.live.data.model.DataSource
import com.cdmafrique.live.data.model.Match
import com.cdmafrique.live.data.model.MatchEvent
import com.cdmafrique.live.data.model.MatchLineups
import com.cdmafrique.live.data.model.MatchStats
import com.cdmafrique.live.data.model.Prediction
import com.cdmafrique.live.data.model.StandingGroup
import com.cdmafrique.live.data.model.toDomain

sealed class RepositoryLoadResult<out T> {
    data class Success<T>(val data: T, val source: DataSource) : RepositoryLoadResult<T>()
    data class Empty<T>(val source: DataSource = DataSource.EMPTY_SERVER) : RepositoryLoadResult<T>()
    data class Error<T>(val message: String, val canUseLocalFallback: Boolean = true) : RepositoryLoadResult<T>()
    data class LocalFallback<T>(val data: T, val reason: String) : RepositoryLoadResult<T>()
}

class MatchRepository(
    context: Context? = null,
    private val api: BackendApiClient = BackendApiClient()
) {
    private val temporaryError = "Serveur temporairement indisponible, reessayez."
    private val cache = context?.applicationContext?.let { AppCacheStore(it) }

    suspend fun getLiveMatches(): Result<List<Match>> = getLiveMatchesState().toListResult()

    suspend fun getLiveMatchesState(): RepositoryLoadResult<List<Match>> =
        fetchMatchList(
            bucket = "live",
            readCache = { cache?.getFreshLiveMatches().orEmpty() },
            allowLocalFallback = false,
            remote = { api.getLiveMatches().map { it.toDomain() } }
        )

    suspend fun getTodayMatches(): Result<List<Match>> = getTodayMatchesState().toListResult()

    suspend fun getTodayMatchesState(): RepositoryLoadResult<List<Match>> =
        fetchMatchList(
            bucket = "today",
            readCache = { cache?.getMatches("today").orEmpty() },
            remote = { api.getTodayMatches().map { it.toDomain() } }
        )

    suspend fun getUpcomingMatches(): Result<List<Match>> = getUpcomingMatchesState().toListResult()

    suspend fun getUpcomingMatchesState(): RepositoryLoadResult<List<Match>> =
        fetchMatchList(
            bucket = "upcoming",
            readCache = { cache?.getMatches("upcoming").orEmpty() },
            remote = { api.getUpcomingMatches().map { it.toDomain() } }
        )

    suspend fun getMatchById(matchId: String): Result<Match?> = try {
        Result.success(api.getMatchById(matchId)?.toDomain())
    } catch (e: Exception) {
        Result.failure(Exception(userFriendlyMessage(e)))
    }

    suspend fun getMatchEvents(matchId: String): Result<List<MatchEvent>> = try {
        val events = api.getMatchEvents(matchId).map { it.toDomain() }
        if (events.isEmpty() && api.lastError != null) {
            Result.failure(Exception(api.lastError ?: temporaryError))
        } else {
            Result.success(events)
        }
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

    suspend fun getStandings(): Result<List<StandingGroup>> = getStandingsState().toListResult()

    suspend fun getStandingsState(): RepositoryLoadResult<List<StandingGroup>> =
        fetchCachedList(
            readCache = { cache?.getStandings().orEmpty() },
            save = { cache?.saveStandings(it) },
            remote = { api.getStandings()?.groups?.map { it.toDomain() }.orEmpty() }
        )

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

    suspend fun getArticles(): Result<List<Article>> = getArticlesState().toListResult()

    suspend fun getArticlesState(): RepositoryLoadResult<List<Article>> =
        fetchCachedList(
            readCache = { cache?.getArticles().orEmpty() },
            save = { cache?.saveArticles(it) },
            remote = { api.getArticles()?.items?.map { it.toDomain() }.orEmpty() }
        )

    suspend fun getVideos(): Result<List<ContentResult>> = getVideosState().toListResult()

    suspend fun getVideosState(): RepositoryLoadResult<List<ContentResult>> =
        getCachedContentState("videos") { api.getVideos()?.items?.map { it.toDomain() }.orEmpty() }

    suspend fun getGlobalInterviews(): Result<List<ContentResult>> = getGlobalInterviewsState().toListResult()

    suspend fun getGlobalInterviewsState(): RepositoryLoadResult<List<ContentResult>> =
        getCachedContentState("interviews") { api.getGlobalInterviews()?.items?.map { it.toDomain() }.orEmpty() }

    suspend fun getGlobalInjuries(): Result<List<ContentResult>> = getGlobalInjuriesState().toListResult()

    suspend fun getGlobalInjuriesState(): RepositoryLoadResult<List<ContentResult>> =
        getCachedContentState("injuries") { api.getGlobalInjuries()?.items?.map { it.toDomain() }.orEmpty() }

    suspend fun getGlobalTraining(): Result<List<ContentResult>> = getGlobalTrainingState().toListResult()

    suspend fun getGlobalTrainingState(): RepositoryLoadResult<List<ContentResult>> =
        getCachedContentState("training") { api.getGlobalTraining()?.items?.map { it.toDomain() }.orEmpty() }

    private suspend fun getCachedContentState(
        bucket: String,
        remote: suspend () -> List<ContentResult>
    ): RepositoryLoadResult<List<ContentResult>> =
        fetchCachedList(
            readCache = { cache?.getContent(bucket).orEmpty() },
            save = { cache?.saveContent(bucket, it) },
            remote = remote
        )

    private suspend fun fetchMatchList(
        bucket: String,
        readCache: () -> List<Match>,
        allowLocalFallback: Boolean = true,
        remote: suspend () -> List<Match>
    ): RepositoryLoadResult<List<Match>> =
        fetchCachedList(
            readCache = readCache,
            save = { cache?.saveMatches(bucket, it, replaceEmpty = bucket == "live") },
            allowLocalFallback = allowLocalFallback,
            replaceEmpty = bucket == "live",
            remote = remote
        )

    private suspend fun <T> fetchCachedList(
        readCache: () -> List<T>,
        save: (List<T>) -> Unit,
        allowLocalFallback: Boolean = true,
        replaceEmpty: Boolean = false,
        remote: suspend () -> List<T>
    ): RepositoryLoadResult<List<T>> = try {
        val items = remote()
        val remoteError = api.lastError
        when {
            items.isNotEmpty() -> {
                save(items)
                RepositoryLoadResult.Success(items, DataSource.RENDER)
            }
            remoteError == null -> {
                if (replaceEmpty) save(emptyList())
                RepositoryLoadResult.Empty()
            }
            else -> cachedOrError(readCache(), remoteError, allowLocalFallback)
        }
    } catch (e: Exception) {
        cachedOrError(readCache(), userFriendlyMessage(e), allowLocalFallback)
    }

    private fun <T> cachedOrError(
        cached: List<T>,
        message: String,
        allowLocalFallback: Boolean
    ): RepositoryLoadResult<List<T>> =
        if (cached.isNotEmpty()) {
            RepositoryLoadResult.Success(cached, DataSource.BACKEND_CACHE)
        } else {
            RepositoryLoadResult.Error(message, canUseLocalFallback = allowLocalFallback)
        }

    private fun <T> RepositoryLoadResult<List<T>>.toListResult(): Result<List<T>> = when (this) {
        is RepositoryLoadResult.Success -> Result.success(data)
        is RepositoryLoadResult.Empty -> Result.success(emptyList())
        is RepositoryLoadResult.Error -> Result.failure(Exception(message))
        is RepositoryLoadResult.LocalFallback -> Result.success(data)
    }

    suspend fun getDiagnostic(): AppDiagnostic = try {
        refreshCacheForDiagnostic()
        val health = api.checkHealth()
        val routes = api.checkDiagnosticRoutes()
        val globalOk = health?.status.equals("ok", ignoreCase = true) &&
            routes.any { it.path == "/matches/today" && it.ok && it.itemCount > 0 } &&
            routes.any { it.path == "/matches/upcoming?days=60" && it.ok && it.itemCount > 0 } &&
            routes.any { it.path == "/matches/standings" && it.ok && it.itemCount >= 12 } &&
            routes.any { it.path == "/news" && it.ok && it.itemCount > 0 } &&
            routes.any { it.path == "/videos" && it.ok && it.itemCount > 0 }
        if (globalOk) cache?.markFallbackUsed(false)
        val snapshot = cache?.snapshot()
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

    private suspend fun refreshCacheForDiagnostic() {
        runCatching { getTodayMatches() }
        runCatching { getUpcomingMatches() }
        runCatching { getStandings() }
        runCatching { getArticles() }
        runCatching { getVideos() }
        runCatching { getGlobalInterviews() }
        runCatching { getGlobalInjuries() }
        runCatching { getGlobalTraining() }
    }

    private fun userFriendlyMessage(e: Exception): String = when {
        e.message?.contains("resolve host", ignoreCase = true) == true -> temporaryError
        e.message?.contains("BEGIN", ignoreCase = true) == true -> temporaryError
        e.message?.contains("Json", ignoreCase = true) == true -> temporaryError
        e.message?.contains("timeout", ignoreCase = true) == true -> temporaryError
        e.message?.contains("SSL", ignoreCase = true) == true -> temporaryError
        else -> temporaryError
    }
}
