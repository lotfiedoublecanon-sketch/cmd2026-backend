package com.cdmafrique.live

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.lifecycle.ViewModelProvider
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Article
import androidx.compose.material.icons.rounded.Build
import androidx.compose.material.icons.rounded.CalendarMonth
import androidx.compose.material.icons.rounded.FitnessCenter
import androidx.compose.material.icons.rounded.HealthAndSafety
import androidx.compose.material.icons.rounded.Home
import androidx.compose.material.icons.rounded.LiveTv
import androidx.compose.material.icons.rounded.Mic
import androidx.compose.material.icons.rounded.MoreHoriz
import androidx.compose.material.icons.rounded.Notifications
import androidx.compose.material.icons.rounded.OndemandVideo
import androidx.compose.material.icons.rounded.Public
import androidx.compose.material.icons.rounded.Refresh
import androidx.compose.material.icons.rounded.Settings
import androidx.compose.material.icons.rounded.SportsSoccer
import androidx.compose.material.icons.rounded.TableChart
import androidx.compose.material.icons.rounded.Widgets
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.cdmafrique.live.data.model.Analysis
import com.cdmafrique.live.data.model.AppDiagnostic
import com.cdmafrique.live.data.model.Article
import com.cdmafrique.live.data.model.ContentResult
import com.cdmafrique.live.data.model.Match
import com.cdmafrique.live.data.model.MatchEvent
import com.cdmafrique.live.data.model.MatchLineups
import com.cdmafrique.live.data.model.MatchStats
import com.cdmafrique.live.data.model.MatchStatus
import com.cdmafrique.live.data.model.Prediction
import com.cdmafrique.live.data.model.StandingGroup
import com.cdmafrique.live.ui.MainViewModel
import com.cdmafrique.live.ui.theme.AfriqueGold
import com.cdmafrique.live.ui.theme.AfriqueGreen
import com.cdmafrique.live.ui.theme.AfriqueInk
import com.cdmafrique.live.ui.theme.AfriqueLine
import com.cdmafrique.live.ui.theme.AfriqueMuted
import com.cdmafrique.live.ui.theme.AfriqueRed
import com.cdmafrique.live.ui.theme.AfriqueSoft
import com.cdmafrique.live.ui.theme.AfriqueTeal
import com.cdmafrique.live.ui.theme.CDM2026LiveTheme
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

private enum class AppScreen(val label: String, val icon: ImageVector) {
    Home("Accueil", Icons.Rounded.Home),
    Live("Direct", Icons.Rounded.LiveTv),
    Calendar("Calendrier", Icons.Rounded.CalendarMonth),
    Africa("Afrique", Icons.Rounded.Public),
    More("Plus", Icons.Rounded.MoreHoriz),
    Match("Match", Icons.Rounded.SportsSoccer),
    Standings("Classements", Icons.Rounded.TableChart),
    News("Actualites", Icons.Rounded.Article),
    Videos("Videos", Icons.Rounded.OndemandVideo),
    Interviews("Interviews", Icons.Rounded.Mic),
    Injuries("Blessures", Icons.Rounded.HealthAndSafety),
    Training("Entrainements", Icons.Rounded.FitnessCenter),
    Notifications("Notifications", Icons.Rounded.Notifications),
    Diagnostic("Diagnostic", Icons.Rounded.Build),
    Widget("Widget", Icons.Rounded.Widgets),
    Settings("Parametres", Icons.Rounded.Settings)
}

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        requestNotificationPermissionIfNeeded()
        val viewModel = ViewModelProvider(this)[MainViewModel::class.java]

        setContent {
            CDM2026LiveTheme {
                CdmV5App(viewModel)
            }
        }
    }

    private fun requestNotificationPermissionIfNeeded() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return
        val permission = Manifest.permission.POST_NOTIFICATIONS
        if (ContextCompat.checkSelfPermission(this, permission) == PackageManager.PERMISSION_GRANTED) return
        ActivityCompat.requestPermissions(this, arrayOf(permission), NOTIFICATION_PERMISSION_REQUEST_CODE)
    }

    companion object {
        private const val NOTIFICATION_PERMISSION_REQUEST_CODE = 2026
    }
}

