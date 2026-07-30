package com.callshield.india

import androidx.room.*
import kotlinx.coroutines.flow.Flow

/**
 * Room entity for cached scam/number lookups.
 */
@Entity(
    tableName = "scam_numbers",
    indices = [Index(value = ["phoneNumber"], unique = true)]
)
data class ScamNumber(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,

    @ColumnInfo(name = "phoneNumber")
    val phoneNumber: String,

    @ColumnInfo(name = "threatScore")
    val threatScore: Int,

    @ColumnInfo(name = "scamType")
    val scamType: String?,

    @ColumnInfo(name = "scamSubType")
    val scamSubType: String?,

    @ColumnInfo(name = "carrier")
    val carrier: String?,

    @ColumnInfo(name = "circle")
    val circle: String?,

    @ColumnInfo(name = "location")
    val location: String?,

    @ColumnInfo(name = "category")
    val category: String?,

    @ColumnInfo(name = "verifiedName")
    val verifiedName: String?,

    @ColumnInfo(name = "shouldBlock")
    val shouldBlock: Boolean,

    @ColumnInfo(name = "verdict")
    val verdict: String,

    @ColumnInfo(name = "reportCount")
    val reportCount: Int,

    @ColumnInfo(name = "lastChecked")
    val lastChecked: Long = System.currentTimeMillis()
)

/**
 * DAO for scam number cache.
 */
@Dao
interface ScamNumberDao {

    /**
     * Look up a cached entry by normalized phone number.
     */
    @Query("SELECT * FROM scam_numbers WHERE phoneNumber = :phoneNumber LIMIT 1")
    suspend fun findByNumber(phoneNumber: String): ScamNumber?

    /**
     * Observe a cached entry (Flow for reactive UI).
     */
    @Query("SELECT * FROM scam_numbers WHERE phoneNumber = :phoneNumber LIMIT 1")
    fun observeByNumber(phoneNumber: String): Flow<ScamNumber?>

    /**
     * Insert or update a scam number entry (upsert).
     */
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsert(entry: ScamNumber)

    /**
     * Delete entries older than the given timestamp (cache expiry).
     */
    @Query("DELETE FROM scam_numbers WHERE lastChecked < :olderThan")
    suspend fun deleteOlderThan(olderThan: Long)

    /**
     * Get all cached entries for sync/display.
     */
    @Query("SELECT * FROM scam_numbers ORDER BY lastChecked DESC")
    suspend fun getAll(): List<ScamNumber>

    /**
     * Get count of cached entries.
     */
    @Query("SELECT COUNT(*) FROM scam_numbers")
    suspend fun count(): Int
}

/**
 * Room database for CallShield local storage.
 */
@Database(
    entities = [ScamNumber::class],
    version = 1,
    exportSchema = true
)
abstract class LocalDb : RoomDatabase() {

    abstract fun scamNumberDao(): ScamNumberDao

    companion object {
        const val DATABASE_NAME = "callshield.db"

        @Volatile
        private var INSTANCE: LocalDb? = null

        /**
         * Get or create the database singleton.
         */
        fun getInstance(context: android.content.Context): LocalDb {
            return INSTANCE ?: synchronized(this) {
                INSTANCE ?: Room.databaseBuilder(
                    context.applicationContext,
                    LocalDb::class.java,
                    DATABASE_NAME
                )
                    .fallbackToDestructiveMigration()
                    .build()
                    .also { INSTANCE = it }
            }
        }
    }
}
