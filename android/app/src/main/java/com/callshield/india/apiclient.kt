package com.callshield.india

import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit

/**
 * Singleton Retrofit-based API client for CallShield India backend.
 *
 * Usage:
 *   val response = ApiClient.api.lookup(LookupRequest("+919876543210"))
 */
object ApiClient {

    private const val DEFAULT_BASE_URL = "https://callshield-india.vercel.app/"

    // Override via BuildConfig or programmatically for self-hosted instances.
    var baseUrl: String = DEFAULT_BASE_URL
        private set

    val api: CallShieldApi by lazy { buildRetrofit().create(CallShieldApi::class.java) }

    /**
     * Reconfigure base URL at runtime (e.g. from settings screen).
     */
    fun configure(url: String) {
        baseUrl = url.trimEnd('/') + "/"
    }

    private fun buildRetrofit(): Retrofit {
        val logging = HttpLoggingInterceptor().apply {
            level = if (BuildConfig.DEBUG)
                HttpLoggingInterceptor.Level.BODY
            else
                HttpLoggingInterceptor.Level.NONE
        }

        val client = OkHttpClient.Builder()
            .addInterceptor(logging)
            .connectTimeout(10, TimeUnit.SECONDS)
            .readTimeout(10, TimeUnit.SECONDS)
            .writeTimeout(10, TimeUnit.SECONDS)
            .build()

        return Retrofit.Builder()
            .baseUrl(baseUrl)
            .client(client)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
    }
}
