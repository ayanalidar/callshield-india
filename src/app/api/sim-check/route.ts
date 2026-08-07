/**
 * CallShield SIM Swap / Porting Check API
 *
 * POST /api/sim-check
 * Body: { phoneNumber: string }
 *
 * Checks for SIM porting history, prefix cluster risk,
 * recent SIM swap indicators, and carrier anomalies.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-server';
import { analyzeNumber } from '@/engines/number-intel';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface SimCheckResult {
  phoneNumber: string;
  normalized: string;
  suspicious: boolean;
  score: number;               // 0‑100
  carrierInfo: {
    currentCarrier?: string;
    originalCarrier?: string;
    isPorted: boolean;
    portCount?: number;        // number of reported ports
    lastPortDate?: string;
  };
  prefixCluster: {
    prefix: string;
    carrier: string;
    riskLevel: 'low' | 'medium' | 'high';
    scamReportCount: number;
  };
  warnings: string[];
  recommendations: string[];
  recentSimSwapIndicators: {
    recentPort: boolean;
    carrierMismatch: boolean;
    unknownCarrier: boolean;
    highRiskCluster: boolean;
  };
}

/* ------------------------------------------------------------------ */
/*  Known scam‑heavy clusters (prefix → risk)                          */
/* ------------------------------------------------------------------ */

const CLUSTER_RISK: Record<string, { carrier: string; riskLevel: 'low' | 'medium' | 'high'; scamReports: number }> = {
  '7310': { carrier: 'Reliance Jio', riskLevel: 'high', scamReports: 834 },
  '7311': { carrier: 'Airtel', riskLevel: 'high', scamReports: 612 },
  '7312': { carrier: 'Reliance Jio', riskLevel: 'high', scamReports: 723 },
  '7313': { carrier: 'Airtel', riskLevel: 'high', scamReports: 445 },
  '8600': { carrier: 'Reliance Jio', riskLevel: 'medium', scamReports: 234 },
  '8601': { carrier: 'Airtel', riskLevel: 'medium', scamReports: 198 },
  '8602': { carrier: 'Vi', riskLevel: 'medium', scamReports: 156 },
};

/* ------------------------------------------------------------------ */
/*  Simulated porting database (edge — DB enrich in prod)              */
/* ------------------------------------------------------------------ */

interface PortRecord {
  normalized: string;
  previousCarrier: string;
  portDate: string;
  portCount: number;
}

const PORT_RECORDS: PortRecord[] = [
  { normalized: '+919988776655', previousCarrier: 'Vi', portDate: '2025-12-15', portCount: 3 },
  { normalized: '+918765432109', previousCarrier: 'BSNL', portDate: '2025-11-03', portCount: 2 },
  { normalized: '+917654321098', previousCarrier: 'Airtel', portDate: '2026-01-20', portCount: 1 },
  { normalized: '+919900123456', previousCarrier: 'BSNL', portDate: '2026-06-10', portCount: 4 },
];

/* ------------------------------------------------------------------ */
/*  POST handler                                                       */
/* ------------------------------------------------------------------ */

export async function POST(request: NextRequest) {
  let userId = 'anonymous';
  try {
    const auth = await requireAuth(request);
    if (!auth.error) userId = auth.userId;
  } catch { /* optional auth */ }

  let body: Record<string, any>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { phoneNumber } = body;

  if (!phoneNumber || typeof phoneNumber !== 'string' || phoneNumber.trim().length === 0) {
    return NextResponse.json({ error: 'phoneNumber is required' }, { status: 400 });
  }

  const intel = analyzeNumber(phoneNumber);
  const warnings: string[] = [];
  const recommendations: string[] = [];

  /* ---- Carrier info ---- */
  const portRecord = PORT_RECORDS.find(r => r.normalized === intel.normalized);
  const isPorted = portRecord ? true : (intel.isPorted || false);

  const carrierInfo = {
    currentCarrier: intel.carrier,
    originalCarrier: portRecord?.previousCarrier || intel.originalCarrier,
    isPorted,
    portCount: portRecord?.portCount,
    lastPortDate: portRecord?.portDate,
  };

  /* ---- Prefix cluster risk ---- */
  const prefix = intel.normalized.length >= 7 ? intel.normalized.slice(3, 7) : 'unknown';
  const cluster = CLUSTER_RISK[prefix] || {
    carrier: intel.carrier || 'Unknown',
    riskLevel: 'low' as const,
    scamReports: 0,
  };

  /* ---- Indicators ---- */
  const recentPort: boolean = isPorted && portRecord
    ? (new Date(portRecord.portDate).getTime() > Date.now() - 90 * 86400000)
    : false;

  const carrierMismatch: boolean = !!(isPorted && intel.carrier && portRecord?.previousCarrier
    && intel.carrier !== portRecord.previousCarrier);

  const unknownCarrier = intel.isIndian && !intel.carrier;
  const highRiskCluster = cluster.riskLevel === 'high';

  // Build warnings
  if (recentPort) {
    warnings.push(`Recent SIM port detected (${portRecord?.portDate}). Verify if user initiated it.`);
    recommendations.push('Confirm with the user if they recently ported their SIM.');
  }
  if (portRecord && portRecord.portCount >= 3) {
    warnings.push(`Number has been ported ${portRecord.portCount} times — unusual frequency.`);
    recommendations.push('Frequent porting may indicate SIM swap fraud. Verify recent activity.');
  }
  if (highRiskCluster) {
    warnings.push(`Prefix ${prefix} is in a known scam‑heavy cluster. ${cluster.scamReports} scam reports.`);
    recommendations.push('Numbers from this prefix cluster are frequently used in scams. Exercise extra caution.');
  }
  if (carrierMismatch) {
    warnings.push(`Carrier mismatch: was ${portRecord?.previousCarrier}, now ${intel.carrier}.`);
  }
  if (unknownCarrier) {
    warnings.push('Unknown carrier — could be a newly activated or unregistered SIM.');
    recommendations.push('Unregistered carriers are common in SIM swap fraud schemes.');
  }
  if (intel.isVoip) {
    warnings.push('VoIP number detected — not a physical SIM.');
    recommendations.push('VoIP numbers cannot be SIM‑swapped but are often used for fraud.');
  }

  // Score
  let score = 0;
  if (recentPort) score += 30;
  if (portRecord && portRecord.portCount >= 3) score += 25;
  if (highRiskCluster) score += 20;
  if (carrierMismatch) score += 15;
  if (unknownCarrier) score += 10;
  if (intel.isVoip) score += 5;
  if (portRecord && portRecord.portCount >= 2) score += 10;

  const suspicious = score >= 40;

  const result: SimCheckResult = {
    phoneNumber,
    normalized: intel.normalized,
    suspicious,
    score: Math.min(100, score),
    carrierInfo,
    prefixCluster: {
      prefix,
      carrier: cluster.carrier,
      riskLevel: cluster.riskLevel,
      scamReportCount: cluster.scamReports,
    },
    warnings,
    recommendations: recommendations.length > 0
      ? recommendations
      : ['No SIM swap indicators detected. Number appears normal.'],
    recentSimSwapIndicators: {
      recentPort,
      carrierMismatch,
      unknownCarrier,
      highRiskCluster,
    },
  };

  return NextResponse.json(result);
}
