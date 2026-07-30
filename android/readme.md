# CallShield India — Android Dialer

**A full replacement dialer for Indian Android users with real-time scam/spam call screening.**

CallShield intercepts incoming calls through Android's `CallScreeningService` API (Android 7.0+), normalizes the Indian phone number, checks a local Room SQLite cache, then queries the live [CallShield India API](https://callshield-india.vercel.app/) for threat analysis. High-risk calls are blocked automatically; suspicious calls are allowed with a warning overlay.

## Features

| Feature | Description |
|---|---|
| 📵 **Auto-block scams** | Blocks known scam/fraud numbers before your phone rings |
| ⚠️ **Threat scoring** | Shows risk score, scam type, carrier, and circle/location |
| 📞 **Custom dialer UI** | Full dial pad with real-time threat lookup while you type |
| 🗄️ **Local cache** | Room SQLite database caches lookups for 30 minutes |
| 🔄 **Auto-sync** | Periodic background sync refreshes the cache every 30 minutes |
| 🔢 **Indian number handling** | Normalizes +91/91/0 prefixes and 10-digit mobile numbers |
| 📊 **Report spam** | One-tap reporting to the community database |

## Architecture

```
┌─────────────────────────────────────────────┐
│                 Incoming Call                │
└──────────────────┬──────────────────────────┘
                   │
    ┌──────────────▼──────────────────┐
    │  CallScreeningService           │
    │  (CallShieldScreeningService)   │
    │  1. Extract & normalize number  │
    │  2. Check Room SQLite cache     │
    │  3. Query API if cache miss/exp │
    │  4. Block / Allow / Warn        │
    └─────────────────────────────────┘
                   │
    ┌──────────────▼──────────────────┐
    │  InCallService                  │
    │  (CallShieldInCallService)      │
    │  Custom call UI with:           │
    │  - Caller identity              │
    │  - Threat badge                 │
    │  - Report spam button           │
    └─────────────────────────────────┘
```

## Project Structure

```
callshield/android/
├── build.gradle                  # Project-level Gradle config
├── settings.gradle               # Module settings
├── gradle.properties             # Gradle JVM/AndroidX opts
├── gradle/wrapper/
│   └── gradle-wrapper.properties
├── app/
│   ├── build.gradle              # App module with all dependencies
│   ├── proguard-rules.pro        # ProGuard / R8 rules
│   └── src/main/
│       ├── AndroidManifest.xml   # Permissions & service declarations
│       ├── res/
│       │   ├── drawable/         # Adaptive icon assets, backgrounds
│       │   ├── layout/           # Dialer UI & list item layouts
│       │   ├── mipmap-anydpi-v26/# Adaptive launcher icon
│       │   ├── values/           # Colors, strings, themes
│       │   └── xml/              # Network security config
│       └── java/com/callshield/india/
│           ├── ApiClient.kt                    # Retrofit singleton
│           ├── ApiModels.kt                    # DTOs (LookupRequest/Response, etc.)
│           ├── CallShieldApi.kt                # Retrofit interface
│           ├── CallShieldApplication.kt        # Application class
│           ├── CallShieldConnectionService.kt   # ConnectionService (dialer bridge)
│           ├── CallShieldDialerActivity.kt     # Main dialer UI
│           ├── CallShieldInCallService.kt      # InCallService (custom call screen)
│           ├── CallShieldScreeningService.kt   # CallScreeningService (spam detection)
│           ├── CacheSyncWorker.kt              # WorkManager periodic sync
│           ├── LocalDb.kt                      # Room DB, entity, DAO
│           ├── PhoneNumberUtils.kt             # Indian phone number normalization
│           └── RecentLookupAdapter.kt          # RecyclerView adapter
```

## Prerequisites

- **Android Studio** Hedgehog (2023.1.1) or later
- **JDK 17** (bundled with Android Studio)
- **Gradle 8.5** (auto-downloaded via wrapper)
- **Android SDK 34** with Build Tools 34.0.0
- An Android device running **Android 7.0 (API 24)** or higher

## Build & Install

### 1. Clone / Navigate

```bash
cd callshield/android
```

### 2. Set up the Android SDK

Make sure `ANDROID_HOME` is set, or `local.properties` points to your SDK:

```properties
# callshield/android/local.properties
sdk.dir=/path/to/Android/Sdk
```

### 3. Build the APK

```bash
# Debug build (development)
./gradlew assembleDebug

# Release build (signed — you need a keystore)
./gradlew assembleRelease
```

The APK will be at:
- Debug: `app/build/outputs/apk/debug/app-debug.apk`
- Release: `app/build/outputs/apk/release/app-release.apk`

### 4. Install on Device

```bash
# Via ADB
adb install app/build/outputs/apk/debug/app-debug.apk

# Or open the APK on your device directly
```

### 5. First-Run Setup

1. Open **CallShield** from your app drawer
2. Grant the requested permissions (Phone, Contacts, Call Log, Notifications)
3. Set CallShield as your **default dialer** and **call screening app**:
   - Go to **Settings → Apps → Default apps → Phone app** → select CallShield
   - Go to **Settings → Apps → Default apps → Caller ID & spam** → enable CallShield
4. Grant **battery optimization exemption** for reliable background screening

## API Configuration

By default, the app connects to:

```
https://callshield-india.vercel.app/
```

To point to a self-hosted or staging instance, change the URL in `ApiClient.kt`:

```kotlin
// In CallShieldApplication.onCreate() or your settings screen:
ApiClient.configure("https://your-server.example.com/")
```

## API Endpoints Used

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/lookup` | POST | Check phone number threat level |
| `/api/report` | POST | Report a scam/spam number |
| `/api/stats` | GET | Get global statistics |

## Permissions Explained

| Permission | Why |
|---|---|
| `READ_PHONE_STATE` | Detect incoming calls for screening |
| `READ_CONTACTS` | Match callers against contacts |
| `CALL_PHONE` | Place outgoing calls from the dialer |
| `READ_CALL_LOG` / `WRITE_CALL_LOG` | Maintain call history |
| `POST_NOTIFICATIONS` | Show blocked-call alerts |
| `MANAGE_OWN_CALLS` | Full dialer replacement capabilities |
| `FOREGROUND_SERVICE` + `PHONE_CALL` | Keep screening service alive |
| `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` | Prevent Android from killing screening |
| `INTERNET` | API communication |
| `BIND_SCREENING_SERVICE` | System binds to our screening service |
| `BIND_INCALL_SERVICE` | System binds to our custom call UI |
| `BIND_CONNECTION_SERVICE` | System bridges our dialer |

## Compatibility

- ✅ **Android 7.0 – 14** (API 24–34)
- ✅ Works alongside WhatsApp, Truecaller, etc.
- ✅ No root required
- ✅ Google Play / sideload compatible

## License

Proprietary. All rights reserved.

---

**Built for India. Made to block spam.** 🇮🇳
