/**
 * CallShield UPI Scam Check API
 *
 * POST /api/upi/check
 * Body: { upiId?: string; phoneNumber?: string }
 *
 * Checks UPI ID or phone against known scam databases.
 * Returns risk assessment with color‑coded verdict.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-server';
import { analyzeNumber } from '@/engines/number-intel';

/* ------------------------------------------------------------------ */
/*  Known scam UPI / phone patterns (edge – DB enrich in production)   */
/* ------------------------------------------------------------------ */

interface ScamEntry {
  identifier: string;   // UPI ID or normalized phone
  type: 'upi' | 'phone';
  scamReports: number;
  categories: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
}

const SCAM_DB: ScamEntry[] = [
  { identifier: 'fraud@oksbi', type: 'upi', scamReports: 423, categories: ['bank_impersonation', 'upi_fraud'], severity: 'critical' },
  { identifier: 'support@phonepe.xyz', type: 'upi', scamReports: 187, categories: ['upi_fraud', 'kyc_scam'], severity: 'high' },
  { identifier: 'verify@paytm.cc', type: 'upi', scamReports: 312, categories: ['payment_verify_scam'], severity: 'critical' },
  { identifier: 'reward@gpay.co', type: 'upi', scamReports: 98, categories: ['reward_scam'], severity: 'medium' },
  { identifier: 'help@axisb.xyz', type: 'upi', scamReports: 256, categories: ['bank_impersonation'], severity: 'high' },
  { identifier: 'kyc@icici.site', type: 'upi', scamReports: 145, categories: ['kyc_scam'], severity: 'high' },
  { identifier: 'refund@amazon.ind.in', type: 'upi', scamReports: 67, categories: ['refund_scam'], severity: 'medium' },
  { identifier: '+919988776655', type: 'phone', scamReports: 534, categories: ['bank_otp_scam', 'upi_fraud'], severity: 'critical' },
  { identifier: '+918765432109', type: 'phone', scamReports: 289, categories: ['bank_otp_scam'], severity: 'high' },
  { identifier: '+917654321098', type: 'phone', scamReports: 156, categories: ['loan_app'], severity: 'medium' },
];

/* ------------------------------------------------------------------ */
/*  UPI ID validation helpers                                          */
/* ------------------------------------------------------------------ */

function isValidUpiId(upiId: string): boolean {
  // UPI ID format: localpart@handle (e.g., name@okhdfcbank)
  return /^[a-zA-Z0-9._-]{3,30}@[a-zA-Z0-9]{2,40}$/.test(upiId);
}

const SUSPICIOUS_UPI_HANDLES = [
  'xyz', 'cc', 'site', 'online', 'top', 'club', 'tk', 'ml', 'ga', 'cf', 'gq',
];

/* ------------------------------------------------------------------ */
/*  POST handler                                                       */
/* ------------------------------------------------------------------ */

export async function POST(request: NextRequest) {
  // Optional auth — allow unauthenticated checks but prefer auth
  let userId = 'anonymous';
  try {
    const auth = await requireAuth(request);
    if (!auth.error) userId = auth.userId;
  } catch { /* continue without auth */ }

  let body: Record<string, any>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { upiId, phoneNumber } = body;

  if (!upiId && !phoneNumber) {
    return NextResponse.json({ error: 'Provide upiId or phoneNumber' }, { status: 400 });
  }

  /* ---- Phone path ---- */
  if (phoneNumber && !upiId) {
    const intel = analyzeNumber(phoneNumber);
    const cleaned = phoneNumber.replace(/[^0-9+]/g, '');

    // Check scam DB
    const match = SCAM_DB.find(
      e => e.type === 'phone' && e.identifier === intel.normalized,
    ) || SCAM_DB.find(
      e => e.type === 'phone' && e.identifier === `+91${cleaned.slice(-10)}`,
    );

    if (match) {
      const risk = match.severity === 'critical' ? 95 :
        match.severity === 'high' ? 80 :
        match.severity === 'medium' ? 50 : 25;

      return NextResponse.json({
        risk: match.severity === 'critical' || match.severity === 'high' ? 'HIGH_RISK' :
          match.severity === 'medium' ? 'SUSPICIOUS' : 'LOW_RISK',
        scamReports: match.scamReports,
        categories: match.categories,
        recommendation: match.severity === 'critical'
          ? '🚨 DO NOT send money. This number is flagged as a known scammer.'
          : match.severity === 'high'
            ? '⚠️ Multiple scam reports. Avoid any transactions.'
            : '⚠️ Exercise caution. Verify through official channels.',
        numberIntel: {
          normalized: intel.normalized,
          carrier: intel.carrier,
          telecomCircle: intel.telecomCircle,
          isIndian: intel.isIndian,
        },
      });
    }

    // No direct match – use heuristic scoring
    const heuristicScore = intel.isVoip ? 60 :
      intel.isHighRiskPrefix ? 40 :
      !intel.isValid ? 30 : 10;

    return NextResponse.json({
      risk: heuristicScore >= 50 ? 'SUSPICIOUS' : heuristicScore >= 30 ? 'LOW_RISK' : 'SAFE',
      scamReports: 0,
      categories: [],
      recommendation: heuristicScore >= 50
        ? '⚠️ This number shows risk indicators. Verify before transacting.'
        : heuristicScore >= 30
          ? '⚠️ Minor risk indicators. Standard caution advised.'
          : '✅ No reports found. Proceed with normal caution.',
      numberIntel: {
        normalized: intel.normalized,
        carrier: intel.carrier,
        telecomCircle: intel.telecomCircle,
        isIndian: intel.isIndian,
      },
    });
  }

  /* ---- UPI ID path ---- */
  if (upiId) {
    const normalisedUpi = upiId.toLowerCase().trim();

    // Validate format
    if (!isValidUpiId(normalisedUpi)) {
      return NextResponse.json({
        risk: 'INVALID',
        scamReports: 0,
        categories: [],
        recommendation: '❌ Invalid UPI ID format. UPI IDs look like: name@bankhandle',
      });
    }

    // Check for suspicious handles
    const handle = normalisedUpi.split('@')[1] || '';
    const suspiciousHandle = SUSPICIOUS_UPI_HANDLES.some(h => handle.includes(h));

    // Check scam DB
    const match = SCAM_DB.find(e => e.type === 'upi' && e.identifier.toLowerCase() === normalisedUpi);

    if (match) {
      const risk = match.severity === 'critical' ? 95 :
        match.severity === 'high' ? 80 : 50;

      return NextResponse.json({
        risk: risk >= 80 ? 'HIGH_RISK' : 'SUSPICIOUS',
        scamReports: match.scamReports,
        categories: match.categories,
        recommendation: risk >= 80
          ? '🚨 This UPI ID is flagged for fraud. DO NOT send money.'
          : '⚠️ This UPI ID has scam reports. Avoid transactions.',
      });
    }

    // Heuristic: suspicious handle + no match → moderate risk
    if (suspiciousHandle) {
      return NextResponse.json({
        risk: 'SUSPICIOUS',
        scamReports: 0,
        categories: ['suspicious_handle'],
        recommendation: '⚠️ Unusual UPI handle. Could be a fake banking handle. Verify before paying.',
      });
    }

    // Clean
    return NextResponse.json({
      risk: 'SAFE',
      scamReports: 0,
      categories: [],
      recommendation: '✅ No scam reports for this UPI ID. Proceed with normal caution.',
    });
  }

  return NextResponse.json({ error: 'Unexpected request' }, { status: 400 });
}