@Composable
private fun CdmV5App(viewModel: MainViewModel) {
    var currentScreen by remember { mutableStateOf(AppScreen.Home) }
    val bottomScreens = listOf(AppScreen.Home, AppScreen.Live, AppScreen.Calendar, AppScreen.Africa, AppScreen.More)

    Scaffold(
        containerColor = AfriqueSoft,
        topBar = {
            AppHeader(
                title = currentScreen.label,
                onRefresh = {
                    viewModel.refreshAll()
                    viewModel.loadDiagnostic()
                    viewModel.loadArticles()
                    viewModel.loadStandings()
                }
            )
        },
        bottomBar = {
            NavigationBar(containerColor = Color.White) {
                bottomScreens.forEach { screen ->
                    NavigationBarItem(
                        selected = when (screen) {
                            AppScreen.More -> currentScreen !in listOf(
                                AppScreen.Home,
                                AppScreen.Live,
                                AppScreen.Calendar,
                                AppScreen.Africa,
                                AppScreen.Match
                            )
                            else -> currentScreen == screen
                        },
                        onClick = { currentScreen = screen },
                        icon = { Icon(screen.icon, contentDescription = screen.label) },
                        label = { Text(screen.label, maxLines = 1) }
                    )
                }
            }
        }
    ) { padding ->
        AppBody(
            viewModel = viewModel,
            screen = currentScreen,
            padding = padding,
            navigate = { currentScreen = it }
        )
    }
}

@Composable
private fun AppHeader(title: String, onRefresh: () -> Unit) {
    Surface(color = AfriqueGreen, shadowElevation = 3.dp) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Image(
                painter = painterResource(id = R.drawable.logo_cdm2026),
                contentDescription = "CDM 2026 Live",
                modifier = Modifier
                    .size(44.dp)
                    .clip(RoundedCornerShape(8.dp))
                    .background(Color.White),
                contentScale = ContentScale.Fit
            )
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = "CDM 2026 Live",
                    color = Color.White,
                    style = MaterialTheme.typography.titleLarge,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Text(
                    text = "V5 by Redha - $title",
                    color = Color.White.copy(alpha = 0.78f),
                    style = MaterialTheme.typography.labelLarge,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }
            IconButton(onClick = onRefresh) {
                Icon(Icons.Rounded.Refresh, contentDescription = "Rafraichir", tint = Color.White)
            }
        }
    }
}

@Composable
private fun AppBody(
    viewModel: MainViewModel,
    screen: AppScreen,
    padding: PaddingValues,
    navigate: (AppScreen) -> Unit
) {
    val liveMatches by viewModel.liveMatches.collectAsState()
    val todayMatches by viewModel.todayMatches.collectAsState()
    val upcomingMatches by viewModel.upcomingMatches.collectAsState()
    val calendarMatches by viewModel.calendarMatches.collectAsState()
    val standings by viewModel.standings.collectAsState()
    val articles by viewModel.articles.collectAsState()
    val diagnostic by viewModel.diagnostic.collectAsState()
    val selectedMatch by viewModel.selectedMatch.collectAsState()
    val matchEvents by viewModel.matchEvents.collectAsState()
    val matchStats by viewModel.matchStats.collectAsState()
    val matchLineups by viewModel.matchLineups.collectAsState()
    val analysis by viewModel.analysis.collectAsState()
    val prediction by viewModel.prediction.collectAsState()
    val commentary by viewModel.commentary.collectAsState()
    val media by viewModel.mediaContent.collectAsState()
    val injuries by viewModel.injuriesContent.collectAsState()
    val interviews by viewModel.interviewsContent.collectAsState()
    val training by viewModel.trainingContent.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val error by viewModel.error.collectAsState()

    LaunchedEffect(Unit) {
        viewModel.loadDiagnostic()
        viewModel.loadArticles()
        viewModel.loadStandings()
    }

    val openMatch: (Match) -> Unit = { match ->
        viewModel.selectMatch(match)
        navigate(AppScreen.Match)
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(padding)
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        if (error != null) {
            NoticeCard(
                title = "Connexion",
                message = error ?: "",
                actionLabel = "Masquer",
                onAction = viewModel::clearError
            )
        }

        when (screen) {
            AppScreen.Home -> HomeScreenV5(
                live = liveMatches,
                today = todayMatches,
                upcoming = upcomingMatches,
                articles = articles,
                isLoading = isLoading,
                onRefresh = viewModel::refreshAll,
                onMatchClick = openMatch,
                navigate = navigate
            )
            AppScreen.Live -> LiveScreenV5(
                live = liveMatches,
                today = todayMatches,
                upcoming = upcomingMatches,
                isLoading = isLoading,
                onRefresh = viewModel::refreshAll,
                onMatchClick = openMatch
            )
            AppScreen.Calendar -> CalendarScreenV5(
                matches = calendarMatches,
                isLoading = isLoading,
                onRefresh = viewModel::refreshAll,
                onMatchClick = openMatch
            )
            AppScreen.Africa -> AfricaScreenV5(
                matches = calendarMatches,
                standings = standings,
                onMatchClick = openMatch,
                navigate = navigate
            )
            AppScreen.More -> MoreScreen(navigate)
            AppScreen.Match -> MatchDetailScreenV5(
                match = selectedMatch,
                events = matchEvents,
                stats = matchStats,
                lineups = matchLineups,
                analysis = analysis,
                prediction = prediction,
                commentary = commentary,
                media = media,
                injuries = injuries,
                interviews = interviews,
                training = training,
                onBack = { navigate(AppScreen.Calendar) },
                onRefresh = viewModel::refreshMatchDetail
            )
            AppScreen.Standings -> StandingsScreenV5(standings, viewModel::loadStandings)
            AppScreen.News -> NewsScreenV5(articles, viewModel::loadArticles)
            AppScreen.Videos -> SimpleContentScreen(
                title = "Videos",
                items = media,
                empty = "Aucune video disponible pour le moment.",
                onRetry = viewModel::refreshMatchDetail
            )
            AppScreen.Interviews -> SimpleContentScreen(
                title = "Interviews",
                items = interviews,
                empty = "Aucune interview disponible pour le moment.",
                onRetry = viewModel::refreshMatchDetail
            )
            AppScreen.Injuries -> SimpleContentScreen(
                title = "Blessures",
                items = injuries,
                empty = "Aucune blessure confirmee pour le moment.",
                onRetry = viewModel::refreshMatchDetail
            )
            AppScreen.Training -> SimpleContentScreen(
                title = "Entrainements",
                items = training,
                empty = "Aucune information entrainement disponible pour le moment.",
                onRetry = viewModel::refreshMatchDetail
            )
            AppScreen.Notifications -> NotificationSettingsScreen()
            AppScreen.Diagnostic -> DiagnosticScreenV5(diagnostic, viewModel::loadDiagnostic)
            AppScreen.Widget -> WidgetInfoScreen()
            AppScreen.Settings -> SettingsScreenV5()
        }
        FooterCard()
    }
}

