/**
 * CallShield Scam Detection Engine
 * 
 * Multi-layered scam detection system:
 * 1. KN Scam DB lookup (PostgreSQL)
 * 2. Prefix-pattern matching (known scam ranges)
 * 3. International fraud pattern matching
 * 4. Crowd intelligence scoring
 * 5. Behavioral heuristics
 */

import {
  analyzeNumber, type NumberIntel,
} from './number-intel';

// ============================================================
// TYPES
// ============================================================

export type ScamType = 
  | 'upi_fraud'
  | 'bank_otp_scam'
  | 'it_department'
  | 'insurance'
  | 'loan_app'
  | 'fedex_customs'
  | 'crypto'
  | 'lottery'
  | 'ecommerce'
  | 'police_fake'
  | 'aadhaar_kyc'
  | 'electricity'
  | 'sextortion'
  | 'wangiri'
  | 'sms_phishing'
  | 'job_scam'
  | 'other';

export const SCAM_TYPE_LABELS: Record<ScamType, string> = {
  upi_fraud: 'UPI Payment Fraud',
  bank_otp_scam: 'Bank OTP Scam',
  it_department: 'IT Dept Impersonation',
  insurance: 'Insurance Scam',
  loan_app: 'Loan App Harassment',
  fedex_customs: 'FedEx/Customs Scam',
  crypto: 'Crypto Investment Scam',
  lottery: 'Lottery/Win Scam',
  ecommerce: 'E-commerce Fraud',
  police_fake: 'Fake Police Call',
  aadhaar_kyc: 'Aadhaar KYC Scam',
  electricity: 'Electricity Bill Scam',
  sextortion: 'Sextortion/Blackmail',
  wangiri: 'Wangiri Missed Call',
  sms_phishing: 'SMS Phishing (Smishing)',
  job_scam: 'Fake Job Offer',
  other: 'Other Scam',
};

export interface ScamDetectionResult {
  phoneNumber: string;
  normalized: string;

  // Classification
  isScam: boolean;
  confidence: number;         // 0-1
  verdict: 'safe' | 'suspicious' | 'scam' | 'critical';

  // What was detected
  scamTypes: ScamType[];
  primaryScamType?: ScamType;
  severity: 'low' | 'medium' | 'high' | 'critical';

  // Threat details
  threatScore: number;        // 0-100
  threatBreakdown: ThreatFactor[];

  // Evidence
  evidence: string[];
  warnings: string[];

  // Source data
  numberIntel: NumberIntel;
  dbMatch: boolean;
  crowdReportCount: number;
  patternMatch: boolean;
}

export interface ThreatFactor {
  name: string;
  score: number;    // contribution to total
  maxScore: number; // what it could have contributed
  detail: string;
}

