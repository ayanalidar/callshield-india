package com.callshield.india

/**
 * Utility for normalizing, validating, and formatting phone numbers
 * with a focus on the Indian numbering plan.
 *
 * Handles:
 *   - +91 / 91 / 0 prefix normalization
 *   - 10-digit mobile numbers
 *   - Landline numbers with STD codes
 *   - Numbers containing spaces, dashes, parentheses
 */
object PhoneNumberUtils {

    /** India country code prefix in E.164 format. */
    const val INDIA_PREFIX = "+91"

    /** Minimum length for a valid Indian mobile number (digits only). */
    private const val MIN_DIGITS = 10

    // Common Indian scam/telemarketing prefixes for quick offline scoring
    private val SCAM_PREFIXES = setOf(
        "+91140", "+91141", "+91142", "+91143", "+91144",
        "+9180",  "+9185",  "+9186",
        "+91900", "+91901", "+91902", "+91903", "+91904"
    )

    /**
     * Normalize a raw phone number to E.164-like format.
     *
     * Returns null only if the number has fewer than [MIN_DIGITS] digit characters
     * or is completely blank.
     *
     * Examples:
     *   "9876543210"       → "+919876543210"
     *   "0919876543210"    → "+919876543210"
     *   "+91 98765 43210"  → "+919876543210"
     *   "0-11-2345-6789"   → "+911123456789"  (Delhi landline)
     */
    fun normalize(raw: String): String? {
        // Strip whitespace, dashes, parens — keep digits and leading '+'
        val cleaned = raw.trim().replace(Regex("""[\s\-().]"""), "")

        if (cleaned.isBlank()) return null

        // Already E.164-compatible — return as-is
        if (cleaned.startsWith("+")) {
            val digits = cleaned.substring(1)
            if (digits.all { it.isDigit() } && digits.length >= 7) return cleaned
            return null
        }

        // Extract only digits
        val digits = cleaned.replace(Regex("[^0-9]"), "")
        if (digits.length < MIN_DIGITS) return null

        return when {
            // 91XXXXXXXXXX (12 digits, starts with 91) → +91XXXXXXXXXX
            digits.startsWith("91") && digits.length == 12 -> "+$digits"
            // 0XXXXXXXXXX (11 digits, starts with 0) → +91 then drop leading 0
            digits.startsWith("0") && digits.length == 11 -> "$INDIA_PREFIX${digits.substring(1)}"
            // Plain 10-digit mobile → +91 prefix
            digits.length == 10 -> "$INDIA_PREFIX$digits"
            // Landline with STD code (11-12 digits, leading 0) → +91 then drop 0
            digits.startsWith("0") && digits.length in 11..12 -> "$INDIA_PREFIX${digits.substring(1)}"
            // 12-digit starting with 91 → + prefix
            digits.length == 12 && digits.startsWith("91") -> "+$digits"
            // Catch-all: prepend + to raw digits
            else -> "+$digits"
        }
    }

    /**
     * Get a display-friendly format for a normalized number.
     *
     * Examples:
     *   "+919876543210" → "+91 98765 43210"
     *   "+911123456789" → "+91 11 2345 6789"
     */
    fun forDisplay(normalized: String): String {
        val digits = normalized.removePrefix("+91").removePrefix("91")
        return when {
            digits.length == 10 ->
                "$INDIA_PREFIX ${digits.substring(0, 5)} ${digits.substring(5)}"
            digits.length > 10 ->
                "$INDIA_PREFIX ${digits.substring(0, 2)} ${digits.substring(2, 6)} ${digits.substring(6)}"
            else -> normalized
        }
    }

    /**
     * Extract just the national significant digits (without +91 prefix).
     * "+919876543210" → "9876543210"
     */
    fun nationalDigits(normalized: String): String {
        return normalized.removePrefix("+91").removePrefix("91")
    }

    /**
     * Quick offline check: does the number match a known scam prefix?
     * These prefixes are associated with telemarketing / spam in India.
     */
    fun matchesScamPrefix(normalized: String): Boolean {
        return SCAM_PREFIXES.any { normalized.startsWith(it) }
    }

    /**
     * Determine if the normalized number is an Indian number.
     * Returns true if it starts with +91.
     */
    fun isIndian(normalized: String): Boolean {
        return normalized.startsWith("+91") || normalized.startsWith("91")
    }

    /**
     * Quick validity check for display: does the number have at least 10 digits
     * after stripping formatting?
     */
    fun isValidForDialing(raw: String): Boolean {
        val digits = raw.replace(Regex("[^0-9]"), "")
        return digits.length >= MIN_DIGITS
    }
}
