package com.cdmafrique.live.ui

import android.app.Application
import android.content.Intent
import androidx.core.content.ContextCompat
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.cdmafrique.live.LiveTrackingForegroundService
import com.cdmafrique.live.NotificationHelper
import com.cdmafrique.live.background.SyncScheduler
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
 * ViewModel corrigé.
 *
 * Corrections :
 * 1. Erreurs techniques JAMAIS affichées à l'utilisateur
 * 2. _error contient uniquement des messages user-friendly
 * 3. loadLiveMatches() ne pollue plus _error si le backend est vide
 * 4. Les fallbacks locaux sont utilisés silencieusement
 * 5. Les erreurs techniques de parsing ou reseau ne remontent plus.
 */
class MainViewModel(application: Application) : AndroidViewModel(application) {

    private val repository = MatchRepository(application.applicationContext)
    private val localFallback = LocalWorldCupFallback(application.applicationContext)

    // ── Live Matches ────────────────────────────────────────
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

    // ── Match Detail ────────────────────────────────────────
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

    // ── Content Tabs ────────────────────────────────────────
    private val _mediaContent = MutableStateFlow<List<ContentResult>>(emptyList())
    val mediaContent: StateFlow<List<ContentResult>> = _mediaContent.asStateFlow()

    private val _injuriesContent = MutableStateFlow<List<ContentResult>>(emptyList())
    val injuriesContent: StateFlow<List<ContentResult>> = _injuriesContent.asStateFlow()

    private val _interviewsContent = MutableStateFlow<List<ContentResult>>(emptyList())
    val interviewsContent: StateFlow<List<ContentResult>> = _interviewsContent.asStateFlow()

    private val _trainingContent = MutableStateFlow<List<ContentResult>>(emptyList())
    val trainingContent: StateFlow<List<ContentResult>> = _trainingContent.asStateFlow()

    // ── Diagnostic ──────────────────────────────────────────
    private val _diagnostic = MutableStateFlow<AppDiagnostic?>(null)
    val diagnostic: StateFlow<AppDiagnostic?> = _diagnostic.asStateFlow()

    // ── Loading / Error ─────────────────────────────────────
    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    // FIX : _error ne contient PLUS JAMAIS de message technique.
    // Seuls des messages user-friendly y sont écrits.
    // Les erreurs réseau "normales" (pas de match live) ne sont plus des erreurs.
    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error.asStateFlow()

    private val _liveTrackingEnabled = MutableStateFlow(false)
    val liveTrackingEnabled: StateFlow<Boolean> = _liveTrackingEnabled.asStateFlow()

    // ── Polling ─────────────────────────────────────────────
    private var livePollingJob: Job? = null
    private var todayPollingJob: Job? = null

    // ── Initialization ──────────────────────────────────────

    init {
        NotificationHelper.ensureChannels(application.applicationContext)
        SyncScheduler.schedulePeriodic(application.applicationContext)
        restoreCachedSnapshot()
        loadInitialData()
        registerFcmToken()
        subscribeToDefaultTopics()
    }

    fun loadInitialData() {
        SyncScheduler.enqueueOneTimeSync(getApplication())
        viewModelScope.launch {
            _isLoading.value = true
            loadLiveMatches()
            loadTodayMatches()
            loadUpcomingMatches()
            loadStandings()
            loadArticles()
            loadGlobalContent()
            _isLoading.value = false
        }
        startLivePolling()
    }

    private fun restoreCachedSnapshot() {
        _liveMatches.value = repository.cachedLiveMatches()
        _todayMatches.value = repository.cachedTodayMatches()
        _upcomingMatches.value = repository.cachedUpcomingMatches()
        _standings.value = repository.cachedStandings()
        _articles.value = repository.cachedArticles()
        _mediaContent.value = repository.cachedVideos()
        _interviewsContent.value = repository.cachedInterviews()
        _injuriesContent.value = repository.cachedInjuries()
        _trainingContent.value = repository.cachedTraining()
        refreshCalendarFallback()
    }

    // ── Live Matches ────────────────────────────────────────
    //
    // FIX : les erreurs de connexion ne sont plus propagées dans _error
    // si c'est simplement que le backend n'a pas de données.
    // Les fallbacks locaux sont utilisés silencieusement.

    private suspend fun loadLiveMatches() {
        repository.getLiveMatches()
            .onSuccess { matches ->
                _liveMatches.value = matches
            }
            .onFailure {
                _liveMatches.value = repository.cachedLiveMatches()
            }
        refreshCalendarFallback()
    }

