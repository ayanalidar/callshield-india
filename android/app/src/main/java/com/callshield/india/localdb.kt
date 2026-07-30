package com.callshield.india

import androidx.room.*
import kotlinx.coroutines.flow.Flow

/**
 * Room entity for cached scam/number lookups.
 * Mirrors the response fields from POST /api/lookup and /api/caller-id.
 */
@Entity(
    tableName = "scam_numbers",
    indices = [
        Index(value = ["phoneNumber"], unique = true),
        Index(value = ["verified"]),
        Index(value = ["lastChecked"])
    ]
)
data class CachedNumber(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,

    /** Normalized phone number, e.g. +919876543210 */
    @ColumnInfo(name = "phoneNumber")
    val phoneNumber: String,

    // ── Threat ──

    @ColumnInfo(name = "threatScore")
    val threatScore: Int,

    @ColumnInfo(name = "verdict")
    val verdict: String,            // "safe" | "suspicious" | "scam" | "critical"

    @ColumnInfo(name = "shouldBlock")
    val shouldBlock: Boolean,

    @ColumnInfo(name = "isScam")
    val isScam: Boolean,

    @ColumnInfo(name = "scamType")
    val scamType: String?,          // e.g. "upi_fraud", "insurance_scam"

    @ColumnInfo(name = "severity")
    val severity: String?,

    // ── Identity ──

    @ColumnInfo(name = "displayName")
    val displayName: String?,

    @ColumnInfo(name = "carrier")
    val carrier: String?,

    @ColumnInfo(name = "telecomCircle")
    val telecomCircle: String?,

    @ColumnInfo(name = "location")
    val location: String?,

    @ColumnInfo(name = "city")
    val city: String?,

    @ColumnInfo(name = "state")
    val state: String?,

    @ColumnInfo(name = "country")
    val country: String?,

    @ColumnInfo(name = "isIndian")
    val isIndian: Boolean,

    @ColumnInfo(name = "numberType")
    val numberType: String?,

    @ColumnInfo(name = "isVoip")
    val isVoip: Boolean,

    // ── Community ──

    @ColumnInfo(name = "reportCount")
    val reportCount: Int,

    @ColumnInfo(name = "verified")
    val verified: Boolean,          // DB-verified scam entry

    @ColumnInfo(name = "source")
    val source: String?,

    // ── Cache metadata ──

    /** Epoch millis when this entry was last refreshed from the API. */
    @ColumnInfo(name = "lastChecked")
    val lastChecked: Long = System.currentTimeMillis(),

    /** Epoch millis when this entry was first cached (for TTL logic). */
    @ColumnInfo(name = "firstCached")
    val firstCached: Long = System.currentTimeMillis()
)

/**
 * DAO for the scam number cache.
 */
@Dao
interface CachedNumberDao {

    /** Look up a cached entry by normalized phone number. */
    @Query("SELECT * FROM scam_numbers WHERE phoneNumber = :phoneNumber LIMIT 1")
    suspend fun findByNumber(phoneNumber: String): CachedNumber?

    /** Observe a cached entry reactively (Flow). */
    @Query("SELECT * FROM scam_numbers WHERE phoneNumber = :phoneNumber LIMIT 1")
    fun observeByNumber(phoneNumber: String): Flow<CachedNumber?>

    /** Upsert: insert or replace on conflict by phoneNumber index. */
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(entry: CachedNumber)

    /** Bulk upsert for offline cache sync. */
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertAll(entries: List<CachedNumber>)

    /** Get all cached entries, newest first. */
    @Query("SELECT * FROM scam_numbers ORDER BY lastChecked DESC")
    suspend fun getAll(): List<CachedNumber>

    /** Get top entries for offline access (most dangerous first). */
    @Query("SELECT * FROM scam_numbers WHERE shouldBlock = 1 ORDER BY threatScore DESC LIMIT :limit")
    suspend fun getTopBlocked(limit: Int = 5000): List<CachedNumber>

    /** Count total cached entries. */
    @Query("SELECT COUNT(*) FROM scam_numbers")
    suspend fun count(): Int

    /** Delete entries older than the given cutoff (cache expiry). */
    @Query("DELETE FROM scam_numbers WHERE lastChecked < :olderThan")
    suspend fun deleteOlderThan(olderThan: Long)

    /** Delete all entries (nuclear reset). */
    @Query("DELETE FROM scam_numbers")
    suspend fun deleteAll()

    /** Search by partial number / carrier / scamType. */
    @Query("""
        SELECT * FROM scam_numbers 
        WHERE phoneNumber LIKE '%' || :query || '%' 
           OR carrier LIKE '%' || :query || '%'
           OR scamType LIKE '%' || :query || '%'
        ORDER BY threatScore DESC 
        LIMIT :limit
    """)
    suspend fun search(@Query("query") query: String, limit: Int = 50): List<CachedNumber>
}

/**
 * Room database for CallShield local storage.
 *
 * Version 2: expanded schema with caller-id fields, verified flag, etc.
 */
@Database(
    entities = [CachedNumber::class],
    version = 2,
    exportSchema = true
)
abstract class LocalDb : RoomDatabase() {

    abstract fun cachedNumberDao(): CachedNumberDao

    companion object {
        const val DATABASE_NAME = "callshield.db"

        @Volatile
        private var INSTANCE: LocalDb? = null

        fun getInstance(context: android.content.Context): LocalDb {
            return INSTANCE ?: synchronized(this) {
                INSTANCE ?: Room.databaseBuilder(
                    context.applicationContext,
                    LocalDb::class.java,
                    DATABASE_NAME
                )
                    .fallbackToDestructiveMigration() // v1→v2: OK to wipe for now
                    .build()
                    .also { INSTANCE = it }
            }
        }
    }
}
