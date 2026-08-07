package com.callshield.india

import android.os.Build
import android.telecom.Call
import android.telecom.InCallService
import android.util.Log
import android.view.Gravity
import android.view.ViewGroup
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView

/**
 * Custom InCallService that displays a branded call UI overlay during
 * incoming calls. Shows caller identity (name, carrier, location) and
 * threat warnings using data from CallShieldScreeningService.lastCallerId.
 *
 * The overlay is attached directly to the InCallService window — this is
 * the standard approach for custom dialer UIs on Android.
 */
class CallShieldInCallService : InCallService() {

    companion object {
        private const val TAG = "CallShieldInCall"

        // Overlay colors (dark theme, semi-transparent)
        private const val OVERLAY_BG = 0xDD_121212.toInt()
        private const val TEXT_WHITE = 0xFF_FFFFFF.toInt()
        private const val TEXT_GREEN = 0xFF_4CAF50.toInt()
        private const val TEXT_ORANGE = 0xFF_FFA726.toInt()
        private const val TEXT_RED = 0xFF_EF5350.toInt()
 private const val TEXT_DIM = 0xFF_9E9E9E.toInt()
    }

    private var overlayView: LinearLayout? = null
    private var currentCall: Call? = null

    override fun onCreate() {
        super.onCreate()
        Log.d(TAG, "InCallService created")
    }

    override fun onCallAdded(call: Call) {
        super.onCallAdded(call)
        currentCall = call
        Log.d(TAG, "Call added: ${call.details?.handle?.schemeSpecificPart}")

        call.registerCallback(object : Call.Callback() {
            override fun onStateChanged(call: Call, state: Int) {
                Log.d(TAG, "Call state → ${stateToString(state)}")
                when (state) {
                    Call.STATE_RINGING -> showCallerOverlay()
                    Call.STATE_ACTIVE -> hideOverlay()
                    Call.STATE_DISCONNECTED -> hideOverlay()
                }
            }

            override fun onDetailsChanged(call: Call, details: Call.Details) {
                Log.d(TAG, "Call details updated")
                // Refresh overlay if we're still ringing
                if (call.state == Call.STATE_RINGING) {
                    showCallerOverlay()
                }
            }
        })
    }

    override fun onCallRemoved(call: Call) {
        super.onCallRemoved(call)
        if (call == currentCall) {
            hideOverlay()
            currentCall = null
        }
        Log.d(TAG, "Call removed")
    }

