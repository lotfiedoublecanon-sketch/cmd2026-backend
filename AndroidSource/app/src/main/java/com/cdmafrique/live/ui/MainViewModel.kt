package com.cdmafrique.live.ui

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.cdmafrique.live.data.local.LocalWorldCupFallback
import com.cdmafrique.live.data.model.*
import com.cdmafrique.live.data.repository.MatchRepository
import com.google.firebase.messaging.FirebaseMessaging
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

/**
 * V5.0.9 Redha
 * - refreshAll() recharge tout réellement
 * - le démarrage ne dépend plus du clic “Réessayer”
 * - matchs/classements utilisent le calendrier local uniquement si le serveur renvoie vide
 * - news/videos/interviews/injuries/training gardent le serveur prioritaire et évitent les faux contenus locaux quand Render répond
 */
class MainViewModel(application: Application) : AndroidViewModel(application) {

    private val repository = MatchRepository()
    private val localFallback = LocalWorldCupFallback(application.applicationContext)

    private val _liveMatches = MutableStateFlow<List<Match>>(emptyList())
    val liveMatches: StateFlow<List<Match>> = _liveMatches.asStateFlow()

    private val _todayMatches = MutableStateFlow<List<Match>>(emptyList())
    val todayMatches: StateFlow<List<Match>> = _todayMatches.asStateFlow()

    private val _upcomingMatches = MutableStateFlow<List<Match>>(emptyList())
    val upcomingMatches: StateFlow<List<Match>> = _upcomingMatches.asStateFlow()

    private val _calendarMatches = MutableStateFlow<List<Match>>(emptyList())
    val calendarMatches: StateFlow<List<Match>> = _calendarMatches.asStateFlow()

    private val _standings = MutableStateFlow<List<StandingGroup>>(emptyList())
    val standings: StateFlow<List<StandingGroup>> = _standings.asStateFlow()

    private val _articles = MutableStateFlow<List<Article>>(emptyList())
    val articles: StateFlow<List<Article>> = _articles.asStateFlow()

    private val _selectedMatch = MutableStateFlow<Match?>(null)
    val selectedMatch: StateFlow<Match?> = _selectedMatch.asStateFlow()

    private val _matchEvents = MutableStateFlow<List<MatchEvent>>(emptyList())
    val matchEvents: StateFlow<List<MatchEvent>> = _matchEvents.asStateFlow()

    private val _matchStats = MutableStateFlow<MatchStats?>(null)
    val matchStats: StateFlow<MatchStats?> = _matchStats.asStateFlow()

    private val _matchLineups = MutableStateFlow<MatchLineups?>(null)
    val matchLineups: StateFlow<MatchLineups?> = _matchLineups.asStateFlow()

    private val _analysis = MutableStateFlow<Analysis?>(null)
    val analysis: StateFlow<Analysis?> = _analysis.asStateFlow()

    private val _prediction = MutableStateFlow<Prediction?>(null)
    val prediction: StateFlow<Prediction?> = _prediction.asStateFlow()

    private val _commentary = MutableStateFlow<List<CommentaryItem>>(emptyList())
    val commentary: StateFlow<List<CommentaryItem>> = _commentary.asStateFlow()

    private val _mediaContent = MutableStateFlow<List<ContentResult>>(emptyList())
    val mediaContent: StateFlow<List<ContentResult>> = _mediaContent.asStateFlow()

    private val _injuriesContent = MutableStateFlow<List<ContentResult>>(emptyList())
    val injuriesContent: StateFlow<List<ContentResult>> = _injuriesContent.asStateFlow()

    private val _interviewsContent = MutableStateFlow<List<ContentResult>>(emptyList())
    val interviewsContent: StateFlow<List<ContentResult>> = _interviewsContent.asStateFlow()

    private val _trainingContent = MutableStateFlow<List<ContentResult>>(emptyList())
    val trainingContent: StateFlow<List<ContentResult>> = _trainingContent.asStateFlow()

    private val _diagnostic = MutableStateFlow<AppDiagnostic?>(null)
    val diagnostic: StateFlow<AppDiagnostic?> = _diagnostic.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error.asStateFlow()

    private var backendReachable: Boolean = false
    private var livePollingJob: Job? = null
    private var todayPollingJob: Job? = null
    private var refreshJob: Job? = null

    init {
        refreshAll()
        startLivePolling()
        registerFcmToken()
        subscribeToDefaultTopics()
    }

    fun loadInitialData() = refreshAll()

    fun refreshAll() {
        refreshJob?.cancel()
        refreshJob = viewModelScope.launch {
            refreshAllInternal()
        }
    }

    private suspend fun refreshAllInternal() {
        _isLoading.value = true
        _error.value = null
        loadDiagnosticNow(includeRoutes = false)
        loadLiveMatchesNow()
        loadTodayMatchesNow()
        loadUpcomingMatchesNow()
        loadStandingsNow()
        loadArticlesNow()
        loadGlobalContentNow()
        refreshCalendarFallback()
        _isLoading.value = false
    }

