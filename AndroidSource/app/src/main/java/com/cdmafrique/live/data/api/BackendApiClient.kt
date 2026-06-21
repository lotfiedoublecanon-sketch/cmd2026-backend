package com.cdmafrique.live.data.api

import com.cdmafrique.live.BuildConfig
import com.cdmafrique.live.data.model.RouteDiagnostic
import com.google.gson.Gson
import com.google.gson.JsonArray
import com.google.gson.JsonElement
import com.google.gson.JsonNull
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import com.google.gson.JsonSyntaxException
import com.google.gson.reflect.TypeToken
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.MediaType.Companion.toMediaType
import java.lang.reflect.ParameterizedType
import java.net.UnknownHostException
import java.util.concurrent.TimeUnit

/**
 * Backend API Client — version corrigée.
 *
 * Corrections :
 * 1. get<T>() gere data:[] quand T attend un objet.
 * 2. Erreurs reseau classees avec messages user-friendly.
 * 3. Timeouts augmentés pour Render cold starts (30s/45s/30s)
 * 4. Retour nullable pour les endpoints objet — le Repository gère les nulls
 */
class BackendApiClient {

    private val temporaryError = "Serveur temporairement indisponible, réessayez."
    private val baseUrl: String = BuildConfig.BACKEND_URL.trim().removeSuffix("/")

