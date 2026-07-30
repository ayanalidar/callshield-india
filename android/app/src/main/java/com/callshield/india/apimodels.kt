package com.callshield.india

import com.google.gson.annotations.SerializedName

/**
 * API data transfer objects matching the CallShield India web API.
 *
 * Endpoints documented at: https://callshield.vercel.app
 */
object ApiModels {

    // ── Lookup ────────────────────────────────────────────────────

    /**
     * POST /api/lookup request body.
     */
    data class LookupRequest(
        @SerializedName("phoneNumber") val phoneNumber: String,
        @SerializedName("protectionLevel") val protectionLevel: String = "strict"
    )

    /**
     * POST /api/lookup response body — full threat analysis.
     */
    data class LookupResponse(
        @SerializedName("phoneNumber") val phoneNumber: String,
        @SerializedName("normalized") val normalized: String?,
        @SerializedName("carrier") val carrier: String?,
        @SerializedName("telecomCircle") val telecomCircle: String?,
        @SerializedName("state") val state: String?,
        @SerializedName("city") val city: String?,
        @SerializedName("numberType") val numberType: String?,
        @SerializedName("isIndian") val isIndian: Boolean,
        @SerializedName("countryName") val countryName: String?,
        @SerializedName("isVoip") val isVoip: Boolean,
        @SerializedName("isScam") val isScam: Boolean,
        @SerializedName("verdict") val verdict: String,
        @SerializedName("threatScore") val threatScore: Int,
        @SerializedName("confidence") val confidence: Double?,
        @SerializedName("scamType") val scamType: String?,
        @SerializedName("scamTypes") val scamTypes: List<String>?,
        @SerializedName("severity") val severity: String?,
        @SerializedName("shouldBlock") val shouldBlock: Boolean,
        @SerializedName("blockReason") val blockReason: String?,
        @SerializedName("evidence") val evidence: List<String>?,
        @SerializedName("warnings") val warnings: List<String>?,
        @SerializedName("recommendations") val recommendations: List<String>?,
        @SerializedName("dbMatch") val dbMatch: DbMatch?,
        @SerializedName("whitelisted") val whitelisted: Boolean?,
        @SerializedName("responseTime") val responseTime: Long?,
        @SerializedName("cached") val cached: Boolean?
    )

    data class DbMatch(
        @SerializedName("found") val found: Boolean,
        @SerializedName("reportCount") val reportCount: Int,
        @SerializedName("recentReportCount") val recentReportCount: Int?,
        @SerializedName("verified") val verified: Boolean,
        @SerializedName("source") val source: String?
    )

    // ── Caller ID ─────────────────────────────────────────────────

    /**
     * POST /api/caller-id request body.
     */
    data class CallerIdRequest(
        @SerializedName("phoneNumber") val phoneNumber: String,
        @SerializedName("deviceInfo") val deviceInfo: DeviceInfo? = null
    ) {
        data class DeviceInfo(
            @SerializedName("imei") val imei: String?,
            @SerializedName("deviceModel") val deviceModel: String?,
            @SerializedName("networkType") val networkType: String?,
            @SerializedName("signalStrength") val signalStrength: String?,
            @SerializedName("roaming") val roaming: Boolean,
            @SerializedName("towerLocation") val towerLocation: String?
        )
    }

    /**
     * POST /api/caller-id response body — caller identity for display.
     */
    data class CallerIdResponse(
        @SerializedName("name") val name: String?,
        @SerializedName("phoneNumber") val phoneNumber: String,
        @SerializedName("normalized") val normalized: String?,
        @SerializedName("displayName") val displayName: String?,
        @SerializedName("location") val location: String?,
        @SerializedName("city") val city: String?,
        @SerializedName("state") val state: String?,
        @SerializedName("telecomCircle") val telecomCircle: String?,
        @SerializedName("country") val country: String?,
        @SerializedName("countryCode") val countryCode: String?,
        @SerializedName("isIndian") val isIndian: Boolean?,
        @SerializedName("carrier") val carrier: String?,
        @SerializedName("numberType") val numberType: String?,
        @SerializedName("isVoip") val isVoip: Boolean?,
        @SerializedName("isScam") val isScam: Boolean,
        @SerializedName("scamType") val scamType: String?,
        @SerializedName("scamTypes") val scamTypes: List<String>?,
        @SerializedName("severity") val severity: String?,
        @SerializedName("threatScore") val threatScore: Int,
        @SerializedName("verdict") val verdict: String?,
        @SerializedName("shouldBlock") val shouldBlock: Boolean,
        @SerializedName("reportCount") val reportCount: Int,
        @SerializedName("recentReportCount") val recentReportCount: Int?,
        @SerializedName("verified") val verified: Boolean,
        @SerializedName("source") val source: String?,
        @SerializedName("warnings") val warnings: List<String>?,
        @SerializedName("deviceInfo") val deviceInfo: DeviceInfo? = null
    ) {
        data class DeviceInfo(
            @SerializedName("imei") val imei: String?,
            @SerializedName("deviceModel") val deviceModel: String?,
            @SerializedName("networkType") val networkType: String?,
            @SerializedName("signalStrength") val signalStrength: String?,
            @SerializedName("roaming") val roaming: Boolean,
            @SerializedName("towerLocation") val towerLocation: String?
        )
    }

    // ── Report ────────────────────────────────────────────────────

    data class ReportRequest(
        @SerializedName("phoneNumber") val phoneNumber: String,
        @SerializedName("scamType") val scamType: String,
        @SerializedName("description") val description: String? = null
    )

    data class ReportResponse(
        @SerializedName("success") val success: Boolean,
        @SerializedName("message") val message: String?
    )

    // ── Stats ─────────────────────────────────────────────────────

    data class StatsResponse(
        @SerializedName("totalNumbers") val totalNumbers: Int?,
        @SerializedName("totalReports") val totalReports: Int?,
        @SerializedName("blockedToday") val blockedToday: Int?,
        @SerializedName("topScamTypes") val topScamTypes: Map<String, Int>?
    )

    // ── Blocklist Sync ────────────────────────────────────────────

    /**
     * GET /api/blocklist/top?limit=5000
     */
    data class BlocklistEntry(
        @SerializedName("phoneNumber") val phoneNumber: String,
        @SerializedName("threatScore") val threatScore: Int,
        @SerializedName("scamType") val scamType: String?,
        @SerializedName("reportCount") val reportCount: Int,
        @SerializedName("verified") val verified: Boolean,
        @SerializedName("carrier") val carrier: String?,
        @SerializedName("telecomCircle") val telecomCircle: String?,
        @SerializedName("city") val city: String?,
        @SerializedName("state") val state: String?
    )
}
