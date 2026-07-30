# CallShield India — Product Architecture

## Overview
AI-powered scam call protection for every Indian. Detects, blocks, and reports phone scams using multi-layer intelligence combining telecom prefix analysis, crowd-sourced reporting, and a known-scam database.

## Architecture

### Detection Pipeline (Multi-Layer)
```
Incoming Call / Number Lookup
    │
    ├─ Layer 1: Number Intelligence (edge, no DB)
    │   ├─ TRAI prefix → telecom circle, carrier
    │   ├─ Number type classification (mobile/landline/voip/tollfree)
    │   ├─ International fraud pattern matching
    │   └─ Risk flags: VoIP detection, known scam prefixes
    │
    ├─ Layer 2: Scam Database (PostgreSQL)
    │   ├─ Known scam numbers lookup
    │   ├─ Crowd report aggregation
    │   └─ Severity & verification status
    │
    ├─ Layer 3: Threat Scoring
    │   ├─ Weighted multi-factor scoring
    │   ├─ Report velocity (spike detection)
    │   └─ Reporter trust weighting
    │
    └─ Layer 4: Verdict & Action
        ├─ Protection level filtering (off/standard/strict)
        ├─ Whitelist bypass
        └─ Auto-block recommendations
```

### Tech Stack
- **Frontend**: Next.js 14, React 18, static SPA (existing UI adapted)
- **Backend**: Next.js API routes (serverless edge)
- **Database**: Supabase (PostgreSQL 15) — free tier: 500MB, 50K rows, 2 projects
- **Auth**: Supabase Phone OTP (free: 50 SMS/mo, ₹0.50/SMS after)
- **Deployment**: Vercel (Hobby) → AWS/own server for scale

### Data Sources
1. **TRAI Prefix Database**: Embedded in code + extended via DB for ported numbers
2. **Community Reports**: Crowd-sourced via app, deduped & verified
3. **Cyber Crime Portal**: Periodic import from India's cybercrime reporting portal
4. **Auto-detection**: Pattern-based identification of new scam ranges

### API Endpoints
| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `/api/lookup` | POST | Optional | Full threat assessment for any number |
| `/api/report` | POST | Optional | Submit scam report |
| `/api/stats` | GET | No | Global stats |
| `/api/blocklist` | GET/POST/DELETE | Yes | User block list |
| `/api/whitelist` | GET/POST/DELETE | Yes | User whitelist |

### Database Schema
```
scam_numbers         — Master scam DB (public read)
scam_reports         — Crowd-sourced reports (with user attribution)
indian_prefixes      — TRAI numbering plan data
intl_scam_patterns   — International fraud patterns
user_profiles        — User settings, trust scores, subscription
user_blocks          — Per-user block list
user_whitelist       — Per-user whitelist
call_history         — Opt-in call history
family_plans         — Family plan management
scam_stats_hourly    — Aggregated analytics
```

### Threat Scoring Weights
- Number Intelligence: 20% (carrier, location, VoIP type)
- Scam DB Match: 35% (known scam, severity, verification)
- Crowd Reports: 30% (report volume, unique reporters)
- Report Velocity: 10% (trending/spike detection)
- Reporter Trust: 5% (reporter credibility)

### Cost Structure (Supabase Free Tier)
- Database: 500MB, 50K rows → ~6 months at 3K reports/month
- Auth: 50 phone OTP/month free, then ₹0.50/SMS
- API: 2M API calls/month → sufficient for MVP

### Scaling Path
1. **Vercel Hobby** (now) → **Vercel Pro** (when traffic >100GB/month)
2. **Supabase Free** (now) → **Supabase Pro** ($25/mo) when DB >500MB
3. **Self-hosted DB** on AWS RDS or own server when scale demands
4. **Phone OTP** → Supabase $0.034/SMS vs Indian SMS gateway (₹0.12/SMS)

### Run Locally
```bash
cd callshield
npm install
cp .env.example .env.local  # fill Supabase creds
npm run dev                  # starts on :3000
```

### Deploy
```bash
# Vercel
vercel deploy

# Set env vars on Vercel dashboard
# NEXT_PUBLIC_SUPABASE_URL
# NEXT_PUBLIC_SUPABASE_ANON_KEY
# SUPABASE_SERVICE_ROLE_KEY
```

### Immediate Next Steps
1. Create Supabase project
2. Run database migration (`supabase db push` or run SQL manually)
3. Set up Phone OTP auth in Supabase dashboard
4. Deploy to Vercel
5. Add bulk-import pipeline for known scam databases
6. Build admin dashboard for moderation