    private suspend fun loadLiveMatchesNow() {
        repository.getLiveMatches()
            .onSuccess { matches -> _liveMatches.value = matches }
            .onFailure { _liveMatches.value = emptyList() }
        refreshCalendarFallback()
    }

    private suspend fun loadTodayMatchesNow() {
        repository.getTodayMatches()
            .onSuccess { matches -> _todayMatches.value = matches }
            .onFailure { _todayMatches.value = emptyList() }
        refreshCalendarFallback()
    }

    private suspend fun loadUpcomingMatchesNow() {
        repository.getUpcomingMatches()
            .onSuccess { matches ->
                _upcomingMatches.value = matches.ifEmpty { localFallback.upcomingMatches(60) }
            }
            .onFailure {
                _upcomingMatches.value = localFallback.upcomingMatches(60)
                showLocalNoticeIfOffline()
            }
        refreshCalendarFallback()
    }

    private fun refreshCalendarFallback() {
        val merged = (_liveMatches.value + _todayMatches.value + _upcomingMatches.value)
            .distinctBy { it.id }
        _calendarMatches.value = merged.ifEmpty { localFallback.upcomingMatches(60) }
    }

    fun loadStandings() {
        viewModelScope.launch { loadStandingsNow() }
    }

    private suspend fun loadStandingsNow() {
        repository.getStandings()
            .onSuccess { groups -> _standings.value = groups.ifEmpty { localFallback.standings() } }
            .onFailure {
                _standings.value = localFallback.standings()
                showLocalNoticeIfOffline()
            }
    }

    fun loadArticles() {
        viewModelScope.launch { loadArticlesNow() }
    }

    private suspend fun loadArticlesNow() {
        repository.getArticles()
            .onSuccess { items ->
                // Important : ne pas afficher les 3 fausses cartes locales si Render répond.
                _articles.value = if (items.isNotEmpty()) items else if (backendReachable) emptyList() else localFallback.fallbackArticles()
            }
            .onFailure {
                _articles.value = if (backendReachable) emptyList() else localFallback.fallbackArticles()
                showLocalNoticeIfOffline()
            }
    }

    fun refreshGlobalContent() {
        viewModelScope.launch { loadGlobalContentNow() }
    }

    private suspend fun loadGlobalContentNow() {
        repository.getVideos()
            .onSuccess { items -> _mediaContent.value = serverOnlyWhenReachable(items) { localFallback.mediaContent() } }
            .onFailure { _mediaContent.value = if (backendReachable) emptyList() else localFallback.mediaContent() }

        repository.getGlobalInjuries()
            .onSuccess { items -> _injuriesContent.value = serverOnlyWhenReachable(items) { localFallback.injuriesContent() } }
            .onFailure { _injuriesContent.value = if (backendReachable) emptyList() else localFallback.injuriesContent() }

        repository.getGlobalInterviews()
            .onSuccess { items -> _interviewsContent.value = serverOnlyWhenReachable(items) { localFallback.interviewsContent() } }
            .onFailure { _interviewsContent.value = if (backendReachable) emptyList() else localFallback.interviewsContent() }

        repository.getGlobalTraining()
            .onSuccess { items -> _trainingContent.value = serverOnlyWhenReachable(items) { localFallback.trainingContent() } }
            .onFailure { _trainingContent.value = if (backendReachable) emptyList() else localFallback.trainingContent() }
    }

    private fun <T> serverOnlyWhenReachable(items: List<T>, localProvider: () -> List<T>): List<T> {
        return if (items.isNotEmpty()) items else if (backendReachable) emptyList() else localProvider()
    }

    private fun showLocalNoticeIfOffline() {
        if (!backendReachable) _error.value = localFallback.localNotice()
    }

    fun startLivePolling() {
        livePollingJob?.cancel()
        livePollingJob = viewModelScope.launch {
            while (isActive) {
                delay(15_000)
                loadLiveMatchesNow()
            }
        }
        todayPollingJob?.cancel()
        todayPollingJob = viewModelScope.launch {
            while (isActive) {
                delay(30_000)
                loadTodayMatchesNow()
                loadUpcomingMatchesNow()
            }
        }
    }

    fun stopLivePolling() {
        livePollingJob?.cancel()
        todayPollingJob?.cancel()
    }

    fun selectMatch(matchId: String) {
        viewModelScope.launch {
            _isLoading.value = true
            repository.getMatchById(matchId)
                .onSuccess { match ->
                    _selectedMatch.value = match
                    loadMatchDetails(match.id)
                }
            _isLoading.value = false
        }
    }

