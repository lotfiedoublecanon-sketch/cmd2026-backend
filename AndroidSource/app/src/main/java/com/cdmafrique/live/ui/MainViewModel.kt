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
import com.cdmafrique.live.data.repository.RepositoryLoadResult
import com.google.firebase.messaging.FirebaseMessaging
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import java.time.Instant

data class ScreenDataState(
    val items: Int = 0,
    val isLoading: Boolean = false,
    val source: DataSource = DataSource.EMPTY_SERVER,
    val errorMessage: String? = null,
    val lastUpdated: String? = null
) {
    val noticeMessage: String?
        get() = when (source) {
            DataSource.LOCAL_FALLBACK -> errorMessage ?: "Aucune donnee serveur pour cet ecran, affichage des donnees locales."
            DataSource.ERROR -> errorMessage ?: "Donnees indisponibles pour cet ecran."
            else -> null
        }
}

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

    private val _screenStates = MutableStateFlow<Map<String, ScreenDataState>>(emptyMap())
    val screenStates: StateFlow<Map<String, ScreenDataState>> = _screenStates.asStateFlow()

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
            loadTodayMatchesRobust()
            loadUpcomingMatchesRobust()
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
        setScreenState("Live", _liveMatches.value.size, sourceForCache(_liveMatches.value))
        setScreenState("Today", _todayMatches.value.size, sourceForCache(_todayMatches.value))
        setScreenState("Upcoming", _upcomingMatches.value.size, sourceForCache(_upcomingMatches.value))
        setScreenState("Standings", _standings.value.size, sourceForCache(_standings.value))
        setScreenState("News", _articles.value.size, sourceForCache(_articles.value))
        setScreenState("Videos", _mediaContent.value.size, sourceForCache(_mediaContent.value))
        setScreenState("Interviews", _interviewsContent.value.size, sourceForCache(_interviewsContent.value))
        setScreenState("Injuries", _injuriesContent.value.size, sourceForCache(_injuriesContent.value))
        setScreenState("Training", _trainingContent.value.size, sourceForCache(_trainingContent.value))
        refreshCalendarState()
    }

    // ── Live Matches ────────────────────────────────────────
    //
    // FIX : les erreurs de connexion ne sont plus propagées dans _error
    // si c'est simplement que le backend n'a pas de données.
    // Les fallbacks locaux sont utilisés silencieusement.

    private suspend fun loadLiveMatches() {
        setScreenLoading("Live", true)
        when (val result = repository.getLiveMatchesState()) {
            is RepositoryLoadResult.Success -> {
                _liveMatches.value = result.data
                setScreenState("Live", result.data.size, result.source)
            }
            is RepositoryLoadResult.Empty -> {
                _liveMatches.value = emptyList()
                setScreenState("Live", 0, result.source)
            }
            is RepositoryLoadResult.Error -> {
                _liveMatches.value = emptyList()
                setScreenState("Live", 0, DataSource.ERROR, result.message)
            }
            is RepositoryLoadResult.LocalFallback -> Unit
        }
        refreshCalendarState()
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

    private suspend fun loadTodayMatchesRobust() {
        setScreenLoading("Today", true)
        when (val result = repository.getTodayMatchesState()) {
            is RepositoryLoadResult.Success -> {
                _todayMatches.value = result.data
                setScreenState("Today", result.data.size, result.source)
            }
            is RepositoryLoadResult.Empty -> {
                _todayMatches.value = emptyList()
                setScreenState("Today", 0, result.source)
            }
            is RepositoryLoadResult.Error -> {
                val fallback = localFallback.todayMatches().ifEmpty { localFallback.upcomingMatches(7) }
                _todayMatches.value = fallback
                setFallbackOrError("Today", fallback.size, result)
            }
            is RepositoryLoadResult.LocalFallback -> Unit
        }
        refreshCalendarState()
    }

    private suspend fun loadUpcomingMatchesRobust() {
        setScreenLoading("Upcoming", true)
        when (val result = repository.getUpcomingMatchesState()) {
            is RepositoryLoadResult.Success -> {
                _upcomingMatches.value = result.data
                setScreenState("Upcoming", result.data.size, result.source)
            }
            is RepositoryLoadResult.Empty -> {
                _upcomingMatches.value = emptyList()
                setScreenState("Upcoming", 0, result.source)
            }
            is RepositoryLoadResult.Error -> {
                val fallback = localFallback.upcomingMatches(30)
                _upcomingMatches.value = fallback
                setFallbackOrError("Upcoming", fallback.size, result)
            }
            is RepositoryLoadResult.LocalFallback -> Unit
        }
        refreshCalendarState()
    }

    private fun refreshCalendarState() {
        val merged = (_liveMatches.value + _todayMatches.value + _upcomingMatches.value)
            .distinctBy { it.id }
        if (merged.isNotEmpty()) {
            _calendarMatches.value = merged
            val source = bestMatchSource()
            setScreenState("Home", merged.size, source)
            setScreenState("Calendar", merged.size, source)
            setScreenState("Africa", merged.size, source)
        } else {
            _calendarMatches.value = emptyList()
            setScreenState("Home", 0, DataSource.EMPTY_SERVER)
            setScreenState("Calendar", 0, DataSource.EMPTY_SERVER)
            setScreenState("Africa", 0, DataSource.EMPTY_SERVER)
        }
    }

    fun refreshAll() {
        _error.value = null  // Effacer l'erreur au refresh
        SyncScheduler.enqueueOneTimeSync(getApplication())
        loadInitialData()
    }

    fun loadStandings() {
        viewModelScope.launch {
            setScreenLoading("Standings", true)
            when (val result = repository.getStandingsState()) {
                is RepositoryLoadResult.Success -> {
                    _standings.value = result.data
                    setScreenState("Standings", result.data.size, result.source)
                }
                is RepositoryLoadResult.Empty -> {
                    _standings.value = emptyList()
                    setScreenState("Standings", 0, result.source)
                }
                is RepositoryLoadResult.Error -> {
                    val fallback = localFallback.standings()
                    _standings.value = fallback
                    setFallbackOrError("Standings", fallback.size, result)
                }
                is RepositoryLoadResult.LocalFallback -> Unit
            }
        }
    }

    fun loadArticles() {
        viewModelScope.launch {
            setScreenLoading("News", true)
            when (val result = repository.getArticlesState()) {
                is RepositoryLoadResult.Success -> {
                    _articles.value = result.data
                    setScreenState("News", result.data.size, result.source)
                    setScreenState("Articles", result.data.size, result.source)
                }
                is RepositoryLoadResult.Empty -> {
                    _articles.value = emptyList()
                    setScreenState("News", 0, result.source)
                    setScreenState("Articles", 0, result.source)
                }
                is RepositoryLoadResult.Error -> {
                    val fallback = localFallback.fallbackArticles()
                    _articles.value = fallback
                    setFallbackOrError("News", fallback.size, result)
                    setFallbackOrError("Articles", fallback.size, result)
                }
                is RepositoryLoadResult.LocalFallback -> Unit
            }
        }
    }

    private suspend fun loadGlobalContent() {
        loadVideosContent()
        loadGlobalInjuriesContent()
        loadGlobalInterviewsContent()
        loadGlobalTrainingContent()
    }

    fun loadVideos() {
        viewModelScope.launch { loadVideosContent() }
    }

    fun loadGlobalInjuries() {
        viewModelScope.launch { loadGlobalInjuriesContent() }
    }

    fun loadGlobalInterviews() {
        viewModelScope.launch { loadGlobalInterviewsContent() }
    }

    fun loadGlobalTraining() {
        viewModelScope.launch { loadGlobalTrainingContent() }
    }

    fun loadAllGlobalContent() {
        viewModelScope.launch { loadGlobalContent() }
    }

    private suspend fun loadVideosContent() {
        setScreenLoading("Videos", true)
        loadContentScreen(
            key = "Videos",
            result = repository.getVideosState(),
            fallbackItems = localFallback.mediaContent(),
            target = _mediaContent
        )
    }

    private suspend fun loadGlobalInjuriesContent() {
        setScreenLoading("Injuries", true)
        loadContentScreen(
            key = "Injuries",
            result = repository.getGlobalInjuriesState(),
            fallbackItems = localFallback.injuriesContent(),
            target = _injuriesContent
        )
    }

    private suspend fun loadGlobalInterviewsContent() {
        setScreenLoading("Interviews", true)
        loadContentScreen(
            key = "Interviews",
            result = repository.getGlobalInterviewsState(),
            fallbackItems = localFallback.interviewsContent(),
            target = _interviewsContent
        )
    }

    private suspend fun loadGlobalTrainingContent() {
        setScreenLoading("Training", true)
        loadContentScreen(
            key = "Training",
            result = repository.getGlobalTrainingState(),
            fallbackItems = localFallback.trainingContent(),
            target = _trainingContent
        )
    }

    private fun applyGlobalContent(
        items: List<ContentResult>,
        fallbackItems: List<ContentResult>,
        cachedItems: List<ContentResult>,
        target: MutableStateFlow<List<ContentResult>>
    ) {
        when {
            items.isNotEmpty() -> {
                target.value = items
                clearLocalFallbackState()
            }
            cachedItems.isNotEmpty() -> {
                target.value = cachedItems
                clearLocalFallbackState()
            }
            fallbackItems.isNotEmpty() -> {
                showLocalNotice()
                target.value = fallbackItems
            }
            else -> {
                target.value = emptyList()
            }
        }
    }

    private fun applyCachedOrLocalContent(
        cachedItems: List<ContentResult>,
        fallbackItems: List<ContentResult>,
        target: MutableStateFlow<List<ContentResult>>
    ) {
        when {
            cachedItems.isNotEmpty() -> {
                target.value = cachedItems
                clearLocalFallbackState()
            }
            fallbackItems.isNotEmpty() -> {
                showLocalNotice()
                target.value = fallbackItems
            }
            else -> {
                target.value = emptyList()
            }
        }
    }

    private fun clearLocalFallbackState() {
        repository.markFallbackUsed(false)
        if (_error.value == localFallback.localNotice()) {
            _error.value = null
        }
    }

    private fun showLocalNotice() {
        repository.markFallbackUsed(true)
        _error.value = localFallback.localNotice()
    }

    private fun loadContentScreen(
        key: String,
        result: RepositoryLoadResult<List<ContentResult>>,
        fallbackItems: List<ContentResult>,
        target: MutableStateFlow<List<ContentResult>>
    ) {
        setScreenLoading(key, true)
        when (result) {
            is RepositoryLoadResult.Success -> {
                target.value = result.data
                setScreenState(key, result.data.size, result.source)
            }
            is RepositoryLoadResult.Empty -> {
                target.value = emptyList()
                setScreenState(key, 0, result.source)
            }
            is RepositoryLoadResult.Error -> {
                target.value = fallbackItems
                setFallbackOrError(key, fallbackItems.size, result)
            }
            is RepositoryLoadResult.LocalFallback -> {
                target.value = result.data
                setScreenState(key, result.data.size, DataSource.LOCAL_FALLBACK, result.reason)
            }
        }
    }

    private fun setFallbackOrError(
        key: String,
        itemCount: Int,
        result: RepositoryLoadResult.Error<*>
    ) {
        if (result.canUseLocalFallback && itemCount > 0) {
            setScreenState(
                key,
                itemCount,
                DataSource.LOCAL_FALLBACK,
                "Cache serveur indisponible pour $key, donnees locales utilisees uniquement sur cet ecran."
            )
        } else {
            setScreenState(key, itemCount, DataSource.ERROR, result.message)
        }
    }

    private fun setScreenLoading(key: String, isLoading: Boolean) {
        val current = _screenStates.value[key] ?: ScreenDataState()
        setScreenState(
            key = key,
            itemCount = current.items,
            source = current.source,
            errorMessage = current.errorMessage,
            isLoading = isLoading,
            lastUpdated = current.lastUpdated
        )
    }

    private fun setScreenState(
        key: String,
        itemCount: Int,
        source: DataSource,
        errorMessage: String? = null,
        isLoading: Boolean = false,
        lastUpdated: String? = Instant.now().toString()
    ) {
        val updated = _screenStates.value.toMutableMap()
        updated[key] = ScreenDataState(
            items = itemCount,
            isLoading = isLoading,
            source = source,
            errorMessage = if (source == DataSource.RENDER || source == DataSource.BACKEND_CACHE || source == DataSource.EMPTY_SERVER) null else errorMessage,
            lastUpdated = lastUpdated
        )
        _screenStates.value = updated
        repository.markFallbackUsed(updated.values.any { it.source == DataSource.LOCAL_FALLBACK })
        if (source == DataSource.RENDER || source == DataSource.BACKEND_CACHE) {
            _error.value = null
        }
    }

    private fun sourceForCache(items: List<*>): DataSource =
        if (items.isNotEmpty()) DataSource.BACKEND_CACHE else DataSource.EMPTY_SERVER

    private fun bestMatchSource(): DataSource {
        val sources = listOf("Live", "Today", "Upcoming").mapNotNull { _screenStates.value[it]?.source }
        return when {
            DataSource.RENDER in sources -> DataSource.RENDER
            DataSource.BACKEND_CACHE in sources -> DataSource.BACKEND_CACHE
            DataSource.LOCAL_FALLBACK in sources -> DataSource.LOCAL_FALLBACK
            DataSource.ERROR in sources -> DataSource.ERROR
            else -> DataSource.EMPTY_SERVER
        }
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
                loadTodayMatchesRobust()
                loadUpcomingMatchesRobust()
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
        val isLocalMatch = currentMatch?.id?.startsWith("local-") == true
        // Load events — silencieux si erreur
        repository.getMatchEvents(matchId)
            .onSuccess { events ->
                _matchEvents.value = events.ifEmpty {
                    if (isLocalMatch) localEventsFor(currentMatch) else emptyList()
                }
            }

        // Load stats — null si indisponible, c'est normal
        repository.getMatchStats(matchId)
            .onSuccess { stats -> _matchStats.value = stats ?: currentMatch?.takeIf { isLocalMatch }?.let { localFallback.matchStats(matchId, it) } }

        // Load lineups — null si indisponible, c'est normal
        repository.getMatchLineups(matchId)
            .onSuccess { lineups -> _matchLineups.value = lineups ?: currentMatch?.takeIf { isLocalMatch }?.let { localFallback.lineups(matchId, it) } }

        // Load analysis — null si Gemini indisponible
        repository.getAnalysis(matchId)
            .onSuccess { _analysis.value = it }

        // Load prediction — null si indisponible
        repository.getPrediction(matchId)
            .onSuccess { prediction -> _prediction.value = prediction ?: currentMatch?.takeIf { isLocalMatch }?.let { localFallback.prediction(matchId, it) } }

        // Load commentary — vide si indisponible
        repository.getCommentary(matchId)
            .onSuccess { items -> _commentary.value = items.ifEmpty { currentMatch?.takeIf { isLocalMatch }?.let { localFallback.commentary(it) } ?: emptyList() } }

        // Load content tabs — vides si indisponibles
        repository.getMedia(matchId)
            .onSuccess { _mediaContent.value = it.ifEmpty { if (isLocalMatch) localFallback.mediaContent() else emptyList() } }

        repository.getInjuries(matchId)
            .onSuccess { _injuriesContent.value = it.ifEmpty { if (isLocalMatch) localFallback.injuriesContent() else emptyList() } }

        repository.getInterviews(matchId)
            .onSuccess { _interviewsContent.value = it.ifEmpty { if (isLocalMatch) localFallback.interviewsContent() else emptyList() } }

        repository.getTraining(matchId)
            .onSuccess { _trainingContent.value = it.ifEmpty { if (isLocalMatch) localFallback.trainingContent() else emptyList() } }
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
