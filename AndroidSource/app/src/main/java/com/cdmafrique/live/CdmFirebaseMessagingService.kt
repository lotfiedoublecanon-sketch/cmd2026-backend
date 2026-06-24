package com.cdmafrique.live

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.content.ContextCompat
import com.cdmafrique.live.background.SyncScheduler
import com.cdmafrique.live.data.local.AppCacheStore
import com.cdmafrique.live.data.repository.MatchRepository
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

class CdmFirebaseMessagingService : FirebaseMessagingService() {
    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    override fun onNewToken(token: String) {
        serviceScope.launch {
            MatchRepository(applicationContext).registerFcmToken(token)
        }
    }

    override fun onMessageReceived(message: RemoteMessage) {
        super.onMessageReceived(message)
        SyncScheduler.enqueueOneTimeSync(applicationContext)

        if (!canPostNotifications()) return
        val dedupeKey = message.messageId
            ?: message.data["eventKey"]
            ?: message.data["eventId"]
            ?: message.data["dedupeKey"]
        if (dedupeKey != null) {
            val cache = AppCacheStore(applicationContext)
            if (cache.hasNotificationBeenDisplayed(dedupeKey)) return
            cache.markNotificationDisplayed(dedupeKey)
        }
        val title = message.notification?.title
            ?: message.data["title"]
            ?: "CDM 2026 Live"
        val body = message.notification?.body
            ?: message.data["body"]
            ?: message.data["message"]
            ?: "Nouvelle mise a jour disponible."
        val channel = when (message.data["type"]?.lowercase()) {
            "goal", "live", "match_start", "match_end", "red_card" -> NotificationHelper.LIVE_CHANNEL_ID
            "system", "diagnostic" -> NotificationHelper.SYSTEM_CHANNEL_ID
            else -> NotificationHelper.NEWS_CHANNEL_ID
        }
        NotificationHelper.pushNotification(applicationContext, title, body, channel)
    }

    private fun canPostNotifications(): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return true
        return ContextCompat.checkSelfPermission(
            applicationContext,
            Manifest.permission.POST_NOTIFICATIONS
        ) == PackageManager.PERMISSION_GRANTED
    }
}
