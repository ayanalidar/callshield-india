/**
 * CallShield Blocklist Top API
 * 
 * GET /api/blocklist/top?limit=5000
 * Returns top scam numbers for Android offline cache sync.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const limit = Math.min(
      parseInt(request.nextUrl.searchParams.get('limit') || '5000', 10),
      10000
    );

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data, error } = await supabase
      .from('scam_numbers')
      .select('phone_number, normalized_number, scam_type, severity, threat_score, telecom_circle, carrier, city, state, report_count, recent_report_count, verified, first_reported_at, last_reported_at')
      .order('threat_score', { ascending: false })
      .limit(limit);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const entries = (data || []).map((d: any) => ({
      phoneNumber: d.phone_number,
      normalizedNumber: d.normalized_number,
      scamType: d.scam_type,
      severity: d.severity,
      threatScore: d.threat_score,
      telecomCircle: d.telecom_circle,
      carrier: d.carrier,
      city: d.city,
      state: d.state,
      reportCount: d.report_count,
      recentReportCount: d.recent_report_count,
      verified: d.verified,
      firstReportedAt: d.first_reported_at,
      lastReportedAt: d.last_reported_at,
    }));

    return NextResponse.json(entries, {
      headers: {
        'Cache-Control': 'public, max-age=300, s-maxage=600',
      },
    });

  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to fetch blocklist', detail: error.message },
      { status: 500 }
    );
  }
}
