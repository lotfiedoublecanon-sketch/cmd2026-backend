package com.cdmafrique.live.data.model

import com.cdmafrique.live.data.api.*

// ── Team ────────────────────────────────────────────────────

data class Team(
    val id: String,
    val name: String,
    val code: String?,
    val flag: String?,
    val logo: String?
)

// ── Match ───────────────────────────────────────────────────

enum class MatchStatus(val key: String, val display: String) {
    SCHEDULED("SCHEDULED", "Programmé"),
    LIVE("LIVE", "En direct"),
    HALF_TIME("HALF_TIME", "Mi-temps"),
    SECOND_HALF("SECOND_HALF", "2ᵉ mi-temps"),
    FINISHED("FINISHED", "Terminé"),
    POSTPONED("POSTPONED", "Reporté"),
    CANCELLED("CANCELLED", "Annulé"),
    SUSPENDED("SUSPENDED", "Suspendu"),
    UNKNOWN("UNKNOWN", "—");

    companion object {
        fun fromKey(key: String): MatchStatus = when (key.lowercase()) {
            "live", "in_progress", "inprogress", "1st_half", "2nd_half" -> LIVE
            "halftime", "half_time", "ht" -> HALF_TIME
            "finished", "full_time", "ft" -> FINISHED
            "scheduled", "pre_match", "not_started", "upcoming" -> SCHEDULED
            "postponed" -> POSTPONED
            "cancelled", "canceled" -> CANCELLED
            "suspended" -> SUSPENDED
            else -> entries.find { it.key.equals(key, ignoreCase = true) } ?: UNKNOWN
        }
    }

    val isLive: Boolean get() = this == LIVE || this == HALF_TIME || this == SECOND_HALF
}

enum class MatchPeriod(val display: String) {
    PRE_MATCH("Avant-match"),
    FIRST_HALF("1ʳᵉ mi-temps"),
    HALF_TIME("Mi-temps"),
    SECOND_HALF("2ᵉ mi-temps"),
    EXTRA_TIME("Prolongations"),
    PENALTY_SHOOTOUT("Tirs au but"),
    FULL_TIME("Fin du match"),
    UNKNOWN("—");

    companion object {
        fun fromKey(key: String?): MatchPeriod = when (key?.lowercase()) {
            "pre_match" -> PRE_MATCH
            "1st_half", "first_half" -> FIRST_HALF
            "halftime", "half_time", "ht" -> HALF_TIME
            "2nd_half", "second_half" -> SECOND_HALF
            "extra_time", "extra_time_1", "extra_time_2" -> EXTRA_TIME
            "penalty_shootout", "penalties" -> PENALTY_SHOOTOUT
            "full_time", "finished", "ft" -> FULL_TIME
            else -> entries.find { it.name.equals(key, ignoreCase = true) } ?: UNKNOWN
        }
    }
}

data class Match(
    val id: String,
    val homeTeam: Team,
    val awayTeam: Team,
    val homeScore: Int?,
    val awayScore: Int?,
    val status: MatchStatus,
    val period: MatchPeriod,
    val minute: Int?,
    val kickoff: String?,
    val venue: String?,
    val group: String?,
    val round: String?
)

// ── Events ──────────────────────────────────────────────────

enum class EventType(val key: String, val emoji: String, val display: String) {
    GOAL("GOAL", "⚽", "But"),
    OWN_GOAL("OWN_GOAL", "⚽", "CSC"),
    PENALTY("PENALTY", "⚽", "Penalty"),
    PENALTY_MISSED("PENALTY_MISSED", "❌", "Penalty raté"),
    YELLOW_CARD("YELLOW_CARD", "🟨", "Carton jaune"),
    RED_CARD("RED_CARD", "🟥", "Carton rouge"),
    SECOND_YELLOW("SECOND_YELLOW", "🟨🟥", "2ᵉ jaune"),
    SUBSTITUTION("SUBSTITUTION", "🔄", "Remplacement"),
    VAR("VAR", "📺", "VAR"),
    PERIOD_START("PERIOD_START", "▶️", "Début"),
    PERIOD_END("PERIOD_END", "⏹️", "Fin"),
    UNKNOWN("UNKNOWN", "•", "Événement");

