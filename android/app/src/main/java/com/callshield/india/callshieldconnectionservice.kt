package com.callshield.india

import android.telecom.Connection
import android.telecom.ConnectionRequest
import android.telecom.ConnectionService
import android.telecom.DisconnectCause
import android.telecom.PhoneAccountHandle
import android.telecom.TelecomManager
import android.util.Log

/**
 * ConnectionService that bridges CallShield as a full dialer replacement.
 *
 * Handles:
 *   - Outgoing calls placed via the CallShield dial pad
 *   - Incoming call connections
 *   - Call state management (dialing → active → disconnected)
 *   - Proper disconnect causes for call log accuracy
 */
class CallShieldConnectionService : ConnectionService() {

    companion object {
        private const val TAG = "CallShieldConnection"
    }

    override fun onCreateOutgoingConnection(
        phoneAccount: PhoneAccountHandle?,
        request: ConnectionRequest?
    ): Connection {
        val connection = CallShieldConnection()
        val address = request?.address
        val number = address?.schemeSpecificPart ?: "Unknown"

        connection.setAddress(address, TelecomManager.PRESENTATION_ALLOWED)
        connection.setDialing()
        Log.d(TAG, "Outgoing → $number")

        // The system will handle the actual telephony — we just proxy the connection.
        // When the call connects, Telecom informs us via the Connection lifecycle.

        return connection
    }

    override fun onCreateOutgoingConnectionFailed(
        phoneAccount: PhoneAccountHandle?,
        request: ConnectionRequest?
    ) {
        Log.w(TAG, "Outgoing failed: ${request?.address?.schemeSpecificPart}")
        super.onCreateOutgoingConnectionFailed(phoneAccount, request)
    }

    override fun onCreateIncomingConnection(
        phoneAccount: PhoneAccountHandle?,
        request: ConnectionRequest?
    ): Connection {
        val connection = CallShieldConnection()
        val address = request?.address
        val number = address?.schemeSpecificPart ?: "Unknown"

        connection.setAddress(address, TelecomManager.PRESENTATION_ALLOWED)
        connection.setRinging()
        Log.d(TAG, "Incoming → $number")

        return connection
    }

    /**
     * Custom Connection subclass for CallShield-managed calls.
     */
    inner class CallShieldConnection : Connection() {

        override fun onAnswer() {
            super.onAnswer()
            setActive()
            Log.d(TAG, "Call answered — now ACTIVE")
        }

        override fun onReject() {
            super.onReject()
            setDisconnected(DisconnectCause(DisconnectCause.REJECTED))
            destroy()
            Log.d(TAG, "Call rejected")
        }

        override fun onDisconnect() {
            super.onDisconnect()
            setDisconnected(DisconnectCause(DisconnectCause.LOCAL))
            destroy()
            Log.d(TAG, "Call disconnected")
        }

        override fun onHold() {
            super.onHold()
            setOnHold()
            Log.d(TAG, "Call on hold")
        }

        override fun onUnhold() {
            super.onUnhold()
            setActive()
            Log.d(TAG, "Call unheld")
        }

        override fun onAbort() {
            super.onAbort()
            setDisconnected(DisconnectCause(DisconnectCause.CANCELED))
            destroy()
            Log.d(TAG, "Call aborted")
        }

        override fun onAnswer(videoState: Int) {
            super.onAnswer(videoState)
            setActive()
            Log.d(TAG, "Call answered (videoState=$videoState)")
        }
    }
}
