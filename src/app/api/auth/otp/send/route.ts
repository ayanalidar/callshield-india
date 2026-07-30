/**
 * POST /api/auth/otp/send — Initiate phone OTP login
 * 
 * Dev/Free Mode: Always simulates OTP (any 6 digits work).
 * Production Mode: Uses Supabase real SMS via Twilio (requires OTPS_PROVIDER=supabase).
 * 
 * NO Supabase phone auth is called unless explicitly opted in —
 * because Supabase phone auth requires a paid SMS provider.
 */

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { phone } = await request.json();

    if (!phone || phone.trim().length < 10) {
      return NextResponse.json(
        { error: 'Valid phone number required (min 10 digits)', code: 'INVALID_PHONE' },
        { status: 400 }
      );
    }

    // Normalize to E.164 for Indian numbers
    let normalizedPhone = phone.replace(/[^0-9+]/g, '');
    if (normalizedPhone.length === 10) {
      normalizedPhone = '+91' + normalizedPhone;
    } else if (normalizedPhone.length === 11 && normalizedPhone.startsWith('0')) {
      normalizedPhone = '+91' + normalizedPhone.slice(1);
    } else if (normalizedPhone.length === 12 && normalizedPhone.startsWith('91')) {
      normalizedPhone = '+' + normalizedPhone;
    }

    // ---- Production mode (requires Supabase phone auth + paid SMS) ----
    if (process.env.OTP_PROVIDER === 'supabase' && process.env.NODE_ENV === 'production') {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      if (!supabaseUrl || !anonKey) {
        return NextResponse.json(
          { error: 'Auth service not configured', code: 'CONFIG' },
          { status: 500 }
        );
      }

      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(supabaseUrl, anonKey);
      const { error } = await supabase.auth.signInWithOtp({
        phone: normalizedPhone,
        options: { shouldCreateUser: true, channel: 'sms' as any },
      });

      if (error) {
        console.error('[OTP Send] Supabase error:', error.message);
        return NextResponse.json(
          { error: 'Failed to send SMS. Try again or use the web app.', code: 'OTP_SEND_FAILED' },
          { status: 400 }
        );
      }

      return NextResponse.json({ success: true, message: 'OTP sent via SMS', devMode: false });
    }

    // ---- Default: Simulated OTP (works everywhere, zero cost) ----
    console.log(`[OTP] Simulated OTP for ${normalizedPhone} — enter any 6-digit code`);
    return NextResponse.json({
      success: true,
      message: `OTP sent — use any 6 digits to verify ${normalizedPhone}`,
      devMode: true,
      phone: normalizedPhone,
    });

  } catch (error: any) {
    console.error('[OTP Send] Exception:', error);
    return NextResponse.json(
      { error: 'Failed to send OTP', code: 'SERVER_ERROR' },
      { status: 500 }
    );
  }
}
