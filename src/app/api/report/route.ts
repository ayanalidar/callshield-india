/**
 * CallShield Report API
 * 
 * POST /api/report — Submit a scam report
 */

import { NextRequest, NextResponse } from 'next/server';
import { normalizeIndianNumber, normalizeIntlNumber } from '@/engines/number-intel';
import { checkRateLimit, recordReport } from '@/engines/crowd-reports';
import { submitScamReport } from '@/db/supabase';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phoneNumber, scamType, description, spamScore, userId } = body;

    if (!phoneNumber || !scamType) {
      return NextResponse.json(
        { error: 'phoneNumber and scamType required', code: 'MISSING_FIELDS' },
        { status: 400 }
      );
    }

    // Normalize number
    const normalized = normalizeIndianNumber(phoneNumber) || normalizeIntlNumber(phoneNumber);
    if (!normalized) {
      return NextResponse.json(
        { error: 'Invalid phone number format', code: 'INVALID_NUMBER' },
        { status: 400 }
      );
    }

    // Rate limit
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    const rateCheck = checkRateLimit({ ip, userId, normalizedNumber: normalized });
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: 'Rate limited', code: 'RATE_LIMITED', waitSeconds: rateCheck.waitSeconds },
        { status: 429 }
      );
    }

    // Submit to DB
    const result = await submitScamReport({
      phoneNumber,
      normalizedNumber: normalized,
      scamType,
      description,
      spamScore: spamScore || 3,
      userId,
      reporterIp: ip,
    });

    // Record for rate limiting
    if (result.success) {
      recordReport({ ip, userId, normalizedNumber: normalized });
    }

    return NextResponse.json(result);

  } catch (error: any) {
    console.error('Report error:', error);
    return NextResponse.json(
      { error: 'Failed to submit report', code: 'REPORT_FAILED', detail: error.message },
      { status: 500 }
    );
  }
}
