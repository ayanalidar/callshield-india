# CallShield India — Android Default Dialer App

Production-ready Android dialer app that replaces the system phone app with real-time spam/scam call screening, caller ID, and community threat intelligence.

## Features

- **Default Dialer**: Full dial pad (T9), contact picker, call log
- **Real-Time Call Screening**: `CallScreeningService` intercepts every incoming call
- **Caller ID**: Name, carrier, telecom circle, location, scam type, community reports
- **Auto Block/Warn**: Blocks calls with `threatScore >= 60`, warns at `>= 35`
- **Offline Cache**: Room DB with top 5000 scam numbers, 24h/7d TTL
- **Background Sync**: WorkManager refreshes cache every 6 hours
- **Material 3 Dark Theme**: `#1B5E20` primary, `#121212` surface

## Architecture

```
app/src/main/java/com/callshield/india/
├── CallShieldApplication.kt        — App init, DB, notification channels
├── CallShieldDialerActivity.kt     — Main dialer UI with number lookup
├── CallShieldScreeningService.kt   — Incoming call interceptor
├── CallShieldInCallService.kt      — Custom call screen overlay
├── CallShieldConnectionService.kt  — Telecom connection manager
├── ApiClient.kt                    — Retrofit singleton
├── CallShieldApi.kt                — API interface definition
├── ApiModels.kt                    — Request/response DTOs
├── LocalDb.kt                      — Room DB, entity, DAO
├── PhoneNumberUtils.kt             — Indian number normalization
└── CacheSyncWorker.kt              — Periodic background sync
```

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/lookup` | POST | Full threat analysis |
| `/api/caller-id` | POST | Caller identity (name, location, carrier) |
| `/api/report` | POST | Report a spam/scam number |
| `/api/blocklist/top?limit=5000` | GET | Top scam numbers for offline cache |

Base URL: `https://callshield.vercel.app/`

## Setup

### Prerequisites

- Android Studio Hedgehog (2023.1) or later
- JDK 17
- Android SDK 34

### Build

```bash
cd android
./gradlew assembleDebug
```

### Install

```bash
adb install app/build/outputs/apk/debug/app-debug.apk
```

### Set as Default Dialer

After installation:
1. Open **Settings → Apps → Default Apps → Phone App**
2. Select **CallShield**
3. Grant all requested permissions (Phone, Contacts, Call Log, Notifications)

The app will also prompt you during first launch.

## Permission Requirements

| Permission | Purpose |
|------------|---------|
| `READ_PHONE_STATE` | Detect incoming calls |
| `READ_CONTACTS` | Contact picker |
| `CALL_PHONE` | Make outgoing calls |
| `READ_CALL_LOG` / `WRITE_CALL_LOG` | Show recent calls, log blocked numbers |
| `MANAGE_OWN_CALLS` | Default dialer role |
| `POST_NOTIFICATIONS` | Block/spam alerts |
| `INTERNET` | API calls to CallShield backend |

## Offline Cache

- Room database: `callshield.db` (schema v2)
- Cached numbers with 24-hour TTL (known numbers) / 7-day TTL (verified scams)
- WorkManager syncs top 5000 scam numbers every 6 hours
- Fallback: if API is unreachable, uses stale cache entries

## Troubleshooting

**App doesn't screen calls**: Make sure CallShield is set as the default Phone app in Settings.

**Blocked call notifications not showing**: Grant Notification permission (Settings → Apps → CallShield → Notifications).

**Battery optimization killing the app**: Go to Settings → Apps → CallShield → Battery → Unrestricted.
