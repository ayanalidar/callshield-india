-- CallShield India: Initial Database Schema
-- Run on Supabase (PostgreSQL 15+)

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- for fuzzy text search

-- ============================================================
-- SCAM DATABASE — Master table of known scam numbers
-- ============================================================
CREATE TABLE scam_numbers (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    phone_number TEXT NOT NULL UNIQUE,
    normalized_number TEXT GENERATED ALWAYS AS (
        regexp_replace(phone_number, '[^0-9]', '', 'g')
    ) STORED,
    
    -- Scam classification
    scam_type TEXT NOT NULL,  -- upi_fraud, bank_otp_scam, it_department, insurance, loan_app, fedex_customs, crypto, lottery, ecommerce, police_fake, aadhaar_kyc, electricity, international, other
    severity TEXT CHECK (severity IN ('low', 'medium', 'high', 'critical')) DEFAULT 'medium',
    threat_score INTEGER CHECK (threat_score BETWEEN 0 AND 100) DEFAULT 50,
    
    -- Number intelligence
    telecom_circle TEXT,       -- e.g., UP-West, Delhi, Maharashtra
    carrier TEXT,              -- Jio, Airtel, Vi, BSNL
    number_type TEXT CHECK (number_type IN ('mobile', 'landline', 'voip', 'tollfree', 'virtual', 'unknown')) DEFAULT 'unknown',
    is_voip BOOLEAN DEFAULT false,
    is_burner BOOLEAN DEFAULT false,
    first_reported_at TIMESTAMPTZ,
    ported_from_carrier TEXT,
    
    -- Location data
    city TEXT,
    state TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    accuracy_radius_km INTEGER,
    
    -- Crowd intelligence
    report_count INTEGER DEFAULT 1,
    unique_ips INTEGER DEFAULT 1,
    recent_report_count INTEGER DEFAULT 1,  -- reports in last 30 days
    
    -- Verification
    verified BOOLEAN DEFAULT false,
    verified_by TEXT,  -- admin/auto/ai
    evidence_links TEXT[],
    
    -- Metadata
    notes TEXT,
    source TEXT DEFAULT 'user_report',  -- user_report, cyber_crime_portal, telecom_api, auto_detect, admin_import
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    last_reported_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_scam_numbers_phone ON scam_numbers (normalized_number);
CREATE INDEX idx_scam_numbers_type ON scam_numbers (scam_type);
CREATE INDEX idx_scam_numbers_severity ON scam_numbers (severity);
CREATE INDEX idx_scam_numbers_telecom_circle ON scam_numbers (telecom_circle);
CREATE INDEX idx_scam_numbers_city ON scam_numbers (city);
CREATE INDEX idx_scam_numbers_report_count ON scam_numbers (report_count DESC);
CREATE INDEX idx_scam_numbers_recent ON scam_numbers (recent_report_count DESC);
CREATE INDEX idx_scam_numbers_threat ON scam_numbers (threat_score DESC);
CREATE INDEX idx_scam_numbers_created ON scam_numbers (created_at DESC);
CREATE INDEX idx_scam_numbers_trgm ON scam_numbers USING GIN (phone_number gin_trgm_ops);

-- ============================================================
-- USER REPORTS — Crowd-sourced scam reports
-- ============================================================
CREATE TABLE scam_reports (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    phone_number TEXT NOT NULL,
    normalized_number TEXT GENERATED ALWAYS AS (
        regexp_replace(phone_number, '[^0-9]', '', 'g')
    ) STORED,
    
    -- Reporter info
    reporter_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    reporter_ip INET,
    reporter_fingerprint TEXT,  -- browser fingerprint hash
    
    -- Report details
    scam_type TEXT NOT NULL,
    description TEXT,
    call_duration_seconds INTEGER,
    call_timestamp TIMESTAMPTZ,
    spam_score INTEGER CHECK (spam_score BETWEEN 1 AND 5),  -- user-rated severity
    
    -- Verification
    verified BOOLEAN DEFAULT false,
    verification_method TEXT,  -- sms, call_back, ai_analysis, peer_review
    trust_weight REAL DEFAULT 1.0,  -- weighted by reporter history/trust
    
    -- Metadata
    source TEXT DEFAULT 'app',
    device_info TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_scam_reports_phone ON scam_reports (normalized_number);
CREATE INDEX idx_scam_reports_reporter ON scam_reports (reporter_id);
CREATE INDEX idx_scam_reports_created ON scam_reports (created_at DESC);
CREATE INDEX idx_scam_reports_ip ON scam_reports (reporter_ip);
CREATE INDEX idx_scam_reports_type ON scam_reports (scam_type);

-- ============================================================
-- INDIAN TELECOM PREFIX DATABASE (TRAI numbering plan)
-- ============================================================
CREATE TABLE indian_prefixes (
    prefix TEXT PRIMARY KEY,  -- 4-5 digit prefix
    series_type TEXT NOT NULL,  -- mobile, landline, tollfree, special
    telecom_circle TEXT NOT NULL,
    state TEXT NOT NULL,
    carrier TEXT,  -- may be NULL for ported ranges
    notes TEXT,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- INTERNATIONAL SCAM PATTERNS
-- ============================================================
CREATE TABLE intl_scam_patterns (
    id SERIAL PRIMARY KEY,
    country_code TEXT NOT NULL,
    country TEXT NOT NULL,
    pattern_type TEXT NOT NULL,  -- prefix_match, regex, exact
    pattern TEXT NOT NULL,
    description TEXT,
    risk_level TEXT CHECK (risk_level IN ('low', 'medium', 'high', 'critical')) DEFAULT 'high',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- FAMILY PLANS (must be created before user_profiles)
-- ============================================================
CREATE TABLE family_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    max_members INTEGER DEFAULT 5,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- USER PROFILES
-- ============================================================
CREATE TABLE user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    phone_number TEXT,
    display_name TEXT,
    avatar_url TEXT,
    
    -- Trust & reputation
    trust_score REAL DEFAULT 1.0,
    total_reports INTEGER DEFAULT 0,
    verified_reports INTEGER DEFAULT 0,
    false_reports INTEGER DEFAULT 0,
    
    -- Preferences
    protection_level TEXT CHECK (protection_level IN ('off', 'standard', 'strict')) DEFAULT 'standard',
    auto_block_spammers BOOLEAN DEFAULT true,
    auto_report_spam BOOLEAN DEFAULT true,
    elder_mode BOOLEAN DEFAULT false,
    
    -- Family plan
    family_plan_id UUID REFERENCES family_plans(id),
    is_family_admin BOOLEAN DEFAULT false,
    
    -- Subscription
    plan TEXT CHECK (plan IN ('free', 'single', 'family')) DEFAULT 'free',
    plan_expires_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- USER BLOCK LIST
-- ============================================================
CREATE TABLE user_blocks (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    phone_number TEXT NOT NULL,
    normalized_number TEXT GENERATED ALWAYS AS (
        regexp_replace(phone_number, '[^0-9]', '', 'g')
    ) STORED,
    reason TEXT,
    scam_type TEXT,
    blocked_at TIMESTAMPTZ DEFAULT now(),
    
    UNIQUE(user_id, normalized_number)
);

CREATE INDEX idx_user_blocks_user ON user_blocks (user_id);

-- ============================================================
-- USER WHITELIST
-- ============================================================
CREATE TABLE user_whitelist (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    phone_number TEXT NOT NULL,
    normalized_number TEXT GENERATED ALWAYS AS (
        regexp_replace(phone_number, '[^0-9]', '', 'g')
    ) STORED,
    contact_name TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    
    UNIQUE(user_id, normalized_number)
);

CREATE INDEX idx_user_whitelist_user ON user_whitelist (user_id);

-- ============================================================
-- CALL HISTORY (opt-in; privacy-conscious)
-- ============================================================
CREATE TABLE call_history (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    phone_number TEXT NOT NULL,
    normalized_number TEXT GENERATED ALWAYS AS (
        regexp_replace(phone_number, '[^0-9]', '', 'g')
    ) STORED,
    call_type TEXT CHECK (call_type IN ('incoming', 'outgoing', 'missed')),
    duration_seconds INTEGER,
    result TEXT CHECK (result IN ('scam', 'safe', 'unknown', 'blocked', 'whitelisted')),
    scam_type TEXT,
    threat_score INTEGER,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_call_history_user ON call_history (user_id, created_at DESC);
CREATE INDEX idx_call_history_phone ON call_history (normalized_number);

-- ============================================================
-- ANALYTICS — Aggregated scam stats
-- ============================================================
CREATE TABLE scam_stats_hourly (
    hour TIMESTAMPTZ NOT NULL,
    scam_type TEXT,
    telecom_circle TEXT,
    state TEXT,
    report_count INTEGER DEFAULT 0,
    unique_numbers INTEGER DEFAULT 0,
    avg_threat_score REAL,
    
    PRIMARY KEY (hour, scam_type, telecom_circle, state)
);

CREATE INDEX idx_scam_stats_hour ON scam_stats_hourly (hour DESC);

-- ============================================================
-- RATE LIMITING & ABUSE PREVENTION
-- ============================================================
CREATE TABLE report_rate_limits (
    ip INET NOT NULL,
    window_start TIMESTAMPTZ NOT NULL DEFAULT now(),
    report_count INTEGER DEFAULT 1,
    
    PRIMARY KEY (ip, window_start)
);

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Normalize any Indian phone number to E.164
CREATE OR REPLACE FUNCTION normalize_indian_number(input_number TEXT)
RETURNS TEXT AS $$
DECLARE
    cleaned TEXT;
BEGIN
    -- Strip everything except digits
    cleaned := regexp_replace(input_number, '[^0-9]', '', 'g');
    
    -- Handle common Indian formats
    IF length(cleaned) = 10 THEN
        RETURN '+91' || cleaned;
    ELSIF length(cleaned) = 11 AND cleaned LIKE '0%' THEN
        RETURN '+91' || substring(cleaned, 2);
    ELSIF length(cleaned) = 12 AND cleaned LIKE '91%' THEN
        RETURN '+' || cleaned;
    ELSIF length(cleaned) = 13 AND cleaned LIKE '+91%' THEN
        RETURN cleaned;
    ELSE
        RETURN NULL;  -- Invalid format
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Aggregate scam reports into scam_numbers
CREATE OR REPLACE FUNCTION aggregate_scam_reports()
RETURNS TRIGGER AS $$
DECLARE
    existing_id BIGINT;
BEGIN
    SELECT id INTO existing_id FROM scam_numbers
    WHERE normalized_number = NEW.normalized_number;
    
    IF FOUND THEN
        -- Update existing entry
        UPDATE scam_numbers SET
            report_count = report_count + 1,
            recent_report_count = recent_report_count + 1,
            last_reported_at = now(),
            threat_score = LEAST(100, threat_score + 
                CASE WHEN NEW.spam_score >= 4 THEN 5
                     WHEN NEW.spam_score >= 3 THEN 3
                     ELSE 1 END
            ),
            updated_at = now()
        WHERE id = existing_id;
    ELSE
        -- Create new entry
        INSERT INTO scam_numbers (
            phone_number, scam_type, severity, threat_score,
            source, report_count, recent_report_count,
            first_reported_at, last_reported_at
        ) VALUES (
            NEW.phone_number, NEW.scam_type, 
            CASE WHEN NEW.spam_score >= 4 THEN 'high' 
                 WHEN NEW.spam_score >= 3 THEN 'medium' 
                 ELSE 'low' END,
            NEW.spam_score * 20,
            'user_report', 1, 1,
            now(), now()
        );
    END IF;
    
    -- Update reporter trust
    IF NEW.reporter_id IS NOT NULL THEN
        UPDATE user_profiles SET
            total_reports = total_reports + 1,
            trust_score = LEAST(5.0, trust_score + 0.01)
        WHERE id = NEW.reporter_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_aggregate_scam_reports
    AFTER INSERT ON scam_reports
    FOR EACH ROW
    EXECUTE FUNCTION aggregate_scam_reports();

-- Decay recent_report_count periodically (for a stale-scam penalty)
CREATE OR REPLACE FUNCTION decay_old_reports()
RETURNS void AS $$
BEGIN
    UPDATE scam_numbers SET
        recent_report_count = GREATEST(0, recent_report_count - 1)
    WHERE last_reported_at < now() - INTERVAL '30 days'
      AND recent_report_count > 0;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- ENABLE RLS
-- ============================================================
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_whitelist ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE scam_reports ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can read own profile" ON user_profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON user_profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can manage own blocks" ON user_blocks
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own whitelist" ON user_whitelist
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own call history" ON call_history
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Anyone can read scam reports" ON scam_reports
    FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create reports" ON scam_reports
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- scam_numbers is public read
CREATE POLICY "Public can read scam DB" ON scam_numbers
    FOR SELECT USING (true);

-- ============================================================
-- SEED DATA: Indian Telecom Prefixes (TRAI numbering plan — subset)
-- ============================================================
-- These are the 4-digit MSC codes used by Indian operators
-- Full list is ~3000 entries; seeding the most common ones
INSERT INTO indian_prefixes (prefix, series_type, telecom_circle, state, carrier) VALUES
-- Delhi
('7001', 'mobile', 'Delhi', 'Delhi', 'Jio'),
('7002', 'mobile', 'Delhi', 'Delhi', 'Jio'),
('7003', 'mobile', 'Delhi', 'Delhi', 'Airtel'),
('7004', 'mobile', 'Delhi', 'Delhi', 'Airtel'),
('7005', 'mobile', 'Delhi', 'Delhi', 'Vi'),
('7006', 'mobile', 'Delhi', 'Delhi', 'Vi'),
('7007', 'mobile', 'Delhi', 'Delhi', 'BSNL'),
('7008', 'mobile', 'Delhi', 'Delhi', 'BSNL'),
('7009', 'mobile', 'Delhi', 'Delhi', 'Jio'),
-- Mumbai (Maharashtra)
('8001', 'mobile', 'Mumbai', 'Maharashtra', 'Jio'),
('8002', 'mobile', 'Mumbai', 'Maharashtra', 'Airtel'),
('8003', 'mobile', 'Mumbai', 'Maharashtra', 'Vi'),
('8004', 'mobile', 'Mumbai', 'Maharashtra', 'BSNL'),
-- Karnataka
('9001', 'mobile', 'Karnataka', 'Karnataka', 'Airtel'),
('9002', 'mobile', 'Karnataka', 'Karnataka', 'Jio'),
('9003', 'mobile', 'Karnataka', 'Karnataka', 'Vi'),
('9004', 'mobile', 'Karnataka', 'Karnataka', 'BSNL'),
-- Tamil Nadu
('9005', 'mobile', 'Tamil Nadu', 'Tamil Nadu', 'Jio'),
('9006', 'mobile', 'Tamil Nadu', 'Tamil Nadu', 'Airtel'),
('9007', 'mobile', 'Tamil Nadu', 'Tamil Nadu', 'Vi'),
('9008', 'mobile', 'Tamil Nadu', 'Tamil Nadu', 'BSNL'),
-- UP East
('9009', 'mobile', 'UP East', 'Uttar Pradesh', 'Jio'),
('9010', 'mobile', 'UP East', 'Uttar Pradesh', 'Airtel'),
('9011', 'mobile', 'UP East', 'Uttar Pradesh', 'Vi'),
-- UP West
('9012', 'mobile', 'UP West', 'Uttar Pradesh', 'Airtel'),
('9013', 'mobile', 'UP West', 'Uttar Pradesh', 'Jio'),
('9014', 'mobile', 'UP West', 'Uttar Pradesh', 'Vi'),
-- West Bengal
('9015', 'mobile', 'West Bengal', 'West Bengal', 'Jio'),
('9016', 'mobile', 'West Bengal', 'West Bengal', 'Airtel'),
('9017', 'mobile', 'West Bengal', 'West Bengal', 'Vi'),
-- Gujarat
('9018', 'mobile', 'Gujarat', 'Gujarat', 'Jio'),
('9019', 'mobile', 'Gujarat', 'Gujarat', 'Airtel'),
('9020', 'mobile', 'Gujarat', 'Gujarat', 'Vi'),
-- Rajasthan
('9021', 'mobile', 'Rajasthan', 'Rajasthan', 'Jio'),
('9022', 'mobile', 'Rajasthan', 'Rajasthan', 'Airtel'),
('9023', 'mobile', 'Rajasthan', 'Rajasthan', 'BSNL'),
-- Known scam-heavy prefixes (commonly abused by scammers)
('7310', 'mobile', 'UP East', 'Uttar Pradesh', 'Jio'),
('7311', 'mobile', 'UP West', 'Uttar Pradesh', 'Airtel'),
('7312', 'mobile', 'Bihar', 'Bihar', 'Jio'),
('7313', 'mobile', 'Jharkhand', 'Jharkhand', 'Airtel'),
-- Toll-free numbers (often spoofed)
('1800', 'tollfree', 'Pan-India', 'Pan-India', 'Various'),
('1860', 'tollfree', 'Pan-India', 'Pan-India', 'Various');

-- Seed: International scam patterns (numbers from Pakistan, Bangladesh, etc.)
INSERT INTO intl_scam_patterns (country_code, country, pattern_type, pattern, description, risk_level) VALUES
('92', 'Pakistan', 'prefix_match', '+92', 'Pakistani numbers commonly used in KYC/sextortion scams', 'critical'),
('92', 'Pakistan', 'prefix_match', '0092', 'Pakistani numbers (00 format)', 'critical'),
('880', 'Bangladesh', 'prefix_match', '+880', 'Bangladeshi numbers used in lottery scams', 'high'),
('84', 'Vietnam', 'prefix_match', '+84', 'Vietnamese VoIP scam rings', 'high'),
('63', 'Philippines', 'prefix_match', '+63', 'Philippine love scam operations', 'medium'),
('213', 'Algeria', 'prefix_match', '+213', 'Algerian missed-call Wangiri fraud', 'high'),
('216', 'Tunisia', 'prefix_match', '+216', 'Tunisian missed-call fraud', 'high'),
('7', 'Russia/Kazakhstan', 'prefix_match', '+7', 'CIS-region scam calls', 'medium'),
('+140', 'USA VoIP', 'prefix_regex', '^\+140[0-9]{7,}$', 'US VoIP numbers often used for tech support scams', 'medium'),
('+170', 'USA VoIP', 'prefix_regex', '^\+170[0-9]{7,}$', 'VoIP numbers spoofed as IRS/tech support', 'high');

-- Seed: Known Indian scam numbers (crowd-sourced sample data for demo)
INSERT INTO scam_numbers (phone_number, scam_type, severity, threat_score, telecom_circle, carrier, number_type, city, state, report_count, unique_ips, recent_report_count, source, verified) VALUES
('+919876543210', 'upi_fraud', 'high', 85, 'Delhi', 'Jio', 'mobile', 'New Delhi', 'Delhi', 234, 198, 47, 'user_report', true),
('+918765432109', 'bank_otp_scam', 'high', 82, 'Mumbai', 'Airtel', 'mobile', 'Mumbai', 'Maharashtra', 189, 167, 35, 'user_report', true),
('+919988776655', 'it_department', 'critical', 91, 'UP West', 'Jio', 'mobile', 'Noida', 'Uttar Pradesh', 456, 401, 89, 'user_report', true),
('+918877665544', 'insurance', 'medium', 55, 'Karnataka', 'Vi', 'mobile', 'Bengaluru', 'Karnataka', 87, 76, 12, 'user_report', false),
('+917766554433', 'fedex_customs', 'high', 78, 'Delhi', 'Airtel', 'mobile', 'Gurgaon', 'Haryana', 312, 278, 56, 'user_report', true),
('+919001122334', 'loan_app', 'critical', 88, 'Bihar', 'Jio', 'mobile', 'Patna', 'Bihar', 198, 167, 42, 'cyber_crime_portal', true),
('+919988776600', 'police_fake', 'high', 80, 'Delhi', 'Jio', 'mobile', 'Delhi', 'Delhi', 145, 134, 29, 'user_report', true),
('+918877665500', 'aadhaar_kyc', 'high', 76, 'Mumbai', 'Vi', 'mobile', 'Mumbai', 'Maharashtra', 201, 178, 38, 'user_report', false),
('+914433221100', 'crypto', 'high', 72, 'UP East', 'Airtel', 'mobile', 'Lucknow', 'Uttar Pradesh', 98, 87, 19, 'user_report', false),
('+913322110099', 'electricity', 'medium', 62, 'Rajasthan', 'BSNL', 'mobile', 'Jaipur', 'Rajasthan', 67, 58, 11, 'user_report', false),
('+9221122334455', 'sextortion', 'critical', 95, 'International', 'Unknown', 'mobile', 'Karachi', 'Pakistan', 89, 76, 22, 'user_report', true),
('+8801122334455', 'lottery', 'high', 78, 'International', 'Unknown', 'mobile', 'Dhaka', 'Bangladesh', 45, 38, 9, 'user_report', false),
('+912211009988', 'ecommerce', 'medium', 58, 'West Bengal', 'Airtel', 'mobile', 'Kolkata', 'West Bengal', 76, 65, 14, 'user_report', false),
('+911100998877', 'ecommerce', 'high', 74, 'Delhi', 'Jio', 'mobile', 'New Delhi', 'Delhi', 156, 134, 31, 'user_report', true),
('+910099887766', 'insurance', 'medium', 45, 'Tamil Nadu', 'Vi', 'mobile', 'Chennai', 'Tamil Nadu', 43, 38, 7, 'user_report', false);