// Known scam keywords by type — for pattern matching
const SCAM_KEYWORDS: Record<ScamType, string[]> = {
  upi_fraud: ['upi', 'payment', 'google pay', 'phonepe', 'paytm', 'bhim', 'qr', 'scan', 'refund', 'send money', 'pay'],
  bank_otp_scam: ['sbi', 'hdfc', 'icici', 'axis', 'kotak', 'otp', 'card', 'debit', 'credit', 'bank', 'kyc', 'verify', 'expiry', 'block'],
  it_department: ['income tax', 'it department', 'tax refund', 'itr', 'pan card', 'tax notice', 'it raid'],
  insurance: ['insurance', 'lic', 'policy', 'premium', 'health cover', 'claim', 'star health', 'hdfc life', 'max life'],
  loan_app: ['loan', 'instant loan', 'emi', 'personal loan', 'nbfc', 'recovery', 'repayment', 'collection'],
  fedex_customs: ['fedex', 'customs', 'parcel', 'courier', 'dhl', 'package', 'illegal goods', 'narcotics', 'shipment'],
  crypto: ['crypto', 'bitcoin', 'ethereum', 'trading', 'investment', 'returns', 'binance', 'wazirx', 'coin', 'mining'],
  lottery: ['lottery', 'won', 'prize', 'lucky', 'draw', 'jackpot', 'reward', 'congratulations', 'kaun banega'],
  ecommerce: ['amazon', 'flipkart', 'order', 'delivery', 'return', 'refund', 'product', 'gift card'],
  police_fake: ['police', 'crime branch', 'cbi', 'narcotics', 'fir', 'arrest', 'complaint', 'station'],
  aadhaar_kyc: ['aadhaar', 'uidai', 'kyc', 'verification', 'biometric', 'linking', 'update kyc', 'deactivate'],
  electricity: ['electricity', 'bill', 'power', 'disconnection', 'meter', 'tsspdcl', 'bses', 'adani', 'tneb'],
  sextortion: ['video', 'webcam', 'nude', 'leak', 'social media', 'uploaded', 'recorded', 'facebook', 'whatsapp video'],
  wangiri: ['missed call', 'one ring', 'ring back', 'callback'],
  sms_phishing: ['sms', 'link', 'click', 'verify your', 'update your', 'account suspended'],
  job_scam: ['job', 'work from home', 'salary', 'interview', 'hiring', 'placement', 'resume', 'recruitment'],
  other: [],
};

/**
 * Detect scam type from a description or known type string.
 */
export function detectScamTypeFromText(text: string): ScamType[] {
  const lower = text.toLowerCase();
  const matches: ScamType[] = [];

  for (const [type, keywords] of Object.entries(SCAM_KEYWORDS)) {
    if (type === 'other') continue;
    if (keywords.some(kw => lower.includes(kw))) {
      matches.push(type as ScamType);
    }
  }

  return matches.length > 0 ? matches : ['other'];
}

// ============================================================
// PROTECTION MODE THRESHOLDS
// ============================================================

const THRESHOLD_MAP = {
  off: { fraud: 999, suspicious: 999 },  // nothing blocked
  standard: { fraud: 70, suspicious: 50 },   // aggressive
  strict: { fraud: 50, suspicious: 30 },     // very aggressive
};

// ============================================================
// CORE DETECTION (without DB — works offline for instant checks)
// ============================================================

/**
 * Run the full scam detection pipeline.
 * This is the edge-side detection — fast, no DB needed.
 * DB enrichment happens in the second pass.
 */
