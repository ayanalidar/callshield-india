package com.callshield.india

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.provider.CallLog
import android.telecom.TelecomManager
import android.text.Editable
import android.text.TextWatcher
import android.util.Log
import android.view.View
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.callshield.india.ApiModels.*
import kotlinx.coroutines.*
import java.text.SimpleDateFormat
import java.util.*

/**
 * Main dialer activity for CallShield India.
 *
 * Features:
 *   - Full T9 dial pad (0-9, *, #) with haptic feedback
 *   - Real-time caller ID lookup as user types (debounced)
 *   - Threat badge: green (safe), red/orange (scam/suspicious)
 *   - Carrier, circle, location display
 *   - Call button with TelecomManager integration
 *   - Recent calls from system CallLog + API lookup history
 *   - Bottom navigation: Dialer | Recents | Contacts | Settings
 *   - Material 3 dark theme (#1B5E20 primary, #121212 surface)
 */
class CallShieldDialerActivity : AppCompatActivity() {

    companion object {
        private const val TAG = "CallShieldDialer"
        private const val PERMISSION_REQUEST_CODE = 1001
        private const val LOOKUP_DEBOUNCE_MS = 500L

        // Lookup trigger: after 10 digits OR 2 second pause
        private const val LOOKUP_MIN_DIGITS = 6
        private const val LOOKUP_FULL_DIGITS = 10
    }

    // ── UI References ──

    private lateinit var numberInput: EditText
    private lateinit var lookupCard: View
    private lateinit var threatBadge: TextView
    private lateinit var callerNameText: TextView
    private lateinit var carrierLocationText: TextView
    private lateinit var reportInfoText: TextView
    private lateinit var blockReportButton: Button
    private lateinit var callButton: Button
    private lateinit var recentRecycler: RecyclerView
    private lateinit var recentLabel: TextView

    // Bottom nav
    private lateinit var navDialer: View
    private lateinit var navRecents: View
    private lateinit var navContacts: View
    private lateinit var navSettings: View

    // ── State ──

    private lateinit var dao: CachedNumberDao
    private var lookupJob: Job? = null
    private var lastLookupNormalized: String? = null
    private var lastCallerIdResult: CallerIdResponse? = null

