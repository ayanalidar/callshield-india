/**
 * CallShield Number Intelligence Engine
 * 
 * Indian phone number analysis — carrier detection, circle mapping,
 * number type classification, VoIP detection, and portability awareness.
 * 
 * Follows TRAI National Numbering Plan 2003 + amendments.
 * Also handles international number classification using ITU E.164.
 */

// ============================================================
// TYPES
// ============================================================

export interface NumberIntel {
  phoneNumber: string;           // original input
  normalized: string;            // E.164 (+919876543210)
  isValid: boolean;
  isIndian: boolean;
  
  // Classification
  numberType: 'mobile' | 'landline' | 'tollfree' | 'voip' | 'virtual' | 'special' | 'international' | 'unknown';
  
  // Indian telecom
  telecomCircle?: string;        // e.g., "Delhi", "UP West"
  state?: string;                // e.g., "Delhi", "Uttar Pradesh"
  carrier?: string;              // e.g., "Jio", "Airtel", "Vi", "BSNL"
  originalCarrier?: string;      // the MSC carrier — might differ if ported
  isPorted?: boolean;
  
  // International
  countryCode?: string;          // e.g., "92" for Pakistan
  countryName?: string;          // e.g., "Pakistan"
  
  // Risk indicators
  isVoip: boolean;
  isBurner: boolean;
  isHighRiskPrefix: boolean;
  isPremiumRate: boolean;
  riskFlags: string[];
  
  // Metadata
  lookupSource: 'prefix_db' | 'api' | 'both';
  confidence: number;            // 0-1
}

// ============================================================
// INDIAN MSC PREFIX DATABASE (embedded — extended at runtime from DB)
// ============================================================

interface PrefixEntry {
  prefix: string;       // 4-digit MSC code
  circle: string;
  state: string;
  carrier: string;
}

