package com.callshield.india

import android.Manifest
import android.content.pm.PackageManager
import android.os.Bundle
import android.telecom.TelecomManager
import android.text.Editable
import android.text.TextWatcher
import android.util.Log
import android.view.View
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.callshield.india.ApiModels.LookupRequest
import com.callshield.india.ApiModels.LookupResponse
import kotlinx.coroutines.*

/**
 * Main dialer activity for CallShield India.
 *
 * Features:
 *   - Full dial pad (0-9, *, #)
 *   - Real-time number formatting
 *   - Quick threat lookup as user types
 *   - Recent calls / lookup history
 *   - Carrier & circle display
 *   - Call button with telecom integration
 */
class CallShieldDialerActivity : AppCompatActivity() {

    companion object {
        private const val TAG = "CallShieldDialer"
        private const val PERMISSION_REQUEST_CODE = 1001
        private const val LOOKUP_DEBOUNCE_MS = 400L
    }

    // --- UI References ---
    private lateinit var numberInput: EditText
    private lateinit var threatBadge: TextView
    private lateinit var carrierInfo: TextView
    private lateinit var callButton: Button
    private lateinit var recentRecycler: RecyclerView

    // --- State ---
    private lateinit var db: LocalDb
    private lateinit var dao: ScamNumberDao
    private var lookupJob: Job? = null
    private var lastLookupNormalized: String? = null
    private var lastLookupResponse: LookupResponse? = null