    private val client: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)   // Render cold start peut prendre 10-20s
        .readTimeout(45, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .build()

    private val gson = Gson()

    var apiCallCount = 0
        private set

    var lastError: String? = null
        private set

    // ── Live Matches ────────────────────────────────────────

    suspend fun getLiveMatches(): List<MatchDto> = withContext(Dispatchers.IO) {
        get("/matches/live") ?: emptyList()
    }

    suspend fun getTodayMatches(): List<MatchDto> = withContext(Dispatchers.IO) {
        get("/matches/today") ?: emptyList()
    }

    suspend fun getUpcomingMatches(): List<MatchDto> = withContext(Dispatchers.IO) {
        get("/matches/upcoming?days=60") ?: emptyList()
    }

    suspend fun getMatchById(matchId: String): MatchDto? = withContext(Dispatchers.IO) {
        get("/matches/$matchId")
    }

    // ── Match Details ───────────────────────────────────────

    suspend fun getMatchEvents(matchId: String): List<MatchEventDto> = withContext(Dispatchers.IO) {
        get("/matches/$matchId/events") ?: emptyList()
    }

    suspend fun getMatchStats(matchId: String): MatchStatsDto? = withContext(Dispatchers.IO) {
        get("/matches/$matchId/stats")
    }

    suspend fun getMatchLineups(matchId: String): MatchLineupsDto? = withContext(Dispatchers.IO) {
        get("/matches/$matchId/lineups")
    }

    // ── Standings ───────────────────────────────────────────

    suspend fun getStandings(): StandingsDto? = withContext(Dispatchers.IO) {
        get("/matches/standings")
    }

    // ── AI Content (agents hidden from user) ────────────────

    suspend fun getCommentary(matchId: String): CommentaryDto? = withContext(Dispatchers.IO) {
        get("/matches/$matchId/commentary")
    }

    suspend fun getAnalysis(matchId: String): AnalysisDto? = withContext(Dispatchers.IO) {
        get("/matches/$matchId/analysis")
    }

    suspend fun getPrediction(matchId: String): PredictionDto? = withContext(Dispatchers.IO) {
        get("/matches/$matchId/prediction")
    }

    // ── Content Tabs ────────────────────────────────────────

    suspend fun getInjuries(matchId: String): ContentListDto? = withContext(Dispatchers.IO) {
        get("/matches/$matchId/injuries")
    }

    suspend fun getInterviews(matchId: String): ContentListDto? = withContext(Dispatchers.IO) {
        get("/matches/$matchId/interviews")
    }

    suspend fun getTraining(matchId: String): ContentListDto? = withContext(Dispatchers.IO) {
        get("/matches/$matchId/training")
    }

    suspend fun getMedia(matchId: String): ContentListDto? = withContext(Dispatchers.IO) {
        get("/matches/$matchId/media")
    }

    suspend fun getArticles(): ArticleListDto? = withContext(Dispatchers.IO) {
        val news = get<ArticleListDto>("/news")
        if (news != null && news.items.isNotEmpty()) news else get("/articles")
    }

    suspend fun getVideos(): ContentListDto? = withContext(Dispatchers.IO) {
        get("/videos")
    }

    suspend fun getGlobalInterviews(): ContentListDto? = withContext(Dispatchers.IO) {
        get("/interviews")
    }

    suspend fun getGlobalInjuries(): ContentListDto? = withContext(Dispatchers.IO) {
        get("/injuries")
    }

    suspend fun getGlobalTraining(): ContentListDto? = withContext(Dispatchers.IO) {
        get("/training")
    }

    // ── Trust / Reliability ─────────────────────────────────

    suspend fun getTrust(): Map<String, String> = withContext(Dispatchers.IO) {
        get("/trust") ?: emptyMap()
    }

    // ── FCM ─────────────────────────────────────────────────

    suspend fun registerFcmToken(token: String): Boolean = withContext(Dispatchers.IO) {
        try {
            val json = gson.toJson(FcmTokenDto(token))
            val body = json.toRequestBody("application/json".toMediaType())
            val request = Request.Builder()
                .url("$baseUrl/notifications/register")
                .post(body)
                .build()
            apiCallCount++
            client.newCall(request).execute().use { response ->
                response.isSuccessful
            }
        } catch (e: Exception) {
            lastError = classifyError(e)
            false
        }
    }

    // ── Health ──────────────────────────────────────────────

    suspend fun checkHealth(): HealthDto? = withContext(Dispatchers.IO) {
        get("/diagnostic")
    }

    suspend fun checkDiagnosticRoutes(): List<RouteDiagnostic> = withContext(Dispatchers.IO) {
        listOf(
            "/health",
            "/diagnostic",
            "/matches/live",
            "/matches/today",
            "/matches/upcoming?days=60",
            "/matches/standings",
            "/news",
            "/articles",
            "/videos",
            "/interviews",
            "/injuries",
            "/training",
            "/sources"
        ).map { checkRoute(it) }
    }

    // ── Generic GET ─────────────────────────────────────────
    //
    // FIX PRINCIPAL :
    // - Retourne T? (nullable) au lieu de T
    // - Détecte data:[] quand T attend un objet → retourne null au lieu de crasher
    // - Erreurs réseau classées proprement
    // - Render cold start toléré

    private inline fun <reified T> get(path: String): T? {
        val request = Request.Builder()
            .url("$baseUrl$path")
            .get()
            .build()
        apiCallCount++
        try {
            val response = client.newCall(request).execute()
            val body = response.body?.string()

            if (!response.isSuccessful || body == null) {
                lastError = temporaryError
                return null
            }
            lastError = null

            val root = JsonParser.parseString(body)

            // Extraire le payload : si le backend envoie { success, data }, prendre data
            val payload = if (root.isJsonObject && root.asJsonObject.has("data")) {
                root.asJsonObject.get("data")
            } else {
                root
            }

            // Si payload null ou JsonNull → données vides
            if (payload == null || payload is JsonNull || payload.isJsonNull) {
                return null
            }

            // data est [] mais T attend un objet : retourner null et laisser le
            // Repository fournir le fallback sans afficher d'erreur technique.
            if (payload.isJsonArray) {
                val type = object : TypeToken<T>() {}.type
                val isListType = when (type) {
                    is ParameterizedType -> {
                        val raw = type.rawType
                        raw is Class<*> && List::class.java.isAssignableFrom(raw)
                    }
                    is Class<*> -> List::class.java.isAssignableFrom(type)
                    else -> false
                }

                if (isListType) {
                    // T est une List → désérialiser normalement (ex: List<MatchDto>)
                    return try {
                        gson.fromJson<T>(payload, type)
                    } catch (e: JsonSyntaxException) {
                        emptyList<Any>() as T
                    }
                } else if (
                    T::class.java == ArticleListDto::class.java ||
                    T::class.java == ContentListDto::class.java ||
                    T::class.java == CommentaryDto::class.java
                ) {
                    return gson.fromJson<T>(wrapArray("items", payload.asJsonArray), type)
                } else if (T::class.java == StandingsDto::class.java) {
                    return gson.fromJson<T>(wrapArray("groups", payload.asJsonArray), type)
                } else {
                    // T attend un objet mais on a un tableau
                    // Si le tableau est vide → pas de données, retourner null
                    if (payload.asJsonArray.size() == 0) {
                        return null
                    }
                    // Si le tableau n'est pas vide, essayer de prendre le premier élément
                    return try {
                        gson.fromJson<T>(payload.asJsonArray[0], object : TypeToken<T>() {}.type)
                    } catch (e: Exception) {
                        null
                    }
                }
            }

            // Payload est un objet JSON → désérialiser normalement
            val type = object : TypeToken<T>() {}.type
            val isListType = when (type) {
                is ParameterizedType -> {
                    val raw = type.rawType
                    raw is Class<*> && List::class.java.isAssignableFrom(raw)
                }
                is Class<*> -> List::class.java.isAssignableFrom(type)
                else -> false
            }
            val objectPayload = if (payload.isJsonObject && isListType) {
                val obj = payload.asJsonObject
                when {
                    obj.has("items") -> obj.get("items")
                    obj.has("groups") -> obj.get("groups")
                    obj.has("data") -> obj.get("data")
                    else -> payload
                }
            } else if (payload.isJsonObject && T::class.java == StandingsDto::class.java) {
                val obj = payload.asJsonObject
                if (!obj.has("groups") && obj.has("items")) wrapElement("groups", obj.get("items")) else payload
            } else {
                payload
            }
            return try {
                gson.fromJson<T>(objectPayload, type)
            } catch (e: JsonSyntaxException) {
                // Erreur de parsing : logger mais ne pas crasher
                lastError = temporaryError
                null
            }

        } catch (e: UnknownHostException) {
            // DNS non résolu → pas de connexion internet ou host incorrect
            lastError = temporaryError
            return null
        } catch (e: java.net.SocketTimeoutException) {
            // Timeout → Render se réveille ou réseau lent
            lastError = temporaryError
            return null
        } catch (e: java.net.ConnectException) {
            lastError = temporaryError
            return null
        } catch (e: Exception) {
            lastError = classifyError(e)
            return null
        }
    }

    private fun checkRoute(path: String): RouteDiagnostic {
        return try {
            val request = Request.Builder()
                .url("$baseUrl$path")
                .get()
                .build()
            apiCallCount++
            client.newCall(request).execute().use { response ->
                val body = response.body?.string().orEmpty()
                val count = countItems(body)
                val renderRoute = path == "/health" || path == "/diagnostic"
                RouteDiagnostic(
                    path = path,
                    ok = response.isSuccessful,
                    httpCode = response.code,
                    itemCount = count,
                    sourceUsed = if (response.isSuccessful || renderRoute) "Render" else "Local",
                    message = if (response.isSuccessful) null else temporaryError
                )
            }
        } catch (e: Exception) {
            RouteDiagnostic(
                path = path,
                ok = false,
                httpCode = null,
                itemCount = 0,
                sourceUsed = "Local",
                message = classifyError(e)
            )
        }
    }

    private fun countItems(body: String): Int {
        if (body.isBlank()) return 0
        val root = runCatching { JsonParser.parseString(body) }.getOrNull() ?: return 0
        return countJsonItems(root)
    }

    private fun countJsonItems(element: JsonElement?): Int {
        if (element == null || element.isJsonNull) return 0
        if (element.isJsonArray) return element.asJsonArray.size()
        if (!element.isJsonObject) return 1

        val obj = element.asJsonObject
        val data = obj.get("data")
        if (data != null && !data.isJsonNull) return countJsonItems(data)

        val items = obj.get("items")
        if (items != null && !items.isJsonNull) return countJsonItems(items)

        val groups = obj.get("groups")
        if (groups != null && !groups.isJsonNull) return countJsonItems(groups)

        return 1
    }

    private fun wrapArray(fieldName: String, array: JsonArray): JsonObject =
        JsonObject().apply { add(fieldName, array) }

    private fun wrapElement(fieldName: String, element: JsonElement): JsonObject =
        JsonObject().apply { add(fieldName, element) }

    /** Classe les erreurs techniques en messages user-friendly */
    private fun classifyError(e: Exception): String = when {
        e is UnknownHostException -> temporaryError
        e is java.net.SocketTimeoutException -> temporaryError
        e is java.net.ConnectException -> temporaryError
        e.message?.contains("resolve host", ignoreCase = true) == true ->
            temporaryError
        e.message?.contains("BEGIN", ignoreCase = true) == true ||
        e.message?.contains("Json", ignoreCase = true) == true ->
            temporaryError
        e.message?.contains("SSL", ignoreCase = true) == true ->
            temporaryError
        else -> temporaryError
    }
}
