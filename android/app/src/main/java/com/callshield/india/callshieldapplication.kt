package com.callshield.india

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import android.util.Log
import androidx.work.*

/**
 * Application class for CallShield India.
 *
 * Initializes Room database, creates notification channels, schedules
 * periodic cache sync via WorkManager, and requests battery optimization
 * exemption so the screening service stays alive.
 */
class CallShieldApplication : Application() {

    companion object {
        const val CHANNEL_CALL_SCREENING = "callshield_screening"
        const val CHANNEL_ALERTS = "callshield_alerts"
        private const val TAG = "CallShieldApp"

        @Volatile
        lateinit var instance: CallShieldApplication
            private set
    }

    lateinit var database: LocalDb
        private set

    override fun onCreate() {
        super.onCreate()
        instance = this

        // Initialize Room database
        database = LocalDb.getInstance(this)

        // Setup notification channels (required for foreground service + alerts)
        createNotificationChannels()

        // Schedule periodic cache sync (every 6 hours as per spec)
        CacheSyncWorker.schedule(this)

        // Request battery optimization exemption (so call screening works in background)
        requestBatteryExemption()

        Log.d(TAG, "CallShield Application initialized")
    }

    private fun createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val manager = getSystemService(NotificationManager::class.java)

            // Low-priority channel for the screening foreground service
            val screeningChannel = NotificationChannel(
                CHANNEL_CALL_SCREENING,
                getString(R.string.notification_channel_screening),
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = getString(R.string.notification_channel_screening_desc)
                setShowBadge(false)
            }
            manager.createNotificationChannel(screeningChannel)

            // High-priority channel for blocked/spam call alerts
            val alertChannel = NotificationChannel(
                CHANNEL_ALERTS,
                getString(R.string.notification_channel_alerts),
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = getString(R.string.notification_channel_alerts_desc)
                enableVibration(true)
            }
            manager.createNotificationChannel(alertChannel)
        }
    }

    /**
     * Request exemption from battery optimization so the OS doesn't kill
     * the CallScreeningService when the screen is off.
     */
    private fun requestBatteryExemption() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val pm = getSystemService(PowerManager::class.java)
            if (!pm.isIgnoringBatteryOptimizations(packageName)) {
                // We don't auto-launch the intent — instead, guide the user
                // through onboarding. The actual intent is shown on the
                // dialer activity if needed.
                Log.d(TAG, "Battery optimization NOT exempt — will prompt user")
            }
        }
    }
}
