package com.cdmafrique.live.data.repository

import com.cdmafrique.live.BuildConfig
import com.cdmafrique.live.data.api.BackendApiClient
import com.cdmafrique.live.data.model.*

/**
 * Repository corrigé.
 *
 * Corrections :
 * 1. Gère les retours null de BackendApiClient (data:[] → null)
 * 2. Fournit des valeurs par défaut au lieu de crasher
 * 3. Erreurs classées en user-friendly, jamais techniques
 * 4. Plus jamais "Expected BEGIN_OBJECT but was BEGIN_ARRAY"
 * 5. Plus jamais "Unable to resolve host" affiché tel quel
 */
class MatchRepository(
    private val api: BackendApiClient = BackendApiClient()
) {

    // ── Live / Today / Upcoming ─────────────────────────────

    suspend fun getLiveMatches(): Result<List<Match>> = try {
        val dtos = api.getLiveMatches()
        Result.success(dtos.map { it.toDomain() })
    } catch (e: Exception) {
        Result.failure(Exception(userFriendlyMessage(e)))
    }

    suspend fun getTodayMatches(): Result<List<Match>> = try {
        val dtos = api.getTodayMatches()
        Result.success(dtos.map { it.toDomain() })
    } catch (e: Exception) {
        Result.failure(Exception(userFriendlyMessage(e)))
    }

    suspend fun getUpcomingMatches(): Result<List<Match>> = try {
        val dtos = api.getUpcomingMatches()
        Result.success(dtos.map { it.toDomain() })
    } catch (e: Exception) {
        Result.failure(Exception(userFriendlyMessage(e)))
    }

    suspend fun getMatchById(matchId: String): Result<Match?> = try {
        val dto = api.getMatchById(matchId)
        Result.success(dto?.toDomain())
    } catch (e: Exception) {
        Result.failure(Exception(userFriendlyMessage(e)))
    }

    // ── Match Details ───────────────────────────────────────

    suspend fun getMatchEvents(matchId: String): Result<List<MatchEvent>> = try {
        val dtos = api.getMatchEvents(matchId)
        Result.success(dtos.map { it.toDomain() })
    } catch (e: Exception) {
        Result.failure(Exception(userFriendlyMessage(e)))
    }

    suspend fun getMatchStats(matchId: String): Result<MatchStats?> = try {
        val dto = api.getMatchStats(matchId)
        Result.success(dto?.toDomain())
    } catch (e: Exception) {
        Result.failure(Exception(userFriendlyMessage(e)))
    }

    suspend fun getMatchLineups(matchId: String): Result<MatchLineups?> = try {
        val dto = api.getMatchLineups(matchId)
        Result.success(dto?.toDomain())
    } catch (e: Exception) {
        Result.failure(Exception(userFriendlyMessage(e)))
    }

    // ── Standings ───────────────────────────────────────────
    //
    // FIX : getStandings() peut retourner null quand le backend
    // renvoie data:[] (tableau vide au lieu d'un objet).
    // Avant : crash "Expected BEGIN_OBJECT but was BEGIN_ARRAY"
    // Maintenant : retourne liste vide → le ViewModel utilise le fallback local

    suspend fun getStandings(): Result<List<StandingGroup>> = try {
        val dto = api.getStandings()
        // Si le backend a renvoyé data:[] (→ null), on retourne une liste vide
        // Le ViewModel utilisera le fallback local
        val groups = dto?.groups?.map { it.toDomain() } ?: emptyList()
        Result.success(groups)
    } catch (e: Exception) {
        Result.failure(Exception(userFriendlyMessage(e)))
    }

    // ── AI Content ──────────────────────────────────────────

    suspend fun getCommentary(matchId: String): Result<List<CommentaryItem>> = try {
        val dto = api.getCommentary(matchId)
        val items = dto?.items?.map { it.toDomain() } ?: emptyList()
        Result.success(items)
    } catch (e: Exception) {
        Result.failure(Exception(userFriendlyMessage(e)))
    }

    suspend fun getAnalysis(matchId: String): Result<Analysis?> = try {
        val dto = api.getAnalysis(matchId)
        Result.success(dto?.toDomain())
    } catch (e: Exception) {
        Result.failure(Exception(userFriendlyMessage(e)))
    }

    suspend fun getPrediction(matchId: String): Result<Prediction?> = try {
        val dto = api.getPrediction(matchId)
        Result.success(dto?.toDomain())
    } catch (e: Exception) {
        Result.failure(Exception(userFriendlyMessage(e)))
    }

    // ── Content Tabs ────────────────────────────────────────

    suspend fun getInjuries(matchId: String): Result<List<ContentResult>> = try {
        val dto = api.getInjuries(matchId)
        Result.success(dto?.items?.map { it.toDomain() } ?: emptyList())
    } catch (e: Exception) {
        Result.failure(Exception(userFriendlyMessage(e)))
    }

    suspend fun getInterviews(matchId: String): Result<List<ContentResult>> = try {
        val dto = api.getInterviews(matchId)
        Result.success(dto?.items?.map { it.toDomain() } ?: emptyList())
    } catch (e: Exception) {
        Result.failure(Exception(userFriendlyMessage(e)))
    }

    suspend fun getTraining(matchId: String): Result<List<ContentResult>> = try {
        val dto = api.getTraining(matchId)
        Result.success(dto?.items?.map { it.toDomain() } ?: emptyList())
    } catch (e: Exception) {
        Result.failure(Exception(userFriendlyMessage(e)))
    }

    suspend fun getMedia(matchId: String): Result<List<ContentResult>> = try {
        val dto = api.getMedia(matchId)
        Result.success(dto?.items?.map { it.toDomain() } ?: emptyList())
    } catch (e: Exception) {
        Result.failure(Exception(userFriendlyMessage(e)))
    }

    suspend fun getArticles(): Result<List<Article>> = try {
        val dto = api.getArticles()
        Result.success(dto?.items?.map { it.toDomain() } ?: emptyList())
    } catch (e: Exception) {
        Result.failure(Exception(userFriendlyMessage(e)))
    }

    // ── Health / Diagnostic ─────────────────────────────────

    suspend fun getDiagnostic(): AppDiagnostic = try {
        val health = api.checkHealth()
        if (health != null) {
            AppDiagnostic(
                backendStatus = health.status,
                backendUptime = health.uptime,
                backendVersion = health.version,
                apiCallCount = api.apiCallCount,
                lastError = api.lastError,
                appVersion = BuildConfig.VERSION_NAME
            )
        } else {
            AppDiagnostic(
                backendStatus = "unreachable",
                backendUptime = null,
                backendVersion = null,
                apiCallCount = api.apiCallCount,
                lastError = api.lastError ?: "Pas de reponse du serveur.",
                appVersion = BuildConfig.VERSION_NAME
            )
        }
    } catch (e: Exception) {
        AppDiagnostic(
            backendStatus = "unreachable",
            backendUptime = null,
            backendVersion = null,
            apiCallCount = api.apiCallCount,
            lastError = userFriendlyMessage(e),
            appVersion = BuildConfig.VERSION_NAME
        )
    }

    // ── FCM ─────────────────────────────────────────────────

    suspend fun registerFcmToken(token: String): Boolean {
        return api.registerFcmToken(token)
    }

    // ── Error Mapping ───────────────────────────────────────
    //
    // Ne jamais afficher de message technique à l'utilisateur.
    // "Unable to resolve host" → "Serveur inaccessible"
    // "Expected BEGIN_OBJECT" → "Données indisponibles"
    // "HTTP 503" → "Serveur en réveil"

    private fun userFriendlyMessage(e: Exception): String = when {
        e.message?.contains("Unable to resolve host", ignoreCase = true) == true ->
            "Serveur inaccessible. Verifiez votre connexion internet."
        e.message?.contains("BEGIN_OBJECT", ignoreCase = true) == true ||
        e.message?.contains("BEGIN_ARRAY", ignoreCase = true) == true ->
            "Donnees indisponibles pour le moment."
        e.message?.contains("timeout", ignoreCase = true) == true ->
            "Le serveur repond lentement. Reessayez."
        e.message?.contains("SSL", ignoreCase = true) == true ->
            "Erreur de securite de connexion."
        else -> "Donnees temporairement indisponibles. Reessayez."
    }
}