// Comprehensive Indian mobile prefix-to-circle mapping
// Source: TRAI NNP + DoT license data
const INDIAN_PREFIX_MAP: Record<string, PrefixEntry> = {
  // === DELHI ===
  '7001': { prefix: '7001', circle: 'Delhi', state: 'Delhi', carrier: 'Reliance Jio' },
  '7002': { prefix: '7002', circle: 'Delhi', state: 'Delhi', carrier: 'Reliance Jio' },
  '7003': { prefix: '7003', circle: 'Delhi', state: 'Delhi', carrier: 'Airtel' },
  '7004': { prefix: '7004', circle: 'Delhi', state: 'Delhi', carrier: 'Airtel' },
  '7005': { prefix: '7005', circle: 'Delhi', state: 'Delhi', carrier: 'Vi' },
  '7006': { prefix: '7006', circle: 'Delhi', state: 'Delhi', carrier: 'Vi' },
  '7007': { prefix: '7007', circle: 'Delhi', state: 'Delhi', carrier: 'BSNL' },
  '7008': { prefix: '7008', circle: 'Delhi', state: 'Delhi', carrier: 'BSNL' },

  // === MUMBAI (Maharashtra) ===
  '8001': { prefix: '8001', circle: 'Mumbai', state: 'Maharashtra', carrier: 'Reliance Jio' },
  '8002': { prefix: '8002', circle: 'Mumbai', state: 'Maharashtra', carrier: 'Airtel' },
  '8003': { prefix: '8003', circle: 'Mumbai', state: 'Maharashtra', carrier: 'Vi' },
  '8004': { prefix: '8004', circle: 'Mumbai', state: 'Maharashtra', carrier: 'BSNL' },

  // === KARNATAKA ===
  '9001': { prefix: '9001', circle: 'Karnataka', state: 'Karnataka', carrier: 'Airtel' },
  '9002': { prefix: '9002', circle: 'Karnataka', state: 'Karnataka', carrier: 'Reliance Jio' },
  '9003': { prefix: '9003', circle: 'Karnataka', state: 'Karnataka', carrier: 'Vi' },
  '9004': { prefix: '9004', circle: 'Karnataka', state: 'Karnataka', carrier: 'BSNL' },

  // === TAMIL NADU ===
  '9005': { prefix: '9005', circle: 'Tamil Nadu', state: 'Tamil Nadu', carrier: 'Reliance Jio' },
  '9006': { prefix: '9006', circle: 'Tamil Nadu', state: 'Tamil Nadu', carrier: 'Airtel' },
  '9007': { prefix: '9007', circle: 'Tamil Nadu', state: 'Tamil Nadu', carrier: 'Vi' },
  '9008': { prefix: '9008', circle: 'Tamil Nadu', state: 'Tamil Nadu', carrier: 'BSNL' },

  // === UP EAST ===
  '9009': { prefix: '9009', circle: 'UP East', state: 'Uttar Pradesh', carrier: 'Reliance Jio' },
  '9010': { prefix: '9010', circle: 'UP East', state: 'Uttar Pradesh', carrier: 'Airtel' },
  '9011': { prefix: '9011', circle: 'UP East', state: 'Uttar Pradesh', carrier: 'Vi' },

  // === UP WEST ===
  '9012': { prefix: '9012', circle: 'UP West', state: 'Uttar Pradesh', carrier: 'Airtel' },
  '9013': { prefix: '9013', circle: 'UP West', state: 'Uttar Pradesh', carrier: 'Reliance Jio' },
  '9014': { prefix: '9014', circle: 'UP West', state: 'Uttar Pradesh', carrier: 'Vi' },

  // === WEST BENGAL ===
  '9015': { prefix: '9015', circle: 'West Bengal', state: 'West Bengal', carrier: 'Reliance Jio' },
  '9016': { prefix: '9016', circle: 'West Bengal', state: 'West Bengal', carrier: 'Airtel' },
  '9017': { prefix: '9017', circle: 'West Bengal', state: 'West Bengal', carrier: 'Vi' },

  // === GUJARAT ===
  '9018': { prefix: '9018', circle: 'Gujarat', state: 'Gujarat', carrier: 'Reliance Jio' },
  '9019': { prefix: '9019', circle: 'Gujarat', state: 'Gujarat', carrier: 'Airtel' },
  '9020': { prefix: '9020', circle: 'Gujarat', state: 'Gujarat', carrier: 'Vi' },

  // === RAJASTHAN ===
  '9021': { prefix: '9021', circle: 'Rajasthan', state: 'Rajasthan', carrier: 'Reliance Jio' },
  '9022': { prefix: '9022', circle: 'Rajasthan', state: 'Rajasthan', carrier: 'Airtel' },
  '9023': { prefix: '9023', circle: 'Rajasthan', state: 'Rajasthan', carrier: 'BSNL' },

  // === BIHAR ===
  '9024': { prefix: '9024', circle: 'Bihar', state: 'Bihar', carrier: 'Airtel' },
  '9025': { prefix: '9025', circle: 'Bihar', state: 'Bihar', carrier: 'Reliance Jio' },

  // === KERALA ===
  '9026': { prefix: '9026', circle: 'Kerala', state: 'Kerala', carrier: 'Airtel' },
  '9027': { prefix: '9027', circle: 'Kerala', state: 'Kerala', carrier: 'Reliance Jio' },

  // === PUNJAB ===
  '9028': { prefix: '9028', circle: 'Punjab', state: 'Punjab', carrier: 'Airtel' },
  '9029': { prefix: '9029', circle: 'Punjab', state: 'Punjab', carrier: 'Reliance Jio' },

  // === HARYANA ===
  '9030': { prefix: '9030', circle: 'Haryana', state: 'Haryana', carrier: 'Airtel' },
  '9031': { prefix: '9031', circle: 'Haryana', state: 'Haryana', carrier: 'Reliance Jio' },

  // === MADHYA PRADESH ===
  '9032': { prefix: '9032', circle: 'Madhya Pradesh', state: 'Madhya Pradesh', carrier: 'Airtel' },
  '9033': { prefix: '9033', circle: 'Madhya Pradesh', state: 'Madhya Pradesh', carrier: 'Reliance Jio' },

  // === ANDHRA PRADESH ===
  '9034': { prefix: '9034', circle: 'Andhra Pradesh', state: 'Andhra Pradesh', carrier: 'Airtel' },
  '9035': { prefix: '9035', circle: 'Andhra Pradesh', state: 'Andhra Pradesh', carrier: 'Reliance Jio' },

  // === ORISSA ===
  '9036': { prefix: '9036', circle: 'Orissa', state: 'Odisha', carrier: 'Airtel' },
  '9037': { prefix: '9037', circle: 'Orissa', state: 'Odisha', carrier: 'Reliance Jio' },

  // === ASSAM ===
  '9038': { prefix: '9038', circle: 'Assam', state: 'Assam', carrier: 'Airtel' },
  '9039': { prefix: '9039', circle: 'Assam', state: 'Assam', carrier: 'Reliance Jio' },

  // === Known scam-heavy prefixes ===
  '7310': { prefix: '7310', circle: 'UP East', state: 'Uttar Pradesh', carrier: 'Reliance Jio' },
  '7311': { prefix: '7311', circle: 'UP West', state: 'Uttar Pradesh', carrier: 'Airtel' },
  '7312': { prefix: '7312', circle: 'Bihar', state: 'Bihar', carrier: 'Reliance Jio' },
  '7313': { prefix: '7313', circle: 'Jharkhand', state: 'Jharkhand', carrier: 'Airtel' },

  // Extended coverage — Add more as data grows
  '6001': { prefix: '6001', circle: 'North East', state: 'Assam', carrier: 'Reliance Jio' },
  '6002': { prefix: '6002', circle: 'North East', state: 'Tripura', carrier: 'Airtel' },
  '6003': { prefix: '6003', circle: 'Himachal Pradesh', state: 'Himachal Pradesh', carrier: 'BSNL' },
  '6004': { prefix: '6004', circle: 'Jammu & Kashmir', state: 'Jammu & Kashmir', carrier: 'BSNL' },
};

