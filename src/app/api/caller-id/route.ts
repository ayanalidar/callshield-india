/**
 * POST /api/caller-id — Identify caller with name, location, carrier, scam status
 * 
 * Combines: number intel (carrier/circle), DB lookup (scam/name), crowd reports
 * Used by the Android dialer for incoming call screen and dial-pad lookup.
 */

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { phoneNumber } = await request.json();
    if (!phoneNumber || phoneNumber.trim().length < 6) {
      return NextResponse.json(
        { error: 'Valid phone number required', code: 'INVALID_NUMBER' },
        { status: 400 }
      );
    }

    // Dynamic imports to avoid SSR issues
    const { detectScam } = await import('@/engines/scam-detector');
    const { lookupScamNumber } = await import('@/db/supabase');

    const normalized = normalizeIndian(phoneNumber.trim());

    // Edge analysis
    const edgeResult = detectScam(normalized, { protectionLevel: 'standard' });
    const intel = edgeResult.numberIntel;

    // Build location from edge analysis
    const circle = intel.telecomCircle || null;
    const circleLoc = circle ? CITY_MAP[circle] : null;
    const location = circleLoc?.area || circle || (intel.isIndian ? 'India' : intel.countryName || 'Unknown');

    // DB enrichment
    let dbMatch: any = null;
    try { if (normalized) dbMatch = await lookupScamNumber(normalized); } catch {}

    // Carrier
    const carrier = dbMatch?.carrier || intel.carrier || (intel.isIndian ? 'Indian Mobile' : 'Unknown');

    // Build display name
    let displayName = carrier;
    if (dbMatch?.scamType) {
      displayName = dbMatch.scamType.replace(/_/g, ' ') + ' ' + carrier;
    }
    if (dbMatch?.reportCount > 10) {
      displayName = carrier + ' ' + dbMatch.reportCount + ' reports';
    }

    // Scoring
    const threatScore = dbMatch
      ? Math.round((dbMatch.threatScore || 50) * 0.7 + edgeResult.threatScore * 0.3)
      : edgeResult.threatScore;

    let verdict = 'safe';
    if (threatScore >= 80) verdict = 'critical';
    else if (threatScore >= 60) verdict = 'scam';
    else if (threatScore >= 35) verdict = 'suspicious';

    const shouldBlock = verdict === 'scam' || verdict === 'critical';
    const severity = threatScore >= 80 ? 'critical' : threatScore >= 60 ? 'high' : threatScore >= 35 ? 'medium' : 'low';

    const warnings: string[] = [];
    if (shouldBlock) warnings.push('This number has been reported as a scam');
    if (dbMatch?.verified) warnings.push('Verified scam number in community database');
    if (intel.numberType === 'voip') warnings.push('VoIP number - often used for spam');

    return NextResponse.json({
      phoneNumber: normalized,
      normalized,
      name: dbMatch?.scamType || null,
      displayName,
      location,
      city: circleLoc?.city || circle || null,
      state: circleLoc?.state || null,
      telecomCircle: circle,
      country: intel.isIndian ? 'India' : intel.countryName || 'Unknown',
      countryCode: intel.countryCode || null,
      isIndian: intel.isIndian,
      carrier,
      numberType: intel.numberType || dbMatch?.numberType || 'mobile',
      isVoip: intel.isVoip || false,
      isScam: dbMatch ? true : edgeResult.isScam,
      scamType: dbMatch?.scamType || edgeResult.primaryScamType || null,
      scamTypes: dbMatch?.scamType ? [dbMatch.scamType] : edgeResult.scamTypes || [],
      severity,
      threatScore,
      verdict,
      shouldBlock,
      reportCount: dbMatch?.reportCount || 0,
      recentReportCount: dbMatch?.recentReportCount || 0,
      verified: dbMatch?.verified || false,
      source: dbMatch?.source || 'edge-analysis',
      warnings,
    });

  } catch (error: any) {
    console.error('[Caller ID] Error:', error.message);
    return NextResponse.json(
      { error: 'Lookup failed', code: 'SERVER_ERROR' },
      { status: 500 }
    );
  }
}

function normalizeIndian(raw: string): string {
  let n = raw.replace(/[^0-9+]/g, '');
  if (n.length === 10) n = '+91' + n;
  else if (n.length === 11 && n.startsWith('0')) n = '+91' + n.slice(1);
  else if (n.length === 12 && n.startsWith('91')) n = '+' + n;
  else if (n.length > 10 && !n.startsWith('+')) n = '+' + n;
  return n;
}

const CITY_MAP: Record<string, { city: string; state: string; area: string }> = {
  'Delhi': { city: 'New Delhi', state: 'Delhi', area: 'Delhi NCR' },
  'Mumbai': { city: 'Mumbai', state: 'Maharashtra', area: 'Mumbai Metro' },
  'Kolkata': { city: 'Kolkata', state: 'West Bengal', area: 'Kolkata Metro' },
  'Chennai': { city: 'Chennai', state: 'Tamil Nadu', area: 'Chennai Metro' },
  'Bangalore': { city: 'Bangalore', state: 'Karnataka', area: 'Bangalore Urban' },
  'Hyderabad': { city: 'Hyderabad', state: 'Telangana', area: 'Hyderabad Metro' },
  'Ahmedabad': { city: 'Ahmedabad', state: 'Gujarat', area: 'Ahmedabad Metro' },
  'Pune': { city: 'Pune', state: 'Maharashtra', area: 'Pune Metro' },
  'Jaipur': { city: 'Jaipur', state: 'Rajasthan', area: 'Jaipur Metro' },
  'Lucknow': { city: 'Lucknow', state: 'Uttar Pradesh', area: 'Lucknow Metro' },
  'Karnataka': { city: 'Bangalore', state: 'Karnataka', area: 'Karnataka' },
  'Tamil Nadu': { city: 'Chennai', state: 'Tamil Nadu', area: 'Tamil Nadu' },
  'UP East': { city: 'Lucknow', state: 'Uttar Pradesh', area: 'Eastern UP' },
  'UP West': { city: 'Noida', state: 'Uttar Pradesh', area: 'Western UP / NCR' },
  'Bihar': { city: 'Patna', state: 'Bihar', area: 'Bihar' },
  'Jharkhand': { city: 'Ranchi', state: 'Jharkhand', area: 'Jharkhand' },
  'Gujarat': { city: 'Ahmedabad', state: 'Gujarat', area: 'Gujarat' },
  'West Bengal': { city: 'Kolkata', state: 'West Bengal', area: 'West Bengal' },
  'Pan-India': { city: 'India', state: 'Pan-India', area: 'India' },
};
