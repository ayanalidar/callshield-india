package com.callshield.india

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings

/**
 * Application class for CallShield India.
 *
 * Initializes Room database, creates notification channels, and
 * requests battery optimization exemption so the screening service
 * stays alive.
 */
class CallShieldApplication : Application() {

    lateinit var database: LocalDb
        private set

    override fun onCreate() {
        super.onCreate()
        instance = this

        // Initialize Room
        database = LocalDb.getInstance(this)

        // Create notification channel (foreground service requirement)
        createNotificationChannels()

        // Request battery optimization exemption
        requestBatteryExemption()
    }

    private fun createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val manager = getSystemService(NotificationManager::class.java)

            // Call screening foreground channel
            val screeningChannel = NotificationChannel(
                CHANNEL_CALL_SCREENING,
                "Call Screening",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Shown while CallShield is screening incoming calls"
                setShowBadge(false)
            }
            manager.createNotificationChannel(screeningChannel)

            // Alerts channel for blocked-call notifications
            val alertChannel = NotificationChannel(
                CHANNEL_ALERTS,
                "Call Alerts",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Notifications when a call is blocked or flagged"
            }
            manager.createNotificationChannel(alertChannel)
        }
    }

    private fun requestBatteryExemption() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val pm = getSystemService(PowerManager::class.java)
            if (!pm.isIgnoringBatteryOptimizations(packageName)) {
                val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                    data = Uri.parse("package:$packageName")
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                // Only launch if we have an activity context available;
                // typically the user grants this during first-run setup.
                // startActivity(intent)
            }
        }
    }

    companion object {
        const val CHANNEL_CALL_SCREENING = "callshield_screening"
        const val CHANNEL_ALERTS = "callshield_alerts"

        lateinit var instance: CallShieldApplication
            private set
    }
}