@Composable
private fun HomeScreenV5(
    live: List<Match>,
    today: List<Match>,
    upcoming: List<Match>,
    articles: List<Article>,
    isLoading: Boolean,
    onRefresh: () -> Unit,
    onMatchClick: (Match) -> Unit,
    navigate: (AppScreen) -> Unit
) {
    val hero = live.firstOrNull() ?: today.firstOrNull() ?: upcoming.firstOrNull()
    if (hero != null) {
        HeroCard(hero, onMatchClick = { onMatchClick(hero) }, onAi = { onMatchClick(hero) })
    } else {
        EmptyHero(isLoading = isLoading, onRefresh = onRefresh)
    }

    SectionTitle("Acces rapide")
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        QuickCard("Direct", Icons.Rounded.LiveTv, Modifier.weight(1f)) { navigate(AppScreen.Live) }
        QuickCard("Calendrier", Icons.Rounded.CalendarMonth, Modifier.weight(1f)) { navigate(AppScreen.Calendar) }
        QuickCard("Afrique", Icons.Rounded.Public, Modifier.weight(1f)) { navigate(AppScreen.Africa) }
    }
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        QuickCard("Classements", Icons.Rounded.TableChart, Modifier.weight(1f)) { navigate(AppScreen.Standings) }
        QuickCard("Actualites", Icons.Rounded.Article, Modifier.weight(1f)) { navigate(AppScreen.News) }
        QuickCard("Diagnostic", Icons.Rounded.Build, Modifier.weight(1f)) { navigate(AppScreen.Diagnostic) }
    }

    SectionTitle("Aujourd'hui")
    if (today.isEmpty()) {
        EmptyState("Aucun match aujourd'hui. Les prochains matchs sont affiches dans Calendrier.", "Voir calendrier") {
            navigate(AppScreen.Calendar)
        }
    } else {
        today.take(4).forEach { MatchCardV5(it, onClick = { onMatchClick(it) }) }
    }

    SectionTitle("Actualites")
    if (articles.isEmpty()) {
        EmptyState("Aucune actualite disponible pour le moment.", "Reessayer", onRefresh)
    } else {
        articles.take(3).forEach { ArticleCard(it) }
    }
}

