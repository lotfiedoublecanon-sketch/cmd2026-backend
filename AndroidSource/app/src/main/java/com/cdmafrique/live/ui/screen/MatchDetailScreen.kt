package com.cdmafrique.live.ui.screen

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.cdmafrique.live.data.model.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MatchDetailScreen(
    viewModel: com.cdmafrique.live.ui.MainViewModel,
    onBack: () -> Unit
) {
    val match by viewModel.selectedMatch.collectAsState()
    val events by viewModel.matchEvents.collectAsState()
    val stats by viewModel.matchStats.collectAsState()
    val lineups by viewModel.matchLineups.collectAsState()
    val analysis by viewModel.analysis.collectAsState()
    val prediction by viewModel.prediction.collectAsState()
    val mediaContent by viewModel.mediaContent.collectAsState()
    val injuriesContent by viewModel.injuriesContent.collectAsState()
    val interviewsContent by viewModel.interviewsContent.collectAsState()
    val trainingContent by viewModel.trainingContent.collectAsState()

    val tabs = listOf("Résumé", "Events", "Stats", "Compo", "Médias", "Blessures", "Interviews", "Entraînements")
    var selectedTab by remember { mutableIntStateOf(0) }

    if (match == null) {
        Box(
            modifier = Modifier.fillMaxSize(),
            contentAlignment = Alignment.Center
        ) {
            CircularProgressIndicator()
        }
        return
    }

    Column(modifier = Modifier.fillMaxSize()) {
        // Back button + Match header
        TopAppBar(
            title = {
                Text(
                    "${match!!.homeTeam.code ?: match!!.homeTeam.name} vs ${match!!.awayTeam.code ?: match!!.awayTeam.name}",
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            },
            navigationIcon = {
                TextButton(onClick = onBack) {
                    Text("← Retour")
                }
            }
        )

        // Score Header
        ScoreHeader(match!!)

        // Tabs
        ScrollableTabRow(
            selectedTabIndex = selectedTab,
            edgePadding = 8.dp,
            containerColor = MaterialTheme.colorScheme.surface,
        ) {
            tabs.forEachIndexed { index, title ->
                Tab(
                    selected = selectedTab == index,
                    onClick = { selectedTab = index },
                    text = {
                        Text(
                            text = title,
                            fontSize = 12.sp,
                            fontWeight = if (selectedTab == index) FontWeight.Bold else FontWeight.Normal
                        )
                    }
                )
            }
        }

        // Tab content
        when (selectedTab) {
            0 -> ResumeTab(match!!, analysis, prediction)
            1 -> EventsTab(events)
            2 -> StatsTab(stats)
            3 -> CompoTab(lineups)
            4 -> ContentTab("Médias", mediaContent)
            5 -> ContentTab("Blessures", injuriesContent)
            6 -> ContentTab("Interviews", interviewsContent)
            7 -> ContentTab("Entraînements", trainingContent)
        }
    }
}

@Composable
private fun ScoreHeader(match: Match) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp, vertical = 4.dp),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.2f))
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            StatusBadge(status = match.status, minute = match.minute)
            Spacer(modifier = Modifier.height(8.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceEvenly,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(
                    modifier = Modifier.weight(1f),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(
                        text = match.homeTeam.code ?: match.homeTeam.name,
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = match.homeTeam.name,
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }

                Row(
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = match.homeScore?.toString() ?: "-",
                        style = MaterialTheme.typography.displayMedium,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = " - ",
                        style = MaterialTheme.typography.displayMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Text(
                        text = match.awayScore?.toString() ?: "-",
                        style = MaterialTheme.typography.displayMedium,
                        fontWeight = FontWeight.Bold
                    )
                }

                Column(
                    modifier = Modifier.weight(1f),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(
                        text = match.awayTeam.code ?: match.awayTeam.name,
                        style = MaterialTheme.typography.titleLarge,
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        text = match.awayTeam.name,
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            if (match.period != MatchPeriod.UNKNOWN && match.period != MatchPeriod.PRE_MATCH) {
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = match.period.display,
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.primary
                )
            }

            if (match.venue != null) {
                Text(
                    text = match.venue,
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

// ── Résumé Tab ──────────────────────────────────────────────

@Composable
private fun ResumeTab(
    match: Match,
    analysis: Analysis?,
    prediction: Prediction?
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(12.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        // Quick actions
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                if (analysis != null) {
                    AssistChip(
                        onClick = { },
                        label = { Text("Analyse") },
                        leadingIcon = { Text("📊") }
                    )
                }
                if (prediction != null) {
                    AssistChip(
                        onClick = { },
                        label = { Text("Pronostic") },
                        leadingIcon = { Text("🎯") }
                    )
                }
            }
        }

        // Analysis
        if (analysis != null) {
            item {
                ContentCard(
                    title = "Analyse du match",
                    content = analysis.content,
                    reliability = analysis.reliability,
                    updatedAt = analysis.updatedAt
                )
            }
        }

        // Prediction
        if (prediction != null) {
            item {
                ContentCard(
                    title = "Pronostic",
                    content = buildString {
                        append(prediction.prediction)
                        prediction.confidence?.let { c ->
                            append("\n\nConfiance : ${"%.0f".format(c * 100)}%")
                        }
                    },
                    reliability = prediction.reliability,
                    updatedAt = prediction.updatedAt
                )
            }
        }

        // Match info
        item {
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(8.dp)
            ) {
                Column(modifier = Modifier.padding(12.dp)) {
                    Text("Informations", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
                    Spacer(modifier = Modifier.height(4.dp))
                    if (match.group != null) InfoRow("Groupe", match.group)
                    if (match.round != null) InfoRow("Tour", match.round)
                    if (match.venue != null) InfoRow("Stade", match.venue)
                    if (match.kickoff != null) InfoRow("Coup d'envoi", match.kickoff)
                }
            }
        }
    }
}

@Composable
private fun InfoRow(label: String, value: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 2.dp),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(text = label, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(text = value, style = MaterialTheme.typography.bodySmall, fontWeight = FontWeight.Medium)
    }
}

// ── Events Tab ──────────────────────────────────────────────

@Composable
private fun EventsTab(events: List<MatchEvent>) {
    if (events.isEmpty()) {
        EmptyContent("Aucun événement")
        return
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(12.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp)
    ) {
        items(events, key = { it.id }) { event ->
            EventRow(event)
        }
    }
}

@Composable
private fun EventRow(event: MatchEvent) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        // Minute
        Text(
            text = "${event.minute}'",
            style = MaterialTheme.typography.labelMedium,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.primary,
            modifier = Modifier.width(36.dp)
        )

        // Emoji
        Text(
            text = event.type.emoji,
            style = MaterialTheme.typography.bodyLarge,
            modifier = Modifier.width(28.dp)
        )

        // Details
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = buildString {
                    append(event.playerName ?: event.type.display)
                    if (event.player2Name != null) append(" → ${event.player2Name}")
                },
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.Medium
            )
            if (event.teamName != null) {
                Text(
                    text = event.teamName,
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            if (event.detail != null) {
                Text(
                    text = event.detail,
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

// ── Stats Tab ───────────────────────────────────────────────

@Composable
private fun StatsTab(stats: MatchStats?) {
    if (stats == null || stats.categories.isEmpty()) {
        EmptyContent("Statistiques indisponibles")
        return
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(12.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        items(stats.categories) { category ->
            StatBar(category)
        }
    }
}

@Composable
private fun StatBar(category: StatCategory) {
    val homeVal = category.homeValue.toFloatOrNull() ?: 0f
    val awayVal = category.awayValue.toFloatOrNull() ?: 0f
    val total = homeVal + awayVal
    val homeRatio = if (total > 0f) homeVal / total else 0.5f

    Column(modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Text(
                text = category.homeValue,
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.primary
            )
            Text(
                text = category.name,
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            Text(
                text = category.awayValue,
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.tertiary
            )
        }

        Spacer(modifier = Modifier.height(4.dp))

        Row(
            modifier = Modifier
                .fillMaxWidth()
                .height(6.dp)
        ) {
            Box(
                modifier = Modifier
                    .weight(homeRatio.coerceIn(0.05f, 0.95f))
                    .fillMaxHeight()
                    .background(
                        MaterialTheme.colorScheme.primary,
                        RoundedCornerShape(topStart = 3.dp, bottomStart = 3.dp)
                    )
            )
            Spacer(modifier = Modifier.width(2.dp))
            Box(
                modifier = Modifier
                    .weight((1f - homeRatio).coerceIn(0.05f, 0.95f))
                    .fillMaxHeight()
                    .background(
                        MaterialTheme.colorScheme.tertiary,
                        RoundedCornerShape(topEnd = 3.dp, bottomEnd = 3.dp)
                    )
            )
        }
    }
}

// ── Compo Tab ───────────────────────────────────────────────

@Composable
private fun CompoTab(lineups: MatchLineups?) {
    if (lineups == null) {
        EmptyContent("Compositions indisponibles")
        return
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(12.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        // Formations
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceEvenly
            ) {
                lineups.homeFormation?.let {
                    Text(
                        text = it,
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.primary
                    )
                }
                Text("vs", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                lineups.awayFormation?.let {
                    Text(
                        text = it,
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.tertiary
                    )
                }
            }
        }

        // Starters side by side
        item {
            Text(
                "Titulaires",
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.padding(vertical = 4.dp)
            )
        }

        val maxStarters = maxOf(lineups.homeStarters.size, lineups.awayStarters.size)
        items(maxStarters) { index ->
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                // Home player
                Box(modifier = Modifier.weight(1f)) {
                    if (index < lineups.homeStarters.size) {
                        PlayerRow(lineups.homeStarters[index])
                    }
                }
                // Away player
                Box(modifier = Modifier.weight(1f)) {
                    if (index < lineups.awayStarters.size) {
                        PlayerRow(lineups.awayStarters[index], alignEnd = true)
                    }
                }
            }
        }

        // Substitutes
        item {
            Text(
                "Remplaçants",
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.padding(vertical = 4.dp)
            )
        }

        val maxSubs = maxOf(lineups.homeSubs.size, lineups.awaySubs.size)
        items(maxSubs) { index ->
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Box(modifier = Modifier.weight(1f)) {
                    if (index < lineups.homeSubs.size) {
                        PlayerRow(lineups.homeSubs[index])
                    }
                }
                Box(modifier = Modifier.weight(1f)) {
                    if (index < lineups.awaySubs.size) {
                        PlayerRow(lineups.awaySubs[index], alignEnd = true)
                    }
                }
            }
        }
    }
}

@Composable
private fun PlayerRow(player: LineupPlayer, alignEnd: Boolean = false) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = if (alignEnd) Arrangement.End else Arrangement.Start,
        modifier = Modifier.fillMaxWidth().padding(vertical = 2.dp)
    ) {
        if (!alignEnd) {
            player.number?.let {
                Text(
                    text = "$it",
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.width(24.dp)
                )
            }
        }
        Text(
            text = player.name,
            style = MaterialTheme.typography.bodySmall,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis
        )
        if (alignEnd) {
            player.number?.let {
                Text(
                    text = "$it",
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.tertiary,
                    modifier = Modifier.width(24.dp)
                )
            }
        }
    }
}

// ── Content Tab (Médias, Blessures, Interviews, Entraînements) ──

@Composable
private fun ContentTab(title: String, items: List<ContentResult>) {
    if (items.isEmpty()) {
        EmptyContent("Aucun contenu $title disponible")
        return
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(12.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        items(items) { item ->
            ContentCard(
                title = item.title,
                content = item.content,
                reliability = item.reliability,
                updatedAt = item.updatedAt,
                source = item.source
            )
        }
    }
}

@Composable
fun ContentCard(
    title: String,
    content: String,
    reliability: Reliability,
    updatedAt: String?,
    source: String? = null
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(8.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp)
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = title,
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.weight(1f)
                )
                ReliabilityBadge(reliability)
            }

            Spacer(modifier = Modifier.height(8.dp))

            Text(
                text = content,
                style = MaterialTheme.typography.bodyMedium
            )

            if (updatedAt != null || source != null) {
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = buildString {
                        source?.let { append(it) }
                        if (source != null && updatedAt != null) append(" · ")
                        updatedAt?.let { append(it) }
                    },
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

@Composable
fun ReliabilityBadge(reliability: Reliability) {
    val (color, text) = when (reliability) {
        Reliability.OFFICIAL -> Color(0xFF4CAF50) to "Source officielle"
        Reliability.RELIABLE -> Color(0xFFFF9800) to "Info fiable"
        Reliability.UNCONFIRMED -> Color(0xFF9E9E9E) to "À confirmer"
    }

    Surface(
        shape = RoundedCornerShape(4.dp),
        color = color.copy(alpha = 0.12f)
    ) {
        Text(
            text = text,
            style = MaterialTheme.typography.labelSmall,
            color = color,
            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
        )
    }
}

@Composable
private fun EmptyContent(message: String) {
    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = message,
            style = MaterialTheme.typography.bodyLarge,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}
