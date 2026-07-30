/**
 * CallShield Threat Scoring Engine
 * 
 * Composite threat score from multiple signals:
 * - Number intelligence (carrier, location, VoIP)
 * - Scam DB match
 * - Crowd report volume & recency
 * - Report velocity (spike detection)
 * - Reporter trust weighting
 * - Behavior patterns
 */

import type { ScamType } from './scam-detector';
import type { NumberIntel } from './number-intel';

// ============================================================
// TYPES
// ============================================================

export interface CrowdSignal {
  totalReports: number;
  recentReports: number;     // last 30 days
  uniqueReporters: number;
  uniqueIPs: number;
  reportVelocity: number;    // reports per day (recent average)
  firstReportedAt: string | null;
  lastReportedAt: string | null;
  topScamTypes: { type: ScamType; count: number }[];
  avgReporterTrust: number;  // 0-5
}

export interface DbMatchSignal {
  found: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  threatScore: number;
  scamTypes: ScamType[];
  verified: boolean;
  source: string;
}

export interface ThreatScoreResult {
  phoneNumber: string;
  normalized: string;
  
  // Final score
  threatScore: number;       // 0-100
  confidence: number;        // 0-1
  severity: 'none' | 'low' | 'medium' | 'high' | 'critical';
  
  // Breakdown
  components: ThreatComponent[];
  
  // Explanation
  summary: string;
  recommendations: string[];

  // Source data
  numberIntel: NumberIntel;
  dbMatch: DbMatchSignal;
  crowdSignal: CrowdSignal;
}

export interface ThreatComponent {
  name: string;
  rawScore: number;
  normalizedScore: number;   // 0-100
  weight: number;            // contribution weight
  weightedScore: number;     // final contribution
  maxPossible: number;
  detail: string;
}

// ============================================================
// SCORING WEIGHTS
// ============================================================

const WEIGHTS = {
  numberIntel: 0.20,    // carrier, location, VoIP, type
  dbMatch: 0.35,        // known scam DB
  crowdReports: 0.30,   // community reports
  reportVelocity: 0.10, // trending/scam bursts
  reporterTrust: 0.05,  // trust in reporters
};

// ============================================================
// COMPONENT SCORERS
// ============================================================

/**
 * Score number intelligence.
 * High VoIP risk, international danger, unknown carriers get weighted.
 */
function scoreNumberIntel(intel: NumberIntel): ThreatComponent {
  let rawScore = 0;
  const maxPossible = 100;

  // VoIP = instant high risk
  if (intel.isVoip || intel.riskFlags.includes('voip_number')) {
    rawScore += 40;
  }

  // International high-risk countries
  if (intel.riskFlags.includes('critical_risk_country')) {
    rawScore += 35;
  } else if (intel.riskFlags.includes('known_scam_country')) {
    rawScore += 30;
  } else if (intel.riskFlags.includes('high_risk_country')) {
    rawScore += 15;
  }

  // Known scam prefix
  if (intel.isHighRiskPrefix) {
    rawScore += 20;
  }

  // Unknown carrier (could be new, could be suspicious)
  if (intel.isIndian && !intel.carrier) {
    rawScore += 8;
  }

  // Toll-free (often spoofed)
  if (intel.numberType === 'tollfree') {
    rawScore += 10;
  }

  // Premium rate
  if (intel.isPremiumRate) {
    rawScore += 12;
  }

  // Invalid format
  if (!intel.isValid) {
    rawScore += 5;
  }

  return {
    name: 'Number Intelligence',
    rawScore,
    normalizedScore: Math.min(maxPossible, rawScore),
    weight: WEIGHTS.numberIntel,
    weightedScore: 0, // calculated later
    maxPossible,
    detail: intel.isValid 
      ? `${intel.isIndian ? 'IN ' + (intel.carrier || 'Unknown') + ' ' + (intel.telecomCircle || '') : intel.countryName} ${intel.numberType}`
      : 'Invalid number',
  };
}

/**
 * Score database match signal.
 */