@Composable
private fun LiveScreenV5(
    live: List<Match>,
    today: List<Match>,
    upcoming: List<Match>,
    isLoading: Boolean,
    onRefresh: () -> Unit,
    onMatchClick: (Match) -> Unit
) {
    var selectedTab by remember { mutableIntStateOf(0) }
    val tabs = listOf("Direct", "Aujourd'hui", "A venir")
    val lists = listOf(live, today, upcoming)
    val emptyMessages = listOf(
        "Aucun match en direct pour le moment.",
        "Aucun match aujourd'hui.",
        "Aucun match a venir dans la fenetre backend."
    )

    Row(modifier = Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        tabs.forEachIndexed { index, label ->
            FilterChip(
                selected = selectedTab == index,
                onClick = { selectedTab = index },
                label = { Text(label) }
            )
        }
    }
    MatchListBlock(
        matches = lists[selectedTab],
        empty = emptyMessages[selectedTab],
        isLoading = isLoading,
        onRefresh = onRefresh,
        onMatchClick = onMatchClick
    )
}

@Composable
private fun CalendarScreenV5(
    matches: List<Match>,
    isLoading: Boolean,
    onRefresh: () -> Unit,
    onMatchClick: (Match) -> Unit
) {
    SectionTitle("Calendrier")
    MatchListBlock(
        matches = matches,
        empty = "Calendrier indisponible pour le moment.",
        isLoading = isLoading,
        onRefresh = onRefresh,
        onMatchClick = onMatchClick
    )
}

@Composable
private fun AfricaScreenV5(
    matches: List<Match>,
    standings: List<StandingGroup>,
    onMatchClick: (Match) -> Unit,
    navigate: (AppScreen) -> Unit
) {
    val africanCodes = setOf("ALG", "MAR", "SEN", "TUN", "EGY", "CIV", "GHA", "CMR", "NGA", "RSA", "CPV", "COD", "MLI")
    val africanMatches = matches.filter { match ->
        match.homeTeam.code in africanCodes || match.awayTeam.code in africanCodes
    }
    SectionTitle("Afrique")
    if (africanMatches.isEmpty()) {
        EmptyState("Aucun match africain charge pour le moment.", "Voir calendrier") {
            navigate(AppScreen.Calendar)
        }
    } else {
        africanMatches.take(12).forEach { MatchCardV5(it, onClick = { onMatchClick(it) }) }
    }

    SectionTitle("Groupes avec equipes africaines")
    val africanGroups = standings.mapNotNull { group ->
        val rows = group.entries.filter { it.teamCode in africanCodes }
        if (rows.isEmpty()) null else group.copy(entries = rows)
    }
    if (africanGroups.isEmpty()) {
        EmptyState("Classements africains en attente.", "Classements") { navigate(AppScreen.Standings) }
    } else {
        africanGroups.forEach { StandingGroupCard(it, compact = true) }
    }
}

@Composable
private fun MoreScreen(navigate: (AppScreen) -> Unit) {
    SectionTitle("Plus")
    val items = listOf(
        AppScreen.Standings,
        AppScreen.News,
        AppScreen.Videos,
        AppScreen.Interviews,
        AppScreen.Injuries,
        AppScreen.Training,
        AppScreen.Notifications,
        AppScreen.Diagnostic,
        AppScreen.Widget,
        AppScreen.Settings
    )
    items.chunked(2).forEach { row ->
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            row.forEach { screen ->
                QuickCard(screen.label, screen.icon, Modifier.weight(1f)) { navigate(screen) }
            }
            if (row.size == 1) Spacer(Modifier.weight(1f))
        }
    }
}