    companion object {
        fun fromKey(key: String): EventType = when (key.lowercase()) {
            "goal" -> GOAL
            "own_goal" -> OWN_GOAL
            "penalty_goal", "penalty" -> PENALTY
            "penalty_missed" -> PENALTY_MISSED
            "yellow_card" -> YELLOW_CARD
            "red_card" -> RED_CARD
            "second_yellow_card", "second_yellow" -> SECOND_YELLOW
            "substitution" -> SUBSTITUTION
            "var_decision", "var" -> VAR
            "period_start" -> PERIOD_START
            "period_end" -> PERIOD_END
            else -> entries.find { it.key.equals(key, ignoreCase = true) } ?: UNKNOWN
        }
    }
}

data class MatchEvent(
    val id: String,
    val matchId: String,
    val type: EventType,
    val minute: Int,
    val teamId: String?,
    val teamName: String?,
    val playerName: String?,
    val player2Name: String?,
    val detail: String?
)

// ── Stats ───────────────────────────────────────────────────

data class MatchStats(
    val matchId: String,
    val categories: List<StatCategory>
)

data class StatCategory(
    val name: String,
    val homeValue: String,
    val awayValue: String
)

// ── Lineups ─────────────────────────────────────────────────

data class MatchLineups(
    val matchId: String,
    val homeFormation: String?,
    val awayFormation: String?,
    val homeStarters: List<LineupPlayer>,
    val awayStarters: List<LineupPlayer>,
    val homeSubs: List<LineupPlayer>,
    val awaySubs: List<LineupPlayer>
)

data class LineupPlayer(
    val id: String,
    val name: String,
    val number: Int?,
    val position: String?,
    val flag: String?
)

// ── Standings ───────────────────────────────────────────────

data class StandingGroup(
    val name: String,
    val entries: List<StandingEntry>
)

data class StandingEntry(
    val teamId: String,
    val teamName: String,
    val teamCode: String?,
    val teamFlag: String?,
    val played: Int,
    val won: Int,
    val drawn: Int,
    val lost: Int,
    val goalsFor: Int,
    val goalsAgainst: Int,
    val goalDifference: Int,
    val points: Int
)

// ── Content (Médias, Blessures, Interviews, Entraînements) ──

enum class Reliability(val key: String, val display: String) {
    OFFICIAL("official", "Source officielle"),
    RELIABLE("reliable", "Info fiable"),
    UNCONFIRMED("unconfirmed", "À confirmer");

    companion object {
        fun fromKey(key: String): Reliability =
            entries.find { it.key.equals(key, ignoreCase = true) } ?: UNCONFIRMED
    }
}

data class ContentResult(
    val title: String,
    val content: String,
    val reliability: Reliability,
    val updatedAt: String?,
    val source: String?
)

// ── Analysis / Prediction ───────────────────────────────────

data class Analysis(
    val matchId: String,
    val content: String,
    val reliability: Reliability,
    val updatedAt: String?
)

data class Prediction(
    val matchId: String,
    val prediction: String,
    val confidence: Double?,
    val reliability: Reliability,
    val updatedAt: String?
)

data class CommentaryItem(
    val minute: Int,
    val text: String
)

// ── Diagnostic ──────────────────────────────────────────────

data class AppDiagnostic(
    val backendStatus: String,
    val backendUptime: Double?,
    val backendVersion: String?,
    val apiCallCount: Int,
    val lastError: String?,
    val appVersion: String,
    val routes: List<RouteDiagnostic> = emptyList()
)

data class RouteDiagnostic(
    val path: String,
    val ok: Boolean,
    val httpCode: Int?,
    val itemCount: Int,
    val sourceUsed: String,
    val message: String? = null
)

