package com.cdmafrique.live.data.api

import com.google.gson.annotations.SerializedName
import com.google.gson.reflect.TypeToken

// ── Match DTOs ──────────────────────────────────────────────

data class MatchDto(
    val id: String,
    val homeTeam: TeamDto,
    val awayTeam: TeamDto,
    val homeScore: Int? = null,
    val awayScore: Int? = null,
    val status: String = "SCHEDULED",
    val period: String? = null,
    val minute: Int? = null,
    @SerializedName(value = "kickoff", alternate = ["startDateTimeUtc"])
    val kickoff: String? = null,
    val venue: String? = null,
    val group: String? = null,
    val round: String? = null
)

data class TeamDto(
    val id: String,
    val name: String,
    @SerializedName(value = "code", alternate = ["threeCharCode", "shortName"])
    val code: String? = null,
    val flag: String? = null,
    @SerializedName(value = "logo", alternate = ["logoUrl"])
    val logo: String? = null
)

// ── Events DTOs ─────────────────────────────────────────────

data class MatchEventDto(
    val id: String,
    val matchId: String,
    val type: String,
    val minute: Int,
    val teamId: String? = null,
    @SerializedName(value = "teamName", alternate = ["team"])
    val teamName: String? = null,
    val playerName: String? = null,
    @SerializedName(value = "player2Name", alternate = ["assistPlayerName"])
    val player2Name: String? = null,
    @SerializedName(value = "detail", alternate = ["description"])
    val detail: String? = null
)

// ── Stats DTOs ──────────────────────────────────────────────

data class MatchStatsDto(
    val matchId: String,
    @SerializedName(value = "categories", alternate = ["stats"])
    val categories: List<StatCategoryDto> = emptyList()
)

data class StatCategoryDto(
    val name: String,
    @SerializedName(value = "homeValue", alternate = ["home"])
    val homeValue: String,
    @SerializedName(value = "awayValue", alternate = ["away"])
    val awayValue: String
)

// ── Lineups DTOs ────────────────────────────────────────────

data class MatchLineupsDto(
    val matchId: String,
    val homeFormation: String? = null,
    val awayFormation: String? = null,
    @SerializedName(value = "homeStarters", alternate = ["homePlayers"])
    val homeStarters: List<LineupPlayerDto> = emptyList(),
    @SerializedName(value = "awayStarters", alternate = ["awayPlayers"])
    val awayStarters: List<LineupPlayerDto> = emptyList(),
    val homeSubs: List<LineupPlayerDto> = emptyList(),
    val awaySubs: List<LineupPlayerDto> = emptyList()
)

data class LineupPlayerDto(
    val id: String,
    val name: String,
    @SerializedName(value = "number", alternate = ["shirtNumber"])
    val number: Int? = null,
    val position: String? = null,
    val flag: String? = null
)

// ── Standings DTOs ──────────────────────────────────────────

data class StandingsDto(
    val groups: List<StandingGroupDto> = emptyList()
)

data class StandingGroupDto(
    val name: String = "Groupes",
    val entries: List<StandingEntryDto> = emptyList()
)

data class StandingEntryDto(
    val teamId: String,
    val teamName: String,
    val teamCode: String? = null,
    val teamFlag: String? = null,
    val played: Int,
    val won: Int,
    val drawn: Int,
    val lost: Int,
    val goalsFor: Int,
    val goalsAgainst: Int,
    val goalDifference: Int,
    val points: Int
)

// ── Content DTOs (Media, Injuries, Interviews, Training) ────

data class ContentResultDto(
    val id: String? = null,
    val title: String = "",
    @SerializedName(value = "content", alternate = ["description"])
    val content: String? = null,
    val summary: String? = null,
    @SerializedName(value = "url", alternate = ["link", "sourceUrl", "source_url", "canonicalUrl"])
    val url: String? = null,
    val reliability: String? = null,
    @SerializedName(value = "updatedAt", alternate = ["publishedAt"])
    val updatedAt: String? = null,
    val source: String? = null,
    val sourceType: String? = null,
    val category: String? = null,
    val confidence: Double? = null,
    val language: String? = null
)

data class ContentListDto(
    val items: List<ContentResultDto> = emptyList()
)

// ── Analysis / Prediction DTOs ──────────────────────────────

data class AnalysisDto(
    val matchId: String,
    val content: String,
    val reliability: String = "unconfirmed",
    val updatedAt: String? = null
)

data class PredictionDto(
    val matchId: String,
    val prediction: String,
    val confidence: Double? = null,
    val reliability: String = "unconfirmed",
    val updatedAt: String? = null
)

data class CommentaryDto(
    val matchId: String,
    val items: List<CommentaryItemDto> = emptyList()
)

data class CommentaryItemDto(
    val minute: Int,
    val text: String
)

// ── Health / Diagnostic DTOs ────────────────────────────────
//
// Corrigé pour correspondre au /diagnostic du backend Render :
// {
//   status, service, version, timestamp, uptime, port, env,
//   checks: { fapiConfigured, sportDbConfigured, geminiConfigured,
//             firebaseConfigured, agentsConfigured: [...] },
//   routes: [...]
// }
// Les champs optionnels ne crashent pas si absents.

data class HealthDto(
    val status: String,
    val service: String? = null,
    val uptime: Double? = null,
    val version: String? = null,
    val timestamp: String? = null,
    val env: String? = null,
    val checks: DiagnosticChecksDto? = null
)

data class DiagnosticChecksDto(
    val fapiConfigured: Boolean? = null,
    val sportDbConfigured: Boolean? = null,
    val geminiConfigured: Boolean? = null,
    val firebaseConfigured: Boolean? = null,
    val agentsConfigured: List<String>? = null
)

// ── FCM ─────────────────────────────────────────────────────

data class FcmTokenDto(
    val token: String,
    val platform: String = "android"
)

// ── Generic API response ────────────────────────────────────

data class ApiResponseDto<T>(
    val success: Boolean,
    val data: T? = null,
    val error: String? = null
)

// ── Articles DTOs ───────────────────────────────────────────

data class ArticleDto(
    val id: String = "",
    val title: String = "",
    val summary: String? = null,
    val content: String? = null,
    @SerializedName(value = "url", alternate = ["link", "sourceUrl", "source_url", "canonicalUrl"])
    val url: String? = null,
    val imageUrl: String? = null,
    val publishedAt: String? = null,
    val source: String? = null,
    val sourceType: String? = null,
    val category: String? = null,
    val confidence: Double? = null,
    val language: String? = null
)

data class ArticleListDto(
    val items: List<ArticleDto> = emptyList()
)