export function detectScam(
  phoneNumber: string,
  options?: {
    callerDescription?: string;
    protectionLevel?: 'off' | 'standard' | 'strict';
    userCountry?: string;
  }
): ScamDetectionResult {
  const intel = analyzeNumber(phoneNumber);
  const evidence: string[] = [];
  const warnings: string[] = [];
  const factors: ThreatFactor[] = [];
  let threatScore = 0;
  let maxPossible = 0;
  const detectedScamTypes: Set<ScamType> = new Set();
  let dbMatch = false;
  let crowdReportCount = 0;
  let patternMatch = false;

  // ---- FACTOR 1: Invalid / suspicious format (0-15 pts) ----
  maxPossible += 15;
  if (!intel.isValid) {
    threatScore += 10;
    evidence.push('Invalid phone format');
    warnings.push('Invalid format');
    factors.push({ name: 'Format', score: 10, maxScore: 15, detail: 'Invalid format' });
  } else {
    factors.push({ name: 'Format', score: 0, maxScore: 15, detail: 'Valid format' });
  }

  // ---- FACTOR 2: International risk (0-25 pts) ----
  maxPossible += 25;
  if (!intel.isIndian && intel.countryCode) {
    const countryRisk = typeof intel.isHighRiskPrefix === 'boolean' ? 
      (intel.riskFlags.includes('known_scam_country') ? 4 : 
       intel.riskFlags.includes('high_risk_country') ? 3 : 
       intel.riskFlags.includes('critical_risk_country') ? 5 : 1) : 1;
    
    const score = Math.min(25, countryRisk * 5);
    threatScore += score;
    evidence.push(`International number from ${intel.countryName} (${intel.countryCode})`);
    
    if (countryRisk >= 4) {
      warnings.push(`International: ${intel.countryName} — known scam source`);
    }
    
    factors.push({
      name: 'International',
      score,
      maxScore: 25,
      detail: `Country: ${intel.countryName} (risk: ${countryRisk}/5)`,
    });
  } else {
    factors.push({ name: 'International', score: 0, maxScore: 25, detail: 'Indian number' });
  }

  // ---- FACTOR 3: VoIP / Virtual number (0-20 pts) ----
  maxPossible += 20;
  if (intel.isVoip || intel.riskFlags.includes('voip_number')) {
    threatScore += 18;
    evidence.push('VoIP/virtual number detected');
    warnings.push('VoIP number — impossible to trace');
    factors.push({ name: 'VoIP/Virtual', score: 18, maxScore: 20, detail: 'VoIP number' });
  } else {
    factors.push({ name: 'VoIP/Virtual', score: 0, maxScore: 20, detail: 'Not VoIP' });
  }

  // ---- FACTOR 4: High-risk prefix / known scam range (0-15 pts) ----
  maxPossible += 15;
  if (intel.isHighRiskPrefix) {
    threatScore += 12;
    evidence.push('Known scam-heavy prefix range');
    warnings.push('Number from known scam-heavy prefix');
    patternMatch = true;
    factors.push({ name: 'Prefix Risk', score: 12, maxScore: 15, detail: 'Known scam prefix' });
  } else {
    factors.push({ name: 'Prefix Risk', score: 0, maxScore: 15, detail: 'Normal prefix' });
  }

  // ---- FACTOR 5: Toll-free susceptibility (0-10 pts) ----
  maxPossible += 10;
  if (intel.numberType === 'tollfree') {
    threatScore += 6;
    evidence.push('Toll-free number — often spoofed');
    factors.push({ name: 'Toll-free', score: 6, maxScore: 10, detail: 'Often spoofed' });
  } else {
    factors.push({ name: 'Toll-free', score: 0, maxScore: 10, detail: `Type: ${intel.numberType}` });
  }

  // ---- FACTOR 6: Premium rate (0-10 pts) ----
  maxPossible += 10;
  if (intel.isPremiumRate) {
    threatScore += 8;
    evidence.push('Premium rate number — typical wangiri target');
    warnings.push('Premium rate — will charge on callback');
    factors.push({ name: 'Premium Rate', score: 8, maxScore: 10, detail: 'Premium rate' });
  } else {
    factors.push({ name: 'Premium Rate', score: 0, maxScore: 10, detail: 'Standard rate' });
  }

  // ---- FACTOR 7: Unknown carrier/unmapped prefix (0-5 pts) ----
  maxPossible += 5;
  if (intel.isIndian && !intel.carrier) {
    threatScore += 3;
    factors.push({ name: 'Carrier', score: 3, maxScore: 5, detail: 'Unknown carrier' });
  } else {
    factors.push({ name: 'Carrier', score: 0, maxScore: 5, detail: intel.carrier || 'N/A' });
  }

  // ---- FACTOR 8: Caller description text analysis (0-15 pts) ----
  maxPossible += 15;
  if (options?.callerDescription) {
    const textTypes = detectScamTypeFromText(options.callerDescription);
    if (textTypes.length > 0 && textTypes[0] !== 'other') {
      const textScore = Math.min(15, textTypes.length * 5);
      threatScore += textScore;
      textTypes.forEach(t => detectedScamTypes.add(t));
      evidence.push(`Caller dialog matches ${textTypes.map(t => SCAM_TYPE_LABELS[t]).join(', ')} patterns`);
      factors.push({
        name: 'Dialog Match',
        score: textScore,
        maxScore: 15,
        detail: `Matches: ${textTypes.join(', ')}`,
      });
    } else {
      factors.push({ name: 'Dialog Match', score: 0, maxScore: 15, detail: 'No pattern match' });
    }
  } else {
    factors.push({ name: 'Dialog Match', score: 0, maxScore: 15, detail: 'No description provided' });
  }

  // ---- Normalize score to 0-100 ----
  const normalizedScore = maxPossible > 0
    ? Math.round((threatScore / maxPossible) * 100)
    : 0;

  // ---- Verdict ----
  let verdict: ScamDetectionResult['verdict'];
  let severity: ScamDetectionResult['severity'];

  if (normalizedScore >= 80) {
    verdict = 'critical';
    severity = 'critical';
  } else if (normalizedScore >= 60) {
    verdict = 'scam';
    severity = 'high';
  } else if (normalizedScore >= 35) {
    verdict = 'suspicious';
    severity = 'medium';
  } else {
    verdict = 'safe';
    severity = 'low';
  }

  // Apply protection level
  const thresholds = THRESHOLD_MAP[options?.protectionLevel || 'standard'];
  const isScam = normalizedScore >= thresholds.fraud;

  // If international scam patterns are detected, always flag
  const autoFlag = intel.numberType === 'voip' || 
    intel.riskFlags.some(f => ['known_scam_country', 'known_scam_prefix'].includes(f));

  return {
    phoneNumber,
    normalized: intel.normalized,
    isScam: isScam || autoFlag,
    confidence: intel.isValid ? (verdict === 'critical' ? 0.9 : verdict === 'scam' ? 0.75 : verdict === 'suspicious' ? 0.5 : 0.85) : 0,
    verdict,
    scamTypes: [...detectedScamTypes],
    severity,
    threatScore: normalizedScore,
    threatBreakdown: factors,
    evidence,
    warnings,
    numberIntel: intel,
    dbMatch,
    crowdReportCount,
    patternMatch,
  };
}