// ── Article ─────────────────────────────────────────────────

data class Article(
    val id: String,
    val title: String,
    val summary: String?,
    val content: String?,
    val imageUrl: String?,
    val publishedAt: String?,
    val source: String?
)

// ═══════════════════════════════════════════════════════════
// DTO → Domain Mappers
// ═══════════════════════════════════════════════════════════

fun TeamDto.toDomain() = Team(
    id = id,
    name = name,
    code = code,
    flag = flag,
    logo = logo
)

fun MatchDto.toDomain() = Match(
    id = id,
    homeTeam = homeTeam.toDomain(),
    awayTeam = awayTeam.toDomain(),
    homeScore = homeScore,
    awayScore = awayScore,
    status = MatchStatus.fromKey(status),
    period = MatchPeriod.fromKey(period),
    minute = minute,
    kickoff = kickoff,
    venue = venue,
    group = group,
    round = round
)

fun MatchEventDto.toDomain() = MatchEvent(
    id = id,
    matchId = matchId,
    type = EventType.fromKey(type),
    minute = minute,
    teamId = teamId,
    teamName = teamName,
    playerName = playerName,
    player2Name = player2Name,
    detail = detail
)

fun StatCategoryDto.toDomain() = StatCategory(
    name = name,
    homeValue = homeValue,
    awayValue = awayValue
)

fun MatchStatsDto.toDomain() = MatchStats(
    matchId = matchId,
    categories = categories.map { it.toDomain() }
)

fun LineupPlayerDto.toDomain() = LineupPlayer(
    id = id,
    name = name,
    number = number,
    position = position,
    flag = flag
)

fun MatchLineupsDto.toDomain() = MatchLineups(
    matchId = matchId,
    homeFormation = homeFormation,
    awayFormation = awayFormation,
    homeStarters = homeStarters.map { it.toDomain() },
    awayStarters = awayStarters.map { it.toDomain() },
    homeSubs = homeSubs.map { it.toDomain() },
    awaySubs = awaySubs.map { it.toDomain() }
)

fun StandingEntryDto.toDomain() = StandingEntry(
    teamId = teamId,
    teamName = teamName,
    teamCode = teamCode,
    teamFlag = teamFlag,
    played = played,
    won = won,
    drawn = drawn,
    lost = lost,
    goalsFor = goalsFor,
    goalsAgainst = goalsAgainst,
    goalDifference = goalDifference,
    points = points
)

fun StandingGroupDto.toDomain() = StandingGroup(
    name = name,
    entries = entries.map { it.toDomain() }
)

fun ContentResultDto.toDomain() = ContentResult(
    title = title.ifBlank { source ?: "Information" },
    content = content ?: summary ?: url ?: "Aucune donnée source disponible pour le moment",
    reliability = Reliability.fromKey(reliability ?: if ((confidence ?: 0.0) >= 0.8) "reliable" else "unconfirmed"),
    updatedAt = updatedAt,
    source = source ?: sourceType
)

fun AnalysisDto.toDomain() = Analysis(
    matchId = matchId,
    content = content,
    reliability = Reliability.fromKey(reliability),
    updatedAt = updatedAt
)

fun PredictionDto.toDomain() = Prediction(
    matchId = matchId,
    prediction = prediction,
    confidence = confidence,
    reliability = Reliability.fromKey(reliability),
    updatedAt = updatedAt
)

fun CommentaryItemDto.toDomain() = CommentaryItem(
    minute = minute,
    text = text
)

fun ArticleDto.toDomain() = Article(
    id = id.ifBlank { "${source.orEmpty()}-${title.hashCode()}" },
    title = title.ifBlank { source ?: "Actualité" },
    summary = summary,
    content = content ?: summary ?: url,
    imageUrl = imageUrl,
    publishedAt = publishedAt,
    source = source ?: sourceType
)
