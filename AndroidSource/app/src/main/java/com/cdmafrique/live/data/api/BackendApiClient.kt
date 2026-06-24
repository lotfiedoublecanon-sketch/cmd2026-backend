package com.cdmafrique.live.data.api

import com.cdmafrique.live.BuildConfig
import com.cdmafrique.live.data.model.RouteDiagnostic
import com.google.gson.Gson
import com.google.gson.JsonElement
import com.google.gson.JsonArray
import com.google.gson.JsonNull
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
        getArticleList("/news") ?: getArticleList("/articles")
    }

    suspend fun getVideos(): ContentListDto? = withContext(Dispatchers.IO) {
        getContentList("/videos", "videos")
    }

    suspend fun getGlobalInterviews(): ContentListDto? = withContext(Dispatchers.IO) {
        getContentList("/interviews", "interviews")
    }

    suspend fun getGlobalInjuries(): ContentListDto? = withContext(Dispatchers.IO) {
        getContentList("/injuries", "injuries")
    }

    suspend fun getGlobalTraining(): ContentListDto? = withContext(Dispatchers.IO) {
        getContentList("/training", "training")
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
        get("/health")
    }

    suspend fun checkDiagnosticRoutes(): List<RouteDiagnostic> = withContext(Dispatchers.IO) {
        listOf(
            "/health",
            "/diagnostic",
            "/sources",
            "/sources/health",
            "/matches/live",
            "/matches/today",
            "/matches/upcoming?days=60",
            "/matches/standings",
            "/news",
            "/articles",
            "/videos",
            "/interviews",
            "/injuries",
            "/training"
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
                lastError = if (response.code == 503) {
                    temporaryError
                } else {
                    temporaryError
                }
                return null
            }
            lastError = null

            val root = JsonParser.parseString(body)

            if (root.isJsonObject && root.asJsonObject.has("success") && root.asJsonObject.get("success").asBoolean == false) {
                lastError = temporaryError
                return null
            }

            // Extraire le payload : si le backend envoie { success, data }, prendre data
            val payload = if (root.isJsonObject && root.asJsonObject.has("success") && root.asJsonObject.has("data")) {
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
            return try {
                gson.fromJson<T>(payload, type)
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
                val source = extractSourceUsed(body)
                val renderRoute = path == "/health" || path == "/diagnostic"
                RouteDiagnostic(
                    path = path,
                    ok = response.isSuccessful,
                    httpCode = response.code,
                    itemCount = count,
                    sourceUsed = source ?: if (response.isSuccessful && (count > 0 || renderRoute)) "Render" else "Local",
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

    private fun getContentList(path: String, primaryKey: String): ContentListDto? {
        val root = getJson(path) ?: return null
        val array = extractArray(root, primaryKey, "items", "data", "videos", "articles")
        val items = array?.mapNotNull { element ->
            runCatching { gson.fromJson(element, ContentResultDto::class.java) }.getOrNull()
        }.orEmpty()
        return ContentListDto(items)
    }

    private fun getArticleList(path: String): ArticleListDto? {
        val root = getJson(path) ?: return null
        val array = extractArray(root, "articles", "items", "data", "news")
        val items = array?.mapNotNull { element ->
            runCatching { gson.fromJson(element, ArticleDto::class.java) }.getOrNull()
        }.orEmpty()
        return ArticleListDto(items)
    }

    private fun getJson(path: String): JsonElement? {
        val request = Request.Builder()
            .url("$baseUrl$path")
            .get()
            .build()
        apiCallCount++
        return try {
            client.newCall(request).execute().use { response ->
                val body = response.body?.string()
                if (!response.isSuccessful || body == null) {
                    lastError = temporaryError
                    null
                } else {
                    val root = JsonParser.parseString(body)
                    if (root.isJsonObject && root.asJsonObject.has("success") && root.asJsonObject.get("success").asBoolean == false) {
                        lastError = temporaryError
                        null
                    } else {
                        lastError = null
                        root
                    }
                }
            }
        } catch (e: Exception) {
            lastError = classifyError(e)
            null
        }
    }

    private fun extractArray(root: JsonElement, vararg keys: String): JsonArray? {
        if (root.isJsonArray) return root.asJsonArray
        if (!root.isJsonObject) return null
        val obj = root.asJsonObject
        val payload = if (obj.has("success") && obj.has("data")) obj.get("data") else root
        if (payload.isJsonArray) return payload.asJsonArray
        if (!payload.isJsonObject) return null
        val payloadObj = payload.asJsonObject
        keys.forEach { key ->
            val child = payloadObj.get(key)
            if (child != null && !child.isJsonNull) {
                if (child.isJsonArray) return child.asJsonArray
                if (child.isJsonObject) {
                    extractArray(child, *keys)?.let { return it }
                }
            }
        }
        return null
    }

    private fun extractSourceUsed(body: String): String? {
        val root = runCatching { JsonParser.parseString(body) }.getOrNull() ?: return null
        if (!root.isJsonObject) return null
        val obj = root.asJsonObject
        return obj.get("sourceUsed")?.takeIf { !it.isJsonNull }?.asString
            ?: obj.get("source")?.takeIf { !it.isJsonNull }?.asString
            ?: obj.get("metadata")?.takeIf { it.isJsonObject }?.asJsonObject
                ?.get("sourceUsed")?.takeIf { !it.isJsonNull }?.asString
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

        val videos = obj.get("videos")
        if (videos != null && !videos.isJsonNull) return countJsonItems(videos)

        val articles = obj.get("articles")
        if (articles != null && !articles.isJsonNull) return countJsonItems(articles)

        val news = obj.get("news")
        if (news != null && !news.isJsonNull) return countJsonItems(news)

        return 1
    }

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
