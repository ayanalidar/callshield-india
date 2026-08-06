/**
 * Admin Scam Numbers Management API
 *
 * GET    /api/admin/scam-numbers  — List/paginate/search scam numbers
 * POST   /api/admin/scam-numbers  — Insert a new scam number
 * PUT    /api/admin/scam-numbers  — Update existing by id
 * DELETE /api/admin/scam-numbers  — Delete by id
 *
 * All endpoints require admin_token cookie (set via POST /api/admin/login).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/admin-auth';

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Supabase not configured');
  return createClient(url, key);
}

/** Map DB snake_case columns to camelCase for the frontend. */
function mapRow(d: any) {
  return {
    id: d.id,
    phoneNumber: d.phone_number,
    normalizedNumber: d.normalized_number,
    scamType: d.scam_type,
    severity: d.severity,
    threatScore: d.threat_score,
    telecomCircle: d.telecom_circle,
    carrier: d.carrier,
    numberType: d.number_type,
    isVoip: d.is_voip,
    reportCount: d.report_count,
    recentReportCount: d.recent_report_count,
    verified: d.verified,
    verifiedBy: d.verified_by,
    source: d.source,
    firstReportedAt: d.first_reported_at,
    lastReportedAt: d.last_reported_at,
    createdAt: d.created_at,
    updatedAt: d.updated_at,
  };
}

// ── GET — list scam numbers with pagination, search, filters ────

export async function GET(request: NextRequest) {
  const authErr = await requireAdmin(request);
  if (authErr) return authErr;

  try {
    const client = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));
    const phone = searchParams.get('phone') || searchParams.get('search') || '';
    const scamType = searchParams.get('scam_type') || '';
    const severity = searchParams.get('severity') || '';
    const verified = searchParams.get('verified') || '';

    let query = client.from('scam_numbers').select('*', { count: 'exact' });

    if (phone) {
      query = query.or(`phone_number.ilike.%${phone}%,normalized_number.ilike.%${phone}%`);
    }
    if (scamType) query = query.eq('scam_type', scamType);
    if (severity) query = query.eq('severity', severity);
    if (verified === 'true') query = query.eq('verified', true);
    else if (verified === 'false') query = query.eq('verified', false);

    const offset = (page - 1) * limit;
    const { data, count, error } = await query
      .order('last_reported_at', { ascending: false, nullsFirst: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    // Stats
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [{ count: totalCount }, { count: verifiedCount }, { count: todayReports }, { count: activeThreats }] =
      await Promise.all([
        client.from('scam_numbers').select('*', { count: 'exact', head: true }),
        client.from('scam_numbers').select('*', { count: 'exact', head: true }).eq('verified', true),
        client.from('scam_numbers').select('*', { count: 'exact', head: true }).gte('created_at', today.toISOString()),
        client.from('scam_numbers').select('*', { count: 'exact', head: true }).gte('threat_score', 70),
      ]);

    const items = (data || []).map(mapRow);

    return NextResponse.json({
      items,
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
      stats: {
        totalScams: totalCount || 0,
        verifiedCount: verifiedCount || 0,
        verifiedPercent: totalCount ? Math.round(((verifiedCount || 0) / totalCount) * 100) : 0,
        reportsToday: todayReports || 0,
        activeThreats: activeThreats || 0,
      },
    });
  } catch (e: any) {
    console.error('[Admin API] GET error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// ── POST — insert a new scam number ─────────────────────────────

export async function POST(request: NextRequest) {
  const authErr = await requireAdmin(request);
  if (authErr) return authErr;

  try {
    const client = getSupabaseAdmin();
    const body = await request.json();
    const { phoneNumber, scamType, severity, threatScore, carrier, telecomCircle, numberType } = body;

    if (!phoneNumber) {
      return NextResponse.json({ error: 'phoneNumber is required' }, { status: 400 });
    }

    // Normalize phone number
    const normalized = phoneNumber.replace(/[^\d+]/g, '');

    const { data, error } = await client
      .from('scam_numbers')
      .insert({
        phone_number: phoneNumber,
        normalized_number: normalized,
        scam_type: scamType || 'other',
        severity: severity || 'medium',
        threat_score: threatScore ?? 50,
        carrier: carrier || null,
        telecom_circle: telecomCircle || null,
        number_type: numberType || null,
        report_count: 1,
        recent_report_count: 1,
        verified: false,
        source: 'admin',
        first_reported_at: new Date().toISOString(),
        last_reported_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      // Handle unique constraint violation (duplicate)
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'This phone number already exists in the database' },
          { status: 409 },
        );
      }
      throw error;
    }

    return NextResponse.json({ success: true, item: mapRow(data) }, { status: 201 });
  } catch (e: any) {
    console.error('[Admin API] POST error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// ── PUT — update an existing scam number ────────────────────────

export async function PUT(request: NextRequest) {
  const authErr = await requireAdmin(request);
  if (authErr) return authErr;

  try {
    const client = getSupabaseAdmin();
    const body = await request.json();
    const {
      id,
      phoneNumber,
      scamType,
      severity,
      threatScore,
      carrier,
      telecomCircle,
      numberType,
      verified,
      verifiedBy,
    } = body;

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const updates: Record<string, any> = { updated_at: new Date().toISOString() };

    if (phoneNumber !== undefined) {
      updates.phone_number = phoneNumber;
      updates.normalized_number = phoneNumber.replace(/[^\d+]/g, '');
    }
    if (scamType !== undefined) updates.scam_type = scamType;
    if (severity !== undefined) updates.severity = severity;
    if (threatScore !== undefined) updates.threat_score = threatScore;
    if (carrier !== undefined) updates.carrier = carrier;
    if (telecomCircle !== undefined) updates.telecom_circle = telecomCircle;
    if (numberType !== undefined) updates.number_type = numberType;
    if (verified !== undefined) {
      updates.verified = verified;
      if (verified) updates.verified_by = verifiedBy || 'admin';
      else updates.verified_by = null;
    }

    // Remove updated_at from count check
    const updateKeys = Object.keys(updates).filter(k => k !== 'updated_at');
    if (updateKeys.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const { data, error } = await client
      .from('scam_numbers')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, item: mapRow(data) });
  } catch (e: any) {
    console.error('[Admin API] PUT error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// ── DELETE — remove a scam number by id ─────────────────────────

export async function DELETE(request: NextRequest) {
  const authErr = await requireAdmin(request);
  if (authErr) return authErr;

  try {
    const client = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const { error } = await client.from('scam_numbers').delete().eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true, deleted: id });
  } catch (e: any) {
    console.error('[Admin API] DELETE error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
