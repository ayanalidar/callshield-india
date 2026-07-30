/**
 * GET /api/auth/session — Returns current session user
 * Supports both real Supabase sessions and dev-mode local sessions.
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET(_request: NextRequest) {
  const cookieStore = cookies();

  // Check standard auth cookie
  const allCookies = cookieStore.getAll();
  const accessTokenCookie = allCookies.find(c => c.name === 'sb-access-token');

  if (!accessTokenCookie?.value) {
    return NextResponse.json({ user: null }, { status: 200 });
  }

  const token = accessTokenCookie.value;

  // Dev mode: local tokens are base64-encoded JSON with {phone, id}
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf-8');
    const parsed = JSON.parse(decoded);

    if (parsed.phone && parsed.id) {
      // Dev/local session
      return NextResponse.json({
        user: {
          id: parsed.id,
          phone: parsed.phone,
        },
      });
    }
  } catch {
    // Not a dev token, try Supabase
  }

  // Try Supabase real auth
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    return NextResponse.json({ user: null }, { status: 200 });
  }

  try {
    const authCookie = allCookies.find(c =>
      c.name.startsWith('sb-') && c.name.endsWith('-auth-token')
    );

    if (authCookie) {
      const chunks = authCookie.value.split('.');
      const jsonStr = chunks.map((c: string) => Buffer.from(c, 'base64').toString('utf-8')).join('');
      const sessionData = JSON.parse(jsonStr);

      if (sessionData?.access_token) {
        const verifyResult = await fetch(`${supabaseUrl}/auth/v1/user`, {
          headers: {
            Authorization: `Bearer ${sessionData.access_token}`,
            apikey: anonKey,
          },
        });

        if (verifyResult.ok) {
          const user = await verifyResult.json();
          return NextResponse.json({
            user: {
              id: user.id,
              phone: user.phone || user.user_metadata?.phone || '',
            },
          });
        }
      }
    }
  } catch {
    // Fall through
  }

  return NextResponse.json({ user: null }, { status: 200 });
}