    private suspend fun loadTodayMatches() {
        repository.getTodayMatches()
            .onSuccess { matches ->
                _todayMatches.value = matches.ifEmpty {
                    showLocalNotice()
                    localFallback.todayMatches().ifEmpty { localFallback.upcomingMatches(7) }
                }
            }
            .onFailure {
                // Erreur réseau : utiliser le fallback local, pas d'erreur affichée
                showLocalNotice()
                _todayMatches.value = localFallback.todayMatches().ifEmpty { localFallback.upcomingMatches(7) }
            }
        refreshCalendarFallback()
    }

    private suspend fun loadUpcomingMatches() {
        repository.getUpcomingMatches()
            .onSuccess { matches ->
                _upcomingMatches.value = matches.ifEmpty {
                    showLocalNotice()
                    localFallback.upcomingMatches(30)
                }
            }
            .onFailure {
                showLocalNotice()
                _upcomingMatches.value = localFallback.upcomingMatches(30)
            }
        refreshCalendarFallback()
    }

    private fun refreshCalendarFallback() {
        val merged = (_liveMatches.value + _todayMatches.value + _upcomingMatches.value)
            .distinctBy { it.id }
        _calendarMatches.value = merged.ifEmpty { localFallback.upcomingMatches(30) }
    }

    fun refreshAll() {
        _error.value = null  // Effacer l'erreur au refresh
        SyncScheduler.enqueueOneTimeSync(getApplication())
        loadInitialData()
    }

    fun loadStandings() {
        viewModelScope.launch {
            repository.getStandings()
                .onSuccess { groups ->
                    _standings.value = groups.ifEmpty {
                        showLocalNotice()
                        localFallback.standings()
                    }
                }
                .onFailure {
                    showLocalNotice()
                    _standings.value = localFallback.standings()
                }
        }
    }

    fun loadArticles() {
        viewModelScope.launch {
            repository.getArticles()
                .onSuccess { items ->
                    _articles.value = items.ifEmpty {
                        showLocalNotice()
                        localFallback.fallbackArticles()
                    }
                }
                .onFailure {
                    showLocalNotice()
                    _articles.value = localFallback.fallbackArticles()
                }
        }
    }

    private suspend fun loadGlobalContent() {
        repository.getVideos()
            .onSuccess { items -> _mediaContent.value = items.ifEmpty { showLocalNotice(); localFallback.mediaContent() } }
            .onFailure { showLocalNotice(); _mediaContent.value = localFallback.mediaContent() }

        repository.getGlobalInjuries()
            .onSuccess { items -> _injuriesContent.value = items.ifEmpty { showLocalNotice(); localFallback.injuriesContent() } }
            .onFailure { showLocalNotice(); _injuriesContent.value = localFallback.injuriesContent() }

        repository.getGlobalInterviews()
            .onSuccess { items -> _interviewsContent.value = items.ifEmpty { showLocalNotice(); localFallback.interviewsContent() } }
            .onFailure { showLocalNotice(); _interviewsContent.value = localFallback.interviewsContent() }

        repository.getGlobalTraining()
            .onSuccess { items -> _trainingContent.value = items.ifEmpty { showLocalNotice(); localFallback.trainingContent() } }
            .onFailure { showLocalNotice(); _trainingContent.value = localFallback.trainingContent() }
    }

    private fun showLocalNotice() {
        repository.markFallbackUsed(true)
        _error.value = localFallback.localNotice()
    }

    // ── Polling ─────────────────────────────────────────────

    fun startLivePolling() {
        livePollingJob?.cancel()
        livePollingJob = viewModelScope.launch {
            while (isActive) {
                delay(15_000) // 15 seconds for live
                loadLiveMatches()
            }
        }
        todayPollingJob?.cancel()
        todayPollingJob = viewModelScope.launch {
            while (isActive) {
                delay(30_000) // 30 seconds for today
                loadTodayMatches()
                loadUpcomingMatches()
            }
        }
    }

    fun stopLivePolling() {
        livePollingJob?.cancel()
        todayPollingJob?.cancel()
    }

    // ── Match Detail ────────────────────────────────────────

