package com.cdmafrique.live.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews
import com.cdmafrique.live.MainActivity
import com.cdmafrique.live.R

class AfriqueScoreWidget : AppWidgetProvider() {
    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        ids.forEach { id -> updateWidget(context, manager, id) }
    }

    override fun onAppWidgetOptionsChanged(
        context: Context,
        manager: AppWidgetManager,
        appWidgetId: Int,
        newOptions: android.os.Bundle
    ) {
        updateWidget(context, manager, appWidgetId)
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        if (intent.action == ACTION_REFRESH) {
            updateAll(context)
        }
    }

    companion object {
        private const val ACTION_REFRESH = "com.cdmafrique.live.widget.REFRESH"

        fun updateAll(context: Context) {
            val manager = AppWidgetManager.getInstance(context)
            val ids = manager.getAppWidgetIds(ComponentName(context, AfriqueScoreWidget::class.java))
            ids.forEach { id -> updateWidget(context, manager, id) }
        }

        private fun updateWidget(context: Context, manager: AppWidgetManager, id: Int) {
            val views = RemoteViews(context.packageName, widgetLayoutFor(manager, id))
            views.setTextViewText(R.id.widget_title, "CDM 2026 Live")
            views.setTextViewText(R.id.widget_score, "- - -")
            views.setTextViewText(R.id.widget_status, "V5 connecte")
            views.setTextViewText(
                R.id.widget_detail,
                "Ouvre l'app pour voir Direct, Calendrier, Afrique et Diagnostic."
            )

            val openPendingIntent = PendingIntent.getActivity(
                context,
                10,
                Intent(context, MainActivity::class.java),
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.widget_root, openPendingIntent)

            val refreshIntent = Intent(context, AfriqueScoreWidget::class.java).apply {
                action = ACTION_REFRESH
            }
            val refreshPendingIntent = PendingIntent.getBroadcast(
                context,
                11,
                refreshIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.widget_refresh, refreshPendingIntent)

            manager.updateAppWidget(id, views)
        }

        private fun widgetLayoutFor(manager: AppWidgetManager, id: Int): Int {
            val options = manager.getAppWidgetOptions(id)
            val minHeight = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 110)
            val minWidth = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 180)
            return if (minHeight <= 70 || minWidth <= 130) {
                R.layout.widget_score_compact
            } else {
                R.layout.widget_score
            }
        }
    }
}
