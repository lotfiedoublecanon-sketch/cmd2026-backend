package com.cdmafrique.live.background

import android.content.Context
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import com.cdmafrique.live.data.local.AppCacheStore
import java.util.concurrent.TimeUnit

object SyncScheduler {
    private const val SYNC_ALL_PERIODIC = "cdm2026_sync_all_periodic"
    private const val SYNC_ALL_NOW = "cdm2026_sync_all_now"

    fun schedulePeriodic(context: Context) {
        val constraints = Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .build()
        val request = PeriodicWorkRequestBuilder<SyncAllWorker>(15, TimeUnit.MINUTES)
            .setConstraints(constraints)
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
            .build()
        WorkManager.getInstance(context.applicationContext).enqueueUniquePeriodicWork(
            SYNC_ALL_PERIODIC,
            ExistingPeriodicWorkPolicy.UPDATE,
            request
        )
        AppCacheStore(context).markWorkScheduled()
    }

    fun enqueueOneTimeSync(context: Context) {
        val constraints = Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .build()
        val request = OneTimeWorkRequestBuilder<SyncAllWorker>()
            .setConstraints(constraints)
            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
            .build()
        WorkManager.getInstance(context.applicationContext).enqueueUniqueWork(
            SYNC_ALL_NOW,
            ExistingWorkPolicy.REPLACE,
            request
        )
        AppCacheStore(context).markWorkScheduled()
    }
}
