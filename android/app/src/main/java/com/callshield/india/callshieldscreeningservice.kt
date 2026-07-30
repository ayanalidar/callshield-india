package com.callshield.india

import android.app.Notification
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
import android.os.Build
import android.telecom.Call
import android.telecom.CallScreeningService
import android.util.Log
import androidx.core.app.NotificationCompat
import com.callshield.india.ApiModels.LookupRequest
import com.callshield.india.ApiModels.LookupResponse
import kotlinx.coroutines.*
import retrofit2.Response

/**
 * CallScreeningService that intercepts incoming calls, normalizes the
 * Indian phone number, checks a local SQLite cache and then the live
 * API, and decides whether to block, allow, or flag the call.
 */
class CallShieldScreeningService : CallScreeningService() {

    companion object {
        private const val TAG = "CallShieldScreening"
        private const val CACHE_TTL_MS = 30 * 60 * 1000L // 30 minutes

        // Risk threshold categories
        private const val THREAT_HIGH = 70
        private const val THREAT_SUSPICIOUS = 40
    }

    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private lateinit var db: LocalDb
    private lateinit var dao: ScamNumberDao

    override fun onCreate() {
        super.onCreate()
        db = CallShieldApplication.instance.database
        dao = db.scamNumberDao()
        Log.d(TAG, "CallShield Screening Service created")
    }

    override fun onScreenCall(details: Call.Details) {
        val handle = details.handle ?: run {
            // No caller ID available — allow by default
            respondToCall(details, CallResponse.Builder().apply {
                setDisallowCall(false)
                setSkipCallLog(false)
            }.build())
            return
        }

        val rawNumber = handle.schemeSpecificPart
        Log.d(TAG, "Screening incoming call from: $rawNumber")

        // Normalize the Indian phone number
        val normalized = PhoneNumberUtils.normalize(rawNumber)
        if (normalized == null) {
            Log.w(TAG, "Could not normalize number: $rawNumber — allowing call")
            respondAllow(details)
            return
        }

        // Process lookup asynchronously — CallScreeningService gives us
        // a limited window (~5 sec) so we fire a coroutine and respond ASAP.
        scope.launch {
            try {
                val result = checkNumberAsync(normalized)
                respondBasedOnResult(details, normalized, result)
            } catch (e: Exception) {
                Log.e(TAG, "Screening error for $normalized", e)
                respondAllow(details)
            }
        }
    }

    /**
     * Check local cache first, then fall back to live API.
     * Returns the LookupResponse or null if unreachable.
     */
    private suspend fun checkNumberAsync(normalized: String): LookupResponse? {
        // 1. Check local SQLite cache
        val cached = dao.findByNumber(normalized)
        if (cached != null) {
            val age = System.currentTimeMillis() - cached.lastChecked
            if (age < CACHE_TTL_MS) {
                Log.d(TAG, "Cache HIT for $normalized (threat=${cached.threatScore})")
                return LookupResponse(
                    phoneNumber = cached.phoneNumber,
                    verifiedName = cached.verifiedName,
                    carrier = cached.carrier,
                    circle = cached.circle,
                    location = cached.location,
                    category = cached.category,
                    threatScore = cached.threatScore,
                    scamType = cached.scamType,
                    scamSubType = cached.scamSubType,
                    shouldBlock = cached.shouldBlock,
                    verdict = cached.verdict,
                    recommendation = null,
                    reportCount = cached.reportCount,
                    lastReported = null,
                    rawDetails = null
                )
            }
            Log.d(TAG, "Cache STALE for $normalized — will refresh from API")
        }

        // 2. Call live API
        return try {
            val response: Response<LookupResponse> = withTimeout(3_000L) {
                ApiClient.api.lookup(
                    LookupRequest(phoneNumber = normalized, protectionLevel = "high")
                )
            }

            if (response.isSuccessful && response.body() != null) {
                val body = response.body()!!
                // Upsert into cache
                dao.upsert(ScamNumber(
                    phoneNumber = normalized,
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
                ))
                Log.d(TAG, "API call OK for $normalized: verdict=${body.verdict}, threat=${body.threatScore}")
                body
            } else {
                Log.w(TAG, "API error ${response.code()} for $normalized — allowing call")
                null
            }
        } catch (e: Exception) {
            Log.e(TAG, "API unreachable for $normalized: ${e.message}")
            null
        }
    }

    /**
     * Map the lookup result to a CallResponse.
     */
    private fun respondBasedOnResult(
        details: Call.Details,
        normalized: String,
        result: LookupResponse?
    ) {
        if (result == null) {
            // API unreachable — allow the call (fail-open)
            respondAllow(details)
            return
        }

        val builder = CallResponse.Builder()

        if (result.shouldBlock || result.threatScore >= THREAT_HIGH) {
            // Block the call: disallow + reject (sends to voicemail/ends)
            builder.apply {
                setDisallowCall(true)
                setRejectCall(true)
                setSkipCallLog(false)
                setSkipNotification(false)
            }
            respondToCall(details, builder.build())

            // Show a post-block notification
            showBlockedNotification(normalized, result)
            Log.i(TAG, "BLOCKED call from $normalized (${result.scamType ?: "unknown"}, threat=${result.threatScore})")

        } else if (result.threatScore >= THREAT_SUSPICIOUS) {
            // Allow but flag as suspicious — user sees warning overlay
            builder.apply {
                setDisallowCall(false)
                setRejectCall(false)
                setSkipCallLog(false)
                setSkipNotification(false)
            }
            respondToCall(details, builder.build())
            Log.i(TAG, "SUSPICIOUS call from $normalized (${result.scamType ?: "unknown"}, threat=${result.threatScore}) — allowed with warning")

        } else {
            // Clean call — allow silently
            respondAllow(details)
            Log.d(TAG, "CLEAN call from $normalized ($result.verdict)")
        }
    }

    private fun respondAllow(details: Call.Details) {
        respondToCall(details, CallResponse.Builder().apply {
            setDisallowCall(false)
            setRejectCall(false)
            setSkipCallLog(false)
            setSkipNotification(false)
        }.build())
    }

    /**
     * Show a notification that a call was blocked.
     */
    private fun showBlockedNotification(normalized: String, result: LookupResponse) {
        val displayNumber = PhoneNumberUtils.forDisplay(normalized)
        val scamLabel = result.scamType ?: "Suspected Spam"

        val intent = Intent(this, CallShieldDialerActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val pendingIntent = PendingIntent.getActivity(
            this, 0, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(this, CallShieldApplication.CHANNEL_ALERTS)
            .setSmallIcon(android.R.drawable.ic_dialog_alert)
            .setContentTitle("Blocked: $scamLabel")
            .setContentText("Call from $displayNumber was blocked")
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .build()

        val nm = getSystemService(NotificationManager::class.java)
        nm.notify(normalized.hashCode(), notification)
    }

    override fun onDestroy() {
        scope.cancel()
        super.onDestroy()
    }
}