    fun selectMatch(match: Match) {
        _selectedMatch.value = match
        _matchEvents.value = emptyList()
        _matchStats.value = null
        _matchLineups.value = null
        _analysis.value = null
        _prediction.value = null
        _commentary.value = emptyList()
        _mediaContent.value = emptyList()
        _injuriesContent.value = emptyList()
        _interviewsContent.value = emptyList()
        _trainingContent.value = emptyList()

        if (match.id.startsWith("local-")) {
            loadLocalMatchDetails(match)
        } else {
            viewModelScope.launch { loadMatchDetails(match.id) }
        }
    }

    private suspend fun loadMatchDetails(matchId: String) {
        val currentMatch = _selectedMatch.value

        repository.getMatchEvents(matchId)
            .onSuccess { events -> _matchEvents.value = events.ifEmpty { localEventsFor(currentMatch) } }

        repository.getMatchStats(matchId)
            .onSuccess { stats -> _matchStats.value = stats }
            .onFailure { _matchStats.value = currentMatch?.let { localFallback.matchStats(matchId, it) } }

        repository.getMatchLineups(matchId)
            .onSuccess { lineups -> _matchLineups.value = lineups }
            .onFailure { _matchLineups.value = currentMatch?.let { localFallback.lineups(matchId, it) } }

        repository.getAnalysis(matchId).onSuccess { _analysis.value = it }
        repository.getPrediction(matchId)
            .onSuccess { _prediction.value = it }
            .onFailure { _prediction.value = currentMatch?.let { localFallback.prediction(matchId, it) } }

        repository.getCommentary(matchId)
            .onSuccess { items -> _commentary.value = items.ifEmpty { currentMatch?.let { localFallback.commentary(it) } ?: emptyList() } }

        repository.getMedia(matchId)
            .onSuccess { _mediaContent.value = serverOnlyWhenReachable(it) { localFallback.mediaContent() } }
        repository.getInjuries(matchId)
            .onSuccess { _injuriesContent.value = serverOnlyWhenReachable(it) { localFallback.injuriesContent() } }
        repository.getInterviews(matchId)
            .onSuccess { _interviewsContent.value = serverOnlyWhenReachable(it) { localFallback.interviewsContent() } }
        repository.getTraining(matchId)
            .onSuccess { _trainingContent.value = serverOnlyWhenReachable(it) { localFallback.trainingContent() } }
    }

    fun refreshMatchDetail() {
        val match = _selectedMatch.value ?: return
        if (match.id.startsWith("local-")) {
            loadLocalMatchDetails(match)
        } else {
            viewModelScope.launch { loadMatchDetails(match.id) }
        }
    }

    private fun loadLocalMatchDetails(match: Match) {
        val matchId = match.id.removePrefix("local-")
        _matchStats.value = localFallback.matchStats(matchId, match)
        _matchLineups.value = localFallback.lineups(matchId, match)
        _prediction.value = localFallback.prediction(matchId, match)
        _commentary.value = localFallback.commentary(match)
        _mediaContent.value = localFallback.mediaContent()
        _injuriesContent.value = localFallback.injuriesContent()
        _interviewsContent.value = localFallback.interviewsContent()
        _trainingContent.value = localFallback.trainingContent()
        _matchEvents.value = localEventsFor(match)
    }

    private fun localEventsFor(match: Match?): List<MatchEvent> {
        if (match == null) return emptyList()
        return localFallback.commentary(match).mapIndexed { index, item ->
            MatchEvent("local-event-$index", match.id, EventType.UNKNOWN, item.minute, null, null, null, null, item.text)
        }
    }

    fun loadDiagnostic() {
        viewModelScope.launch { loadDiagnosticNow(includeRoutes = true) }
    }

    private suspend fun loadDiagnosticNow(includeRoutes: Boolean = true) {
        val diagnostic = repository.getDiagnostic(includeRoutes = includeRoutes)
        _diagnostic.value = diagnostic
        backendReachable = diagnostic.backendStatus.equals("ok", ignoreCase = true) || diagnostic.backendStatus.equals("healthy", ignoreCase = true) || diagnostic.backendStatus.equals("up", ignoreCase = true)
        if (backendReachable) _error.value = null
    }

    private fun registerFcmToken() {
        FirebaseMessaging.getInstance().token.addOnCompleteListener { task ->
            if (!task.isSuccessful) return@addOnCompleteListener
            val token = task.result ?: return@addOnCompleteListener
            viewModelScope.launch { repository.registerFcmToken(token) }
        }
    }

    private fun subscribeToDefaultTopics() {
        defaultNotificationTopics.forEach { topic ->
            FirebaseMessaging.getInstance().subscribeToTopic(topic).addOnFailureListener { }
        }
    }

    fun clearError() {
        _error.value = null
    }

    override fun onCleared() {
        super.onCleared()
        stopLivePolling()
    }

    companion object {
        private val defaultNotificationTopics = listOf(
            "algeria",
            "africa",
            "live_goals",
            "injuries",
            "interviews",
            "training",
            "lineups",
            "breaking_news"
        )
    }
}
