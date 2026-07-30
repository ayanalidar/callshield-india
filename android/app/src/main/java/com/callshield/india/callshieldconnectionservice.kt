package com.callshield.india

import android.os.Bundle
import android.telecom.Connection
import android.telecom.ConnectionRequest
import android.telecom.ConnectionService
import android.telecom.DisconnectCause
import android.telecom.PhoneAccountHandle
import android.util.Log

/**
 * ConnectionService that bridges CallShield as a full dialer replacement.
 *
 * This service is responsible for:
 *   - Creating outgoing call Connections when the user dials from CallShield
 *   - Managing call state (dialing, active, disconnected)
 *   - Handling disconnect with proper causes
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
        connection.setAddress(request?.address, android.telecom.TelecomManager.PRESENTATION_ALLOWED)
        connection.setDialing()

        Log.d(TAG, "Outgoing connection created: ${request?.address?.schemeSpecificPart}")

        // In production, this is where you would initialize the actual
        // telecom call and bridge it.

        // Simulate active connection after a short delay
        android.os.Handler(mainLooper).postDelayed({
            if (connection.state == Connection.STATE_DIALING) {
                connection.setActive()
                Log.d(TAG, "Connection → ACTIVE")
            }
        }, 2000)

        return connection
    }

    override fun onCreateOutgoingConnectionFailed(
        phoneAccount: PhoneAccountHandle?,
        request: ConnectionRequest?
    ) {
        Log.w(TAG, "Outgoing connection failed: ${request?.address}")
        super.onCreateOutgoingConnectionFailed(phoneAccount, request)
    }

    override fun onCreateIncomingConnection(
        phoneAccount: PhoneAccountHandle?,
        request: ConnectionRequest?
    ): Connection {
        Log.d(TAG, "Incoming connection: ${request?.address?.schemeSpecificPart}")
        val connection = CallShieldConnection()
        connection.setAddress(request?.address, android.telecom.TelecomManager.PRESENTATION_ALLOWED)
        connection.setRinging()
        return connection
    }

    /**
     * Custom Connection subclass for CallShield calls.
     */
    inner class CallShieldConnection : Connection() {

        override fun onAnswer() {
            super.onAnswer()
            setActive()
            Log.d(TAG, "Call answered")
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
    }
}