    // --- Dial Pad buttons (0-9, *, #) ---
    private val dialButtons: MutableMap<String, Button> = mutableMapOf()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_dialer)

        db = CallShieldApplication.instance.database
        dao = db.scamNumberDao()

        bindViews()
        setupDialPad()
        setupNumberInput()
        setupCallButton()
        loadRecentSearches()
        requestPermissionsIfNeeded()
    }

    // --- View Binding ---

    private fun bindViews() {
        numberInput = findViewById(R.id.numberInput)
        threatBadge = findViewById(R.id.threatBadge)
        carrierInfo = findViewById(R.id.carrierInfo)
        callButton = findViewById(R.id.callButton)
        recentRecycler = findViewById(R.id.recentRecycler)

        recentRecycler.layoutManager = LinearLayoutManager(this)

        // Collect dial pad buttons
        val buttonIds = mapOf(
            "0" to R.id.btn0, "1" to R.id.btn1, "2" to R.id.btn2,
            "3" to R.id.btn3, "4" to R.id.btn4, "5" to R.id.btn5,
            "6" to R.id.btn6, "7" to R.id.btn7, "8" to R.id.btn8,
            "9" to R.id.btn9, "*" to R.id.btnStar, "#" to R.id.btnHash
        )
        buttonIds.forEach { (digit, id) ->
            findViewById<Button>(id)?.let { dialButtons[digit] = it }
        }

        // Backspace
        findViewById<Button>(R.id.btnBackspace)?.setOnClickListener { onBackspace() }
    }

    // --- Dial Pad ---

    private fun setupDialPad() {
        dialButtons.forEach { (digit, button) ->
            button.setOnClickListener {
                onDigitPressed(digit)
            }
        }
    }

    private fun onDigitPressed(digit: String) {
        val current = numberInput.text.toString()
        numberInput.setText("$current$digit")
        numberInput.setSelection(numberInput.text.length)
    }

    private fun onBackspace() {
        val current = numberInput.text.toString()
        if (current.isNotEmpty()) {
            numberInput.setText(current.substring(0, current.length - 1))
            numberInput.setSelection(numberInput.text.length)
        }
    }

    // --- Number Input & Auto Lookup ---

    private fun setupNumberInput() {
        numberInput.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {}

            override fun afterTextChanged(s: Editable?) {
                val raw = s?.toString().orEmpty()
                // Don't lookup very short numbers
                if (raw.filter { it.isDigit() }.length < 6) {
                    resetLookupUi()
                    return
                }
                // Debounced lookup
                lookupJob?.cancel()
                lookupJob = lifecycleScope.launch {
                    delay(LOOKUP_DEBOUNCE_MS)
                    performQuickLookup(raw)
                }
            }
        })
    }

    private suspend fun performQuickLookup(raw: String) {
        val normalized = PhoneNumberUtils.normalize(raw) ?: return

        // Avoid duplicate lookups for same number
        if (normalized == lastLookupNormalized) return
        lastLookupNormalized = normalized

        // Check cache first
        val cached = dao.findByNumber(normalized)
        if (cached != null) {
            withContext(Dispatchers.Main) { updateLookupUi(cached) }
            return
        }

        // Quick API call
        try {
            val response = withContext(Dispatchers.IO) {
                withTimeout(2_000L) {
                    ApiClient.api.lookup(LookupRequest(normalized))
                }
            }
            if (response.isSuccessful && response.body() != null) {
                val body = response.body()!!
                // Cache it
                dao.upsert(ScamNumber(
                    phoneNumber = normalized,
                    threatScore = body.threatScore,
                    scamType = body.scamType,
                    scamSubType = body.scamSubType,
                    carrier = body.carrier,
                    circle = body.circle,
                    location = body.location,
                    category = body.category,
                    verifiedName = body.verifiedName,
                    shouldBlock = body.shouldBlock,
                    verdict = body.verdict,
                    reportCount = body.reportCount,
                    lastChecked = System.currentTimeMillis()
                ))
                withContext(Dispatchers.Main) { updateLookupUi(body) }
            }
        } catch (e: Exception) {
            Log.w(TAG, "Quick lookup failed for $normalized: ${e.message}")
        }
    }

    private fun updateLookupUi(cached: ScamNumber) {
        updateLookupUi(LookupResponse(
            phoneNumber = cached.phoneNumber,
            verifiedName = cached.verifiedName,
            carrier = cached.carrier,
            circle = cached.circle,
            location = cached.location,
            category = cached.category,
            threatScore = cached.threatScore,
            scamType = cached.scamType,
            scamSubType = cached.scamSubType,
            shouldBlock = cached.shouldBlock,
            verdict = cached.verdict,
            recommendation = null,
            reportCount = cached.reportCount,
            lastReported = null,
            rawDetails = null
        ))
    }

    private fun updateLookupUi(response: LookupResponse) {
        lastLookupResponse = response

        // Threat badge
        when {
            response.shouldBlock || response.threatScore >= 70 -> {
                threatBadge.text = "⚠️ SCAM — ${response.scamType ?: "High Risk"}"
                threatBadge.setTextColor(getColor(android.R.color.holo_red_dark))
                threatBadge.visibility = View.VISIBLE
            }
            response.threatScore >= 40 -> {
                threatBadge.text = "⚠️ Suspicious — ${response.scamType ?: "Unknown"}"
                threatBadge.setTextColor(getColor(android.R.color.holo_orange_dark))
                threatBadge.visibility = View.VISIBLE
            }
            else -> {
                threatBadge.visibility = View.GONE
            }
        }

        // Carrier / circle info
        val parts = mutableListOf<String>()
        response.carrier?.let { parts.add(it) }
        response.circle?.let { parts.add(it) }
        response.location?.let { parts.add(it) }
        response.verifiedName?.let { parts.add("📛 $it") }

        if (parts.isNotEmpty()) {
            carrierInfo.text = parts.joinToString(" · ")
            carrierInfo.visibility = View.VISIBLE
        } else {
            carrierInfo.visibility = View.GONE
        }
    }

    private fun resetLookupUi() {
        lastLookupNormalized = null
        lastLookupResponse = null
        threatBadge.visibility = View.GONE
        carrierInfo.visibility = View.GONE
    }

    // --- Call Button ---

    private fun setupCallButton() {
        callButton.setOnClickListener {
            val raw = numberInput.text.toString()
            val normalized = PhoneNumberUtils.normalize(raw)
                ?: raw.also { Toast.makeText(this, "Enter a valid number", Toast.LENGTH_SHORT).show() }

            if (normalized != null && raw.filter { it.isDigit() }.length >= 6) {
                placeCall(normalized)
            }
        }
    }

    private fun placeCall(normalized: String) {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CALL_PHONE)
            != PackageManager.PERMISSION_GRANTED) {
            Toast.makeText(this, "Phone permission required", Toast.LENGTH_SHORT).show()
            return
        }

        val telecomManager = getSystemService(TelecomManager::class.java)
        if (telecomManager.defaultDialerPackage != packageName) {
            // Offer to set as default dialer
            val intent = android.content.Intent(android.provider.Settings.ACTION_MANAGE_DEFAULT_APPS_SETTINGS)
            startActivity(intent)
            Toast.makeText(this, "Set CallShield as your default dialer first", Toast.LENGTH_LONG).show()
            return
        }

        val uri = android.net.Uri.parse("tel:$normalized")
        val bundle = Bundle()
        telecomManager.placeCall(uri, bundle)
        Log.d(TAG, "Placing call to $normalized")
    }

    // --- Recent Searches ---

    private fun loadRecentSearches() {
        lifecycleScope.launch {
            val recent = withContext(Dispatchers.IO) { dao.getAll() }
            withContext(Dispatchers.Main) {
                recentRecycler.adapter = RecentLookupAdapter(recent) { entry ->
                    numberInput.setText(PhoneNumberUtils.forDisplay(entry.phoneNumber))
                }
            }
        }
    }

    // --- Permission Handling ---

    private fun requestPermissionsIfNeeded() {
        val needed = mutableListOf<String>()
        val perms = arrayOf(
            Manifest.permission.READ_PHONE_STATE,
            Manifest.permission.READ_CONTACTS,
            Manifest.permission.CALL_PHONE,
            Manifest.permission.READ_CALL_LOG,
            Manifest.permission.WRITE_CALL_LOG
        )
        perms.forEach { perm ->
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
                    "Some permissions were denied. CallShield needs them to screen calls.",
                    Toast.LENGTH_LONG
                ).show()
            }
        }
    }
}
