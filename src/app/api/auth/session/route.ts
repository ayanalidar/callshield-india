/**
 * GET /api/auth/session — Returns current session user
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

export async function GET(_request: NextRequest) {
  const cookieStore = cookies();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    return NextResponse.json({ user: null }, { status: 200 });
  }

  // Try reading the session from the auth cookie
  const allCookies = cookieStore.getAll();
  const authCookie = allCookies.find(c =>
    c.name.startsWith('sb-') && c.name.endsWith('-auth-token')
  );

  if (!authCookie) {
    return NextResponse.json({ user: null }, { status: 200 });
  }

  try {
    // Parse the session JSON from the cookie
    const sessionData = JSON.parse(decodeURIComponent(authCookie.value));
    const accessToken = sessionData?.access_token;
    const refreshToken = sessionData?.refresh_token;

    if (!accessToken) {
      return NextResponse.json({ user: null }, { status: 200 });
    }

    // Set the session to get an authenticated client
    const supabase = createClient(supabaseUrl, anonKey);
    const { data, error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken || '',
    });

    if (error || !data.user) {
      return NextResponse.json({ user: null }, { status: 200 });
    }

    return NextResponse.json({
      user: {
        id: data.user.id,
        phone: data.user.phone || '',
      },
    });
  } catch {
    return NextResponse.json({ user: null }, { status: 200 });
  }
}