/**
 * Check if a call should be blocked based on protection level.
 */
export function shouldBlock(
  result: ScamDetectionResult,
  protectionLevel: 'off' | 'standard' | 'strict'
): { block: boolean; reason: string } {
  if (protectionLevel === 'off') {
    return { block: false, reason: 'Protection off' };
  }

  const thresholds = THRESHOLD_MAP[protectionLevel];
  
  if (result.verdict === 'critical') {
    return { block: true, reason: `Critical threat score: ${result.threatScore}/100` };
  }
  if (result.threatScore >= thresholds.fraud) {
    return { block: true, reason: `High threat score: ${result.threatScore}/100` };
  }
  if (result.numberIntel.isVoip) {
    return { block: true, reason: 'VoIP number — untraceable' };
  }
  if (result.numberIntel.riskFlags.includes('known_scam_country')) {
    return { block: true, reason: `Known scam country: ${result.numberIntel.countryName}` };
  }

  return { block: false, reason: 'Passed checks' };
}

// ============================================================
// MOCK KG SCAM DATABASE (when DB is unreachable — edge resilience)
// ============================================================

// In-memory cache of recent scam lookups
const scamCache = new Map<string, { scamTypes: ScamType[]; score: number; count: number }>();

/**
 * Fast in-memory scam check (no DB needed).
 * Used as first-pass edge detection before DB enrichment.
 */
export function edgeScamCheck(normalized: string): {
  known: boolean;
  scamTypes: ScamType[];
  score: number;
  reportCount: number;
} | null {
  const cached = scamCache.get(normalized);
  if (cached) {
    return {
      known: true,
      scamTypes: cached.scamTypes,
      score: cached.score,
      reportCount: cached.count,
    };
  }
  return null;
}

/**
 * Update the edge cache with DB result.
 */
export function updateScamCache(
  normalized: string,
  data: { scamTypes: ScamType[]; score: number; count: number }
): void {
  scamCache.set(normalized, data);
  
  // Limit cache size
  if (scamCache.size > 10000) {
    const firstKey = scamCache.keys().next().value;
    if (firstKey) scamCache.delete(firstKey);
  }
}
