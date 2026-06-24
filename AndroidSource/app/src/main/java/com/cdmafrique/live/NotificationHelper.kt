package com.cdmafrique.live

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat

object NotificationHelper {
    const val LIVE_CHANNEL_ID = "live_scores"
    const val NEWS_CHANNEL_ID = "news"
    const val SYSTEM_CHANNEL_ID = "system_diagnostic"

    fun ensureChannels(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = context.getSystemService(NotificationManager::class.java)
        val channels = listOf(
            NotificationChannel(LIVE_CHANNEL_ID, "Live scores", NotificationManager.IMPORTANCE_LOW),
            NotificationChannel(NEWS_CHANNEL_ID, "News", NotificationManager.IMPORTANCE_DEFAULT),
            NotificationChannel(SYSTEM_CHANNEL_ID, "System / diagnostic", NotificationManager.IMPORTANCE_LOW)
        )
        manager.createNotificationChannels(channels)
    }

    fun liveNotification(context: Context, title: String, text: String): Notification {
        ensureChannels(context)
        val openApp = PendingIntent.getActivity(
            context,
            2026,
            Intent(context, MainActivity::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val stopIntent = PendingIntent.getService(
            context,
            2027,
            Intent(context, LiveTrackingForegroundService::class.java).setAction(LiveTrackingForegroundService.ACTION_STOP),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        return NotificationCompat.Builder(context, LIVE_CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentText(text)
            .setContentIntent(openApp)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .addAction(0, "Stop", stopIntent)
            .build()
    }

    fun pushNotification(context: Context, title: String, text: String, channelId: String = NEWS_CHANNEL_ID) {
        ensureChannels(context)
        val manager = context.getSystemService(NotificationManager::class.java)
        val openApp = PendingIntent.getActivity(
            context,
            2028,
            Intent(context, MainActivity::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val notification = NotificationCompat.Builder(context, channelId)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentText(text)
            .setContentIntent(openApp)
            .setAutoCancel(true)
            .build()
        manager.notify((System.currentTimeMillis() % Int.MAX_VALUE).toInt(), notification)
    }
}