    fun selectMatch(matchId: String) {
        viewModelScope.launch {
            _isLoading.value = true
            repository.getMatchById(matchId)
                .onSuccess { match ->
                    _selectedMatch.value = match
                    if (match != null) {
                        loadMatchDetails(matchId)
                    }
                }
                .onFailure { /* Match non trouvé, selectedMatch reste null */ }
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
            viewModelScope.launch {
                loadMatchDetails(match.id)
            }
        }
    }

    private suspend fun loadMatchDetails(matchId: String) {
        val currentMatch = _selectedMatch.value
        // Load events — silencieux si erreur
        repository.getMatchEvents(matchId)
            .onSuccess { events -> _matchEvents.value = events.ifEmpty { localEventsFor(currentMatch) } }

        // Load stats — null si indisponible, c'est normal
        repository.getMatchStats(matchId)
            .onSuccess { stats -> _matchStats.value = stats ?: currentMatch?.let { localFallback.matchStats(matchId, it) } }

        // Load lineups — null si indisponible, c'est normal
        repository.getMatchLineups(matchId)
            .onSuccess { lineups -> _matchLineups.value = lineups ?: currentMatch?.let { localFallback.lineups(matchId, it) } }

        // Load analysis — null si Gemini indisponible
        repository.getAnalysis(matchId)
            .onSuccess { _analysis.value = it }

        // Load prediction — null si indisponible
        repository.getPrediction(matchId)
            .onSuccess { prediction -> _prediction.value = prediction ?: currentMatch?.let { localFallback.prediction(matchId, it) } }

        // Load commentary — vide si indisponible
        repository.getCommentary(matchId)
            .onSuccess { items -> _commentary.value = items.ifEmpty { currentMatch?.let { localFallback.commentary(it) } ?: emptyList() } }

        // Load content tabs — vides si indisponibles
        repository.getMedia(matchId)
            .onSuccess { _mediaContent.value = it.ifEmpty { localFallback.mediaContent() } }

        repository.getInjuries(matchId)
            .onSuccess { _injuriesContent.value = it.ifEmpty { localFallback.injuriesContent() } }

        repository.getInterviews(matchId)
            .onSuccess { _interviewsContent.value = it.ifEmpty { localFallback.interviewsContent() } }

        repository.getTraining(matchId)
            .onSuccess { _trainingContent.value = it.ifEmpty { localFallback.trainingContent() } }
    }

    fun refreshMatchDetail() {
        val matchId = _selectedMatch.value?.id ?: return
        val match = _selectedMatch.value
        if (match?.id?.startsWith("local-") == true) {
            loadLocalMatchDetails(match)
            return
        }
        viewModelScope.launch {
            loadMatchDetails(matchId)
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

    // ── Diagnostic ──────────────────────────────────────────

    fun loadDiagnostic() {
        viewModelScope.launch {
            _diagnostic.value = repository.getDiagnostic()
        }
    }

    fun setLiveTrackingEnabled(enabled: Boolean) {
        _liveTrackingEnabled.value = enabled
        val context = getApplication<Application>().applicationContext
        val intent = Intent(context, LiveTrackingForegroundService::class.java)
        if (enabled) {
            ContextCompat.startForegroundService(context, intent)
        } else {
            context.startService(intent.setAction(LiveTrackingForegroundService.ACTION_STOP))
        }
        viewModelScope.launch {
            _diagnostic.value = repository.getDiagnostic()
        }
    }

    private fun registerFcmToken() {
        FirebaseMessaging.getInstance().token.addOnCompleteListener { task ->
            if (!task.isSuccessful) {
                return@addOnCompleteListener
            }
            val token = task.result ?: return@addOnCompleteListener
            viewModelScope.launch {
                repository.registerFcmToken(token)
            }
        }
    }

    private fun subscribeToDefaultTopics() {
        defaultNotificationTopics.forEach { topic ->
            FirebaseMessaging.getInstance().subscribeToTopic(topic).addOnFailureListener {
                // Silencieux : les notifications ne sont pas critiques
            }
        }
    }

    // ── Error handling ──────────────────────────────────────
    //
    // FIX : clearError() efface l'erreur.
    // Les erreurs ne sont plus jamais techniques.

    fun clearError() {
        _error.value = null
    }

    override fun onCleared() {
        super.onCleared()
        stopLivePolling()
    }

    companion object {
        private val defaultNotificationTopics = listOf(
            "global",
            "worldcup2026",
            "algeria",
            "africa",
            "live",
            "live_goals",
            "injuries",
            "interviews",
            "training",
            "lineups",
            "breaking_news"
        )
    }
}
