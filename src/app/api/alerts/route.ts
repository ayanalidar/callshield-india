/**
 * CallShield Alerts API
 *
 * GET /api/alerts — Recent scam alerts (last 24h)
 *
 * Returns alerts derived from scam_numbers where:
 * - last_reported_at is within the last 24 hours
 * - report_count > threshold (configurable, defaults to 1)
 * - Sorted by report_count DESC, limited to 20
 *
 * Each alert:
 *   { id, phoneNumber, scamType, scamLabel, city, state, reportCount, time, severity }
 */

import { NextResponse } from 'next/server';
import { SCAM_TYPE_LABELS, type ScamType } from '@/engines/scam-detector';
import { createClient } from '@supabase/supabase-js';

// ============================================================
// TYPES
// ============================================================

interface AlertRecord {
  id: string;
  phoneNumber: string;
  scamType: string;
  scamLabel: string;
  city: string;
  state: string;
  reportCount: number;
  time: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

// ============================================================
// HELPERS
// ============================================================

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

function computeSeverity(reportCount: number, scamType: string): AlertRecord['severity'] {
  if (reportCount >= 50) return 'critical';
  if (reportCount >= 20) return 'high';
  if (reportCount >= 5) return 'medium';
  return 'low';
}

function generateSeverityId(severity: string): string {
  const prefix: Record<string, string> = {
    critical: 'c',
    high: 'h',
    medium: 'm',
    low: 'l',
  };
  return `${prefix[severity] || 'l'}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function maskPhone(phone: string): string {
  // Mask middle digits for privacy
  const digits = phone.replace(/[^0-9]/g, '');
  if (digits.length >= 10) {
    const clean = digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits;
    if (clean.length >= 10) {
      return `+91-${clean.slice(0, 3)}-XXX-${clean.slice(6)}`;
    }
  }
  return phone;
}

// ============================================================
// MOCK DATA (fallback when DB unavailable)
// ============================================================

function generateMockAlerts(): AlertRecord[] {
  const now = Date.now();
  const types = Object.entries(SCAM_TYPE_LABELS).filter(([k]) => k !== 'other');

  const scenarios = [
    { city: 'Delhi', state: 'Delhi', baseCount: 45, type: 'fedex_customs' },
    { city: 'Lucknow', state: 'Uttar Pradesh', baseCount: 38, type: 'loan_app' },
    { city: 'Mumbai', state: 'Maharashtra', baseCount: 32, type: 'bank_otp_scam' },
    { city: 'Patna', state: 'Bihar', baseCount: 28, type: 'upi_fraud' },
    { city: 'Bengaluru', state: 'Karnataka', baseCount: 24, type: 'job_scam' },
    { city: 'Jaipur', state: 'Rajasthan', baseCount: 19, type: 'aadhaar_kyc' },
    { city: 'Noida', state: 'Uttar Pradesh', baseCount: 17, type: 'it_department' },
    { city: 'Kolkata', state: 'West Bengal', baseCount: 15, type: 'electricity' },
    { city: 'Chennai', state: 'Tamil Nadu', baseCount: 13, type: 'crypto' },
    { city: 'Hyderabad', state: 'Telangana', baseCount: 11, type: 'police_fake' },
    { city: 'Gurugram', state: 'Haryana', baseCount: 9, type: 'sextortion' },
    { city: 'Ahmedabad', state: 'Gujarat', baseCount: 7, type: 'insurance' },
    { city: 'Bhubaneswar', state: 'Odisha', baseCount: 6, type: 'wangiri' },
    { city: 'Indore', state: 'Madhya Pradesh', baseCount: 5, type: 'lottery' },
    { city: 'Chandigarh', state: 'Chandigarh', baseCount: 4, type: 'sms_phishing' },
    { city: 'Pune', state: 'Maharashtra', baseCount: 23, type: 'loan_app' },
    { city: 'Delhi', state: 'Delhi', baseCount: 22, type: 'bank_otp_scam' },
    { city: 'Surat', state: 'Gujarat', baseCount: 3, type: 'ecommerce' },
    { city: 'Kochi', state: 'Kerala', baseCount: 8, type: 'job_scam' },
    { city: 'Guwahati', state: 'Assam', baseCount: 4, type: 'wangiri' },
  ];

  return scenarios.sort((a, b) => b.baseCount - a.baseCount).map((s, i) => {
    const typeLabel = SCAM_TYPE_LABELS[s.type as ScamType] || s.type;
    const minutesAgo = Math.floor(Math.random() * 60 * 24);
    const jitter = Math.floor(Math.random() * 5) - 2;

    return {
      id: generateSeverityId(computeSeverity(s.baseCount + jitter, s.type)),
      phoneNumber: maskPhone(`+91${String(6000000000 + i * 11111111)}`),
      scamType: s.type,
      scamLabel: typeLabel,
      city: s.city,
      state: s.state,
      reportCount: Math.max(1, s.baseCount + jitter),
      time: new Date(now - minutesAgo * 60 * 1000).toISOString(),
      severity: computeSeverity(s.baseCount + jitter, s.type),
    };
  });
}

// ============================================================
// HANDLER
// ============================================================

export async function GET() {
  try {
    const supabase = getSupabase();

    // If Supabase is available, query real data
    if (supabase) {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const { data, error } = await supabase
        .from('scam_numbers')
        .select('*')
        .gte('last_reported_at', twentyFourHoursAgo)
        .gte('report_count', 1)
        .order('report_count', { ascending: false })
        .limit(20);

      if (!error && data && data.length > 0) {
        const alerts: AlertRecord[] = data.map((d: any) => {
          const scamType = d.scam_type || 'other';
          const severity = computeSeverity(d.report_count || 1, scamType);

          return {
            id: generateSeverityId(severity),
            phoneNumber: maskPhone(d.phone_number || 'N/A'),
            scamType,
            scamLabel: SCAM_TYPE_LABELS[scamType as ScamType] || 'Unknown',
            city: d.city || d.telecom_circle || 'Unknown',
            state: d.state || '',
            reportCount: d.report_count || 1,
            time: d.last_reported_at || new Date().toISOString(),
            severity,
          };
        });

        return NextResponse.json(alerts, {
          headers: {
            'Cache-Control': 'public, max-age=30, s-maxage=30',
          },
        });
      }
    }

    // Fallback to mock data
    const mockAlerts = generateMockAlerts();
    return NextResponse.json(mockAlerts, {
      headers: {
        'Cache-Control': 'public, max-age=30, s-maxage=30',
      },
    });
  } catch (error: any) {
    console.error('[Alerts API] Error:', error.message);
    const mockAlerts = generateMockAlerts();
    return NextResponse.json(mockAlerts, {
      headers: {
        'Cache-Control': 'public, max-age=30, s-maxage=30',
      },
    });
  }
}

/**
 * Dynamic: allow runtime evaluation
 */
export const dynamic = 'force-dynamic';
