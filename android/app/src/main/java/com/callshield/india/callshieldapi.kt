package com.callshield.india

import com.callshield.india.ApiModels.*
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Query

/**
 * Retrofit API interface for the CallShield India backend.
 *
 * All endpoints are relative to the base URL configured in [ApiClient].
 */
interface CallShieldApi {

    /**
     * Full threat analysis lookup.
     * POST /api/lookup
     */
    @POST("api/lookup")
    suspend fun lookup(@Body request: LookupRequest): Response<LookupResponse>

    /**
     * Caller ID — name, location, carrier, scam info for display.
     * POST /api/caller-id
     */
    @POST("api/caller-id")
    suspend fun callerId(@Body request: CallerIdRequest): Response<CallerIdResponse>

    /**
     * Report a phone number as spam/scam.
     * POST /api/report
     */
    @POST("api/report")
    suspend fun report(@Body request: ReportRequest): Response<ReportResponse>

    /**
     * Get global / user stats.
     * GET /api/stats
     */
    @GET("api/stats")
    suspend fun getStats(): Response<StatsResponse>

    /**
     * Get top blocked/scam numbers for offline cache sync.
     * GET /api/blocklist/top?limit=5000
     */
    @GET("api/blocklist/top")
    suspend fun getBlocklistTop(@Query("limit") limit: Int = 5000): Response<List<BlocklistEntry>>
}
