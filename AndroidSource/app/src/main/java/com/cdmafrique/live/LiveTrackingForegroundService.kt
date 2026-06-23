package com.cdmafrique.live

import android.app.Service
import android.content.Intent
import android.os.IBinder
import com.cdmafrique.live.data.local.AppCacheStore
import com.cdmafrique.live.data.repository.MatchRepository
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
                val matches = repository.getLiveMatches().getOrDefault(emptyList())
                val text = if (matches.isEmpty()) {
                    "Aucun match live confirme actuellement."
                } else {
                    "${matches.size} match(s) live confirme(s)."
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
