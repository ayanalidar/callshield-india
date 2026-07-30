# CallShield India 🇮🇳

AI-powered scam call protection for every Indian. Detects, blocks, and reports phone scams using multi-layer intelligence — telecom prefix analysis, crowd-sourced reporting, and a known-scam database.

## Architecture

```
Incoming Call / Number Lookup
    │
    ├─ Layer 1: Number Intelligence (edge, no DB)
    │   ├─ TRAI prefix → telecom circle, carrier
    │   ├─ Number type classification (mobile/landline/voip/tollfree)
    │   └─ International fraud pattern matching
    │
    ├─ Layer 2: Scam Database (PostgreSQL via Supabase)
    │   ├─ Known scam numbers lookup
    │   └─ Crowd report aggregation
    │
    ├─ Layer 3: Threat Scoring (weighted 5-component)
    │   ├─ Number Intel (20%)
    │   ├─ DB Match (35%)
    │   ├─ Crowd Reports (30%)
    │   ├─ Report Velocity (10%)
    │   └─ Reporter Trust (5%)
    │
    └─ Layer 4: Verdict & Action
        ├─ Off / Standard / Strict modes
        ├─ Whitelist bypass
        └─ Auto-block recommendations
```

## Tech Stack

- **Frontend**: Next.js 14, React 18
- **Backend**: Next.js API Routes (serverless)
- **Database**: Supabase (PostgreSQL 15)
- **Auth**: Supabase Phone OTP

## API Endpoints

| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `/api/lookup` | POST | Optional | Full threat assessment for any number |
| `/api/report` | POST | Optional | Submit scam report |
| `/api/stats` | GET | No | Global scam statistics |
| `/api/blocklist` | GET/POST/DELETE | Yes | User block list |
| `/api/whitelist` | GET/POST/DELETE | Yes | User whitelist |

## Quick Start

1. Create a [Supabase](https://supabase.com) project
2. Run the migration SQL from `supabase/migrations/00001_initial_schema.sql` in the SQL Editor
3. Enable Phone Auth in Supabase dashboard
4. Copy `.env.example` to `.env.local` and fill in your Supabase credentials
5. Install and run:

```bash
npm install
npm run dev
```

Test the lookup API:

```bash
curl -X POST http://localhost:3000/api/lookup \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber":"+92211223344","protectionLevel":"strict"}'
```

## Engine Tests

```bash
npx tsx src/engines/__test.ts
```

## Project Structure

```
src/
├── engines/
│   ├── number-intel.ts    # TRAI prefix/carrier/circle detection
│   ├── scam-detector.ts   # Multi-factor scam classification
│   ├── threat-scorer.ts   # Weighted threat scoring engine
│   └── crowd-reports.ts   # Report dedup, trust, trending
├── db/
│   └── supabase.ts        # Database client & queries
├── lib/
│   └── auth.ts            # Auth helpers
└── app/api/
    ├── lookup/            # Main lookup endpoint
    ├── report/            # Scam reporting endpoint
    ├── stats/             # Global statistics
    ├── blocklist/         # User block list
    └── whitelist/         # User whitelist
```
