/**
 * Admin Scam Numbers Management API
 * 
 * GET /api/admin/scam-numbers — List/paginate/search scam numbers
 * PATCH /api/admin/scam-numbers — Update threat score or verify
 * DELETE /api/admin/scam-numbers — Delete a scam number entry
 * 
 * Protected by an admin password header: x-admin-key
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const ADMIN_PASSWORD = 'callshield_admin_2024';

function authAdmin(request: NextRequest): NextResponse | null {
  const key = request.headers.get('x-admin-key');
  if (!key || key !== ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
  }
  return null;
}

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Supabase not configured');
  return createClient(url, key);
}

// GET — list scam numbers with pagination, search, filters
export async function GET(request: NextRequest) {
  const authErr = authAdmin(request);
  if (authErr) return authErr;

  try {
    const client = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));
    const phone = searchParams.get('phone') || '';
    const scamType = searchParams.get('scam_type') || '';
    const severity = searchParams.get('severity') || '';
    const verified = searchParams.get('verified') || '';

    // Build query
    let query = client.from('scam_numbers').select('*', { count: 'exact' });

    if (phone) {
      query = query.or(`phone_number.ilike.%${phone}%,normalized_number.ilike.%${phone}%`);
    }
    if (scamType) {
      query = query.eq('scam_type', scamType);
    }
    if (severity) {
      query = query.eq('severity', severity);
    }
    if (verified === 'true') {
      query = query.eq('verified', true);
    } else if (verified === 'false') {
      query = query.eq('verified', false);
    }

    // Order and paginate
    const offset = (page - 1) * limit;
    const { data, count, error } = await query
      .order('last_reported_at', { ascending: false, nullsFirst: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    // Get stats for today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { count: todayReports } = await client
      .from('scam_numbers')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', today.toISOString());

    const { count: verifiedCount } = await client
      .from('scam_numbers')
      .select('*', { count: 'exact', head: true })
      .eq('verified', true);

    // Map column names
    const items = (data || []).map((d: any) => ({
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
    }));

    return NextResponse.json({
      items,
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
      stats: {
        totalScams: count || 0,
        verifiedCount: verifiedCount || 0,
        verifiedPercent: count ? Math.round(((verifiedCount || 0) / count) * 100) : 0,
        reportsToday: todayReports || 0,
      },
    });
  } catch (e: any) {
    console.error('[Admin API] GET error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// PATCH — update threat score or verify
export async function PATCH(request: NextRequest) {
  const authErr = authAdmin(request);
  if (authErr) return authErr;

  try {
    const client = getSupabaseAdmin();
    const body = await request.json();
    const { id, threatScore, verified, verifiedBy } = body;

    if (!id) {
      return NextResponse.json({ error: 'id required' }, { status: 400 });
    }

    const updates: Record<string, any> = {};
    if (threatScore !== undefined) updates.threat_score = threatScore;
    if (verified !== undefined) {
      updates.verified = verified;
      if (verified) updates.verified_by = verifiedBy || 'admin';
    }
    updates.updated_at = new Date().toISOString();

    if (Object.keys(updates).length === 1) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const { error } = await client
      .from('scam_numbers')
      .update(updates)
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true, updated: updates });
  } catch (e: any) {
    console.error('[Admin API] PATCH error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// DELETE — remove a scam number entry
export async function DELETE(request: NextRequest) {
  const authErr = authAdmin(request);
  if (authErr) return authErr;

  try {
    const client = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id required' }, { status: 400 });
    }

    const { error } = await client
      .from('scam_numbers')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true, deleted: id });
  } catch (e: any) {
    console.error('[Admin API] DELETE error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
