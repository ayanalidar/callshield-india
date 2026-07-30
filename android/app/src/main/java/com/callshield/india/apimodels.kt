package com.callshield.india

/**
 * API data transfer objects matching the CallShield India web API.
 */
object ApiModels {

    /**
     * Request body for POST /api/lookup.
     */
    data class LookupRequest(
        val phoneNumber: String,
        val protectionLevel: String = "high"
    )

    /**
     * Response body from POST /api/lookup.
     */
    data class LookupResponse(
        val phoneNumber: String,
        val verifiedName: String?,
        val carrier: String?,
        val circle: String?,
        val location: String?,
        val category: String?,
        val threatScore: Int,
        val scamType: String?,
        val scamSubType: String?,
        val shouldBlock: Boolean,
        val verdict: String,
        val recommendation: String?,
        val reportCount: Int,
        val lastReported: String?,
        val rawDetails: Map<String, Any>?
    )

    /**
     * Request body for POST /api/report.
     */
    data class ReportRequest(
        val phoneNumber: String,
        val scamType: String,
        val description: String? = null
    )

    /**
     * Response body from POST /api/report.
     */
    data class ReportResponse(
        val success: Boolean,
        val message: String
    )

    /**
     * Response body from GET /api/stats.
     */
    data class StatsResponse(
        val totalNumbers: Int,
        val totalReports: Int,
        val blockedToday: Int,
        val topScamTypes: Map<String, Int>?
    )
}