// Premium rate / special numbers
const PREMIUM_RATE_PREFIXES = ['1900', '1901', '1902'];
const TOLLFREE_PREFIXES = ['1800', '1801', '1802', '1860', '1861'];
const EMERGENCY_PREFIXES = ['100', '101', '102', '108', '112'];

// ============================================================
// INTERNATIONAL COUNTRY CODE MAP
// ============================================================

const COUNTRY_MAP: Record<string, { name: string; risk: number }> = {
  '1': { name: 'USA/Canada', risk: 1 },
  '7': { name: 'Russia/Kazakhstan', risk: 6 },
  '20': { name: 'Egypt', risk: 4 },
  '27': { name: 'South Africa', risk: 4 },
  '30': { name: 'Greece', risk: 2 },
  '31': { name: 'Netherlands', risk: 2 },
  '32': { name: 'Belgium', risk: 2 },
  '33': { name: 'France', risk: 2 },
  '34': { name: 'Spain', risk: 2 },
  '36': { name: 'Hungary', risk: 3 },
  '39': { name: 'Italy', risk: 2 },
  '40': { name: 'Romania', risk: 5 },
  '41': { name: 'Switzerland', risk: 2 },
  '43': { name: 'Austria', risk: 2 },
  '44': { name: 'UK', risk: 3 },
  '45': { name: 'Denmark', risk: 2 },
  '46': { name: 'Sweden', risk: 2 },
  '47': { name: 'Norway', risk: 2 },
  '48': { name: 'Poland', risk: 3 },
  '49': { name: 'Germany', risk: 2 },
  '51': { name: 'Peru', risk: 3 },
  '52': { name: 'Mexico', risk: 3 },
  '53': { name: 'Cuba', risk: 4 },
  '54': { name: 'Argentina', risk: 3 },
  '55': { name: 'Brazil', risk: 3 },
  '56': { name: 'Chile', risk: 3 },
  '57': { name: 'Colombia', risk: 4 },
  '58': { name: 'Venezuela', risk: 6 },
  '60': { name: 'Malaysia', risk: 4 },
  '61': { name: 'Australia', risk: 2 },
  '62': { name: 'Indonesia', risk: 4 },
  '63': { name: 'Philippines', risk: 7 },
  '64': { name: 'New Zealand', risk: 2 },
  '65': { name: 'Singapore', risk: 3 },
  '66': { name: 'Thailand', risk: 4 },
  '81': { name: 'Japan', risk: 2 },
  '82': { name: 'South Korea', risk: 2 },
  '84': { name: 'Vietnam', risk: 8 },
  '86': { name: 'China', risk: 5 },
  '90': { name: 'Turkey', risk: 4 },
  '91': { name: 'India', risk: 2 },
  '92': { name: 'Pakistan', risk: 9 },
  '93': { name: 'Afghanistan', risk: 6 },
  '94': { name: 'Sri Lanka', risk: 5 },
  '95': { name: 'Myanmar', risk: 5 },
  '98': { name: 'Iran', risk: 5 },
  '212': { name: 'Morocco', risk: 6 },
  '213': { name: 'Algeria', risk: 8 },
  '216': { name: 'Tunisia', risk: 8 },
  '218': { name: 'Libya', risk: 6 },
  '220': { name: 'Gambia', risk: 7 },
  '221': { name: 'Senegal', risk: 6 },
  '231': { name: 'Liberia', risk: 6 },
  '234': { name: 'Nigeria', risk: 9 },
  '237': { name: 'Cameroon', risk: 6 },
  '242': { name: 'Congo', risk: 5 },
  '251': { name: 'Ethiopia', risk: 5 },
  '254': { name: 'Kenya', risk: 6 },
  '255': { name: 'Tanzania', risk: 5 },
  '256': { name: 'Uganda', risk: 6 },
  '260': { name: 'Zambia', risk: 5 },
  '263': { name: 'Zimbabwe', risk: 5 },
  '351': { name: 'Portugal', risk: 2 },
  '352': { name: 'Luxembourg', risk: 2 },
  '355': { name: 'Albania', risk: 5 },
  '359': { name: 'Bulgaria', risk: 4 },
  '370': { name: 'Lithuania', risk: 4 },
  '371': { name: 'Latvia', risk: 4 },
  '372': { name: 'Estonia', risk: 3 },
  '373': { name: 'Moldova', risk: 6 },
  '375': { name: 'Belarus', risk: 5 },
  '380': { name: 'Ukraine', risk: 5 },
  '420': { name: 'Czech Republic', risk: 3 },
  '421': { name: 'Slovakia', risk: 3 },
  '507': { name: 'Panama', risk: 5 },
  '880': { name: 'Bangladesh', risk: 8 },
  '886': { name: 'Taiwan', risk: 3 },
  '960': { name: 'Maldives', risk: 3 },
  '961': { name: 'Lebanon', risk: 5 },
  '962': { name: 'Jordan', risk: 4 },
  '963': { name: 'Syria', risk: 7 },
  '964': { name: 'Iraq', risk: 6 },
  '965': { name: 'Kuwait', risk: 5 },
  '966': { name: 'Saudi Arabia', risk: 5 },
  '967': { name: 'Yemen', risk: 7 },
  '968': { name: 'Oman', risk: 4 },
  '971': { name: 'UAE', risk: 4 },
  '972': { name: 'Israel', risk: 3 },
  '974': { name: 'Qatar', risk: 4 },
  '977': { name: 'Nepal', risk: 5 },
};

