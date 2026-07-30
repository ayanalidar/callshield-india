package com.callshield.india

import com.callshield.india.ApiModels.*
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST

/**
 * Retrofit API interface for the CallShield India backend.
 */
interface CallShieldApi {

    /**
     * Look up a phone number for threat analysis.
     * POST /api/lookup
     */
    @POST("api/lookup")
    suspend fun lookup(@Body request: LookupRequest): Response<LookupResponse>

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
}