@Composable
private fun MatchDetailScreenV5(
    match: Match?,
    events: List<MatchEvent>,
    stats: MatchStats?,
    lineups: MatchLineups?,
    analysis: Analysis?,
    prediction: Prediction?,
    commentary: List<com.cdmafrique.live.data.model.CommentaryItem>,
    media: List<ContentResult>,
    injuries: List<ContentResult>,
    interviews: List<ContentResult>,
    training: List<ContentResult>,
    onBack: () -> Unit,
    onRefresh: () -> Unit
) {
    if (match == null) {
        EmptyState("Aucun match selectionne.", "Calendrier", onBack)
        return
    }
    OutlinedButton(onClick = onBack, modifier = Modifier.fillMaxWidth()) {
        Text("Retour")
    }
    HeroCard(match = match, onMatchClick = {}, onAi = onRefresh)
    SectionTitle("Resume")
    InfoCard(
        title = "Source V5",
        body = if (match.id.startsWith("local-")) {
            "Match affiche depuis la base locale de secours. Les donnees Render reprendront la priorite des qu'elles seront disponibles."
        } else {
            "Match charge depuis le backend Render V5."
        }
    )
    analysis?.let { InfoCard("IA", it.content) }
    prediction?.let { InfoCard("Pronostic", it.prediction) }

    SectionTitle("Events")
    if (events.isEmpty()) EmptyState("Aucun evenement disponible.", "Reessayer", onRefresh)
    else events.forEach { InfoCard("${it.minute}' ${it.type.display}", it.playerName ?: it.detail ?: it.teamName ?: "") }

    SectionTitle("Stats")
    if (stats == null || stats.categories.isEmpty()) EmptyState("Stats indisponibles.", "Reessayer", onRefresh)
    else stats.categories.forEach { StatRow(it.name, it.homeValue, it.awayValue) }

    SectionTitle("Compo")
    if (lineups == null || (lineups.homeStarters.isEmpty() && lineups.awayStarters.isEmpty())) {
        EmptyState("Compositions indisponibles.", "Reessayer", onRefresh)
    } else {
        InfoCard(
            "Compositions",
            "${match.homeTeam.code ?: match.homeTeam.name}: ${lineups.homeFormation ?: "-"}\n${match.awayTeam.code ?: match.awayTeam.name}: ${lineups.awayFormation ?: "-"}"
        )
    }

    SectionTitle("IA")
    if (commentary.isEmpty()) EmptyState("Aucun commentaire IA pour le moment.", "Reessayer", onRefresh)
    else commentary.forEach { InfoCard("${it.minute}'", it.text) }

    SimpleContentInline("Medias", media, "Aucun media disponible.")
    SimpleContentInline("Blessures", injuries, "Aucune blessure confirmee.")
    SimpleContentInline("Interviews", interviews, "Aucune interview disponible.")
    SimpleContentInline("Entrainements", training, "Aucune info entrainement disponible.")
}

@Composable
private fun StandingsScreenV5(standings: List<StandingGroup>, onRetry: () -> Unit) {
    SectionTitle("Classements")
    if (standings.isEmpty()) {
        EmptyState("Classements indisponibles.", "Reessayer", onRetry)
    } else {
        standings.forEach { StandingGroupCard(it, compact = false) }
    }
}

@Composable
private fun NewsScreenV5(articles: List<Article>, onRetry: () -> Unit) {
    SectionTitle("Actualites")
    if (articles.isEmpty()) EmptyState("Aucune actualite disponible pour le moment.", "Reessayer", onRetry)
    else articles.forEach { ArticleCard(it) }
}

@Composable
private fun SimpleContentScreen(
    title: String,
    items: List<ContentResult>,
    empty: String,
    onRetry: () -> Unit
) {
    SectionTitle(title)
    if (items.isEmpty()) EmptyState(empty, "Reessayer", onRetry)
    else items.forEach { ContentCard(it) }
}

@Composable
private fun SimpleContentInline(title: String, items: List<ContentResult>, empty: String) {
    SectionTitle(title)
    if (items.isEmpty()) EmptyState(empty)
    else items.forEach { ContentCard(it) }
}

@Composable
private fun NotificationSettingsScreen() {
    SectionTitle("Notifications")
    val options = listOf("Algerie", "Afrique", "Toutes les equipes", "Blessures", "Interviews", "Entrainements", "Buts", "Resultats")
    options.forEach { label ->
        var checked by remember(label) { mutableStateOf(label in listOf("Algerie", "Afrique", "Buts", "Resultats")) }
        CardShell {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(label, style = MaterialTheme.typography.titleMedium)
                    Text("FCM pret cote Android", color = AfriqueMuted, style = MaterialTheme.typography.bodyMedium)
                }
                Switch(checked = checked, onCheckedChange = { checked = it })
            }
        }
    }
}

@Composable
private fun DiagnosticScreenV5(diag: AppDiagnostic?, onRetry: () -> Unit) {
    SectionTitle("Diagnostic")
    CardShell {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Image(
                painter = painterResource(id = R.drawable.logo_cdm2026),
                contentDescription = "Logo CDM 2026",
                modifier = Modifier
                    .size(58.dp)
                    .clip(RoundedCornerShape(8.dp)),
                contentScale = ContentScale.Fit
            )
            Column {
                Text("CDM 2026 Live", style = MaterialTheme.typography.titleMedium)
                Text("Diagnostic V5 - aucune cle visible", color = AfriqueMuted)
            }
        }
    }
    if (diag == null) {
        EmptyState("Diagnostic en chargement.", "Reessayer", onRetry)
        return
    }
    CardShell {
        StatusLine("Backend", diag.backendStatus)
        StatusLine("Version app", diag.appVersion)
        StatusLine("URL", BuildConfig.BACKEND_URL)
        StatusLine("Uptime", diag.backendUptime?.let { "%.1f s".format(it) } ?: "-")
        StatusLine("Derniere erreur", diag.lastError ?: "Aucune")
        StatusLine("Secrets", "Caches cote backend")
    }
    InfoCard(
        title = "Architecture",
        body = "Render V5 + sources live cote serveur + IA interne + Firebase FCM."
    )
    OutlinedButton(onClick = onRetry, modifier = Modifier.fillMaxWidth()) {
        Icon(Icons.Rounded.Refresh, contentDescription = null)
        Spacer(Modifier.width(8.dp))
        Text("Actualiser diagnostic")
    }
}

