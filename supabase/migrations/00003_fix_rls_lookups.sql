-- Fix RLS: Enable public read on lookup tables
ALTER TABLE indian_prefixes DISABLE ROW LEVEL SECURITY;
ALTER TABLE intl_scam_patterns DISABLE ROW LEVEL SECURITY;

-- Also ensure scam_reports has public read
ALTER TABLE scam_reports DISABLE ROW LEVEL SECURITY;
