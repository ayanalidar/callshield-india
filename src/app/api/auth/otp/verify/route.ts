/**
 * POST /api/auth/otp/verify — Verify OTP and create session
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    const { phone, otp } = await request.json();

    if (!phone || !otp) {
      return NextResponse.json(
        { error: 'Phone and OTP required', code: 'MISSING_FIELDS' },
        { status: 400 }
      );
    }

    // Normalize phone
    let normalizedPhone = phone.replace(/[^0-9+]/g, '');
    if (normalizedPhone.length === 10) {
      normalizedPhone = '+91' + normalizedPhone;
    } else if (normalizedPhone.length === 11 && normalizedPhone.startsWith('0')) {
      normalizedPhone = '+91' + normalizedPhone.slice(1);
    } else if (normalizedPhone.length === 12 && normalizedPhone.startsWith('91')) {
      normalizedPhone = '+' + normalizedPhone;
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !anonKey) {
      return NextResponse.json(
        { error: 'Auth service not configured', code: 'CONFIG' },
        { status: 500 }
      );
    }

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

    // Set the auth cookie via the response
    const response = NextResponse.json({
      success: true,
      user: {
        id: data.user.id,
        phone: data.user.phone || normalizedPhone,
      },
    });

    // Store session token in a cookie for SSR middleware
    response.cookies.set('sb-access-token', data.session.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: data.session.expires_in || 604800,
      path: '/',
    });

    // Also set the standard Supabase auth cookie
    const sessionStr = JSON.stringify({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_at: Date.now() + (data.session.expires_in || 604800) * 1000,
    });

    // Split into chunks if too large
    const chunks = sessionStr.match(/.{1,3000}/g) || [sessionStr];
    let cookieValue = '';
    for (let i = 0; i < chunks.length; i++) {
      cookieValue += (i > 0 ? '.' : '') + Buffer.from(chunks[i]).toString('base64');
    }

    response.cookies.set(
      `sb-${supabaseUrl.split('//')[1]?.split('.')[0] || 'project'}-auth-token`,
      cookieValue,
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: data.session.expires_in || 604800,
        path: '/',
      }
    );

    return response;

  } catch (error: any) {
    console.error('[OTP Verify] Exception:', error);
    return NextResponse.json(
      { error: 'Failed to verify OTP', code: 'SERVER_ERROR' },
      { status: 500 }
    );
  }
}