@Composable
private fun WidgetInfoScreen() {
    SectionTitle("Widget Android")
    InfoCard(
        title = "Widget CDM 2026 Live",
        body = "Ajoute le widget depuis l'ecran d'accueil Android. Il affiche un resume propre et ouvre l'application."
    )
}

@Composable
private fun SettingsScreenV5() {
    SectionTitle("Parametres")
    CardShell {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Image(
                painter = painterResource(id = R.drawable.logo_cdm2026),
                contentDescription = "Logo CDM 2026",
                modifier = Modifier
                    .size(58.dp)
                    .clip(RoundedCornerShape(8.dp)),
                contentScale = ContentScale.Fit
            )
            Column {
                Text("CDM 2026 Live", style = MaterialTheme.typography.titleMedium)
                Text("Identite visuelle integree dans l'app et l'icone Android.", color = AfriqueMuted)
            }
        }
    }
    InfoCard("Application", "Package conserve : com.cdmafrique.live\nFirebase conserve\nBackend public : ${BuildConfig.BACKEND_URL}")
    InfoCard("Securite", "Aucune cle sport, Render ou Gemini n'est stockee dans Android.")
}

@Composable
private fun MatchListBlock(
    matches: List<Match>,
    empty: String,
    isLoading: Boolean,
    onRefresh: () -> Unit,
    onMatchClick: (Match) -> Unit
) {
    if (isLoading && matches.isEmpty()) {
        CardShell {
            Box(modifier = Modifier.fillMaxWidth().padding(24.dp), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = AfriqueGreen)
            }
        }
    } else if (matches.isEmpty()) {
        EmptyState(empty, "Reessayer", onRefresh)
    } else {
        matches.forEach { MatchCardV5(match = it, onClick = { onMatchClick(it) }) }
    }
}

@Composable
private fun HeroCard(match: Match, onMatchClick: () -> Unit, onAi: () -> Unit) {
    Card(
        shape = RoundedCornerShape(8.dp),
        colors = CardDefaults.cardColors(containerColor = AfriqueGreen),
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onMatchClick)
    ) {
        Column(
            modifier = Modifier
                .background(AfriqueGreen)
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            StatusBadgeV5(match)
            Text(
                "${match.homeTeam.name} vs ${match.awayTeam.name}",
                color = Color.White,
                style = MaterialTheme.typography.headlineMedium,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis
            )
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                TeamCodeBox(match.homeTeam.code ?: match.homeTeam.name.take(3))
                Text(scoreLine(match), color = Color.White, style = MaterialTheme.typography.headlineMedium)
                TeamCodeBox(match.awayTeam.code ?: match.awayTeam.name.take(3))
            }
            Text(
                "${match.round ?: "Match"} - ${formatKickoff(match.kickoff)}",
                color = Color.White.copy(alpha = 0.8f),
                style = MaterialTheme.typography.bodyMedium
            )
            Button(
                onClick = onAi,
                colors = ButtonDefaults.buttonColors(containerColor = AfriqueGold, contentColor = AfriqueInk),
                shape = RoundedCornerShape(8.dp)
            ) {
                Text("Ouvrir resume")
            }
        }
    }
}

@Composable
private fun EmptyHero(isLoading: Boolean, onRefresh: () -> Unit) {
    Card(
        shape = RoundedCornerShape(8.dp),
        colors = CardDefaults.cardColors(containerColor = AfriqueGreen),
        modifier = Modifier.fillMaxWidth()
    ) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text("CDM 2026 Live", color = Color.White, style = MaterialTheme.typography.headlineMedium)
            Text("Backend connecte. Aucune donnee live recue pour le moment.", color = Color.White.copy(alpha = 0.82f))
            Button(
                onClick = onRefresh,
                enabled = !isLoading,
                colors = ButtonDefaults.buttonColors(containerColor = AfriqueGold, contentColor = AfriqueInk),
                shape = RoundedCornerShape(8.dp)
            ) {
                Text(if (isLoading) "Chargement..." else "Reessayer")
            }
        }
    }
}

