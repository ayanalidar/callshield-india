package com.callshield.india

import android.telecom.Call
import android.telecom.InCallService
import android.util.Log

/**
 * Custom InCallService that provides a branded call UI overlay
 * during active calls. Shows caller identity, threat level,
 * scam warnings, and custom accept/decline/report actions.
 *
 * The UI is rendered via CallShieldInCallFragment (replace with
 * your actual fragment/layout when ready).
 */
class CallShieldInCallService : InCallService() {

    companion object {
        private const val TAG = "CallShieldInCall"
    }

    override fun onCreate() {
        super.onCreate()
        Log.d(TAG, "InCallService created")
    }

    override fun onCallAdded(call: Call) {
        super.onCallAdded(call)
        Log.d(TAG, "Call added: ${call.details?.handle?.schemeSpecificPart}")

        // In a production app, this is where you'd attach the custom
        // call UI fragment. The fragment renders:
        //
        //   - Caller number + carrier + circle + location
        //   - Threat score badge with color coding
        //   - Scam warning banner (if threatScore >= 40)
        //   - Custom accept / decline buttons
        //   - "Report Spam" button
        //
        // Example (pseudo-code):
        //   val fragment = CallShieldInCallFragment.create(call)
        //   supportFragmentManager.beginTransaction()
        //       .replace(R.id.inCallContainer, fragment)
        //       .commit()
        //
        // The InCallService lifecycle is managed by Telecom — we show
        // our UI through the system's incall window.

        call.registerCallback(object : Call.Callback() {
            override fun onStateChanged(call: Call, state: Int) {
                Log.d(TAG, "Call state → ${stateToString(state)}")
            }

            override fun onDetailsChanged(call: Call, details: Call.Details) {
                Log.d(TAG, "Call details updated")
            }
        })
    }

    override fun onCallRemoved(call: Call) {
        super.onCallRemoved(call)
        Log.d(TAG, "Call removed")
    }

    override fun onDestroy() {
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
