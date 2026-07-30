package com.callshield.india

import android.app.Notification
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
import android.telecom.Call
import android.telecom.CallScreeningService
import android.util.Log
import androidx.core.app.NotificationCompat
import com.callshield.india.ApiModels.*
import kotlinx.coroutines.*
import retrofit2.Response

/**
 * CallShield CallScreeningService — intercepts every incoming call, normalizes
 * the Indian phone number, checks a local Room cache and then the live API,
 * and decides whether to block, allow, or warn about the caller.
 *
 * Block logic (per spec):
 *   threatScore >= 60  → BLOCK (silently reject)
 *   threatScore >= 35  → WARN  (allow but show overlay with caller info)
 *   else               → ALLOW (normal ringing)
 */
class CallShieldScreeningService : CallScreeningService() {

    companion object {
        private const val TAG = "CallShieldScreening"

        // Cache TTLs per spec:
        //   24 hours for known numbers, 7 days for verified scams
        private const val TTL_KNOWN_MS = 24 * 60 * 60 * 1000L
        private const val TTL_VERIFIED_MS = 7 * 24 * 60 * 60 * 1000L

        // API call timeout (must stay well under the ~5s screening window)
        private const val API_TIMEOUT_MS = 3_500L

        // Threat thresholds
        private const val THRESHOLD_BLOCK = 60
        private const val THRESHOLD_WARN = 35

        /** Persisted caller ID result for the InCallService to pick up. */
        @Volatile
        var lastCallerId: CallerIdResponse? = null
            private set
    }

    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private lateinit var dao: CachedNumberDao

    override fun onCreate() {
        super.onCreate()
        dao = CallShieldApplication.instance.database.cachedNumberDao()
        Log.d(TAG, "Screening service created")
    }

    override fun onScreenCall(details: Call.Details) {
        val handle = details.handle ?: run {
            // No caller ID (hidden/private) — allow with a note
            Log.d(TAG, "No handle — allowing call with no caller info")
            respondAllow(details)
            return
        }

        val rawNumber = handle.schemeSpecificPart
        Log.d(TAG, "Screening: $rawNumber")

        // Normalize to +91XXXXXXXXXX
        val normalized = PhoneNumberUtils.normalize(rawNumber)
        if (normalized == null) {
            Log.w(TAG, "Cannot normalize '$rawNumber' — allowing")
            respondAllow(details)
            return
        }

        // Fire async — respond within the screening window
        scope.launch {
            try {
                val (lookupResult, callerIdResult) = queryBoth(normalized)
                // Store caller ID for InCallService
                lastCallerId = callerIdResult
                respondBasedOnResult(details, normalized, lookupResult)
            } catch (e: CancellationException) {
                Log.w(TAG, "Screening cancelled for $normalized")
                respondAllow(details)
            } catch (e: Exception) {
                Log.e(TAG, "Screening error for $normalized", e)
                // Fail-open: allow the call if screening crashes
                respondAllow(details)
            }
        }
    }

    /**
     * Query both /api/lookup and /api/caller-id in parallel, with local cache fallback.
     */
    private suspend fun queryBoth(normalized: String): Pair<LookupResponse?, CallerIdResponse?> {
        // 1. Check local cache
        val cached = dao.findByNumber(normalized)
        if (cached != null) {
            val age = System.currentTimeMillis() - cached.lastChecked
            val ttl = if (cached.verified) TTL_VERIFIED_MS else TTL_KNOWN_MS
            if (age < ttl) {
                Log.d(TAG, "Cache HIT: $normalized (threat=${cached.threatScore}, age=${age / 1000}s)")
                val lookup = cached.toLookupResponse()
                val callerId = cached.toCallerIdResponse()
                return Pair(lookup, callerId)
            }
            Log.d(TAG, "Cache STALE: $normalized (age=${age / 1000}s)")
        }

        // 2. Call both APIs in parallel with a timeout
        return try {
            val lookupDeferred = async { fetchLookup(normalized) }
            val callerIdDeferred = async { fetchCallerId(normalized) }

            val (lookup, callerId) = withTimeout(API_TIMEOUT_MS) {
                Pair(lookupDeferred.await(), callerIdDeferred.await())
            }

            // Cache the results
            cacheResults(normalized, lookup, callerId)

            Pair(lookup, callerId)
        } catch (e: TimeoutCancellationException) {
            Log.w(TAG, "API timeout for $normalized — using stale cache if available")
            // Fall back to stale cache
            val stale = cached
            if (stale != null) {
                Pair(stale.toLookupResponse(), stale.toCallerIdResponse())
            } else {
                Pair(null, null)
            }
        }
    }