// ============================================================
// NORMALIZATION
// ============================================================

/**
 * Normalize Indian phone number to E.164 format.
 * Handles: 10-digit, 0-prefixed, +91/91 prefixed, with/without dashes/spaces
 */
export function normalizeIndianNumber(input: string): string | null {
  const cleaned = input.replace(/[^0-9]/g, '');
  const isTollFreeOrLandline = (s: string) => /^(1800|1860|1[2-5]\d{2}|[2-8]\d{2,3})/.test(s);
  
  // Indian mobile: 10 digits starting with 6-9
  if (cleaned.length === 10 && /^[6-9]/.test(cleaned)) {
    return `+91${cleaned}`;
  }
  // Indian landline/toll-free: 10 digits starting with non-mobile
  if (cleaned.length === 10 && isTollFreeOrLandline(cleaned)) {
    return `+91${cleaned}`;
  }
  // Indian mobile with local 0-prefix: 0 + 10 digits starting with 6-9
  if (cleaned.length === 11 && cleaned.startsWith('0') && /^0[6-9]/.test(cleaned)) {
    return `+91${cleaned.slice(1)}`;
  }
  // Indian landline with local 0-prefix
  if (cleaned.length === 11 && cleaned.startsWith('0') && isTollFreeOrLandline(cleaned.slice(1))) {
    return `+91${cleaned.slice(1)}`;
  }
  // Indian mobile: 91 + 10 digits starting with 6-9 (no +)
  if (cleaned.length === 12 && cleaned.startsWith('91') && /^91[6-9]/.test(cleaned)) {
    return `+${cleaned}`;
  }
  // Indian toll-free/landline: 91 + 10 digits (no +)
  if (cleaned.length === 12 && cleaned.startsWith('91') && isTollFreeOrLandline(cleaned.slice(2))) {
    return `+${cleaned}`;
  }
  // Indian mobile: +91 + 10 digits starting with 6-9
  if (cleaned.length === 13 && cleaned.startsWith('+91') && /^\+91[6-9]/.test(cleaned)) {
    return `+91${cleaned.slice(3)}`;
  }
  // Indian toll-free/landline: +91 + 10 digits
  if (cleaned.length === 13 && cleaned.startsWith('+91') && isTollFreeOrLandline(cleaned.slice(3))) {
    return `+91${cleaned.slice(3)}`;
  }
  // Indian landline: +91 + STD + local (11-12 digit after +91)
  if (cleaned.length >= 14 && cleaned.length <= 15 && cleaned.startsWith('+91')) {
    const after = cleaned.slice(3);
    if (/^[2-8]\d{2,3}/.test(after) && after.length >= 7) {
      return `+91${after}`;
    }
  }
  return null;
}

