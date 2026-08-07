/**
 * CallShield Family Alerts API
 *
 * GET  /api/family/alerts — Recent scam alerts for family admin's members
 * POST /api/family/alerts — Create alert when an elder gets a scam call
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-server';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface FamilyAlert {
  id: string;
  familyCode: string;
  elderPhone: string;
  elderName?: string;
  scammerNumber: string;
  scamType: string;
  threatScore: number;
  blocked: boolean;
  timestamp: string;
  details?: string;
}

/* ------------------------------------------------------------------ */
/*  In‑memory store                                                    */
/* ------------------------------------------------------------------ */

const alerts: FamilyAlert[] = [];

// Pre‑seed with a couple sample alerts
alerts.push(
  {
    id: 'alert_001',
    familyCode: '_demo_',
    elderPhone: '+919876543210',
    elderName: 'Grandpa Sharma',
    scammerNumber: '+919988776655',
    scamType: 'bank_otp_scam',
    threatScore: 85,
    blocked: true,
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    details: 'Caller claimed to be from SBI and asked for OTP. Automatically blocked.',
  },
  {
    id: 'alert_002',
    familyCode: '_demo_',
    elderPhone: '+919876543210',
    elderName: 'Grandpa Sharma',
    scammerNumber: '+918765432109',
    scamType: 'fedex_customs',
    threatScore: 92,
    blocked: true,
    timestamp: new Date(Date.now() - 86400000).toISOString(),
    details: 'Caller claimed a parcel was held at customs with illegal contents.',
  },
);

/* ------------------------------------------------------------------ */
/*  GET — Recent alerts for family members                             */
/* ------------------------------------------------------------------ */

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const limit = Math.min(50, parseInt(searchParams.get('limit') || '20', 10) || 20);
  const familyCode = searchParams.get('familyCode') || '_demo_';

  const familyAlerts = alerts
    .filter(a => a.familyCode === familyCode)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, limit);

  return NextResponse.json({
    alerts: familyAlerts,
    total: alerts.filter(a => a.familyCode === familyCode).length,
    blockedCount: familyAlerts.filter(a => a.blocked).length,
  });
}

/* ------------------------------------------------------------------ */
/*  POST — Create alert                                                */
/* ------------------------------------------------------------------ */

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  let body: Record<string, any>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { elderPhone, scammerNumber, threatScore, scamType, details, familyCode } = body;

  if (!elderPhone || !scammerNumber) {
    return NextResponse.json({ error: 'elderPhone and scammerNumber are required' }, { status: 400 });
  }

  const alert: FamilyAlert = {
    id: `alert_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    familyCode: familyCode || '_demo_',
    elderPhone,
    elderName: body.elderName || undefined,
    scammerNumber,
    scamType: scamType || 'other',
    threatScore: typeof threatScore === 'number' ? Math.min(100, Math.max(0, threatScore)) : 75,
    blocked: body.blocked !== false, // default: true
    timestamp: new Date().toISOString(),
    details: details || undefined,
  };

  alerts.unshift(alert);

  // Keep store manageable
  if (alerts.length > 500) {
    alerts.length = 500;
  }

  return NextResponse.json({ success: true, alert }, { status: 201 });
}
