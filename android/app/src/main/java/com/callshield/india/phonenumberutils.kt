package com.callshield.india

/**
 * Utility for normalizing and parsing Indian phone numbers.
 *
 * Handles:
 *   - Leading +91, 91, 0 prefixes
 *   - Local 10-digit numbers
 *   - Landline numbers with STD codes
 *   - Numbers with spaces, dashes, parentheses
 */
object PhoneNumberUtils {

    private const val INDIA_COUNTRY_CODE = "+91"

    /**
     * Normalize a raw phone number into the standard format used for
     * API lookups and DB storage: "+91XXXXXXXXXX" (10-digit mobile)
     * or "+91<STD><number>" for landlines.
     *
     * Returns null if the number is clearly invalid.
     */
    fun normalize(raw: String): String? {
        // Strip everything except digits and leading +
        val cleaned = raw.trim()
            .replace(Regex("[\\s\\-()]"), "")

        if (cleaned.isBlank()) return null

        // Already has + prefix — assume it's well-formed
        if (cleaned.startsWith("+")) {
            return cleaned
        }

        // Strip all non-digits for processing
        val digits = cleaned.replace(Regex("[^0-9]"), "")
        if (digits.length < 10) return null

        return when {
            // 91XXXXXXXXXX → +91XXXXXXXXXX
            digits.startsWith("91") && digits.length == 12 -> "+$digits"
            // 0XXXXXXXXXX → drop leading 0, add +91
            digits.startsWith("0") && digits.length == 11 -> "$INDIA_COUNTRY_CODE${digits.substring(1)}"
            // Plain 10-digit mobile
            digits.length == 10 -> "$INDIA_COUNTRY_CODE$digits"
            // Landline with STD code (11 digits including leading 0) → +91<STD without 0><number>
            digits.startsWith("0") && digits.length in 11..12 -> "$INDIA_COUNTRY_CODE${digits.substring(1)}"
            // Catch-all: 12 digits starting with 91
            digits.length == 12 && digits.startsWith("91") -> "+$digits"
            // Unknown format — return as-is
            else -> "+$digits"
        }
    }

    /**
     * Get the display-friendly version of a normalized number.
     * +919876543210 → "98765 43210"
     */
    fun forDisplay(normalized: String): String {
        val digits = normalized.removePrefix("+91").removePrefix("91")
        return when (digits.length) {
            10 -> "${digits.substring(0, 5)} ${digits.substring(5)}"
            else -> normalized
        }
    }
}
