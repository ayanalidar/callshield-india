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
 *   val callerInfo = ApiClient.api.callerId(CallerIdRequest("+919876543210"))
 */
object ApiClient {

    // Default base URL points to the Vercel deployment
    private const val DEFAULT_BASE_URL = "https://callshield.vercel.app/"

    /** Runtime-overridable base URL (e.g. from settings or BuildConfig). */
    var baseUrl: String = DEFAULT_BASE_URL
        private set

    /** Lazily-built Retrofit instance. Re-build after calling [configure]. */
    @Volatile
    private var retrofit: Retrofit? = null

    val api: CallShieldApi
        get() = (retrofit ?: buildRetrofit().also { retrofit = it })
            .create(CallShieldApi::class.java)

    /**
     * Reconfigure base URL at runtime (e.g. from settings screen).
     * Invalidates the cached Retrofit instance so the next call re-builds.
     */
    fun configure(url: String) {
        baseUrl = url.trimEnd('/') + "/"
        retrofit = null // force rebuild on next access
    }

    private fun buildRetrofit(): Retrofit {
        val logging = HttpLoggingInterceptor().apply {
            level = if (BuildConfig.DEBUG)
                HttpLoggingInterceptor.Level.HEADERS  // BODY is too verbose for release
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
