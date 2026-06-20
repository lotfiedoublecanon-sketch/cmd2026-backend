package com.cdmafrique.live.data.local

import android.content.Context
import com.cdmafrique.live.data.model.Article
import com.cdmafrique.live.data.model.CommentaryItem
import com.cdmafrique.live.data.model.ContentResult
import com.cdmafrique.live.data.model.LineupPlayer
import com.cdmafrique.live.data.model.Match
import com.cdmafrique.live.data.model.MatchLineups
import com.cdmafrique.live.data.model.MatchPeriod
import com.cdmafrique.live.data.model.MatchStats
import com.cdmafrique.live.data.model.MatchStatus
import com.cdmafrique.live.data.model.Prediction
import com.cdmafrique.live.data.model.Reliability
import com.cdmafrique.live.data.model.StatCategory
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

    fun liveMatches(): List<Match> {
        val live = allMatches().filter { it.status.isLive }
        return live.ifEmpty { todayMatches().ifEmpty { upcomingMatches(7).take(6) } }
    }

    fun matchById(matchId: String): Match? {
        val localId = matchId.removePrefix("local-")
        return allMatches().firstOrNull { it.id == matchId || it.id.removePrefix("local-") == localId }
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
            title = "Données locales V4.3 intégrées",
            summary = "Si Render renvoie vide, l'application affiche les données locales complètes embarquées dans l'APK.",
            content = localAssetSummary(),
            imageUrl = null,
            publishedAt = null,
            source = "Base locale V4.3"
        ),
        Article(
            id = "local-africa-focus",
            title = "Focus Afrique",
            summary = "Calendrier, groupes, équipes et sélections africaines restent disponibles hors ligne.",
            content = africaSummary(),
            imageUrl = null,
            publishedAt = null,
            source = "Base locale"
        ),
        Article(
            id = "local-broadcasters",
            title = "Diffusion TV",
            summary = "Les diffuseurs locaux V4.3 sont embarqués dans l'application.",
            content = broadcastersSummary(),
            imageUrl = null,
            publishedAt = null,
            source = "broadcasters.json"
        )
    )

    fun mediaContent(): List<ContentResult> = listOf(
        ContentResult(
            title = "Données médias locales",
            content = broadcastersSummary(),
            reliability = Reliability.RELIABLE,
            updatedAt = null,
            source = "broadcasters.json"
        ),
        ContentResult(
            title = "Pack V4.3 intégré",
            content = localAssetSummary(),
            reliability = Reliability.RELIABLE,
            updatedAt = null,
            source = "assets/wc2026"
        )
    )

    fun injuriesContent(): List<ContentResult> = listOf(
        ContentResult(
            title = "Blessures",
            content = "Aucune blessure confirmée côté données locales. L'application conserve les sélections V4.3 et affichera Render dès qu'une information officielle arrive.",
            reliability = Reliability.UNCONFIRMED,
            updatedAt = null,
            source = "squads.json"
        )
    )

    fun interviewsContent(): List<ContentResult> = listOf(
        ContentResult(
            title = "Interviews et joueurs à suivre",
            content = topPlayersSummary(),
            reliability = Reliability.RELIABLE,
            updatedAt = null,
            source = "squads.json"
        )
    )

    fun trainingContent(): List<ContentResult> = listOf(
        ContentResult(
            title = "Entraînements et préparation",
            content = "Données locales disponibles pour équipes, stades, météo et calendrier. Les rapports d'entraînement Render/Gemini prendront la priorité dès qu'ils seront fournis.",
            reliability = Reliability.UNCONFIRMED,
            updatedAt = null,
            source = "venues.json + weather.json"
        )
    )

    fun lineups(matchId: String, match: Match): MatchLineups? = runCatching {
        val id = matchId.removePrefix("local-")
        val root = readJson("wc2026/data/lineups.json")
        val obj = root.getAsJsonObject(id) ?: return@runCatching null
        val home = obj.getAsJsonObject("home")
        val away = obj.getAsJsonObject("away")
        MatchLineups(
            matchId = match.id,
            homeFormation = home?.get("tactics")?.asString,
            awayFormation = away?.get("tactics")?.asString,
            homeStarters = lineupPlayers(home, "xi", match.homeTeam.flag),
            awayStarters = lineupPlayers(away, "xi", match.awayTeam.flag),
            homeSubs = lineupPlayers(home, "subs", match.homeTeam.flag),
            awaySubs = lineupPlayers(away, "subs", match.awayTeam.flag)
        )
    }.getOrNull()

    fun matchStats(matchId: String, match: Match): MatchStats? = runCatching {
        val id = matchId.removePrefix("local-")
        val probs = readJson("wc2026/data/probs.json").getAsJsonObject(id)
        val categories = mutableListOf<StatCategory>()
        if (probs != null) {
            categories += StatCategory("Victoire ${match.homeTeam.code ?: match.homeTeam.name}", "${probs.get("h")?.asInt ?: 0}%", "")
            categories += StatCategory("Nul", "${probs.get("d")?.asInt ?: 0}%", "")
            categories += StatCategory("Victoire ${match.awayTeam.code ?: match.awayTeam.name}", "${probs.get("a")?.asInt ?: 0}%", "")
        }
        if (match.homeScore != null || match.awayScore != null) {
            categories += StatCategory("Score local", "${match.homeScore ?: "-"}", "${match.awayScore ?: "-"}")
        }
        MatchStats(matchId = match.id, categories = categories)
    }.getOrNull()?.takeIf { it.categories.isNotEmpty() }

    fun prediction(matchId: String, match: Match): Prediction? = runCatching {
        val id = matchId.removePrefix("local-")
        val probs = readJson("wc2026/data/probs.json").getAsJsonObject(id) ?: return@runCatching null
        val home = probs.get("h")?.asInt ?: 0
        val draw = probs.get("d")?.asInt ?: 0
        val away = probs.get("a")?.asInt ?: 0
        val pick = maxOf(home, draw, away)
        val label = when (pick) {
            home -> "Avantage ${match.homeTeam.name}"
            away -> "Avantage ${match.awayTeam.name}"
            else -> "Match équilibré"
        }
        Prediction(
            matchId = match.id,
            prediction = "$label selon le modèle local V4.3 : domicile $home%, nul $draw%, extérieur $away%.",
            confidence = pick / 100.0,
            reliability = Reliability.UNCONFIRMED,
            updatedAt = null
        )
    }.getOrNull()

    fun commentary(match: Match): List<CommentaryItem> = listOf(
        CommentaryItem(0, "Données locales V4.3 affichées en secours."),
        CommentaryItem(match.minute ?: 0, "${match.homeTeam.name} - ${match.awayTeam.name} : ${match.status.display}.")
    )

    fun localNotice(): String = "Aucune donnée serveur pour le moment, affichage des données locales."

    private fun lineupPlayers(team: JsonObject?, key: String, flag: String?): List<LineupPlayer> {
        val array = team?.getAsJsonArray(key) ?: return emptyList()
        return array.mapNotNull { element ->
            val obj = element.asJsonObject
            LineupPlayer(
                id = obj.get("id")?.asString ?: obj.get("name")?.asString ?: return@mapNotNull null,
                name = obj.get("name")?.asString ?: "Joueur",
                number = obj.get("number")?.asInt,
                position = if (obj.get("gk")?.asBoolean == true) "GK" else null,
                flag = flag
            )
        }
    }

    private fun localAssetSummary(): String = runCatching {
        val meta = readJson("wc2026/data/meta.json")
        val counts = meta.getAsJsonObject("counts")
        "Pack local : ${counts.get("matches")?.asInt ?: 0} matchs, ${counts.get("teams")?.asInt ?: 0} équipes, ${counts.get("squads")?.asInt ?: 0} sélections, ${counts.get("lineups")?.asInt ?: 0} compositions, ${counts.get("flags")?.asInt ?: 0} drapeaux."
    }.getOrDefault("Pack local V4.3 disponible dans l'APK.")

    private fun africaSummary(): String {
        val africa = listOf("ALG", "MAR", "TUN", "EGY", "SEN", "CIV", "GHA", "RSA")
        return allMatches()
            .filter { it.homeTeam.code in africa || it.awayTeam.code in africa }
            .take(8)
            .joinToString("\n") { "${it.homeTeam.name} vs ${it.awayTeam.name} - ${it.group ?: "CDM 2026"}" }
            .ifBlank { "Les équipes africaines sont conservées dans les squads et le calendrier local." }
    }

    private fun broadcastersSummary(): String = runCatching {
        val markets = readJson("wc2026/data/broadcasters.json").getAsJsonArray("markets")
        markets.take(5).joinToString("\n") { market ->
            val obj = market.asJsonObject
            val iso = obj.get("iso2")?.asString ?: "TV"
            val channels = obj.getAsJsonArray("channels")?.take(3)?.joinToString(", ") {
                it.asJsonObject.get("name")?.asString ?: "Chaîne"
            }.orEmpty()
            "$iso : $channels"
        }
    }.getOrDefault("Diffuseurs locaux disponibles hors ligne.")

    private fun topPlayersSummary(): String = runCatching {
        val squads = readJson("wc2026/data/squads.json")
        listOf("ALG", "MAR", "FRA", "SEN", "CIV")
            .mapNotNull { code ->
                val team = teamsByCode[code]
                val players = squads.getAsJsonObject(code)?.getAsJsonArray("players") ?: return@mapNotNull null
                val names = players.take(3).joinToString(", ") { it.asJsonObject.get("name")?.asString ?: "Joueur" }
                "${team?.name ?: code} : $names"
            }
            .joinToString("\n")
    }.getOrDefault("Sélections locales disponibles hors ligne.")

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
