package com.cdmafrique.live.data.repository

import com.cdmafrique.live.BuildConfig
import com.cdmafrique.live.data.api.BackendApiClient
import com.cdmafrique.live.data.model.*

class MatchRepository(
    private val api: BackendApiClient = BackendApiClient()
) {

    suspend fun getLiveMatches(): Result<List<Match>> = try {
        Result.success(api.getLiveMatches().map { it.toDomain() })
    } catch (e: Exception) {
        Result.failure(e)
    }

    suspend fun getTodayMatches(): Result<List<Match>> = try {
        Result.success(api.getTodayMatches().map { it.toDomain() })
    } catch (e: Exception) {
        Result.failure(e)
    }

    suspend fun getUpcomingMatches(): Result<List<Match>> = try {
        Result.success(api.getUpcomingMatches().map { it.toDomain() })
    } catch (e: Exception) {
        Result.failure(e)
    }

    suspend fun getMatchById(matchId: String): Result<Match> = try {
        val dto = api.getMatchById(matchId) ?: throw IllegalStateException("Match indisponible")
        Result.success(dto.toDomain())
    } catch (e: Exception) {
        Result.failure(e)
    }

    suspend fun getMatchEvents(matchId: String): Result<List<MatchEvent>> = try {
        Result.success(api.getMatchEvents(matchId).map { it.toDomain() })
    } catch (e: Exception) {
        Result.failure(e)
    }

    suspend fun getMatchStats(matchId: String): Result<MatchStats> = try {
        val dto = api.getMatchStats(matchId) ?: throw IllegalStateException("Stats indisponibles")
        Result.success(dto.toDomain())
    } catch (e: Exception) {
        Result.failure(e)
    }

    suspend fun getMatchLineups(matchId: String): Result<MatchLineups> = try {
        val dto = api.getMatchLineups(matchId) ?: throw IllegalStateException("Compositions indisponibles")
        Result.success(dto.toDomain())
    } catch (e: Exception) {
        Result.failure(e)
    }

    suspend fun getStandings(): Result<List<StandingGroup>> = try {
        val dto = api.getStandings()
        Result.success(dto?.groups.orEmpty().map { it.toDomain() })
    } catch (e: Exception) {
        Result.failure(e)
    }

    suspend fun getCommentary(matchId: String): Result<List<CommentaryItem>> = try {
        val dto = api.getCommentary(matchId)
        Result.success(dto?.items.orEmpty().map { it.toDomain() })
    } catch (e: Exception) {
        Result.failure(e)
    }

    suspend fun getAnalysis(matchId: String): Result<Analysis> = try {
        val dto = api.getAnalysis(matchId) ?: throw IllegalStateException("Analyse indisponible")
        Result.success(dto.toDomain())
    } catch (e: Exception) {
        Result.failure(e)
    }

    suspend fun getPrediction(matchId: String): Result<Prediction> = try {
        val dto = api.getPrediction(matchId) ?: throw IllegalStateException("Prediction indisponible")
        Result.success(dto.toDomain())
    } catch (e: Exception) {
        Result.failure(e)
    }

    suspend fun getInjuries(matchId: String): Result<List<ContentResult>> = try {
        val dto = api.getInjuries(matchId)
        Result.success(dto?.items.orEmpty().map { it.toDomain() })
    } catch (e: Exception) {
        Result.failure(e)
    }

    suspend fun getInterviews(matchId: String): Result<List<ContentResult>> = try {
        val dto = api.getInterviews(matchId)
        Result.success(dto?.items.orEmpty().map { it.toDomain() })
    } catch (e: Exception) {
        Result.failure(e)
    }

    suspend fun getTraining(matchId: String): Result<List<ContentResult>> = try {
        val dto = api.getTraining(matchId)
        Result.success(dto?.items.orEmpty().map { it.toDomain() })
    } catch (e: Exception) {
        Result.failure(e)
    }

    suspend fun getMedia(matchId: String): Result<List<ContentResult>> = try {
        val dto = api.getMedia(matchId)
        Result.success(dto?.items.orEmpty().map { it.toDomain() })
    } catch (e: Exception) {
        Result.failure(e)
    }

    suspend fun getArticles(): Result<List<Article>> = try {
        val dto = api.getArticles()
        Result.success(dto?.items.orEmpty().map { it.toDomain() })
    } catch (e: Exception) {
        Result.failure(e)
    }

    suspend fun getVideos(): Result<List<ContentResult>> = try {
        val dto = api.getVideos()
        Result.success(dto?.items.orEmpty().map { it.toDomain() })
    } catch (e: Exception) {
        Result.failure(e)
    }

    suspend fun getGlobalInterviews(): Result<List<ContentResult>> = try {
        val dto = api.getGlobalInterviews()
        Result.success(dto?.items.orEmpty().map { it.toDomain() })
    } catch (e: Exception) {
        Result.failure(e)
    }

    suspend fun getGlobalInjuries(): Result<List<ContentResult>> = try {
        val dto = api.getGlobalInjuries()
        Result.success(dto?.items.orEmpty().map { it.toDomain() })
    } catch (e: Exception) {
        Result.failure(e)
    }

    suspend fun getGlobalTraining(): Result<List<ContentResult>> = try {
        val dto = api.getGlobalTraining()
        Result.success(dto?.items.orEmpty().map { it.toDomain() })
    } catch (e: Exception) {
        Result.failure(e)
    }

    suspend fun getDiagnostic(includeRoutes: Boolean = true): AppDiagnostic {
        val health = api.checkHealth()
        val routes = if (includeRoutes) api.checkDiagnosticRoutes() else emptyList()
        return AppDiagnostic(
            backendStatus = health?.status ?: if (routes.any { it.ok }) "ok" else "unreachable",
            backendUptime = health?.uptime,
            backendVersion = health?.version,
            apiCallCount = api.apiCallCount,
            lastError = api.lastError,
            appVersion = BuildConfig.VERSION_NAME,
            routes = routes
        )
    }

    suspend fun registerFcmToken(token: String): Boolean {
        return api.registerFcmToken(token)
    }
}