    /**
     * Build and show a caller info overlay at the top of the incall UI.
     * Reads [CallShieldScreeningService.lastCallerId] for caller details.
     */
    private fun showCallerOverlay() {
        hideOverlay() // remove any existing overlay first

        val callerId = CallShieldScreeningService.lastCallerId
        val handle = currentCall?.details?.handle?.schemeSpecificPart ?: return

        val displayNumber = PhoneNumberUtils.forDisplay(
            PhoneNumberUtils.normalize(handle) ?: handle
        )

        val rootView = window?.decorView?.findViewById<FrameLayout>(android.R.id.content)
            ?: return

        // Build overlay view programmatically (no fragment needed)
        val overlay = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(32, if (Build.VERSION.SDK_INT >= 35) 80 else 48, 32, 24)
            setBackgroundColor(OVERLAY_BG)
            alpha = 0.92f
            layoutParams = FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            ).apply {
                gravity = Gravity.TOP
            }
        }

        // ── Phone Number ──
        overlay.addView(TextView(this).apply {
            text = "📞 $displayNumber"
            textSize = 22f
            setTextColor(TEXT_WHITE)
            setPadding(0, 0, 0, 4)
        })

        // ── Carrier & Location ──
        val carrier = callerId?.carrier ?: "Unknown Carrier"
        val location = callerId?.location ?: callerId?.telecomCircle ?: "Unknown Location"
        overlay.addView(TextView(this).apply {
            text = "🏢 $carrier · $location"
            textSize = 14f
            setTextColor(TEXT_GREEN)
            setPadding(0, 0, 0, 4)
        })

        // City / State detail
        val cityStr = buildString {
            callerId?.city?.let { append("📍 $it") }
            callerId?.state?.let {
                if (isNotEmpty()) append(", ")
                append(it)
            }
            callerId?.country?.let {
                if (it != "India" && callerId?.isIndian == true) return@let
                if (isNotEmpty()) append(", ")
                append(it)
            }
        }
        if (cityStr.isNotEmpty()) {
            overlay.addView(TextView(this).apply {
                text = cityStr
                textSize = 13f
                setTextColor(TEXT_GREEN)
                setPadding(0, 0, 0, 8)
            })
        }

        // ── Device Info (IMEI / Tower / Signal) ──
        callerId?.deviceInfo?.let { device ->
            overlay.addView(TextView(this).apply {
                text = "📱 ${device.deviceModel ?: \"Unknown\"} · ${device.networkType ?: \"Unknown\"}"
                textSize = 11f
                setTextColor(TEXT_DIM)
                setPadding(0, 2, 0, 2)
            })
            device.signalStrength?.let { sig ->
                overlay.addView(TextView(this).apply {
                    text = "📶 Signal: $sig${if (device.roaming) \" | 🌐 Roaming\" else \"\"}"
                    textSize = 11f
                    setTextColor(TEXT_DIM)
                })
            }
            device.towerLocation?.let { tower ->
                overlay.addView(TextView(this).apply {
                    text = "🗼 Tower: $tower"
                    textSize = 10f
                    setTextColor(TEXT_DIM)
                    maxLines = 2
                })
            }
            device.imei?.let { imei ->
                overlay.addView(TextView(this).apply {
                    text = "🔑 IMEI: ${imei.take(8)}...${imei.takeLast(4)}"
                    textSize = 10f
                    setTextColor(TEXT_DIM)
                    setPadding(0, 0, 0, 6)
                })
            }
        }

        // ── Threat / Scam Warning ──
        if (callerId != null && callerId.isScam) {
            val scamLabel = callerId.scamType
                ?.replace("_", " ")
                ?.replaceFirstChar { it.uppercase() } ?: "Scam"
            val reportCount = callerId.reportCount

            overlay.addView(TextView(this).apply {
                text = if (reportCount > 0) {
                    "⚠️ $scamLabel · $reportCount community reports"
                } else {
                    "⚠️ $scamLabel"
                }
                textSize = 15f
                setTextColor(TEXT_RED)
                setPadding(0, 4, 0, 4)
            })

            // Severity
            callerId.severity?.let { sev ->
                overlay.addView(TextView(this).apply {
                    text = "Threat Score: ${callerId.threatScore}/100 · Severity: ${sev.uppercase()}"
                    textSize = 12f
                    setTextColor(TEXT_ORANGE)
                })
            }

            // Warnings
            callerId.warnings?.forEach { warning ->
                overlay.addView(TextView(this).apply {
                    text = warning
                    textSize = 11f
                    setTextColor(TEXT_ORANGE)
                    setPadding(0, 2, 0, 0)
                })
            }
        } else if (callerId == null || callerId.reportCount == 0) {
            // Unknown caller — no reports
            overlay.addView(TextView(this).apply {
                text = "📋 Unknown Caller — No community reports"
                textSize = 13f
                setTextColor(TEXT_ORANGE)
                setPadding(0, 4, 0, 0)
            })
        } else {
            // Known not-scam
            overlay.addView(TextView(this).apply {
                text = if (callerId?.verified == true) "✅ Verified Safe" else "✅ No threats detected"
                textSize = 13f
                setTextColor(TEXT_GREEN)
                setPadding(0, 4, 0, 0)
            })
        }

        rootView.addView(overlay)
        overlayView = overlay
    }

    private fun hideOverlay() {
        overlayView?.let { view ->
            (view.parent as? ViewGroup)?.removeView(view)
        }
        overlayView = null
    }

    override fun onDestroy() {
        hideOverlay()
        super.onDestroy()
        Log.d(TAG, "InCallService destroyed")
    }

    private fun stateToString(state: Int): String = when (state) {
        Call.STATE_NEW -> "NEW"
        Call.STATE_RINGING -> "RINGING"
        Call.STATE_DIALING -> "DIALING"
        Call.STATE_ACTIVE -> "ACTIVE"
        Call.STATE_HOLDING -> "HOLDING"
        Call.STATE_DISCONNECTED -> "DISCONNECTED"
        Call.STATE_CONNECTING -> "CONNECTING"
        Call.STATE_DISCONNECTING -> "DISCONNECTING"
        Call.STATE_SELECT_PHONE_ACCOUNT -> "SELECT_PHONE_ACCOUNT"
        Call.STATE_PULLING_CALL -> "PULLING_CALL"
        Call.STATE_SIMULATED_RINGING -> "SIMULATED_RINGING"
        Call.STATE_AUDIO_PROCESSING -> "AUDIO_PROCESSING"
        else -> "UNKNOWN($state)"
    }
}