function scoreDbMatch(db: DbMatchSignal): ThreatComponent {
  if (!db.found) {
    return {
      name: 'Scam Database',
      rawScore: 0,
      normalizedScore: 0,
      weight: WEIGHTS.dbMatch,
      weightedScore: 0,
      maxPossible: 100,
      detail: 'Not in known scam DB',
    };
  }

  let score = 60; // base: it's known

  // Adjust by existing threat score
  score += (db.threatScore - 50) * 0.3; // ±15

  // Verified entries get weight bump
  if (db.verified) score += 10;

  // Source credibility
  if (db.source === 'cyber_crime_portal') score += 15;
  else if (db.source === 'admin_import') score += 10;
  else if (db.source === 'auto_detect') score -= 5;

  return {
    name: 'Scam Database',
    rawScore: score,
    normalizedScore: Math.min(100, Math.max(0, score)),
    weight: WEIGHTS.dbMatch,
    weightedScore: 0,
    maxPossible: 100,
    detail: `Known in DB · ${db.severity} · ${db.scamTypes.join(', ')} · ${db.verified ? 'Verified' : 'Unverified'} · Source: ${db.source}`,
  };
}

/**
 * Score crowd signals using logarithmic scaling.
 * Log scaling prevents a single mass-report from dominating.
 */
function scoreCrowd(crowd: CrowdSignal): ThreatComponent {
  if (crowd.totalReports === 0) {
    return {
      name: 'Crowd Reports',
      rawScore: 0,
      normalizedScore: 0,
      weight: WEIGHTS.crowdReports,
      weightedScore: 0,
      maxPossible: 100,
      detail: 'No community reports',
    };
  }

  // Log-scale: 1 report = ~20, 10 = ~50, 100 = ~80, 1000 = ~95
  let score = Math.min(95, 20 + 25 * Math.log10(Math.max(1, crowd.totalReports)));

  // Unique reporters bonus
  if (crowd.uniqueReporters > 5) score += 3;
  if (crowd.uniqueReporters > 20) score += 3;

  // Multiple IPs = less chance of fabrication
  if (crowd.uniqueIPs > 3) score += 2;
  if (crowd.uniqueIPs > 10) score += 3;

  return {
    name: 'Crowd Reports',
    rawScore: score,
    normalizedScore: Math.min(100, score),
    weight: WEIGHTS.crowdReports,
    weightedScore: 0,
    maxPossible: 100,
    detail: `${crowd.totalReports} reports · ${crowd.uniqueReporters} reporters · ${crowd.uniqueIPs} IPs`,
  };
}

/**
 * Score report velocity (spike detection).
 * A number getting 10+ reports/day is likely an active scam campaign.
 */
function scoreVelocity(crowd: CrowdSignal): ThreatComponent {
  if (crowd.reportVelocity === 0) {
    return {
      name: 'Report Velocity',
      rawScore: 0,
      normalizedScore: 0,
      weight: WEIGHTS.reportVelocity,
      weightedScore: 0,
      maxPossible: 100,
      detail: 'Stable — no recent spike',
    };
  }

  // Velocity scoring
  let score = 0;
  if (crowd.reportVelocity >= 20) score = 95;       // massive campaign
  else if (crowd.reportVelocity >= 10) score = 85;  // active campaign
  else if (crowd.reportVelocity >= 5) score = 70;   // trending
  else if (crowd.reportVelocity >= 2) score = 50;   // moderate
  else score = 25;                                   // low velocity

  return {
    name: 'Report Velocity',
    rawScore: score,
    normalizedScore: score,
    weight: WEIGHTS.reportVelocity,
    weightedScore: 0,
    maxPossible: 100,
    detail: `${crowd.reportVelocity.toFixed(1)} reports/day · ${crowd.recentReports} recent`,
  };
}

/**
 * Score reporter trust.
 */
function scoreReporterTrust(crowd: CrowdSignal): ThreatComponent {
  if (crowd.totalReports === 0) {
    return {
      name: 'Reporter Trust',
      rawScore: 0,
      normalizedScore: 0,
      weight: WEIGHTS.reporterTrust,
      weightedScore: 0,
      maxPossible: 100,
      detail: 'N/A — no reports',
    };
  }

  // Trust: 0 (all reports from untrusted) to 1 (all from trusted)
  const trustScore = Math.round(crowd.avgReporterTrust * 20); // 0-100
  // Weight this inversely: high trust = confirmation, low trust = uncertainty (not penalty)
  const penalty = Math.max(0, 50 - trustScore); // max 50 point penalty for low-trust reporters

  return {
    name: 'Reporter Trust',
    rawScore: penalty,
    normalizedScore: penalty,
    weight: WEIGHTS.reporterTrust,
    weightedScore: 0,
    maxPossible: 50,
    detail: `Avg trust: ${crowd.avgReporterTrust.toFixed(1)}/5 · ${penalty > 0 ? 'Low trust — reduce confidence' : 'Good trust'}`,
  };
}

// ============================================================
// MASTER SCORER
// ============================================================

