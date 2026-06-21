package com.cdmafrique.live.data.local

import android.content.Context
import com.cdmafrique.live.data.model.*
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId

class LocalWorldCupFallback(private val context: Context) {
    private val zone: ZoneId = ZoneId.systemDefault()

    private val embeddedTeams: Map<String, LocalTeam> = listOf(
        LocalTeam("MEX", "Mexique", "A", "MX", null),
        LocalTeam("RSA", "Afrique du Sud", "A", "ZA", null),
        LocalTeam("KOR", "Corée du Sud", "A", "KR", null),
        LocalTeam("CZE", "Tchéquie", "A", "CZ", null),
        LocalTeam("CAN", "Canada", "B", "CA", null),
        LocalTeam("BIH", "Bosnie-Herzégovine", "B", "BA", null),
        LocalTeam("QAT", "Qatar", "B", "QA", null),
        LocalTeam("SUI", "Suisse", "B", "CH", null),
        LocalTeam("BRA", "Brésil", "C", "BR", null),
        LocalTeam("MAR", "Maroc", "C", "MA", null),
        LocalTeam("HTI", "Haïti", "C", "HT", null),
        LocalTeam("SCO", "Écosse", "C", "GB", null),
        LocalTeam("USA", "États-Unis", "D", "US", null),
        LocalTeam("PAR", "Paraguay", "D", "PY", null),
        LocalTeam("AUS", "Australie", "D", "AU", null),
        LocalTeam("TUR", "Turquie", "D", "TR", null),
        LocalTeam("GER", "Allemagne", "E", "DE", null),
        LocalTeam("CIV", "Côte d’Ivoire", "E", "CI", null),
        LocalTeam("ECU", "Équateur", "E", "EC", null),
        LocalTeam("CUW", "Curaçao", "E", "CW", null),
        LocalTeam("NED", "Pays-Bas", "F", "NL", null),
        LocalTeam("JPN", "Japon", "F", "JP", null),
        LocalTeam("SWE", "Suède", "F", "SE", null),
        LocalTeam("TUN", "Tunisie", "F", "TN", null),
        LocalTeam("BEL", "Belgique", "G", "BE", null),
        LocalTeam("EGY", "Égypte", "G", "EG", null),
        LocalTeam("IRI", "Iran", "G", "IR", null),
        LocalTeam("NZL", "Nouvelle-Zélande", "G", "NZ", null),
        LocalTeam("ESP", "Espagne", "H", "ES", null),
        LocalTeam("CPV", "Cap-Vert", "H", "CV", null),
        LocalTeam("KSA", "Arabie saoudite", "H", "SA", null),
        LocalTeam("URU", "Uruguay", "H", "UY", null),
        LocalTeam("FRA", "France", "I", "FR", null),
        LocalTeam("SEN", "Sénégal", "I", "SN", null),
        LocalTeam("IRQ", "Irak", "I", "IQ", null),
        LocalTeam("NOR", "Norvège", "I", "NO", null),
        LocalTeam("ARG", "Argentine", "J", "AR", null),
        LocalTeam("DZA", "Algérie", "J", "DZ", null),
        LocalTeam("AUT", "Autriche", "J", "AT", null),
        LocalTeam("JOR", "Jordanie", "J", "JO", null),
        LocalTeam("POR", "Portugal", "K", "PT", null),
        LocalTeam("COD", "RD Congo", "K", "CD", null),
        LocalTeam("UZB", "Ouzbékistan", "K", "UZ", null),
        LocalTeam("COL", "Colombie", "K", "CO", null),
        LocalTeam("ENG", "Angleterre", "L", "GB", null),
        LocalTeam("CRO", "Croatie", "L", "HR", null),
        LocalTeam("GHA", "Ghana", "L", "GH", null),
        LocalTeam("PAN", "Panama", "L", "PA", null)
    ).associateBy { it.code }