@Composable
private fun MatchCardV5(match: Match, onClick: () -> Unit) {
    Card(
        shape = RoundedCornerShape(8.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        modifier = Modifier
            .fillMaxWidth()
            .border(1.dp, AfriqueLine, RoundedCornerShape(8.dp))
            .clickable(onClick = onClick)
    ) {
        Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
                StatusBadgeV5(match)
                Text(match.group ?: "", color = AfriqueMuted, style = MaterialTheme.typography.labelLarge)
            }
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                TeamColumn(match.homeTeam.code, match.homeTeam.name, Modifier.weight(1f))
                Text(scoreLine(match), style = MaterialTheme.typography.titleLarge, color = AfriqueInk)
                TeamColumn(match.awayTeam.code, match.awayTeam.name, Modifier.weight(1f))
            }
            Text(formatKickoff(match.kickoff), color = AfriqueMuted, style = MaterialTheme.typography.bodyMedium)
        }
    }
}

@Composable
private fun StatusBadgeV5(match: Match) {
    val color = when (match.status) {
        MatchStatus.LIVE, MatchStatus.HALF_TIME, MatchStatus.SECOND_HALF -> AfriqueRed
        MatchStatus.FINISHED -> AfriqueMuted
        MatchStatus.SCHEDULED -> AfriqueTeal
        else -> AfriqueGold
    }
    Surface(shape = RoundedCornerShape(999.dp), color = color.copy(alpha = 0.13f)) {
        Row(
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 5.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            if (match.status.isLive) {
                Box(modifier = Modifier.size(7.dp).clip(CircleShape).background(AfriqueRed))
            }
            Text(statusText(match), color = color, style = MaterialTheme.typography.labelLarge)
        }
    }
}

