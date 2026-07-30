/**
 * POST /api/auth/otp/verify — Verify OTP and create session
 * 
 * Dev mode: accepts any 6-digit OTP and creates a local session.
 * Production: verifies via Supabase real phone OTP.
 */

import { NextRequest, NextResponse } from 'next/server';

function normalizePhone(phone: string): string {
  let np = phone.replace(/[^0-9+]/g, '');
  if (np.length === 10) np = '+91' + np;
  else if (np.length === 11 && np.startsWith('0')) np = '+91' + np.slice(1);
  else if (np.length === 12 && np.startsWith('91')) np = '+' + np;
  return np;
}

export async function POST(request: NextRequest) {
  try {
    const { phone, otp } = await request.json();

    if (!phone || !otp) {
      return NextResponse.json(
        { error: 'Phone and OTP required', code: 'MISSING_FIELDS' },
        { status: 400 }
      );
    }

    const normalizedPhone = normalizePhone(phone);

    // ---- Production mode (real Supabase auth) ----
    if (process.env.OTP_PROVIDER === 'supabase' && process.env.NODE_ENV === 'production') {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      if (!supabaseUrl || !anonKey) {
        return NextResponse.json({ error: 'Auth not configured', code: 'CONFIG' }, { status: 500 });
      }

      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(supabaseUrl, anonKey);
      const { data, error } = await supabase.auth.verifyOtp({
        phone: normalizedPhone,
        token: otp,
        type: 'sms' as any,
      });

      if (error || !data.session) {
        return NextResponse.json(
          { error: error?.message || 'Verification failed', code: 'OTP_INVALID' },
          { status: 400 }
        );
      }

      const response = NextResponse.json({
        success: true,
        user: { id: data.user?.id, phone: data.user?.phone || normalizedPhone },
      });

      response.cookies.set('sb-access-token', data.session.access_token, {
        httpOnly: true, secure: true, sameSite: 'lax',
        maxAge: data.session.expires_in || 604800, path: '/',
      });

      return response;
    }

    // ---- Dev/Free mode: accept any 6-digit OTP ----
    const userId = `user_${normalizedPhone.replace('+', '')}`;
    const sessionToken = Buffer.from(JSON.stringify({
      phone: normalizedPhone,
      id: userId,
      iat: Date.now(),
    })).toString('base64');

    console.log(`[OTP Verify] Dev login: ${normalizedPhone} → ${userId}`);

    const response = NextResponse.json({
      success: true,
      user: { id: userId, phone: normalizedPhone },
    });

    response.cookies.set('sb-access-token', sessionToken, {
      httpOnly: true, secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax', maxAge: 604800, path: '/',
    });

    return response;

  } catch (error: any) {
    console.error('[OTP Verify] Exception:', error);
    return NextResponse.json(
      { error: 'Failed to verify OTP', code: 'SERVER_ERROR' },
      { status: 500 }
    );
  }
}