    private val teamsByCode: Map<String, LocalTeam> by lazy {
        runCatching {
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
        }.getOrElse { embeddedTeams }
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
                homeTeam = toTeam(homeCode, homeTeam),
                awayTeam = toTeam(awayCode, awayTeam),
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
    }.getOrElse { embeddedMatches() }

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
            val date = match.kickoff?.let { runCatching { Instant.parse(it).atZone(zone).toLocalDate() }.getOrNull() }
            date != null && !date.isBefore(today) && !date.isAfter(limit)
        }
        return upcoming.ifEmpty { allMatches().take(48) }
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
    }.getOrElse { embeddedStandings() }

    fun fallbackArticles(): List<Article> = listOf(
        Article(
            id = "local-render-status",
            title = "Backend Render connecté",
            summary = "La V5 interroge le backend public valide. Les données live officielles apparaissent automatiquement quand les sources répondent.",
            content = "Sources côté serveur : FAPI/TheStatsAPI, SportDB/Flashscore, Gemini et Firebase FCM.",
            imageUrl = null,
            publishedAt = null,
            source = "Diagnostic V5",
            url = "https://cmd2026-backend-1.onrender.com/diagnostic"
        ),
        Article(
            id = "local-africa-focus",
            title = "Focus Afrique",
            summary = "Calendrier, groupes, équipes et sélections africaines restent prêts dans l’application.",
            content = "Les équipes africaines sont mises en avant avec calendrier local en secours si le backend renvoie temporairement vide.",
            imageUrl = null,
            publishedAt = null,
            source = "Base locale",
            url = "https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026"
        )
    )

    fun localNotice(): String = "Backend connecté. Données locales utilisées en secours pendant la synchronisation serveur."

    fun mediaContent(): List<ContentResult> = listOf(
        ContentResult(
            title = "Vidéos serveur en attente",
            content = "Les vidéos officielles seront affichées dès que /videos répond avec des liens confirmés.",
            reliability = Reliability.UNCONFIRMED,
            updatedAt = null,
            source = "Fallback local",
            url = null
        )
    )

    fun injuriesContent(): List<ContentResult> = emptyList()
    fun interviewsContent(): List<ContentResult> = emptyList()
    fun trainingContent(): List<ContentResult> = emptyList()

    fun matchStats(matchId: String, match: Match): MatchStats = MatchStats(
        matchId = matchId,
        categories = listOf(
            StatCategory("Statut", match.status.display, match.status.display),
            StatCategory("Groupe", match.group ?: "-", match.group ?: "-")
        )
    )

    fun lineups(matchId: String, match: Match): MatchLineups = MatchLineups(
        matchId = matchId,
        homeFormation = null,
        awayFormation = null,
        homeStarters = emptyList(),
        awayStarters = emptyList(),
        homeSubs = emptyList(),
        awaySubs = emptyList()
    )

    fun prediction(matchId: String, match: Match): Prediction = Prediction(
        matchId = matchId,
        prediction = "Pronostic IA indisponible pour le moment. Le calendrier reste affiché en secours local.",
        confidence = null,
        reliability = Reliability.UNCONFIRMED,
        updatedAt = null
    )

    fun commentary(match: Match): List<CommentaryItem> = listOf(
        CommentaryItem(0, "${match.homeTeam.name} - ${match.awayTeam.name} : informations disponibles dans le calendrier local en secours.")
    )

    private fun embeddedMatches(): List<Match> = listOf(
        m("local-66457022", "ARG", "AUT", "2026-06-22T17:00:00Z", "Groupe J", "Match 1"),
        m("local-66457010", "FRA", "IRQ", "2026-06-22T21:00:00Z", "Groupe I", "Match 2"),
        m("local-66457012", "NOR", "SEN", "2026-06-23T00:00:00Z", "Groupe I", "Match 3"),
        m("local-66457024", "JOR", "DZA", "2026-06-23T03:00:00Z", "Groupe J", "Match 4"),
        m("local-66457034", "POR", "UZB", "2026-06-23T17:00:00Z", "Groupe K", "Match 5"),
        m("local-66457046", "ENG", "GHA", "2026-06-23T20:00:00Z", "Groupe L", "Match 6"),
        m("local-66457048", "PAN", "CRO", "2026-06-23T23:00:00Z", "Groupe L", "Match 7"),
        m("local-66457036", "COL", "COD", "2026-06-24T02:00:00Z", "Groupe K", "Match 8"),
        m("local-66456924", "SUI", "CAN", "2026-06-24T19:00:00Z", "Groupe B", "Match 9"),
        m("local-66456926", "BIH", "QAT", "2026-06-24T19:00:00Z", "Groupe B", "Match 10"),
        m("local-66456936", "SCO", "BRA", "2026-06-24T22:00:00Z", "Groupe C", "Match 11"),
        m("local-66456938", "MAR", "HTI", "2026-06-24T22:00:00Z", "Groupe C", "Match 12"),
        m("local-66456912", "CZE", "MEX", "2026-06-25T01:00:00Z", "Groupe A", "Match 13"),
        m("local-66456914", "RSA", "KOR", "2026-06-25T01:00:00Z", "Groupe A", "Match 14"),
        m("local-66457078", "ECU", "GER", "2026-06-25T20:00:00Z", "Groupe E", "Match 15"),
        m("local-66457080", "CUW", "CIV", "2026-06-25T20:00:00Z", "Groupe E", "Match 16"),
        m("local-66456976", "TUN", "NED", "2026-06-25T23:00:00Z", "Groupe F", "Match 17"),
        m("local-66456978", "JPN", "SWE", "2026-06-25T23:00:00Z", "Groupe F", "Match 18"),
        m("local-66456948", "TUR", "USA", "2026-06-26T02:00:00Z", "Groupe D", "Match 19"),
        m("local-66456950", "PAR", "AUS", "2026-06-26T02:00:00Z", "Groupe D", "Match 20"),
        m("local-66457014", "NOR", "FRA", "2026-06-26T19:00:00Z", "Groupe I", "Match 21"),
        m("local-66457016", "SEN", "IRQ", "2026-06-26T19:00:00Z", "Groupe I", "Match 22"),
        m("local-66457002", "URU", "ESP", "2026-06-27T00:00:00Z", "Groupe H", "Match 23"),
        m("local-66457004", "CPV", "KSA", "2026-06-27T00:00:00Z", "Groupe H", "Match 24"),
        m("local-66456990", "NZL", "BEL", "2026-06-27T03:00:00Z", "Groupe G", "Match 25"),
        m("local-66456992", "EGY", "IRI", "2026-06-27T03:00:00Z", "Groupe G", "Match 26"),
        m("local-66457050", "PAN", "ENG", "2026-06-27T21:00:00Z", "Groupe L", "Match 27"),
        m("local-66457052", "CRO", "GHA", "2026-06-27T21:00:00Z", "Groupe L", "Match 28"),
        m("local-66457038", "COL", "POR", "2026-06-27T23:30:00Z", "Groupe K", "Match 29"),
        m("local-66457040", "COD", "UZB", "2026-06-27T23:30:00Z", "Groupe K", "Match 30"),
        m("local-66457026", "JOR", "ARG", "2026-06-28T02:00:00Z", "Groupe J", "Match 31"),
        m("local-66457028", "DZA", "AUT", "2026-06-28T02:00:00Z", "Groupe J", "Match 32")
    ).sortedBy { it.kickoff.orEmpty() }

    private fun m(id: String, homeCode: String, awayCode: String, kickoff: String, group: String, round: String): Match = Match(
        id = id,
        homeTeam = toTeam(homeCode, teamsByCode[homeCode]),
        awayTeam = toTeam(awayCode, teamsByCode[awayCode]),
        homeScore = null,
        awayScore = null,
        status = MatchStatus.SCHEDULED,
        period = MatchPeriod.UNKNOWN,
        minute = null,
        kickoff = kickoff,
        venue = "Coupe du Monde 2026",
        group = group,
        round = round
    )

    private fun embeddedStandings(): List<StandingGroup> = embeddedTeams.values
        .filter { it.group != null }
        .groupBy { it.group ?: "?" }
        .toSortedMap()
        .map { (groupName, teams) ->
            StandingGroup(
                name = "Groupe $groupName",
                entries = teams.sortedBy { it.code }.map { team ->
                    StandingEntry(
                        teamId = team.code,
                        teamName = team.name,
                        teamCode = team.code,
                        teamFlag = team.iso2,
                        played = 0,
                        won = 0,
                        drawn = 0,
                        lost = 0,
                        goalsFor = 0,
                        goalsAgainst = 0,
                        goalDifference = 0,
                        points = 0
                    )
                }
            )
        }

    private fun toTeam(code: String, local: LocalTeam?): Team = Team(
        id = code,
        name = local?.name ?: code,
        code = code,
        flag = local?.iso2,
        logo = local?.logo
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