export function scoreThreat(params: {
  numberIntel: NumberIntel;
  dbMatch?: Partial<DbMatchSignal>;
  crowdSignal?: Partial<CrowdSignal>;
}): ThreatScoreResult {
  const dbMatch: DbMatchSignal = {
    found: false,
    severity: 'low',
    threatScore: 0,
    scamTypes: [],
    verified: false,
    source: '',
    ...params.dbMatch,
  };

  const crowdSignal: CrowdSignal = {
    totalReports: 0,
    recentReports: 0,
    uniqueReporters: 0,
    uniqueIPs: 0,
    reportVelocity: 0,
    firstReportedAt: null,
    lastReportedAt: null,
    topScamTypes: [],
    avgReporterTrust: 1.0,
    ...params.crowdSignal,
  };

  // Score each component
  const components: ThreatComponent[] = [
    scoreNumberIntel(params.numberIntel),
    scoreDbMatch(dbMatch),
    scoreCrowd(crowdSignal),
    scoreVelocity(crowdSignal),
    scoreReporterTrust(crowdSignal),
  ];

  // Apply weights
  let finalScore = 0;
  for (const comp of components) {
    comp.weightedScore = (comp.normalizedScore / 100) * comp.weight * 100;
    finalScore += comp.weightedScore;
  }

  // Normalize to 0-100
  finalScore = Math.round(Math.min(100, finalScore));

  // Severity
  let severity: ThreatScoreResult['severity'];
  if (finalScore >= 85) severity = 'critical';
  else if (finalScore >= 65) severity = 'high';
  else if (finalScore >= 35) severity = 'medium';
  else if (finalScore >= 10) severity = 'low';
  else severity = 'none';

  // Confidence
  let confidence: number;
  if (dbMatch.found && crowdSignal.totalReports > 5) confidence = 0.9;
  else if (dbMatch.found) confidence = 0.75;
  else if (crowdSignal.totalReports > 3) confidence = 0.6;
  else if (params.numberIntel.isValid) confidence = 0.4;
  else confidence = 0.2;

  // Summary & recommendations
  const recommendations: string[] = [];
  let summary = '';

  if (severity === 'critical') {
    summary = `Critical threat detected. ${params.numberIntel.isVoip ? 'VoIP number, ' : ''}${dbMatch.found ? `Known ${dbMatch.severity} severity scam. ` : ''}${crowdSignal.totalReports} community reports.`;
    recommendations.push('Block immediately');
    recommendations.push('Report to cybercrime.gov.in');
    if (params.numberIntel.isVoip) recommendations.push('VoIP — cannot trace');
  } else if (severity === 'high') {
    summary = `High threat. ${dbMatch.found ? `Matches known scam pattern. ` : ''}Community has flagged this number.`;
    recommendations.push('Block recommended');
    recommendations.push('Warn family members');
  } else if (severity === 'medium') {
    summary = 'Suspicious number — moderate risk indicators.';
    recommendations.push('Exercise caution');
    recommendations.push('Report if confirmed scam');
  } else if (severity === 'low') {
    summary = 'Low risk — minimal threat indicators.';
    recommendations.push('Standard caution advised');
  } else {
    summary = 'No threat detected.';
  }

  return {
    phoneNumber: params.numberIntel.phoneNumber,
    normalized: params.numberIntel.normalized,
    threatScore: finalScore,
    confidence,
    severity,
    components,
    summary,
    recommendations,
    numberIntel: params.numberIntel,
    dbMatch,
    crowdSignal,
  };
}

/**
 * Quick score — fast path for API responses where we have partial data.
 */
export function quickScore(
  numberIntel: NumberIntel,
  dbMatchKnown: boolean,
  reportCount: number
): number {
  let score = 0;

  // Number intel
  if (numberIntel.isVoip) score += 25;
  if (!numberIntel.isIndian) {
    if (numberIntel.riskFlags.includes('known_scam_country')) score += 40;
    else if (numberIntel.riskFlags.includes('high_risk_country')) score += 25;
    else if (numberIntel.riskFlags.includes('critical_risk_country')) score += 20;
    else score += 10;
  }
  if (numberIntel.isHighRiskPrefix) score += 15;
  if (numberIntel.numberType === 'tollfree') score += 5;

  // DB match
  if (dbMatchKnown) score += 35;

  // Crowd reports (log scale)
  if (reportCount > 0) {
    score += Math.min(30, Math.round(10 * Math.log10(reportCount + 1)));
  }

  return Math.min(100, score);
}
