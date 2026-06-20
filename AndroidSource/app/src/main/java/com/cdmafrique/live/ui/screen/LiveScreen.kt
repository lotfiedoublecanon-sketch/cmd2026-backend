package com.cdmafrique.live.ui.screen

import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.LiveTv
import androidx.compose.material.icons.filled.SportsSoccer
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.cdmafrique.live.data.model.Match
import com.cdmafrique.live.data.model.MatchStatus
import com.cdmafrique.live.ui.MainViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LiveScreen(
    viewModel: MainViewModel,
    onMatchClick: (String) -> Unit
) {
    var selectedTab by remember { mutableIntStateOf(0) }
    val tabs = listOf("Direct", "Aujourd'hui", "À venir")

    val liveMatches by viewModel.liveMatches.collectAsState()
    val todayMatches by viewModel.todayMatches.collectAsState()
    val upcomingMatches by viewModel.upcomingMatches.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()

    Column(modifier = Modifier.fillMaxSize()) {
        // Tab Row
        PrimaryTabRow(
            selectedTabIndex = selectedTab,
            containerColor = MaterialTheme.colorScheme.surface,
        ) {
            tabs.forEachIndexed { index, title ->
                Tab(
                    selected = selectedTab == index,
                    onClick = { selectedTab = index },
                    text = {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            if (index == 0 && liveMatches.isNotEmpty()) {
                                PulsingDot()
                                Spacer(modifier = Modifier.width(4.dp))
                            }
                            Text(
                                text = title,
                                fontWeight = if (selectedTab == index) FontWeight.Bold else FontWeight.Normal
                            )
                        }
                    }
                )
            }
        }

        // Content
        when (selectedTab) {
            0 -> MatchList(
                matches = liveMatches,
                emptyIcon = { Icon(Icons.Default.LiveTv, contentDescription = null, modifier = Modifier.size(48.dp)) },
                emptyText = "Aucun match en direct",
                isLoading = isLoading,
                onMatchClick = onMatchClick
            )
            1 -> MatchList(
                matches = todayMatches,
                emptyIcon = { Icon(Icons.Default.SportsSoccer, contentDescription = null, modifier = Modifier.size(48.dp)) },
                emptyText = "Aucun match aujourd'hui",
                isLoading = isLoading,
                onMatchClick = onMatchClick
            )
            2 -> MatchList(
                matches = upcomingMatches,
                emptyIcon = { Icon(Icons.Default.Schedule, contentDescription = null, modifier = Modifier.size(48.dp)) },
                emptyText = "Aucun match à venir",
                isLoading = isLoading,
                onMatchClick = onMatchClick
            )
        }
    }
}

@Composable
private fun MatchList(
    matches: List<Match>,
    emptyIcon: @Composable () -> Unit,
    emptyText: String,
    isLoading: Boolean,
    onMatchClick: (String) -> Unit
) {
    if (isLoading && matches.isEmpty()) {
        Box(
            modifier = Modifier.fillMaxSize(),
            contentAlignment = Alignment.Center
        ) {
            CircularProgressIndicator()
        }
    } else if (matches.isEmpty()) {
        Box(
            modifier = Modifier.fillMaxSize(),
            contentAlignment = Alignment.Center
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                emptyIcon()
                Spacer(modifier = Modifier.height(12.dp))
                Text(
                    text = emptyText,
                    style = MaterialTheme.typography.bodyLarge,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    } else {
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(horizontal = 12.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            items(matches, key = { it.id }) { match ->
                MatchCard(match = match, onClick = { onMatchClick(match.id) })
            }
        }
    }
}

@Composable
fun MatchCard(match: Match, onClick: () -> Unit) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(12.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
        colors = CardDefaults.cardColors(
            containerColor = if (match.status.isLive)
                MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.15f)
            else
                MaterialTheme.colorScheme.surface
        )
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            // Status bar
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                StatusBadge(status = match.status, minute = match.minute)
                if (match.group != null) {
                    Text(
                        text = match.group,
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            // Teams & Score
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceEvenly,
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Home Team
                Column(
                    modifier = Modifier.weight(1f),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    TeamName(name = match.homeTeam.name, code = match.homeTeam.code)
                }

                // Score
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.Center
                ) {
                    Text(
                        text = match.homeScore?.toString() ?: "-",
                        style = MaterialTheme.typography.headlineMedium,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSurface
                    )
                    Text(
                        text = " - ",
                        style = MaterialTheme.typography.headlineMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Text(
                        text = match.awayScore?.toString() ?: "-",
                        style = MaterialTheme.typography.headlineMedium,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onSurface
                    )
                }

                // Away Team
                Column(
                    modifier = Modifier.weight(1f),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    TeamName(name = match.awayTeam.name, code = match.awayTeam.code)
                }
            }

            // Venue
            if (match.venue != null) {
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = match.venue,
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth()
                )
            }
        }
    }
}

@Composable
private fun TeamName(name: String, code: String?) {
    Text(
        text = code ?: name,
        style = MaterialTheme.typography.titleMedium,
        fontWeight = FontWeight.SemiBold,
        maxLines = 1,
        overflow = TextOverflow.Ellipsis
    )
    if (code != null) {
        Text(
            text = name,
            style = MaterialTheme.typography.labelSmall,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

@Composable
fun StatusBadge(status: MatchStatus, minute: Int?) {
    val (backgroundColor, text) = when (status) {
        MatchStatus.LIVE -> Color(0xFF4CAF50) to (minute?.let { "${it}'" } ?: "LIVE")
        MatchStatus.HALF_TIME -> Color(0xFFFF9800) to "Mi-temps"
        MatchStatus.SECOND_HALF -> Color(0xFF4CAF50) to (minute?.let { "${it}'" } ?: "2ᵉ MT")
        MatchStatus.FINISHED -> Color(0xFF9E9E9E) to "Terminé"
        MatchStatus.SCHEDULED -> Color(0xFF42A5F5) to "Programmé"
        MatchStatus.POSTPONED -> Color(0xFFFF9800) to "Reporté"
        MatchStatus.CANCELLED -> Color(0xFFD32F2F) to "Annulé"
        MatchStatus.SUSPENDED -> Color(0xFFFF9800) to "Suspendu"
        MatchStatus.UNKNOWN -> Color(0xFF9E9E9E) to "—"
    }

    Surface(
        shape = RoundedCornerShape(4.dp),
        color = backgroundColor.copy(alpha = 0.15f)
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            if (status.isLive) {
                PulsingDot(color = backgroundColor)
                Spacer(modifier = Modifier.width(4.dp))
            }
            Text(
                text = text,
                style = MaterialTheme.typography.labelMedium,
                fontWeight = FontWeight.Bold,
                color = backgroundColor
            )
        }
    }
}

@Composable
fun PulsingDot(color: Color = Color.Red) {
    val infiniteTransition = rememberInfiniteTransition(label = "pulse")
    val alpha by infiniteTransition.animateFloat(
        initialValue = 0.3f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(800, easing = LinearEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "alpha"
    )

    Box(
        modifier = Modifier
            .size(8.dp)
            .clip(CircleShape)
            .background(color.copy(alpha = alpha))
    )
}
