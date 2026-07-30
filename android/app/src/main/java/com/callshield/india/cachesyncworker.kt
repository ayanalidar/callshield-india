package com.callshield.india

import android.content.Context
import android.util.Log
import androidx.work.*

/**
 * Periodic background sync worker that refreshes the local scam number
 * cache from the CallShield API.
 *
 * Schedule: every 6 hours (per spec), with network constraint and
 *          exponential backoff on failure.
 *
 * Sync strategy:
 *   1. Fetch top 5000 blocked/scam numbers from GET /api/blocklist/top
 *   2. Upsert into Room (bulk insert with OnConflictStrategy.REPLACE)
 *   3. Delete cache entries older than 7 days
 */
class CacheSyncWorker(
    context: Context,
    params: WorkerParameters
) : CoroutineWorker(context, params) {

    companion object {
        private const val TAG = "CacheSyncWorker"
        private const val WORK_NAME = "callshield_cache_sync"

        // Sync every 6 hours with 30 min flex (per spec: "WorkManager periodic sync every 6 hours")
        private const val SYNC_INTERVAL_HOURS = 6L
        private const val FLEX_MINUTES = 30L

        // Delete entries not refreshed in 7 days
        private const val CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000L

        /**
         * Schedule the periodic cache sync. Safe to call multiple times —
         * ExistingPeriodicWorkPolicy.KEEP ensures only one instance exists.
         */
        fun schedule(context: Context) {
            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build()

            val request = PeriodicWorkRequestBuilder<CacheSyncWorker>(
                SYNC_INTERVAL_HOURS, java.util.concurrent.TimeUnit.HOURS,
                FLEX_MINUTES, java.util.concurrent.TimeUnit.MINUTES
            )
                .setConstraints(constraints)
                .setBackoffCriteria(
                    BackoffPolicy.EXPONENTIAL,
                    30, java.util.concurrent.TimeUnit.SECONDS
                )
                .build()

            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                WORK_NAME,
                ExistingPeriodicWorkPolicy.KEEP,
                request
            )

            Log.d(TAG, "Cache sync scheduled: every ${SYNC_INTERVAL_HOURS}h")
        }

        /**
         * Cancel the periodic sync.
         */
        fun cancel(context: Context) {
            WorkManager.getInstance(context).cancelUniqueWork(WORK_NAME)
            Log.d(TAG, "Cache sync cancelled")
        }
    }

    override suspend fun doWork(): Result {
        Log.d(TAG, "━━━ Cache sync started ━━━")
        val dao = CallShieldApplication.instance.database.cachedNumberDao()

        return try {
            // ── Step 1: Fetch blocklist top from API ──
            val blocklist = try {
                withTimeout(30_000L) {
                    val response = ApiClient.api.getBlocklistTop(limit = 5000)
                    if (response.isSuccessful) {
                        response.body() ?: emptyList()
                    } else {
                        Log.w(TAG, "Blocklist API returned HTTP ${response.code()}")
                        emptyList()
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "Failed to fetch blocklist: ${e.message}")
                emptyList()
            }

            if (blocklist.isNotEmpty()) {
                val now = System.currentTimeMillis()
                val entities = blocklist.map { entry ->
                    CachedNumber(
                        phoneNumber = entry.phoneNumber,
                        threatScore = entry.threatScore,
                        verdict = when {
                            entry.threatScore >= 80 -> "critical"
                            entry.threatScore >= 60 -> "scam"
                            entry.threatScore >= 35 -> "suspicious"
                            else -> "safe"
                        },
                        shouldBlock = entry.threatScore >= 60,
                        isScam = entry.threatScore >= 35,
                        scamType = entry.scamType,
                        severity = when {
                            entry.threatScore >= 80 -> "critical"
                            entry.threatScore >= 60 -> "high"
                            else -> "medium"
                        },
                        displayName = entry.scamType?.replace("_", " "),
                        carrier = entry.carrier,
                        telecomCircle = entry.telecomCircle,
                        location = entry.city,
                        city = entry.city,
                        state = entry.state,
                        country = "India",
                        isIndian = true,
                        numberType = "mobile",
                        isVoip = false,
                        reportCount = entry.reportCount,
                        verified = entry.verified,
                        source = "blocklist-sync",
                        lastChecked = now,
                        firstCached = now
                    )
                }
                dao.upsertAll(entities)
                Log.i(TAG, "Synced ${entities.size} entries from blocklist API")
            } else {
                // Fallback: refresh existing cached entries individually
                Log.d(TAG, "Blocklist empty — refreshing existing cache entries")
                val existing = dao.getAll()
                var refreshed = 0
                for (entry in existing) {
                    try {
                        val response = ApiClient.api.lookup(
                            ApiModels.LookupRequest(entry.phoneNumber, "strict")
                        )
                        if (response.isSuccessful && response.body() != null) {
                            val body = response.body()!!
                            dao.upsert(CachedNumber(
                                phoneNumber = entry.phoneNumber,
                                threatScore = body.threatScore,
                                verdict = body.verdict,
                                shouldBlock = body.shouldBlock,
                                isScam = body.isScam,
                                scamType = body.scamType,
                                severity = body.severity,
                                displayName = entry.displayName,
                                carrier = body.carrier,
                                telecomCircle = body.telecomCircle,
                                location = entry.location,
                                city = body.city,
                                state = body.state,
                                country = body.countryName,
                                isIndian = body.isIndian,
                                numberType = body.numberType,
                                isVoip = body.isVoip,
                                reportCount = body.dbMatch?.reportCount ?: 0,
                                verified = body.dbMatch?.verified ?: false,
                                source = body.dbMatch?.source,
                                lastChecked = System.currentTimeMillis()
                            ))
                            refreshed++
                        }
                    } catch (e: Exception) {
                        Log.w(TAG, "Refresh failed for ${entry.phoneNumber}: ${e.message}")
                    }
                }
                Log.i(TAG, "Refreshed $refreshed / ${existing.size} existing entries")
            }

            // ── Step 2: Purge stale entries ──
            val cutoff = System.currentTimeMillis() - CACHE_MAX_AGE_MS
            dao.deleteOlderThan(cutoff)

            val count = dao.count()
            Log.i(TAG, "━━━ Cache sync complete: $count entries in DB ━━━")
            Result.success()

        } catch (e: Exception) {
            Log.e(TAG, "Cache sync failed", e)
            Result.retry()
        }
    }
}