@Composable
private fun TeamColumn(code: String?, name: String, modifier: Modifier) {
    Column(modifier = modifier, horizontalAlignment = Alignment.CenterHorizontally) {
        TeamCodeBox(code ?: name.take(3))
        Text(name, color = AfriqueMuted, maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
}

@Composable
private fun TeamCodeBox(code: String) {
    Box(
        modifier = Modifier
            .size(width = 58.dp, height = 40.dp)
            .clip(RoundedCornerShape(8.dp))
            .background(Color(0xFFE6F2ED))
            .border(1.dp, AfriqueLine, RoundedCornerShape(8.dp)),
        contentAlignment = Alignment.Center
    ) {
        Text(code.uppercase().take(3), color = AfriqueGreen, style = MaterialTheme.typography.titleMedium)
    }
}

@Composable
private fun StandingGroupCard(group: StandingGroup, compact: Boolean) {
    CardShell {
        Text(group.name, style = MaterialTheme.typography.titleMedium, color = AfriqueGreen)
        Spacer(Modifier.height(8.dp))
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text("Equipe", modifier = Modifier.weight(1f), color = AfriqueMuted)
            Text("J", modifier = Modifier.width(30.dp), color = AfriqueMuted)
            Text("Pts", modifier = Modifier.width(40.dp), color = AfriqueMuted)
        }
        HorizontalDivider(color = AfriqueLine)
        group.entries.take(if (compact) 4 else 8).forEach { row ->
            Row(Modifier.fillMaxWidth().padding(vertical = 5.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                Text("${row.teamCode ?: ""} ${row.teamName}", modifier = Modifier.weight(1f), maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text("${row.played}", modifier = Modifier.width(30.dp))
                Text("${row.points}", modifier = Modifier.width(40.dp), fontWeight = FontWeight.Bold)
            }
        }
    }
}

@Composable
private fun ArticleCard(article: Article) {
    CardShell {
        Text(article.title, style = MaterialTheme.typography.titleMedium, color = AfriqueInk)
        if (!article.summary.isNullOrBlank()) {
            Text(article.summary, color = AfriqueMuted, style = MaterialTheme.typography.bodyMedium)
        }
        Text(article.source ?: "Backend", color = AfriqueGreen, style = MaterialTheme.typography.labelLarge)
    }
}

@Composable
private fun ContentCard(item: ContentResult) {
    CardShell {
        Text(item.title, style = MaterialTheme.typography.titleMedium, color = AfriqueInk)
        Text(item.content, color = AfriqueMuted, style = MaterialTheme.typography.bodyMedium)
        Text(item.source ?: item.reliability.display, color = AfriqueGreen, style = MaterialTheme.typography.labelLarge)
    }
}

@Composable
private fun InfoCard(title: String, body: String) {
    CardShell {
        Text(title, style = MaterialTheme.typography.titleMedium, color = AfriqueInk)
        Text(body, color = AfriqueMuted, style = MaterialTheme.typography.bodyMedium)
    }
}

@Composable
private fun NoticeCard(title: String, message: String, actionLabel: String, onAction: () -> Unit) {
    CardShell {
        Text(title, style = MaterialTheme.typography.titleMedium, color = AfriqueRed)
        Text(message, color = AfriqueMuted)
        TextButton(onClick = onAction) { Text(actionLabel) }
    }
}

@Composable
private fun EmptyState(text: String, actionLabel: String? = null, onAction: (() -> Unit)? = null) {
    CardShell {
        Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.fillMaxWidth()) {
            Text(text, color = AfriqueMuted, style = MaterialTheme.typography.bodyMedium)
            if (actionLabel != null && onAction != null) {
                Spacer(Modifier.height(8.dp))
                OutlinedButton(onClick = onAction, shape = RoundedCornerShape(8.dp)) {
                    Text(actionLabel)
                }
            }
        }
    }
}

@Composable
private fun SectionTitle(title: String) {
    Text(title, style = MaterialTheme.typography.titleLarge, color = AfriqueInk)
}

@Composable
private fun QuickCard(label: String, icon: ImageVector, modifier: Modifier = Modifier, onClick: () -> Unit) {
    Card(
        shape = RoundedCornerShape(8.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        modifier = modifier
            .height(86.dp)
            .border(1.dp, AfriqueLine, RoundedCornerShape(8.dp))
            .clickable(onClick = onClick)
    ) {
        Column(
            modifier = Modifier.fillMaxSize().padding(8.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Icon(icon, contentDescription = null, tint = AfriqueGreen)
            Spacer(Modifier.height(6.dp))
            Text(label, maxLines = 1, overflow = TextOverflow.Ellipsis, style = MaterialTheme.typography.labelLarge)
        }
    }
}

@Composable
private fun CardShell(content: @Composable ColumnScope.() -> Unit) {
    Card(
        shape = RoundedCornerShape(8.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        modifier = Modifier
            .fillMaxWidth()
            .border(1.dp, AfriqueLine, RoundedCornerShape(8.dp))
    ) {
        Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp), content = content)
    }
}

@Composable
private fun StatRow(label: String, home: String, away: String) {
    CardShell {
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text(home, fontWeight = FontWeight.Bold)
            Text(label, color = AfriqueMuted)
            Text(away, fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
private fun StatusLine(label: String, value: String) {
    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(label, color = AfriqueMuted)
        Text(value, color = AfriqueInk, fontWeight = FontWeight.Bold, maxLines = 2, overflow = TextOverflow.Ellipsis)
    }
}

@Composable
private fun FooterCard() {
    CardShell {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Image(
                painter = painterResource(id = R.drawable.logo_cdm2026),
                contentDescription = "Logo Redha",
                modifier = Modifier.size(38.dp),
                contentScale = ContentScale.Fit
            )
            Column {
                Text("CDM 2026 Live by Redha", style = MaterialTheme.typography.titleMedium)
                Text("Agents caches, backend public, sources securisees.", color = AfriqueMuted)
            }
        }
    }
}

private fun scoreLine(match: Match): String {
    val home = match.homeScore?.toString() ?: "-"
    val away = match.awayScore?.toString() ?: "-"
    return "$home - $away"
}

private fun statusText(match: Match): String = when (match.status) {
    MatchStatus.LIVE -> match.minute?.let { "$it'" } ?: "LIVE"
    MatchStatus.HALF_TIME -> "Mi-temps"
    MatchStatus.SECOND_HALF -> match.minute?.let { "$it'" } ?: "2e MT"
    MatchStatus.FINISHED -> "Termine"
    MatchStatus.SCHEDULED -> "Programme"
    MatchStatus.POSTPONED -> "Reporte"
    MatchStatus.CANCELLED -> "Annule"
    MatchStatus.SUSPENDED -> "Suspendu"
    MatchStatus.UNKNOWN -> "A confirmer"
}

private fun formatKickoff(raw: String?): String {
    if (raw.isNullOrBlank()) return "Horaire a confirmer"
    return runCatching {
        DateTimeFormatter.ofPattern("EEE d MMM HH:mm", Locale.FRANCE)
            .withZone(ZoneId.systemDefault())
            .format(Instant.parse(raw))
    }.getOrDefault(raw.replace("T", " ").replace("Z", ""))
}