    private suspend fun fetchLookup(normalized: String): LookupResponse? {
        return try {
            val response: Response<LookupResponse> = ApiClient.api.lookup(
                LookupRequest(phoneNumber = normalized, protectionLevel = "strict")
            )
            if (response.isSuccessful) {
                Log.d(TAG, "Lookup OK: $normalized → ${response.body()?.verdict}")
                response.body()
            } else {
                Log.w(TAG, "Lookup HTTP ${response.code()} for $normalized")
                null
            }
        } catch (e: Exception) {
            Log.e(TAG, "Lookup failed: ${e.message}")
            null
        }
    }

    private suspend fun fetchCallerId(normalized: String): CallerIdResponse? {
        return try {
            val response: Response<CallerIdResponse> = ApiClient.api.callerId(
                CallerIdRequest(phoneNumber = normalized)
            )
            if (response.isSuccessful) {
                Log.d(TAG, "CallerID OK: $normalized → ${response.body()?.displayName}")
                response.body()
            } else {
                Log.w(TAG, "CallerID HTTP ${response.code()} for $normalized")
                null
            }
        } catch (e: Exception) {
            Log.e(TAG, "CallerID failed: ${e.message}")
            null
        }
    }

    /**
     * Persist lookup results into Room cache.
     */
    private suspend fun cacheResults(
        normalized: String,
        lookup: LookupResponse?,
        callerId: CallerIdResponse?
    ) {
        val entry = CachedNumber(
            phoneNumber = normalized,
            threatScore = lookup?.threatScore ?: callerId?.threatScore ?: 0,
            verdict = lookup?.verdict ?: callerId?.verdict ?: "unknown",
            shouldBlock = lookup?.shouldBlock ?: callerId?.shouldBlock ?: false,
            isScam = lookup?.isScam ?: callerId?.isScam ?: false,
            scamType = lookup?.scamType ?: callerId?.scamType,
            severity = lookup?.severity ?: callerId?.severity,
            displayName = callerId?.displayName,
            carrier = lookup?.carrier ?: callerId?.carrier,
            telecomCircle = lookup?.telecomCircle ?: callerId?.telecomCircle,
            location = callerId?.location,
            city = lookup?.city ?: callerId?.city,
            state = lookup?.state ?: callerId?.state,
            country = callerId?.country,
            isIndian = lookup?.isIndian ?: callerId?.isIndian ?: true,
            numberType = lookup?.numberType ?: callerId?.numberType,
            isVoip = lookup?.isVoip ?: callerId?.isVoip ?: false,
            reportCount = lookup?.dbMatch?.reportCount ?: callerId?.reportCount ?: 0,
            verified = lookup?.dbMatch?.verified ?: callerId?.verified ?: false,
            source = lookup?.dbMatch?.source ?: callerId?.source,
            lastChecked = System.currentTimeMillis()
        )
        dao.upsert(entry)
    }

