/**
 * GET /api/history — Fetch user's call lookup history
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20')));
    const offset = (page - 1) * limit;

    // Get user from session
    const cookieStore = cookies();
    const allCookies = cookieStore.getAll();
    const accessToken = cookieStore.get('sb-access-token')?.value;

    // Try Supabase auth cookie
    let token = accessToken;
    if (!token) {
      const authCookie = allCookies.find(
        (c) => c.name.startsWith('sb-') && c.name.endsWith('-auth-token')
      );
      if (authCookie) {
        try {
          const decoded = decodeChunkedCookie(authCookie.value);
          const sessionData = JSON.parse(decoded);
          token = sessionData?.access_token;
        } catch {}
      }
    }

    if (!token) {
      return NextResponse.json(
        { error: 'Authentication required', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !anonKey) {
      return NextResponse.json(
        { error: 'Database not configured', code: 'CONFIG' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, anonKey);

    // Verify token
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) {
      return NextResponse.json(
        { error: 'Invalid session', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    const userId = userData.user.id;

    // Fetch lookup history with count
    const [{ data, error }, { count }] = await Promise.all([
      supabase
        .from('call_lookups')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1),
      supabase
        .from('call_lookups')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId),
    ]);

    if (error) {
      console.error('[History] Fetch error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch history', code: 'DB_ERROR' },
        { status: 500 }
      );
    }

    const lookups = (data || []).map((d: any) => ({
      id: d.id,
      phoneNumber: d.phone_number,
      normalizedNumber: d.normalized_number,
      verdict: d.verdict,
      threatScore: d.threat_score,
      scamType: d.scam_type,
      reported: d.reported,
      blocked: d.blocked,
      whitelisted: d.whitelisted,
      createdAt: d.created_at,
    }));

    return NextResponse.json({
      lookups,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
        hasMore: offset + limit < (count || 0),
      },
    });

  } catch (error: any) {
    console.error('[History] Exception:', error);
    return NextResponse.json(
      { error: 'Failed to fetch history', code: 'SERVER_ERROR' },
      { status: 500 }
    );
  }
}

/**
 * Decode chunked base64 cookie value
 */
function decodeChunkedCookie(value: string): string {
  try {
    const chunks = value.split('.');
    return chunks.map(chunk => {
      try {
        return Buffer.from(chunk, 'base64').toString('utf-8');
      } catch {
        return '';
      }
    }).join('');
  } catch {
    return '';
  }
}
