-- CallShield India: Call Lookups Table
-- Stores each lookup a user performs for the /history page

CREATE TABLE call_lookups (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    phone_number TEXT NOT NULL,
    normalized_number TEXT GENERATED ALWAYS AS (
        regexp_replace(phone_number, '[^0-9]', '', 'g')
    ) STORED,
    verdict TEXT CHECK (verdict IN ('safe', 'suspicious', 'scam', 'critical')),
    threat_score INTEGER CHECK (threat_score BETWEEN 0 AND 100),
    scam_type TEXT,
    reported BOOLEAN DEFAULT false,
    blocked BOOLEAN DEFAULT false,
    whitelisted BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_call_lookups_user ON call_lookups (user_id, created_at DESC);
CREATE INDEX idx_call_lookups_phone ON call_lookups (normalized_number);

-- RLS
ALTER TABLE call_lookups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own lookups" ON call_lookups
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own lookups" ON call_lookups
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own lookups" ON call_lookups
    FOR UPDATE USING (auth.uid() = user_id);