    /**
     * Apply the verdict: BLOCK / WARN / ALLOW based on threatScore.
     */
    private fun respondBasedOnResult(
        details: Call.Details,
        normalized: String,
        result: LookupResponse?
    ) {
        if (result == null) {
            // API unreachable, no cache — allow (fail-open)
            Log.w(TAG, "No lookup data for $normalized — allowing")
            respondAllow(details)
            return
        }

        val threatScore = result.threatScore
        val builder = CallResponse.Builder()

        when {
            // BLOCK: threatScore >= 60 — silently reject
            threatScore >= THRESHOLD_BLOCK -> {
                builder.setDisallowCall(true)
                builder.setRejectCall(true)
                builder.setSkipCallLog(false)   // keep in log so user sees it was blocked
                builder.setSkipNotification(false)
                respondToCall(details, builder.build())
                showBlockedNotification(normalized, result)
                Log.i(TAG, "🚫 BLOCKED: $normalized (${result.scamType ?: "scam"}, score=$threatScore)")
            }

            // WARN: threatScore >= 35 — allow but show overlay
            threatScore >= THRESHOLD_WARN -> {
                builder.setDisallowCall(false)
                builder.setRejectCall(false)
                builder.setSkipCallLog(false)
                builder.setSkipNotification(false)
                respondToCall(details, builder.build())
                Log.i(TAG, "⚠️ WARN: $normalized (${result.scamType ?: "suspicious"}, score=$threatScore)")
            }

            // ALLOW: threatScore < 35 — normal ringing
            else -> {
                respondAllow(details)
                Log.d(TAG, "✅ ALLOW: $normalized (score=$threatScore)")
            }
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
     * Post a notification when a call is blocked, so the user knows.
     */
    private fun showBlockedNotification(normalized: String, result: LookupResponse) {
        val displayNumber = PhoneNumberUtils.forDisplay(normalized)
        val scamLabel = result.scamType?.replace("_", " ")?.replaceFirstChar { it.uppercase() }
            ?: "Suspected Spam"

        val intent = Intent(this, CallShieldDialerActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val pendingIntent = PendingIntent.getActivity(
            this, 0, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(this, CallShieldApplication.CHANNEL_ALERTS)
            .setSmallIcon(android.R.drawable.ic_dialog_alert)
            .setContentTitle("Call Blocked: $scamLabel")
            .setContentText("Call from $displayNumber was blocked by CallShield")
            .setStyle(NotificationCompat.BigTextStyle()
                .bigText("$displayNumber\n$scamLabel • Threat Score: ${result.threatScore}/100\nBlocked automatically"))
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

// ── Extension helpers to map DB entities to API responses ──────────────

private fun CachedNumber.toLookupResponse(): ApiModels.LookupResponse {
    return ApiModels.LookupResponse(
        phoneNumber = phoneNumber,
        normalized = phoneNumber,
        carrier = carrier,
        telecomCircle = telecomCircle,
        state = state,
        city = city,
        numberType = numberType,
        isIndian = isIndian,
        countryName = country,
        isVoip = isVoip,
        isScam = isScam,
        verdict = verdict,
        threatScore = threatScore,
        confidence = null,
        scamType = scamType,
        scamTypes = scamType?.let { listOf(it) },
        severity = severity,
        shouldBlock = shouldBlock,
        blockReason = null,
        evidence = null,
        warnings = null,
        recommendations = null,
        dbMatch = ApiModels.DbMatch(
            found = reportCount > 0,
            reportCount = reportCount,
            recentReportCount = null,
            verified = verified,
            source = source
        ),
        whitelisted = null,
        responseTime = null,
        cached = true
    )
}

private fun CachedNumber.toCallerIdResponse(): ApiModels.CallerIdResponse {
    return ApiModels.CallerIdResponse(
        name = displayName,
        phoneNumber = phoneNumber,
        normalized = phoneNumber,
        displayName = displayName,
        location = location,
        city = city,
        state = state,
        telecomCircle = telecomCircle,
        country = country,
        countryCode = null,
        isIndian = isIndian,
        carrier = carrier,
        numberType = numberType,
        isVoip = isVoip,
        isScam = isScam,
        scamType = scamType,
        scamTypes = null,
        severity = severity,
        threatScore = threatScore,
        verdict = verdict,
        shouldBlock = shouldBlock,
        reportCount = reportCount,
        recentReportCount = null,
        verified = verified,
        source = source,
        warnings = null
    )
}
