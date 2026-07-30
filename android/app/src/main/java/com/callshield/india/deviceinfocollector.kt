package com.callshield.india

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.telephony.CellInfo
import android.telephony.CellInfoGsm
import android.telephony.CellInfoLte
import android.telephony.CellInfoWcdma
import android.telephony.CellSignalStrengthGsm
import android.telephony.CellSignalStrengthLte
import android.telephony.CellSignalStrengthWcdma
import android.telephony.SignalStrength
import android.telephony.TelephonyManager
import android.util.Log
import androidx.core.content.ContextCompat

/**
 * DeviceInfoCollector — gathers device, network, IMEI, and tower location
 * information for inclusion in the Caller ID response on incoming calls.
 *
 * Android permissions required:
 *   - READ_PHONE_STATE (for IMEI/MEID, network type, carrier)
 *   - ACCESS_FINE_LOCATION or ACCESS_COARSE_LOCATION (for cell tower info on Android 9+)
 *
 * Note: IMEI is restricted on Android 10+ (API 29). Only system apps or
 * apps with READ_PRIVILEGED_PHONE_STATE can read it. We fall back to
 * getMeid() or return null gracefully.
 */
object DeviceInfoCollector {

    private const val TAG = "DeviceInfoCollector"

    data class DeviceInfo(
        val imei: String?,
        val deviceModel: String,
        val networkType: String,
        val signalStrength: String,
        val roaming: Boolean,
        val towerLocation: String?
    )

    /**
     * Collect all available device info from the TelephonyManager and
     * Build.MODEL. Returns null values for fields that can't be read
     * (permission denied, Android version restrictions, airplane mode, etc.)
     */
    @SuppressLint("MissingPermission")
    fun collect(context: Context): DeviceInfo {
        val tm = context.getSystemService(Context.TELEPHONY_SERVICE) as? TelephonyManager
        if (tm == null) {
            Log.w(TAG, "TelephonyManager unavailable")
            return DeviceInfo(
                imei = null,
                deviceModel = Build.MODEL,
                networkType = "Unknown",
                signalStrength = "Unknown",
                roaming = false,
                towerLocation = null
            )
        }

        val hasPhoneState = ContextCompat.checkSelfPermission(
            context, Manifest.permission.READ_PHONE_STATE
        ) == PackageManager.PERMISSION_GRANTED

        val hasLocation = ContextCompat.checkSelfPermission(
            context, Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED ||
            ContextCompat.checkSelfPermission(
                context, Manifest.permission.ACCESS_COARSE_LOCATION
            ) == PackageManager.PERMISSION_GRANTED

        // --- IMEI (restricted on API 29+) ---
        val imei: String? = if (hasPhoneState) {
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    // API 29+: getDeviceId() is deprecated and returns null
                    // unless the app has READ_PRIVILEGED_PHONE_STATE (system apps only)
                    tm.deviceId ?: tm.meid
                } else {
                    tm.deviceId ?: tm.meid
                }
            } catch (e: SecurityException) {
                Log.w(TAG, "Cannot read IMEI: ${e.message}")
                null
            }
        } else {
            Log.d(TAG, "READ_PHONE_STATE permission not granted — IMEI unavailable")
            null
        }

        // --- Device model ---
        val deviceModel = "${Build.MANUFACTURER} ${Build.MODEL}"
            .replaceFirstChar { it.uppercase() }

        // --- Network type ---
        val networkType = if (hasPhoneState) {
            try {
                getNetworkTypeString(tm.dataNetworkType)
            } catch (e: Exception) {
                getLegacyNetworkType(tm.networkType)
            }
        } else {
            "Unknown (permission denied)"
        }

        // --- Signal strength ---
        val signalStrength = if (hasPhoneState) {
            try {
                val signal = tm.signalStrength
                formatSignalStrength(signal)
            } catch (e: Exception) {
                "Unknown"
            }
        } else {
            "Unknown"
        }

        // --- Roaming ---
        val roaming = if (hasPhoneState) {
            try { tm.isNetworkRoaming } catch (e: Exception) { false }
        } else false

        // --- Tower/cell location ---
        val towerLocation: String? = if (hasLocation && hasPhoneState) {
            try {
                getCellTowerLocation(tm)
            } catch (e: SecurityException) {
                Log.w(TAG, "Cannot read cell info: ${e.message}")
                null
            } catch (e: Exception) {
                Log.e(TAG, "Cell location error: ${e.message}")
                null
            }
        } else {
            Log.d(TAG, "Location permission not granted — tower info unavailable")
            null
        }