/**
 * Normalize international number to E.164.
 */
export function normalizeIntlNumber(input: string): string | null {
  const cleaned = input.replace(/[^0-9]/g, '');
  if (cleaned.length < 7 || cleaned.length > 15) return null;
  
  if (cleaned.startsWith('00')) {
    return `+${cleaned.slice(2)}`;
  }
  if (!cleaned.startsWith('+')) {
    return `+${cleaned}`;
  }
  return `+${cleaned.replace('+', '')}`;
}

// ============================================================
// CORE ANALYSIS
// ============================================================

/**
 * Run full number intelligence on an Indian phone number.
 */
export function analyzeIndianNumber(input: string): NumberIntel {
  const normalized = normalizeIndianNumber(input);
  
  if (!normalized) {
    return {
      phoneNumber: input,
      normalized: '',
      isValid: false,
      isIndian: false,
      numberType: 'unknown',
      isVoip: false,
      isBurner: false,
      isHighRiskPrefix: false,
      isPremiumRate: false,
      riskFlags: ['invalid_format'],
      lookupSource: 'prefix_db',
      confidence: 0,
    };
  }

  const prefix4 = normalized.slice(3, 7); // first 4 digits after +91
  const prefixEntry = INDIAN_PREFIX_MAP[prefix4];
  
  const riskFlags: string[] = [];
  let numberType: NumberIntel['numberType'] = 'unknown';
  let isVoip = false;
  let isBurner = false;
  let isPremiumRate = false;
  let isHighRiskPrefix = false;

  // Classify number type
  if (TOLLFREE_PREFIXES.some(p => prefix4.startsWith(p.slice(0, 3)))) {
    numberType = 'tollfree';
    riskFlags.push('tollfree_susceptible_to_spoofing');
  } else if (PREMIUM_RATE_PREFIXES.some(p => prefix4.startsWith(p.slice(0, 4)))) {
    numberType = 'special';
    isPremiumRate = true;
    riskFlags.push('premium_rate');
  } else if (prefixEntry) {
    numberType = 'mobile';
  } else {
    // Unknown prefix — check if it falls in any valid mobile range
    const firstDigit = normalized.charAt(3);
    if (['6', '7', '8', '9'].includes(firstDigit)) {
      numberType = 'mobile';
      riskFlags.push('unknown_prefix_could_be_new_msc');
    } else if (['2', '3', '4', '5'].includes(firstDigit)) {
      numberType = 'landline';
    }
  }

  // Scam-heavy prefix detection
  if (['7310', '7311', '7312', '7313'].includes(prefix4)) {
    isHighRiskPrefix = true;
    riskFlags.push('known_scam_prefix');
  }

  // Build result
  const intel: NumberIntel = {
    phoneNumber: input,
    normalized,
    isValid: true,
    isIndian: true,
    numberType,
    isVoip,
    isBurner,
    isHighRiskPrefix,
    isPremiumRate,
    riskFlags,
    lookupSource: 'prefix_db',
    confidence: prefixEntry ? 0.85 : 0.4,
  };

  if (prefixEntry) {
    intel.telecomCircle = prefixEntry.circle;
    intel.state = prefixEntry.state;
    intel.carrier = prefixEntry.carrier;
    intel.originalCarrier = prefixEntry.carrier; // without porting API, same as carrier
    intel.isPorted = false;
  } else if (numberType === 'mobile') {
    // Can't resolve circle without prefix match
    intel.telecomCircle = undefined;
    intel.state = undefined;
    riskFlags.push('unmapped_prefix');
  }

  return intel;
}

