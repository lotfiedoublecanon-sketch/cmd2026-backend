package com.cdmafrique.live

import android.app.Service
import android.content.Intent
import android.os.IBinder
import com.cdmafrique.live.data.local.AppCacheStore
import com.cdmafrique.live.data.model.EventType
import com.cdmafrique.live.data.model.Match
import com.cdmafrique.live.data.model.MatchEvent
import com.cdmafrique.live.data.repository.MatchRepository
import com.cdmafrique.live.data.repository.RepositoryLoadResult
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

class LiveTrackingForegroundService : Service() {
    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private var pollingJob: Job? = null
    private lateinit var cache: AppCacheStore
    private lateinit var repository: MatchRepository
    private var lastScoreSignature: String? = null
    private var hadLiveMatches = false
    private var initialEventsPrimed = false

    override fun onCreate() {
        super.onCreate()
        NotificationHelper.ensureChannels(this)
        cache = AppCacheStore(this)
        repository = MatchRepository(this)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_STOP -> {
                stopTracking()
                return START_NOT_STICKY
            }
            else -> startTracking()
        }
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        stopTracking()
        super.onDestroy()
    }

    private fun startTracking() {
        cache.setLiveTrackingActive(true)
        startForeground(
            NOTIFICATION_ID,
            NotificationHelper.liveNotification(this, "Suivi live actif", "Recherche des matchs en direct.")
        )
        if (pollingJob?.isActive == true) return
        pollingJob = serviceScope.launch {
            while (isActive) {
                cache.touchLiveTrackingHeartbeat()
                val liveResult = repository.getLiveMatchesState()
                val matches = when (liveResult) {
                    is RepositoryLoadResult.Success -> liveResult.data
                    is RepositoryLoadResult.Empty -> emptyList()
                    is RepositoryLoadResult.Error -> {
                        startForeground(
                            NOTIFICATION_ID,
                            NotificationHelper.liveNotification(
                                this@LiveTrackingForegroundService,
                                "Suivi live actif",
                                "Connexion live temporairement indisponible."
                            )
                        )
                        delay(60_000L)
                        continue
                    }
                    is RepositoryLoadResult.LocalFallback -> emptyList()
                }
                val text = if (matches.isEmpty()) {
                    "Aucun match live confirme actuellement."
                } else {
                    "${matches.size} match(s) live confirme(s)."
                }
                if (matches.isEmpty() && hadLiveMatches) {
                    NotificationHelper.pushNotification(
                        this@LiveTrackingForegroundService,
                        "Live termine",
                        "Aucun match live confirme actuellement.",
                        NotificationHelper.LIVE_CHANNEL_ID
                    )
                    stopTracking()
                    return@launch
                }
                if (matches.isNotEmpty()) {
                    hadLiveMatches = true
                    notifyNewGoalEvents(matches)
                }
                val signature = matches.joinToString("|") {
                    "${it.id}:${it.homeScore ?: "-"}-${it.awayScore ?: "-"}:${it.minute ?: "-"}"
                }
                if (signature.isNotBlank() && signature != lastScoreSignature && lastScoreSignature != null) {
                    NotificationHelper.pushNotification(
                        this@LiveTrackingForegroundService,
                        "Score live mis a jour",
                        text,
                        NotificationHelper.LIVE_CHANNEL_ID
                    )
                }
                lastScoreSignature = signature.ifBlank { null }
                startForeground(
                    NOTIFICATION_ID,
                    NotificationHelper.liveNotification(this@LiveTrackingForegroundService, "Suivi live actif", text)
                )
                delay(if (matches.isEmpty()) 60_000L else 15_000L)
            }
        }
    }

    private suspend fun notifyNewGoalEvents(matches: List<Match>) {
        val scoringEvents = mutableListOf<Pair<Match, MatchEvent>>()
        for (match in matches) {
            val eventsResult = repository.getMatchEvents(match.id)
            if (eventsResult.isFailure) return
            scoringEvents += eventsResult.getOrDefault(emptyList())
                .filter { it.type.isScoringEvent() }
                .map { event -> match to event }
        }

        if (!initialEventsPrimed) {
            scoringEvents.forEach { (match, event) ->
                cache.markLiveEventNotified(liveEventKey(match, event))
            }
            initialEventsPrimed = true
            return
        }

        scoringEvents.forEach { (match, event) ->
            val eventKey = liveEventKey(match, event)
            if (!cache.hasLiveEventBeenNotified(eventKey)) {
                cache.markLiveEventNotified(eventKey)
                NotificationHelper.pushNotification(
                    this,
                    "But confirme",
                    liveEventMessage(match, event),
                    NotificationHelper.LIVE_CHANNEL_ID
                )
            }
        }
    }

    private fun EventType.isScoringEvent(): Boolean =
        this == EventType.GOAL || this == EventType.OWN_GOAL || this == EventType.PENALTY

    private fun liveEventKey(match: Match, event: MatchEvent): String =
        listOf(
            match.id,
            event.id,
            event.type.key,
            event.minute.toString(),
            event.teamName.orEmpty(),
            event.playerName.orEmpty()
        ).joinToString("|")

    private fun liveEventMessage(match: Match, event: MatchEvent): String {
        val team = event.teamName?.takeIf { it.isNotBlank() } ?: "Equipe"
        val minute = event.minute.takeIf { it > 0 }?.let { "$it'" }
        val player = event.playerName?.takeIf { it.isNotBlank() }
        val score = if (match.homeScore != null && match.awayScore != null) {
            "${match.homeTeam.name} ${match.homeScore}-${match.awayScore} ${match.awayTeam.name}"
        } else {
            null
        }
        return when {
            player != null && minute != null && score != null -> "But $team ! $player $minute - $score"
            player != null && minute != null -> "But $team ! $player $minute"
            minute != null -> "But $team - $minute"
            else -> "But $team confirme"
        }
    }

    private fun stopTracking() {
        pollingJob?.cancel()
        pollingJob = null
        if (::cache.isInitialized) cache.setLiveTrackingActive(false)
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    companion object {
        const val ACTION_STOP = "com.cdmafrique.live.action.STOP_LIVE_TRACKING"
        private const val NOTIFICATION_ID = 202611
    }
}
