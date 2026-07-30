package com.callshield.india

import android.content.Context
import android.util.Log
import androidx.work.*

/**
 * Periodic background sync worker that refreshes the local scam number
 * cache from the API. Scheduled to run every 30 minutes with a 5-minute flex.
 */
class CacheSyncWorker(
    context: Context,
    params: WorkerParameters
) : CoroutineWorker(context, params) {

    companion object {
        private const val TAG = "CacheSyncWorker"
        private const val WORK_NAME = "callshield_cache_sync"

        /**
         * Schedule periodic cache sync.
         */
        fun schedule(context: Context) {
            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build()

            val request = PeriodicWorkRequestBuilder<CacheSyncWorker>(
                30, java.util.concurrent.TimeUnit.MINUTES,
                5, java.util.concurrent.TimeUnit.MINUTES
            )
                .setConstraints(constraints)
                .setBackoffCriteria(
                    BackoffPolicy.EXPONENTIAL,
                    10, java.util.concurrent.TimeUnit.SECONDS
                )
                .build()

            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                WORK_NAME,
                ExistingPeriodicWorkPolicy.KEEP,
                request
            )

            Log.d(TAG, "Cache sync scheduled: every 30 minutes")
        }

        fun cancel(context: Context) {
            WorkManager.getInstance(context).cancelUniqueWork(WORK_NAME)
        }
    }

    override suspend fun doWork(): Result {
        Log.d(TAG, "Cache sync started")
        val db = CallShieldApplication.instance.database
        val dao = db.scamNumberDao()

        return try {
            // Get all cached numbers and refresh them
            val entries = dao.getAll()
            var refreshed = 0

            for (entry in entries) {
                try {
                    val response = ApiClient.api.lookup(
                        ApiModels.LookupRequest(entry.phoneNumber)
                    )
                    if (response.isSuccessful && response.body() != null) {
                        val body = response.body()!!
                        dao.upsert(
                            ScamNumber(
                                phoneNumber = entry.phoneNumber,
                                threatScore = body.threatScore,
                                scamType = body.scamType,
                                scamSubType = body.scamSubType,
                                carrier = body.carrier,
                                circle = body.circle,
                                location = body.location,
                                category = body.category,
                                verifiedName = body.verifiedName,
                                shouldBlock = body.shouldBlock,
                                verdict = body.verdict,
                                reportCount = body.reportCount,
                                lastChecked = System.currentTimeMillis()
                            )
                        )
                        refreshed++
                    }
                } catch (e: Exception) {
                    Log.w(TAG, "Failed to refresh ${entry.phoneNumber}: ${e.message}")
                }
            }

            // Delete entries older than 7 days
            val sevenDaysAgo = System.currentTimeMillis() - 7 * 24 * 60 * 60 * 1000L
            dao.deleteOlderThan(sevenDaysAgo)

            Log.d(TAG, "Cache sync complete: refreshed $refreshed entries")
            Result.success()

        } catch (e: Exception) {
            Log.e(TAG, "Cache sync failed", e)
            Result.retry()
        }
    }
}