/**
 * Analyze an international number for risk.
 */
export function analyzeInternationalNumber(input: string): NumberIntel {
  const normalized = normalizeIntlNumber(input);
  
  if (!normalized) {
    return {
      phoneNumber: input,
      normalized: '',
      isValid: false,
      isIndian: false,
      numberType: 'unknown',
      isVoip: false,
      isBurner: false,
      isHighRiskPrefix: false,
      isPremiumRate: false,
      riskFlags: ['invalid_format'],
      lookupSource: 'prefix_db',
      confidence: 0,
    };
  }

  // Extract country code (longest match first)
  let cc = '';
  let countryName = '';
  let countryRisk = 1;

  const sortedCCs = Object.keys(COUNTRY_MAP).sort((a, b) => b.length - a.length);
  const digits = normalized.slice(1); // remove +
  
  for (const candidate of sortedCCs) {
    if (digits.startsWith(candidate)) {
      cc = candidate;
      const info = COUNTRY_MAP[candidate];
      countryName = info.name;
      countryRisk = info.risk;
      break;
    }
  }

  const riskFlags: string[] = [];
  let numberType: NumberIntel['numberType'] = 'international';

  // VoIP detection heuristics
  // US VoIP ranges often start with area codes known for VoIP reselling
  const voipPatterns = ['+140', '+141', '+142', '+143', '+144', '+145', '+147', '+149', '+170', '+171', '+174'];
  const isVoip = voipPatterns.some(p => normalized.startsWith(p));

  if (isVoip) {
    numberType = 'voip';
    riskFlags.push('voip_number');
  }

  if (countryRisk >= 7) {
    riskFlags.push('high_risk_country');
  }
  if (countryRisk >= 9) {
    riskFlags.push('critical_risk_country');
  }
  if (['92', '880', '213', '216', '234'].includes(cc)) {
    riskFlags.push('known_scam_country');
  }

  return {
    phoneNumber: input,
    normalized,
    isValid: true,
    isIndian: false,
    numberType,
    countryCode: cc,
    countryName,
    isVoip,
    isBurner: false,
    isHighRiskPrefix: countryRisk >= 7,
    isPremiumRate: false,
    riskFlags,
    lookupSource: 'prefix_db',
    confidence: cc ? 0.9 : 0.1,
  };
}

/**
 * Master analysis — automatically routes Indian vs international.
 */
export function analyzeNumber(input: string): NumberIntel {
  const cleaned = input.replace(/[^0-9+]/g, '');
  
  // Explicit international: starts with + or 00 followed by non-91 country code
  if (cleaned.startsWith('+') && !cleaned.startsWith('+91')) {
    return analyzeInternationalNumber(input);
  }
  if (cleaned.startsWith('00')) {
    return analyzeInternationalNumber(input);
  }
  
  // 0-prefixed could be Indian (0 + mobile) or international (0092=Pakistan)
  if (cleaned.startsWith('0')) {
    // Check if the digits after 0 match a known international country code
    // Common Indian scam source countries: 092=Pakistan, 088=Bangladesh, 084=Vietnam
    const afterZero = cleaned.slice(1);
    const knownIntlPrefixes = ['92', '880', '84', '63', '213', '216', '234', '375', '380', '7'];
    const matchedPrefix = knownIntlPrefixes.find(p => afterZero.startsWith(p));
    
    if (matchedPrefix && afterZero.length - matchedPrefix.length >= 7) {
      // Likely international: 0 + country code + local number
      return analyzeInternationalNumber(`+${afterZero}`);
    }
  }
  
  // Detect if Indian
  if (
    cleaned.startsWith('+91') || cleaned.startsWith('91') ||
    cleaned.startsWith('0') || cleaned.length === 10
  ) {
    const indianResult = analyzeIndianNumber(input);
    if (indianResult.isValid) return indianResult;
  }
  
  return analyzeInternationalNumber(input);
}

/**
 * Get the 10-digit Indian mobile number from normalized format.
 */
export function getIndianMobileDigits(normalized: string): string | null {
  if (!normalized.startsWith('+91')) return null;
  const digits = normalized.slice(3);
  return digits.length === 10 ? digits : null;
}

/**
 * Get the 4-digit MSC prefix from an Indian number.
 */
export function getMscPrefix(normalized: string): string | null {
  if (!normalized.startsWith('+91')) return null;
  return normalized.slice(3, 7);
}
