/**
 * POST /api/caller-id — Complete caller identification
 * 
 * Returns: name, displayName, location (city/state/circle), carrier,
 * scamType, threatScore, reportCount, block advisory, plus device-enriched
 * fields for IMEI + tower signaling (filled by Android client).
 */

import { NextRequest, NextResponse } from 'next/server';

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
  'Rajasthan': { city: 'Jaipur', state: 'Rajasthan', area: 'Rajasthan' },
  'Maharashtra': { city: 'Mumbai', state: 'Maharashtra', area: 'Maharashtra' },
  'Madhya Pradesh': { city: 'Bhopal', state: 'Madhya Pradesh', area: 'Madhya Pradesh' },
  'Pan-India': { city: 'India', state: 'Pan-India', area: 'India' },
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phoneNumber, deviceInfo } = body;

    if (!phoneNumber || phoneNumber.trim().length < 6) {
      return NextResponse.json({ error: 'Valid phone number required' }, { status: 400 });
    }

    const { detectScam } = await import('@/engines/scam-detector');
    const { lookupScamNumber } = await import('@/db/supabase');

    const normalized = normalizePhone(phoneNumber.trim());

    // Edge analysis
    const edge = detectScam(normalized, { protectionLevel: 'standard' });
    const intel = edge.numberIntel;

    // DB enrichment
    let db: any = null;
    try { db = await lookupScamNumber(normalized); } catch {}

    // Location
    const circle = db?.telecom_circle || intel.telecomCircle || null;
    const circleLoc = circle ? CITY_MAP[circle] : null;
    const location = circleLoc?.area || circle || (intel.isIndian ? 'India' : intel.countryName || 'Unknown');
    const city = circleLoc?.city || circle || null;
    const state = circleLoc?.state || null;

    // Carrier
    const carrier = db?.carrier || intel.carrier || (intel.isIndian ? 'Indian Mobile' : 'Unknown');

    // Name / display — camelCase from lookupScamNumber
    const scamLabel = db?.scamType?.replace(/_/g, ' ') || null;
    const reportCount = db?.reportCount || 0;
    const displayName = scamLabel
      ? scamLabel + ' · ' + carrier + (reportCount > 10 ? ' (' + reportCount + ' reports)' : '')
      : carrier + (reportCount > 10 ? ' (' + reportCount + ' reports)' : '');

    // Scoring — lookupScamNumber returns camelCase (threatScore, not threat_score)
    const threatScore = db
      ? Math.round((db.threatScore || 50) * 0.7 + edge.threatScore * 0.3)
      : edge.threatScore;

    let verdict = 'safe';
    if (threatScore >= 80) verdict = 'critical';
    else if (threatScore >= 60) verdict = 'scam';
    else if (threatScore >= 35) verdict = 'suspicious';

    const severity = threatScore >= 80 ? 'critical' : threatScore >= 60 ? 'high' : threatScore >= 35 ? 'medium' : 'low';

    const warnings: string[] = [];
    if (verdict === 'scam' || verdict === 'critical') warnings.push('This number has been reported as a scam');
    if (db?.verified) warnings.push('Verified scam number in community database');
    if (intel.numberType === 'voip') warnings.push('VoIP number — often used for spam');
    if (intel.countryCode && intel.countryCode !== '91') warnings.push(`International call from ${intel.countryName || intel.countryCode}`);

    // Tower / device info passed through from Android client
    const towerInfo = deviceInfo || null;

    return NextResponse.json({
      phoneNumber: normalized,
      name: scamLabel || null,
      displayName,
      location,
      city,
      state,
      telecomCircle: circle,
      carrier,
      numberType: intel.numberType || 'mobile',
      isIndian: intel.isIndian,
      isVoip: intel.isVoip || false,
      isScam: db ? true : edge.isScam,
      scamType: db?.scam_type || edge.primaryScamType || null,
      severity,
      threatScore,
      verdict,
      shouldBlock: verdict === 'scam' || verdict === 'critical',
      reportCount,
      recentReportCount: db?.recent_report_count || 0,
      verified: db?.verified || false,
      source: db?.source || 'edge-analysis',
      warnings,
      // Device-level info (from network — Android fills via local APIs)
      deviceInfo: towerInfo ? {
        imei: towerInfo.imei || null,
        deviceModel: towerInfo.deviceModel || null,
        networkType: towerInfo.networkType || null,
        signalStrength: towerInfo.signalStrength || null,
        roaming: towerInfo.roaming || false,
        towerLocation: towerInfo.towerLocation || null,
      } : null,
    });

  } catch (e: any) {
    console.error('[Caller ID]', e.message);
    return NextResponse.json({ error: 'Lookup failed' }, { status: 500 });
  }
}

function normalizePhone(raw: string): string {
  let n = raw.replace(/[^0-9+]/g, '');
  if (n.length === 10) n = '+91' + n;
  else if (n.length === 11 && n.startsWith('0')) n = '+91' + n.slice(1);
  else if (n.length === 12 && n.startsWith('91')) n = '+' + n;
  else if (n.length > 10 && !n.startsWith('+')) n = '+' + n;
  return n;
}