        Log.d(TAG, "Collected: imei=${imei?.take(6)}... model=$deviceModel nw=$networkType " +
                "sig=$signalStrength roam=$roaming tower=$towerLocation")

        return DeviceInfo(
            imei = imei,
            deviceModel = deviceModel,
            networkType = networkType,
            signalStrength = signalStrength,
            roaming = roaming,
            towerLocation = towerLocation
        )
    }

    // --- Network type mapping ---
    private fun getNetworkTypeString(networkType: Int): String = when (networkType) {
        TelephonyManager.NETWORK_TYPE_NR -> "5G NR"       // API 29+
        TelephonyManager.NETWORK_TYPE_LTE -> "4G LTE"
        TelephonyManager.NETWORK_TYPE_HSPAP -> "4G HSPA+"
        TelephonyManager.NETWORK_TYPE_HSPA -> "3G HSPA"
        TelephonyManager.NETWORK_TYPE_HSDPA -> "3G HSDPA"
        TelephonyManager.NETWORK_TYPE_HSUPA -> "3G HSUPA"
        TelephonyManager.NETWORK_TYPE_UMTS -> "3G UMTS"
        TelephonyManager.NETWORK_TYPE_EVDO_0 -> "3G EVDO"
        TelephonyManager.NETWORK_TYPE_EVDO_A -> "3G EVDO-A"
        TelephonyManager.NETWORK_TYPE_EVDO_B -> "3G EVDO-B"
        TelephonyManager.NETWORK_TYPE_1xRTT -> "2G CDMA"
        TelephonyManager.NETWORK_TYPE_CDMA -> "2G CDMA"
        TelephonyManager.NETWORK_TYPE_EDGE -> "2G EDGE"
        TelephonyManager.NETWORK_TYPE_GPRS -> "2G GPRS"
        TelephonyManager.NETWORK_TYPE_GSM -> "2G GSM"
        TelephonyManager.NETWORK_TYPE_IDEN -> "iDEN"
        TelephonyManager.NETWORK_TYPE_IWLAN -> "WiFi Calling"
        TelephonyManager.NETWORK_TYPE_UNKNOWN -> "Unknown"
        else -> "Type $networkType"
    }

    private fun getLegacyNetworkType(type: Int): String = when (type) {
        0 -> "Unknown"
        1 -> "2G GPRS"
        2 -> "2G EDGE"
        3 -> "3G UMTS"
        8 -> "3G HSPA"
        9 -> "3G HSPA"
        10 -> "3G HSPA+"
        13 -> "4G LTE"
        20 -> "5G NR"
        else -> "Type $type"
    }

    // --- Signal strength ---
    private fun formatSignalStrength(signal: SignalStrength?): String {
        if (signal == null) return "No signal"

        val dbm = signal.getDbm()
        return if (dbm != -1 && dbm != 0) {
            "${dbm}dBm"
        } else {
            val percent = signal.level * 25  // level is 0-4
            "${percent}%"
        }
    }

    // --- Tower/cell location ---
    @SuppressLint("MissingPermission")
    private fun getCellTowerLocation(tm: TelephonyManager): String? {
        val cells: List<CellInfo> = try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                tm.allCellInfo ?: return null
            } else {
                @Suppress("DEPRECATION")
                tm.allCellInfo ?: return null
            }
        } catch (e: Exception) {
            return null
        }

        if (cells.isEmpty()) return null

        // Get the primary (registered) cell
        val primaryCell = cells.firstOrNull { it.isRegistered }
            ?: cells.firstOrNull()
            ?: return null

        return when (primaryCell) {
            is CellInfoLte -> {
                val cell = primaryCell.cellIdentity
                "LTE MCC=${cell.mcc} MNC=${cell.mnc} CI=${cell.ci} TAC=${cell.tac}"
            }
            is CellInfoGsm -> {
                val cell = primaryCell.cellIdentity
                "GSM MCC=${cell.mcc} MNC=${cell.mnc} LAC=${cell.lac} CID=${cell.cid}"
            }
            is CellInfoWcdma -> {
                val cell = primaryCell.cellIdentity
                "WCDMA MCC=${cell.mcc} MNC=${cell.mnc} LAC=${cell.lac} CID=${cell.cid}"
            }
            else -> {
                // CDMA, TD-SCDMA, NR (5G standalone) etc.
                "Cell ${primaryCell.javaClass.simpleName}"
            }
        }
    }
}