    // Dial pad button map
    private val dialButtons: MutableMap<String, Button> = mutableMapOf()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_dialer)

        dao = CallShieldApplication.instance.database.cachedNumberDao()

        bindViews()
        setupDialPad()
        setupNumberInput()
        setupCallButton()
        setupBottomNav()
        loadRecentCalls()
        requestPermissionsIfNeeded()
    }

    // ── View Binding ──────────────────────────────────────────────

    private fun bindViews() {
        numberInput = findViewById(R.id.numberInput)
        lookupCard = findViewById(R.id.lookupCard)
        threatBadge = findViewById(R.id.threatBadge)
        callerNameText = findViewById(R.id.callerNameText)
        carrierLocationText = findViewById(R.id.carrierLocationText)
        reportInfoText = findViewById(R.id.reportInfoText)
        blockReportButton = findViewById(R.id.blockReportButton)
        callButton = findViewById(R.id.callButton)
        recentRecycler = findViewById(R.id.recentRecycler)
        recentLabel = findViewById(R.id.recentLabel)

        recentRecycler.layoutManager = LinearLayoutManager(this)

        // Collect dial pad buttons by digit
        mapOf(
            "0" to R.id.btn0, "1" to R.id.btn1, "2" to R.id.btn2,
            "3" to R.id.btn3, "4" to R.id.btn4, "5" to R.id.btn5,
            "6" to R.id.btn6, "7" to R.id.btn7, "8" to R.id.btn8,
            "9" to R.id.btn9, "*" to R.id.btnStar, "#" to R.id.btnHash
        ).forEach { (digit, id) ->
            findViewById<Button>(id)?.let { dialButtons[digit] = it }
        }

        findViewById<Button>(R.id.btnBackspace)?.setOnClickListener { onBackspace() }
        findViewById<Button>(R.id.btnBackspaceLong)?.setOnLongClickListener {
            numberInput.text?.clear()
            resetLookupCard()
            true
        }

        // Bottom nav
        navDialer = findViewById(R.id.navDialer)
        navRecents = findViewById(R.id.navRecents)
        navContacts = findViewById(R.id.navContacts)
        navSettings = findViewById(R.id.navSettings)

        // Start with lookup card hidden
        lookupCard.visibility = View.GONE
    }

    // ── Dial Pad ──────────────────────────────────────────────────

    private fun setupDialPad() {
        dialButtons.forEach { (digit, button) ->
            button.setOnClickListener {
                onDigitPressed(digit)
                hapticTap()
            }
        }
    }

    private fun onDigitPressed(digit: String) {
        val cursor = numberInput.selectionStart
        val current = numberInput.text.toString()
        val new = StringBuilder(current).insert(cursor.coerceIn(0, current.length), digit).toString()
        numberInput.setText(new)
        numberInput.setSelection(cursor + 1)
    }

    private fun onBackspace() {
        val current = numberInput.text.toString()
        if (current.isNotEmpty()) {
            val cursor = numberInput.selectionStart
            if (cursor > 0) {
                val new = StringBuilder(current).delete(cursor - 1, cursor).toString()
                numberInput.setText(new)
                numberInput.setSelection(cursor - 1)
            }
        }
    }

    /**
     * Haptic feedback for dial pad presses (like a real phone).
     */
    private fun hapticTap() {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val vm = getSystemService(VibratorManager::class.java)
                vm.defaultVibrator.vibrate(
                    VibrationEffect.createOneShot(20, VibrationEffect.DEFAULT_AMPLITUDE)
                )
            } else {
                @Suppress("DEPRECATION")
                val vibrator = getSystemService(VIBRATOR_SERVICE) as Vibrator
                if (vibrator.hasVibrator()) {
                    vibrator.vibrate(VibrationEffect.createOneShot(20, VibrationEffect.DEFAULT_AMPLITUDE))
                }
            }
        } catch (_: Exception) {
            // Vibrator not available — ignore
        }
    }

    // ── Number Input & Auto Lookup ────────────────────────────────

    private fun setupNumberInput() {
        numberInput.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {}

            override fun afterTextChanged(s: Editable?) {
                val raw = s?.toString().orEmpty()
                val digitCount = raw.count { it.isDigit() }

                if (digitCount < LOOKUP_MIN_DIGITS) {
                    resetLookupCard()
                    return
                }

                // Debounced lookup
                lookupJob?.cancel()
                lookupJob = lifecycleScope.launch {
                    // Longer delay for partial, shorter for full numbers
                    val delayMs = if (digitCount >= LOOKUP_FULL_DIGITS) 200L else LOOKUP_DEBOUNCE_MS
                    delay(delayMs)
                    performLookup(raw)
                }
            }
        })
    }

    private suspend fun performLookup(raw: String) {
        val normalized = PhoneNumberUtils.normalize(raw) ?: return

        // Avoid duplicate lookups
        if (normalized == lastLookupNormalized) return
        lastLookupNormalized = normalized
        lastCallerIdResult = null

        // 1. Check local Room cache first
        val cached = dao.findByNumber(normalized)
        if (cached != null) {
            withContext(Dispatchers.Main) {
                showLookupCard(cached)
            }
        }

        // 2. Call caller-id API for live data
        try {
            val response = withContext(Dispatchers.IO) {
                withTimeout(3_000L) {
                    ApiClient.api.callerId(CallerIdRequest(normalized))
                }
            }
            if (response.isSuccessful && response.body() != null) {
                val body = response.body()!!
                lastCallerIdResult = body

                // Upsert into cache
                dao.upsert(CachedNumber(
                    phoneNumber = normalized,
                    threatScore = body.threatScore,
                    verdict = body.verdict ?: "unknown",
                    shouldBlock = body.shouldBlock,
                    isScam = body.isScam,
                    scamType = body.scamType,
                    severity = body.severity,
                    displayName = body.displayName,
                    carrier = body.carrier,
                    telecomCircle = body.telecomCircle,
                    location = body.location,
                    city = body.city,
                    state = body.state,
                    country = body.country,
                    isIndian = body.isIndian ?: true,
                    numberType = body.numberType,
                    isVoip = body.isVoip ?: false,
                    reportCount = body.reportCount,
                    verified = body.verified,
                    source = body.source,
                    lastChecked = System.currentTimeMillis()
                ))

                withContext(Dispatchers.Main) {
                    showLookupCardFromCallerId(body)
                }
            }
        } catch (e: Exception) {
            Log.w(TAG, "Lookup failed for $normalized: ${e.message}")
            // If we have cached data, we already showed it above
        }
    }

    // ── Lookup Card Display ──────────────────────────────────────

    private fun showLookupCard(cached: CachedNumber) {
        lookupCard.visibility = View.VISIBLE

        // Threat badge
        when {
            cached.shouldBlock || cached.threatScore >= 70 -> {
                threatBadge.text = "🚫 ${cached.scamType?.replace("_", " ")?.uppercase() ?: "SCAM"}"
                threatBadge.setTextColor(getColor(android.R.color.holo_red_dark))
            }
            cached.threatScore >= 35 -> {
                threatBadge.text = "⚠️ ${cached.scamType?.replace("_", " ") ?: "Suspicious"}"
                threatBadge.setTextColor(getColor(android.R.color.holo_orange_dark))
            }
            else -> {
                threatBadge.text = "✅ Safe"
                threatBadge.setTextColor(getColor(android.R.color.holo_green_dark))
            }
        }

        // Caller name
        callerNameText.text = cached.displayName ?: cached.scamType ?: "Unknown Caller"
        callerNameText.visibility = View.VISIBLE

        // Carrier + location
        val locParts = mutableListOf<String>()
        cached.carrier?.let { locParts.add("🏢 $it") }
        cached.telecomCircle?.let { locParts.add(it) }
        cached.location?.let { if (!locParts.any { it.contains("📍") }) locParts.add("📍 $it") }
        if (locParts.isNotEmpty()) {
            carrierLocationText.text = locParts.joinToString(" · ")
            carrierLocationText.visibility = View.VISIBLE
        } else {
            carrierLocationText.visibility = View.GONE
        }

        // Report info
        val reportParts = mutableListOf<String>()
        if (cached.reportCount > 0) reportParts.add("${cached.reportCount} community reports")
        if (cached.verified) reportParts.add("✅ Verified")
        if (cached.scamType != null) reportParts.add(cached.scamType!!.replace("_", " "))
        reportInfoText.text = if (reportParts.isNotEmpty()) reportParts.joinToString(" · ") else "No reports yet"
        reportInfoText.visibility = View.VISIBLE

        // Block & Report button for scam numbers
        if (cached.shouldBlock || cached.isScam) {
            blockReportButton.text = "Block & Report"
            blockReportButton.visibility = View.VISIBLE
        } else {
            blockReportButton.visibility = View.GONE
        }
    }

    private fun showLookupCardFromCallerId(body: CallerIdResponse) {
        lookupCard.visibility = View.VISIBLE

        // Threat badge
        when {
            body.shouldBlock || body.threatScore >= 70 -> {
                threatBadge.text = "🚫 ${body.scamType?.replace("_", " ")?.uppercase() ?: "SCAM"}"
                threatBadge.setTextColor(getColor(android.R.color.holo_red_dark))
            }
            body.threatScore >= 35 -> {
                threatBadge.text = "⚠️ ${body.scamType?.replace("_", " ") ?: "Suspicious"}"
                threatBadge.setTextColor(getColor(android.R.color.holo_orange_dark))
            }
            else -> {
                threatBadge.text = "✅ Safe"
                threatBadge.setTextColor(getColor(android.R.color.holo_green_dark))
            }
        }

        // Caller name
        callerNameText.text = body.displayName ?: body.carrier ?: "Unknown Caller"
        callerNameText.visibility = View.VISIBLE

        // Carrier + location
        val locParts = mutableListOf<String>()
        body.carrier?.let { locParts.add("🏢 $it") }
        body.telecomCircle?.let { locParts.add(it) }
        body.location?.let { if (!locParts.any { it.contains("📍") }) locParts.add("📍 $it") }
        if (locParts.isNotEmpty()) {
            carrierLocationText.text = locParts.joinToString(" · ")
            carrierLocationText.visibility = View.VISIBLE
        } else {
            carrierLocationText.visibility = View.GONE
        }

        // Report info
        val reportParts = mutableListOf<String>()
        if (body.reportCount > 0) reportParts.add("${body.reportCount} community reports")
        if (body.verified) reportParts.add("✅ Verified")
        if (body.scamType != null) reportParts.add(body.scamType!!.replace("_", " "))
        reportInfoText.text = if (reportParts.isNotEmpty()) reportParts.joinToString(" · ") else "No reports yet"
        reportInfoText.visibility = View.VISIBLE

        // Block & Report button for scam numbers
        if (body.shouldBlock || body.isScam) {
            blockReportButton.text = "Block & Report"
            blockReportButton.visibility = View.VISIBLE
            blockReportButton.setOnClickListener { onBlockAndReport(body) }
        } else {
            blockReportButton.visibility = View.GONE
        }
    }

    private fun resetLookupCard() {
        lastLookupNormalized = null
        lastCallerIdResult = null
        lookupCard.visibility = View.GONE
        blockReportButton.visibility = View.GONE
    }

    private fun onBlockAndReport(callerId: CallerIdResponse) {
        lifecycleScope.launch {
            try {
                val scamType = callerId.scamType ?: "suspected_scam"
                val response = withContext(Dispatchers.IO) {
                    ApiClient.api.report(
                        ReportRequest(
                            phoneNumber = callerId.phoneNumber,
                            scamType = scamType,
                            description = "Reported from Android dialer"
                        )
                    )
                }
                if (response.isSuccessful) {
                    withContext(Dispatchers.Main) {
                        Toast.makeText(
                            this@CallShieldDialerActivity,
                            "Number reported & blocked ✓",
                            Toast.LENGTH_SHORT
                        ).show()
                    }
                    // Update cache
                    dao.upsert(CachedNumber(
                        phoneNumber = callerId.phoneNumber,
                        threatScore = 100,
                        verdict = "scam",
                        shouldBlock = true,
                        isScam = true,
                        scamType = scamType,
                        severity = "high",
                        displayName = callerId.displayName,
                        carrier = callerId.carrier,
                        telecomCircle = callerId.telecomCircle,
                        location = callerId.location,
                        city = callerId.city,
                        state = callerId.state,
                        country = callerId.country,
                        isIndian = callerId.isIndian ?: true,
                        numberType = callerId.numberType,
                        isVoip = callerId.isVoip ?: false,
                        reportCount = callerId.reportCount + 1,
                        verified = true,
                        source = "user-report"
                    ))
                }
            } catch (e: Exception) {
                Log.e(TAG, "Report failed: ${e.message}")
                withContext(Dispatchers.Main) {
                    Toast.makeText(
                        this@CallShieldDialerActivity,
                        "Report failed — check connection",
                        Toast.LENGTH_SHORT
                    ).show()
                }
            }
        }
    }

    // ── Call Button ──────────────────────────────────────────────

    private fun setupCallButton() {
        callButton.setOnClickListener {
            val raw = numberInput.text.toString()
            val normalized = PhoneNumberUtils.normalize(raw)

            if (normalized == null || !PhoneNumberUtils.isValidForDialing(raw)) {
                Toast.makeText(this, "Enter a valid phone number", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            if (ContextCompat.checkSelfPermission(this, Manifest.permission.CALL_PHONE)
                != PackageManager.PERMISSION_GRANTED) {
                Toast.makeText(this, "Phone permission required", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            val telecomManager = getSystemService(TelecomManager::class.java)
            if (telecomManager.defaultDialerPackage != packageName) {
                // Guide the user to set CallShield as default dialer
                val intent = android.content.Intent(android.provider.Settings.ACTION_MANAGE_DEFAULT_APPS_SETTINGS)
                startActivity(intent)
                Toast.makeText(
                    this,
                    "Set CallShield as your default phone app in Settings",
                    Toast.LENGTH_LONG
                ).show()
                return@setOnClickListener
            }

            val uri = android.net.Uri.parse("tel:$normalized")
            val bundle = Bundle()
            telecomManager.placeCall(uri, bundle)
            Log.d(TAG, "Placing call → $normalized")
        }
    }

    // ── Bottom Navigation ────────────────────────────────────────

    private fun setupBottomNav() {
        navDialer.setOnClickListener {
            // Already on dialer
            numberInput.requestFocus()
        }
        navRecents.setOnClickListener { loadRecentCalls() }
        navContacts.setOnClickListener { openContacts() }
        navSettings.setOnClickListener { openSettings() }
    }

    private fun openContacts() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.READ_CONTACTS)
            != PackageManager.PERMISSION_GRANTED) {
            Toast.makeText(this, "Contacts permission required", Toast.LENGTH_SHORT).show()
            return
        }
        // Open system contact picker
        val intent = android.content.Intent(android.content.Intent.ACTION_PICK).apply {
            type = android.provider.ContactsContract.CommonDataKinds.Phone.CONTENT_TYPE
        }
        startActivityForResult(intent, 200)
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: android.content.Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == 200 && resultCode == RESULT_OK && data != null) {
            val contactUri = data.data ?: return
            // Read phone number from contact
            val cursor = contentResolver.query(
                contactUri,
                arrayOf(android.provider.ContactsContract.CommonDataKinds.Phone.NUMBER),
                null, null, null
            )
            cursor?.use {
                if (it.moveToFirst()) {
                    val number = it.getString(0)
                    val digits = number.replace(Regex("[^0-9+]"), "")
                    numberInput.setText(digits)
                    numberInput.setSelection(digits.length)
                }
            }
        }
    }

    private fun openSettings() {
        // Simple settings: just show the default apps screen for now
        val intent = android.content.Intent(android.provider.Settings.ACTION_MANAGE_DEFAULT_APPS_SETTINGS)
        startActivity(intent)
    }

    // ── Recent Calls ─────────────────────────────────────────────

    private fun loadRecentCalls() {
        recentLabel.text = "Recent Calls"
        lifecycleScope.launch {
            val entries = withContext(Dispatchers.IO) {
                loadSystemCallLog()
            }
            withContext(Dispatchers.Main) {
                if (entries.isNotEmpty()) {
                    recentRecycler.adapter = CallLogAdapter(entries) { entry ->
                        numberInput.setText(PhoneNumberUtils.forDisplay(entry.number))
                    }
                    recentRecycler.visibility = View.VISIBLE
                    recentLabel.text = "Recent Calls (${entries.size})"
                } else {
                    // Fall back to lookup history
                    val cached = dao.getAll()
                    if (cached.isNotEmpty()) {
                        recentRecycler.adapter = CachedLookupAdapter(cached) { entry ->
                            numberInput.setText(PhoneNumberUtils.forDisplay(entry.phoneNumber))
                        }
                        recentRecycler.visibility = View.VISIBLE
                        recentLabel.text = "Recent Lookups (${cached.size})"
                    } else {
                        recentRecycler.visibility = View.GONE
                        recentLabel.text = "No recent activity"
                    }
                }
            }
        }
    }

    private fun loadSystemCallLog(): List<CallLogEntry> {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.READ_CALL_LOG)
            != PackageManager.PERMISSION_GRANTED) {
            return emptyList()
        }

        val entries = mutableListOf<CallLogEntry>()
        val cursor = contentResolver.query(
            CallLog.Calls.CONTENT_URI,
            arrayOf(
                CallLog.Calls.NUMBER,
                CallLog.Calls.TYPE,
                CallLog.Calls.DATE,
                CallLog.Calls.DURATION,
                CallLog.Calls.CACHED_NAME
            ),
            null, null,
            "${CallLog.Calls.DATE} DESC LIMIT 50"
        )
        cursor?.use {
            val numberIdx = it.getColumnIndex(CallLog.Calls.NUMBER)
            val typeIdx = it.getColumnIndex(CallLog.Calls.TYPE)
            val dateIdx = it.getColumnIndex(CallLog.Calls.DATE)
            val durationIdx = it.getColumnIndex(CallLog.Calls.DURATION)
            val nameIdx = it.getColumnIndex(CallLog.Calls.CACHED_NAME)
            while (it.moveToNext()) {
                entries.add(CallLogEntry(
                    number = it.getString(numberIdx) ?: "Unknown",
                    type = it.getInt(typeIdx),
                    date = it.getLong(dateIdx),
                    duration = it.getLong(durationIdx),
                    cachedName = it.getString(nameIdx)
                ))
            }
        }
        return entries
    }

    // ── Permissions ──────────────────────────────────────────────

    private fun requestPermissionsIfNeeded() {
        val needed = mutableListOf<String>()
        for (perm in arrayOf(
            Manifest.permission.READ_PHONE_STATE,
            Manifest.permission.READ_CONTACTS,
            Manifest.permission.CALL_PHONE,
            Manifest.permission.READ_CALL_LOG,
            Manifest.permission.WRITE_CALL_LOG
        )) {
            if (ContextCompat.checkSelfPermission(this, perm) != PackageManager.PERMISSION_GRANTED) {
                needed.add(perm)
            }
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED) {
                needed.add(Manifest.permission.POST_NOTIFICATIONS)
            }
        }
        if (needed.isNotEmpty()) {
            ActivityCompat.requestPermissions(this, needed.toTypedArray(), PERMISSION_REQUEST_CODE)
        }
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == PERMISSION_REQUEST_CODE) {
            val denied = permissions.filterIndexed { i, _ ->
                grantResults[i] != PackageManager.PERMISSION_GRANTED
            }
            if (denied.isNotEmpty()) {
                Toast.makeText(
                    this,
                    "Some permissions denied. CallShield needs them to screen and manage calls.",
                    Toast.LENGTH_LONG
                ).show()
            }
        }
    }
}

