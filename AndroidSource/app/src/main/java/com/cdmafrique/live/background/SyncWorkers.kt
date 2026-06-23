package com.cdmafrique.live.background

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.cdmafrique.live.data.repository.MatchRepository

class SyncAllWorker(
    appContext: Context,
    params: WorkerParameters
) : CoroutineWorker(appContext, params) {
    override suspend fun doWork(): Result {
        return try {
            val repository = MatchRepository(applicationContext)
            repository.getTodayMatches()
            repository.getUpcomingMatches()
            repository.getStandings()
            repository.getArticles()
            repository.getVideos()
            repository.getGlobalInterviews()
            repository.getGlobalInjuries()
            repository.getGlobalTraining()
            repository.getDiagnostic()
            Result.success()
        } catch (_: Exception) {
            Result.retry()
        }
    }
}

class SyncMatchesWorker(
    appContext: Context,
    params: WorkerParameters
) : CoroutineWorker(appContext, params) {
    override suspend fun doWork(): Result {
        return try {
            val repository = MatchRepository(applicationContext)
            repository.getLiveMatches()
            repository.getTodayMatches()
            repository.getUpcomingMatches()
            repository.getStandings()
            Result.success()
        } catch (_: Exception) {
            Result.retry()
        }
    }
}

class SyncMediaWorker(
    appContext: Context,
    params: WorkerParameters
) : CoroutineWorker(appContext, params) {
    override suspend fun doWork(): Result {
        return try {
            val repository = MatchRepository(applicationContext)
            repository.getArticles()
            repository.getVideos()
            repository.getGlobalInterviews()
            repository.getGlobalInjuries()
            repository.getGlobalTraining()
            Result.success()
        } catch (_: Exception) {
            Result.retry()
        }
    }
}

class SyncDiagnosticWorker(
    appContext: Context,
    params: WorkerParameters
) : CoroutineWorker(appContext, params) {
    override suspend fun doWork(): Result {
        return try {
            MatchRepository(applicationContext).getDiagnostic()
            Result.success()
        } catch (_: Exception) {
            Result.retry()
        }
    }
}
