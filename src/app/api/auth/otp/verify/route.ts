/**
 * POST /api/auth/otp/verify — Verify OTP and create session
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function normalizePhone(phone: string): string {
  let np = phone.replace(/[^0-9+]/g, '');
  if (np.length === 10) np = '+91' + np;
  else if (np.length === 11 && np.startsWith('0')) np = '+91' + np.slice(1);
  else if (np.length === 12 && np.startsWith('91')) np = '+' + np;
  return np;
}

function respondWithSession(normalizedPhone: string, session: any, supabaseUrl: string, user?: any) {
  const response = NextResponse.json({
    success: true,
    user: {
      id: user?.id || session.user?.id || `dev_${normalizedPhone}`,
      phone: user?.phone || normalizedPhone,
    },
  });

  response.cookies.set('sb-access-token', session.access_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: session.expires_in || 604800,
    path: '/',
  });

  const sessionStr = JSON.stringify({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: Date.now() + (session.expires_in || 604800) * 1000,
  });

  const chunks = sessionStr.match(/.{1,3000}/g) || [sessionStr];
  let cookieValue = chunks.map(c => Buffer.from(c).toString('base64')).join('.');

  response.cookies.set(
    `sb-${supabaseUrl.split('//')[1]?.split('.')[0] || 'project'}-auth-token`,
    cookieValue,
    { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: session.expires_in || 604800, path: '/' }
  );

  return response;
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
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !anonKey) {
      return NextResponse.json(
        { error: 'Auth service not configured', code: 'CONFIG' },
        { status: 500 }
      );
    }

    // ---- DEV MODE: accept any 6-digit code ----
    // When NODE_ENV != 'production' OR OTP_DEV_MODE=1
    if (process.env.NODE_ENV !== 'production' || process.env.OTP_DEV_MODE === '1') {
      console.log(`[DEV Auth] Verifying dev OTP for ${normalizedPhone}`);

      // Try to sign in / sign up a mock user for session persistence
      const supabaseDev = createClient(supabaseUrl, anonKey);
      try {
        const { data: loginData } = await supabaseDev.auth.signInWithPassword({
          email: `${normalizedPhone.replace('+', '')}@callshield.dev`,
          password: 'callshield_dev_2024',
        });

        if (loginData?.session) {
          return respondWithSession(normalizedPhone, loginData.session, supabaseUrl, loginData.user);
        }

        // Sign up
        const { data: signUpData, error: signUpError } = await supabaseDev.auth.signUp({
          email: `${normalizedPhone.replace('+', '')}@callshield.dev`,
          password: 'callshield_dev_2024',
          phone: normalizedPhone,
          options: { data: { phone: normalizedPhone } },
        });

        if (signUpError) {
          console.error('[DEV Auth] Signup error:', signUpError.message);
          // Fall through to local-only session
        } else if (signUpData?.session) {
          return respondWithSession(normalizedPhone, signUpData.session, supabaseUrl, signUpData.user);
        }
      } catch (e: any) {
        console.error('[DEV Auth] Exception:', e.message);
      }

      // Dev mode fallback: local token (works without Supabase auth tables)
      const localSession = {
        access_token: Buffer.from(JSON.stringify({ phone: normalizedPhone, id: `dev-${normalizedPhone.replace('+', '')}`, iat: Date.now() })).toString('base64'),
        refresh_token: 'local_refresh',
        expires_in: 604800,
        user: { id: `dev-${normalizedPhone.replace('+', '')}`, phone: normalizedPhone },
      };

      console.log(`[DEV Auth] Using local-only session for ${normalizedPhone}`);
      return respondWithSession(normalizedPhone, localSession, supabaseUrl, localSession.user);
    }

    // ---- PRODUCTION: Real Supabase OTP verification ----
    const supabase = createClient(supabaseUrl, anonKey);
    const { data, error } = await supabase.auth.verifyOtp({
      phone: normalizedPhone,
      token: otp,
      type: 'sms',
    });

    if (error) {
      console.error('[OTP Verify] Error:', error.message);
      return NextResponse.json(
        { error: error.message, code: 'OTP_INVALID' },
        { status: 400 }
      );
    }

    if (!data.session || !data.user) {
      return NextResponse.json(
        { error: 'Verification failed', code: 'VERIFY_FAILED' },
        { status: 400 }
      );
    }

    return respondWithSession(normalizedPhone, data.session, supabaseUrl, data.user);

  } catch (error: any) {
    console.error('[OTP Verify] Exception:', error);
    return NextResponse.json(
      { error: 'Failed to verify OTP', code: 'SERVER_ERROR' },
      { status: 500 }
    );
  }
}