// ── Data Classes for Call Log Display ────────────────────────────────

data class CallLogEntry(
    val number: String,
    val type: Int,
    val date: Long,
    val duration: Long,
    val cachedName: String?
)

/**
 * Adapter for system call log entries.
 */
class CallLogAdapter(
    private val entries: List<CallLogEntry>,
    private val onEntryClick: (CallLogEntry) -> Unit
) : RecyclerView.Adapter<CallLogAdapter.ViewHolder>() {

    private val dateFormat = SimpleDateFormat("MMM dd, HH:mm", Locale.getDefault())

    class ViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        val nameText: TextView = view.findViewById(R.id.recentNumber)
        val detailText: TextView = view.findViewById(R.id.recentVerdict)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_recent_lookup, parent, false)
        return ViewHolder(view)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        val entry = entries[position]
        holder.nameText.text = entry.cachedName
            ?: PhoneNumberUtils.forDisplay(entry.number)

        val typeIcon = when (entry.type) {
            CallLog.Calls.INCOMING_TYPE -> "📥"
            CallLog.Calls.OUTGOING_TYPE -> "📤"
            CallLog.Calls.MISSED_TYPE -> "🔴"
            else -> "📞"
        }
        val durationStr = if (entry.duration > 0) {
            "${entry.duration}s"
        } else ""
        holder.detailText.text = "$typeIcon ${dateFormat.format(Date(entry.date))} $durationStr".trim()

        holder.itemView.setOnClickListener { onEntryClick(entry) }
    }

    override fun getItemCount(): Int = entries.size
}

/**
 * Adapter for cached lookup entries.
 */
class CachedLookupAdapter(
    private val entries: List<CachedNumber>,
    private val onEntryClick: (CachedNumber) -> Unit
) : RecyclerView.Adapter<CachedLookupAdapter.ViewHolder>() {

    class ViewHolder(view: View) : RecyclerView.ViewHolder(view) {
        val numberText: TextView = view.findViewById(R.id.recentNumber)
        val detailText: TextView = view.findViewById(R.id.recentVerdict)
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_recent_lookup, parent, false)
        return ViewHolder(view)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        val entry = entries[position]
        holder.numberText.text = entry.displayName
            ?: PhoneNumberUtils.forDisplay(entry.phoneNumber)

        val verdict = when {
            entry.shouldBlock || entry.threatScore >= 70 ->
                "🚫 ${entry.scamType?.replace("_", " ") ?: "Blocked"}"
            entry.threatScore >= 35 ->
                "⚠️ ${entry.scamType?.replace("_", " ") ?: "Suspicious"}"
            else -> "✅ Safe"
        }
        holder.detailText.text = verdict
        holder.itemView.setOnClickListener { onEntryClick(entry) }
    }

    override fun getItemCount(): Int = entries.size
}
