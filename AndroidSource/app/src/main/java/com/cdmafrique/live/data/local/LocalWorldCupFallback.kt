package com.cdmafrique.live.data.local

import android.content.Context
import com.cdmafrique.live.data.model.Article
import com.cdmafrique.live.data.model.Match
import com.cdmafrique.live.data.model.MatchPeriod
import com.cdmafrique.live.data.model.MatchStatus
import com.cdmafrique.live.data.model.StandingEntry
import com.cdmafrique.live.data.model.StandingGroup
import com.cdmafrique.live.data.model.Team
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId

class LocalWorldCupFallback(private val context: Context) {
    private val zone: ZoneId = ZoneId.systemDefault()

    private val teamsByCode: Map<String, LocalTeam> by lazy {
        val root = readJson("wc2026/data/teams.json")
        val teams = root.getAsJsonObject("teams")
        teams.entrySet().associate { (code, element) ->
            val obj = element.asJsonObject
            val names = obj.getAsJsonObject("name")
            code to LocalTeam(
                code = code,
                name = names?.get("fr")?.asString ?: names?.get("en")?.asString ?: code,
                group = obj.get("group")?.asString,
                iso2 = obj.get("iso2")?.asString,
                logo = obj.get("flag")?.asString
            )
        }
    }

    fun allMatches(): List<Match> = runCatching {
        val root = readJson("wc2026/data/matches.json")
        root.getAsJsonArray("matches").mapNotNull { element ->
            val obj = element.asJsonObject
            val home = obj.getAsJsonObject("home")
            val away = obj.getAsJsonObject("away")
            val homeCode = home.get("code").asString
            val awayCode = away.get("code").asString
            val homeTeam = teamsByCode[homeCode]
            val awayTeam = teamsByCode[awayCode]
            Match(
                id = "local-${obj.get("id").asString}",
                homeTeam = Team(
                    id = homeCode,
                    name = homeTeam?.name ?: homeCode,
                    code = homeCode,
                    flag = homeTeam?.iso2,
                    logo = homeTeam?.logo
                ),
                awayTeam = Team(
                    id = awayCode,
                    name = awayTeam?.name ?: awayCode,
                    code = awayCode,
                    flag = awayTeam?.iso2,
                    logo = awayTeam?.logo
                ),
                homeScore = scoreOrNull(home),
                awayScore = scoreOrNull(away),
                status = mapStatus(obj.get("status")?.asString),
                period = MatchPeriod.UNKNOWN,
                minute = obj.get("time")?.asString?.filter { it.isDigit() }?.toIntOrNull(),
                kickoff = obj.get("date")?.asString,
                venue = "Coupe du Monde 2026",
                group = obj.get("group")?.asString?.let { "Groupe $it" },
                round = "Match ${obj.get("n")?.asInt ?: ""}".trim()
            )
        }.sortedBy { it.kickoff.orEmpty() }
    }.getOrDefault(emptyList())

    fun todayMatches(): List<Match> {
        val today = LocalDate.now(zone)
        return allMatches().filter { match ->
            match.kickoff?.let { kickoff ->
                runCatching { Instant.parse(kickoff).atZone(zone).toLocalDate() == today }.getOrDefault(false)
            } ?: false
        }
    }

    fun upcomingMatches(days: Long = 30): List<Match> {
        val today = LocalDate.now(zone)
        val limit = today.plusDays(days)
        val upcoming = allMatches().filter { match ->
            val date = match.kickoff?.let {
                runCatching { Instant.parse(it).atZone(zone).toLocalDate() }.getOrNull()
            }
            date != null && !date.isBefore(today) && !date.isAfter(limit)
        }
        return upcoming.ifEmpty { allMatches().take(30) }
    }

    fun standings(): List<StandingGroup> = runCatching {
        val root = readJson("wc2026/data/standings.json")
        val groups = root.getAsJsonObject("groups")
        groups.entrySet()
            .sortedBy { it.key }
            .map { (groupName, rows) ->
                StandingGroup(
                    name = "Groupe $groupName",
                    entries = rows.asJsonArray.map { rowElement ->
                        val row = rowElement.asJsonObject
                        val code = row.get("code").asString
                        val team = teamsByCode[code]
                        StandingEntry(
                            teamId = code,
                            teamName = team?.name ?: code,
                            teamCode = code,
                            teamFlag = team?.iso2,
                            played = row.get("p")?.asInt ?: 0,
                            won = row.get("w")?.asInt ?: 0,
                            drawn = row.get("d")?.asInt ?: 0,
                            lost = row.get("l")?.asInt ?: 0,
                            goalsFor = row.get("gf")?.asInt ?: 0,
                            goalsAgainst = row.get("ga")?.asInt ?: 0,
                            goalDifference = row.get("gd")?.asInt ?: 0,
                            points = row.get("pts")?.asInt ?: 0
                        )
                    }.sortedByDescending { it.points }
                )
            }
    }.getOrDefault(emptyList())

    fun fallbackArticles(): List<Article> = listOf(
        Article(
            id = "local-render-status",
            title = "Backend Render connecte",
            summary = "La V5 interroge le backend public valide. Les donnees live officielles apparaissent automatiquement quand les sources repondent.",
            content = "Sources cote serveur : donnees live, validation secours, IA interne et Firebase FCM.",
            imageUrl = null,
            publishedAt = null,
            source = "Diagnostic V5"
        ),
        Article(
            id = "local-africa-focus",
            title = "Focus Afrique",
            summary = "La structure V4 est reprise avec Accueil, Direct, Calendrier, Afrique et Plus.",
            content = "Les equipes africaines sont mises en avant avec calendrier local en secours si le backend renvoie temporairement vide.",
            imageUrl = null,
            publishedAt = null,
            source = "Base locale"
        )
    )

    private fun readJson(path: String): JsonObject {
        context.assets.open(path).bufferedReader().use { reader ->
            return JsonParser.parseReader(reader).asJsonObject
        }
    }

    private fun scoreOrNull(team: JsonObject): Int? {
        val score = team.get("score")
        return if (score == null || score.isJsonNull) null else score.asInt
    }

    private fun mapStatus(value: String?): MatchStatus = when (value?.lowercase()) {
        "live", "in_progress" -> MatchStatus.LIVE
        "halftime", "half_time" -> MatchStatus.HALF_TIME
        "finished", "full_time", "ft" -> MatchStatus.FINISHED
        "postponed" -> MatchStatus.POSTPONED
        "cancelled", "canceled" -> MatchStatus.CANCELLED
        else -> MatchStatus.SCHEDULED
    }
}

private data class LocalTeam(
    val code: String,
    val name: String,
    val group: String?,
    val iso2: String?,
    val logo: String?
)
