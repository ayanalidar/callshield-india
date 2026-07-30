/**
 * POST /api/auth/otp/send — Initiate phone OTP login
 * Uses Supabase's phone OTP auth via SMS
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    const { phone } = await request.json();

    if (!phone || phone.trim().length < 10) {
      return NextResponse.json(
        { error: 'Valid phone number required', code: 'INVALID_PHONE' },
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

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !anonKey) {
      return NextResponse.json(
        { error: 'Auth service not configured', code: 'CONFIG' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, anonKey);
    const { error } = await supabase.auth.signInWithOtp({
      phone: normalizedPhone,
      options: {
        shouldCreateUser: true,
        channel: 'sms',
      },
    });

    if (error) {
      console.error('[OTP Send] Error:', error.message);
      return NextResponse.json(
        { error: error.message, code: 'OTP_SEND_FAILED' },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, message: 'OTP sent' });

  } catch (error: any) {
    console.error('[OTP Send] Exception:', error);
    return NextResponse.json(
      { error: 'Failed to send OTP', code: 'SERVER_ERROR' },
      { status: 500 }
    );
  }
}
