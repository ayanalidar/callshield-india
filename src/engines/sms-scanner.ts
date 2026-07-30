/**
 * CallShield SMS / WhatsApp Scam Scanner
 * 
 * Detects scam patterns in message text using multi-layered analysis:
 * 1. Regex pattern matching (bank OTP, UPI fraud, etc.)
 * 2. Suspicious link detection (shorteners, lookalike domains)
 * 3. Urgency language scoring
 * 4. Indian-specific scam script matching
 */

export interface ScanResult {
  isScam: boolean;
  confidence: number;          // 0-1
  threatScore: number;         // 0-100
  verdict: 'safe' | 'suspicious' | 'scam' | 'critical';

  matchedPatterns: MatchedPattern[];
  detectedLinks: DetectedLink[];
  urgencyScore: number;
  
  evidence: string[];
  warnings: string[];
  recommendations: string[];
}

export interface MatchedPattern {
  category: string;
  pattern: string;
  matchedText: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description?: string;
}

export interface DetectedLink {
  url: string;
  isSuspicious: boolean;
  reason: string;
  domain: string;
  isShortener: boolean;
}

interface ScanPattern {
  category: string;
  regex: RegExp;
  severity: 'low' | 'medium' | 'high' | 'critical';
  weight: number;
  description: string;
}

// ============================================================
// SCAN PATTERNS
// ============================================================

const SCAN_PATTERNS: ScanPattern[] = [

  // === CATCH-ALL: Account/UPI/Bank blocked or verify + link (most common) ===
  {
    category: 'account_blocked_link',
    regex: /(?:account|bank|upi|card|atm|payment|bill|electricity|kyc|aadhaar|tax|income).{0,30}(?:block|deactivat|suspend|hold|restrict|freeze|verif|update|renew|reactivat).{0,50}(?:http|click|link|visit|tap|bit\.ly|tinyurl|short\.url)/i,
    severity: 'critical',
    weight: 50,
    description: 'Account blocked/verify scam with suspicious link',
  },

  // === BANK / PAYMENT SCAMS ===
  {
    category: 'bank_otp',
    regex: /(?:otp|one.time.password|verification.code).{0,20}(?:share|send|batana|dijiye|bolna|tell)/i,
    severity: 'critical',
    weight: 40,
    description: 'OTP sharing request detected',
  },
  {
    category: 'upi_blocked',
    regex: /(?:your|aapka).{0,10}(?:upi|account|bank.account|khata).{0,10}(?:block|band|suspend|deactivat|nilanbit)/i,
    severity: 'critical',
    weight: 45,
    description: 'UPI/bank account blocked scam',
  },
  {
    category: 'kyc_expired',
    regex: /(?:kyc|know.your.customer).{0,20}(?:expir|pending|khatam|samapt|update|verify|re.kyc)/i,
    severity: 'high',
    weight: 30,
    description: 'KYC expiration/update scam',
  },
  {
    category: 'card_blocked',
    regex: /(?:your|aapka).{0,20}(?:atm|debit|credit|card).{0,10}(?:block|deactivat|hotlist|hold)/i,
    severity: 'high',
    weight: 35,
    description: 'Card blocked scam',
  },

  // === GOVT IMPERSONATION ===
  {
    category: 'income_tax',
    regex: /(?:income.tax|it.department|aykar.vibhag).{0,20}(?:refund|notice|fine|penalty|jurmana|raid)/i,
    severity: 'high',
    weight: 35,
    description: 'Income Tax impersonation',
  },
  {
    category: 'electricity_bill',
    regex: /(?:electricity|bijli|power).{0,10}(?:bill|due|bakaya|pay|cut|disconnect|connection.*cut)/i,
    severity: 'high',
    weight: 30,
    description: 'Electricity bill scam',
  },
  {
    category: 'gas_subsidy',
    regex: /(?:gas|lpg).{0,10}(?:subsidy|refund|kyc|linking|aadhaar|link)/i,
    severity: 'medium',
    weight: 20,
    description: 'Gas subsidy scam',
  },

  // === PARCEL / CUSTOMS ===
  {
    category: 'fedex_parcel',
    regex: /(?:fedex|blue.dart|courier|parcel|shipment|delivery).{0,20}(?:stuck|hold|customs|drugs|illegal|detain)/i,
    severity: 'critical',
    weight: 45,
    description: 'FedEx/parcel customs scam',
  },
  {
    category: 'customs_fee',
    regex: /(?:customs|custom).{0,10}(?:fee|shulk|charge|clearance|pay|payment)/i,
    severity: 'high',
    weight: 30,
    description: 'Customs fee demand',
  },

  // === LOAN / MONEY SCAMS ===
  {
    category: 'instant_loan',
    regex: /(?:instant|turant|5.minut|within.\d+.min).{0,20}(?:loan|credit|approve|disburse)/i,
    severity: 'high',
    weight: 25,
    description: 'Instant loan bait',
  },
  {
    category: 'no_cibil',
    regex: /(?:no.cibil|without.cibil|bad.cibil|bina.*cibil).{0,10}(?:loan|ok|approved|eligible)/i,
    severity: 'high',
    weight: 25,
    description: 'No CIBIL loan scam',
  },
  {
    category: 'lottery_won',
    regex: /(?:won|prize|lottery|jackpot|kbc|lucky.draw|bonus).{0,30}\d+[,.\d]*\s*(?:lakh|crore|rupee|rs|₹|\$)/i,
    severity: 'medium',
    weight: 20,
    description: 'Lottery/prize scam',
  },
  {
    category: 'investment_returns',
    regex: /(?:earn|double|triple|3x|guaranteed.return|daily.profit|daily.income).{0,20}(?:invest|crypto|bitcoin|trade)/i,
    severity: 'high',
    weight: 30,
    description: 'Investment/Ponzi scam',
  },

  // === JOB SCAMS ===
  {
    category: 'work_from_home',
    regex: /(?:work.from.home|ghar.baithe|part.time).{0,30}(?:earn|income|salary|rupee|rs\.?\s*\d+)/i,
    severity: 'medium',
    weight: 20,
    description: 'Fake work-from-home job',
  },
  {
    category: 'job_offer',
    regex: /(?:hiring|vacancy|job.offer|resume.select).{0,10}(?:whatsapp|call.now|contact.now|urgent.hiring)/i,
    severity: 'medium',
    weight: 20,
    description: 'Fake job offer',
  },

  // === SEXTORTION ===
  {
    category: 'video_call_recorded',
    regex: /(?:video.*call).{0,30}(?:record|screen.record|hack|compromise|expose|blackmail|pay).{0,20}(?:paytm|phonepe|gpay|upi|rupee|money)/i,
    severity: 'critical',
    weight: 50,
    description: 'Sextortion/blackmail scam',
  },

  // === AADHAAR SCAMS ===
  {
    category: 'aadhaar_blocked',
    regex: /(?:aadhaar|aadhar).{0,20}(?:block|deactivat|suspend|verify|update|link.bank|confirm.number)/i,
    severity: 'high',
    weight: 35,
    description: 'Aadhaar scam',
  },

  // === REMOTE ACCESS ===
  {
    category: 'teamviewer_anydesk',
    regex: /(?:teamviewer|anydesk|quick.support|screen.shar|remote.*control|remote.*access).{0,20}(?:install|download|app|click.link)/i,
    severity: 'critical',
    weight: 45,
    description: 'Remote access/screen share scam',
  },
  {
    category: 'phonepe_verify',
    regex: /(?:phonepe|google.pay|paytm|gpay|bhim).{0,10}(?:verify|verification|confirm|kyc|reward|bonus|screen.shar|remote)/i,
    severity: 'high',
    weight: 30,
    description: 'Payment app verification scam',
  },

  // === CATCH-ALL: Urgent KYC + link ===
  {
    category: 'urgent_kyc_link',
    regex: /(?:kyc|pan.card|aadhaar).{0,40}(?:http|click|link|visit|bit\.ly|tiny|short)/i,
    severity: 'high',
    weight: 40,
    description: 'KYC/Aadhaar update scam with link',
  },
  {
    category: 'payment_required',
    regex: /(?:payment|pay|paytm|phonepe|gpay|deposit|transfer).{0,20}(?:required|require|needed|mandatory|avoid.block|avoid.penalty|fine)/i,
    severity: 'high',
    weight: 30,
    description: 'Payment demanded to avoid penalty/block',
  },
  {
    category: 'url_shortener',
    regex: /https?:\/\/(?:bit\.ly|tinyurl\.com|t\.co|goo\.gl|is\.gd|ow\.ly|buff\.ly|tiny\.cc|shorturl\.at|cutt\.ly|rb\.gy|rebrand\.ly|short\.link|bit\.do)\//i,
    severity: 'medium',
    weight: 15,
    description: 'URL shortener link (hides destination)',
  },
];

// ============================================================
// SUSPICIOUS LINK PATTERNS
// ============================================================

const URL_SHORTENERS = [
  'bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'ow.ly',
  'is.gd', 'buff.ly', 'tiny.cc', 'shorturl.at', 'cutt.ly',
  'rb.gy', 'rebrand.ly', 'shorte.st', 'bc.vc', 'adf.ly',
  'bit.do', 'clck.ru', 'chilp.it', 'short.link',
];

const SUSPICIOUS_TLD = [
  '.tk', '.ml', '.ga', '.cf', '.gq',
  '.xyz', '.top', '.club', '.online', '.site',
];

const LOOKALIKE_PATTERNS = [
  { brand: 'SBI', matches: ['sbionline', 'sbi-banking', 'sbi-verify', 'sbikyc', 'sbi-kyc'] },
  { brand: 'ICICI', matches: ['icici-bank', 'icici-verify', 'icici-update', 'icici-kyc'] },
  { brand: 'HDFC', matches: ['hdfc-bank', 'hdfc-verify', 'hdfc-net', 'hdfcbank'] },
  { brand: 'Netflix', matches: ['netflix-india', 'netflix-billing', 'netflix-renew'] },
  { brand: 'Amazon', matches: ['amazon-in', 'amazon-india', 'amazon-refund', 'amazon-verify'] },
  { brand: 'Flipkart', matches: ['flipkart-offer', 'flipkart-winner', 'flipkart-deal'] },
  { brand: 'Paytm', matches: ['paytm-kyc', 'paytm-verify', 'paytm-reward', 'paytm-offer'] },
  { brand: 'PhonePe', matches: ['phonepe-kyc', 'phonepe-reward', 'phonepe-offer'] },
  { brand: 'GPay', matches: ['gpay-reward', 'googlepay-offer', 'gpay-verify'] },
  { brand: 'Aadhaar', matches: ['aadhaar-update', 'aadhaar-verify', 'uidai-verify'] },
  { brand: 'IRCTC', matches: ['irctc-confirm', 'irctc-ticket', 'irctc-login', 'irctc-verify'] },
  { brand: 'UPI', matches: ['upi-verify', 'upi-kyc', 'upi-update', 'upi-block'] },
];

// ============================================================
// URGENCY WORDS
// ============================================================

const URGENCY_PATTERNS: { regex: RegExp; weight: number }[] = [
  { regex: /\b(?:immediately|instant|turant?|jaldi|avilamb)\b/i, weight: 10 },
  { regex: /\b(?:urgent|emergency|jaruri|emarjensi|atigh)\b/i, weight: 12 },
  { regex: /\b(?:action.required|immediate.action|karyawahi.jaruri)\b/i, weight: 12 },
  { regex: /\b(?:final.notice|antim.suchana|last.warning|last.reminder|antim.avsar)\b/i, weight: 14 },
  { regex: /\b(?:account.{0,10}(?:close|band|deactivat|suspend))\b/i, weight: 14 },
  { regex: /\b(?:will.be.disconnect|cut.off|disable|deactivat.*soon|blocked.*soon)\b/i, weight: 12 },
  { regex: /\b(?:call.now|abhi.call|ring.now|contact.now|turant.contact)\b/i, weight: 8 },
  { regex: /\b(?:limited.time|simit.samay|today.only|aaj.hi|within.*hour)\b/i, weight: 10 },
];

// ============================================================
// ANALYSIS FUNCTIONS
// ============================================================

function detectLinks(text: string): DetectedLink[] {
  const urlRegex = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi;
  const urls = text.match(urlRegex) || [];
  
  return urls.map(url => {
    let domain = '';
    try {
      domain = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
    } catch { domain = url; }

    const isShortener = URL_SHORTENERS.some(s => domain === s || domain.endsWith('.' + s));
    const suspiciousTld = SUSPICIOUS_TLD.some(tld => domain.endsWith(tld));
    
    let lookalikeReason = '';
    const brandMatch = LOOKALIKE_PATTERNS.find(b =>
      b.matches.some(m => domain.includes(m)) && !domain.includes(b.brand.toLowerCase() + '.com')
    );
    if (brandMatch) {
      lookalikeReason = `Possible ${brandMatch.brand} lookalike domain`;
    }

    const reasons: string[] = [];
    if (isShortener) reasons.push('URL shortener (hides destination)');
    if (suspiciousTld) reasons.push(`Suspicious TLD (.${domain.split('.').pop()})`);
    if (lookalikeReason) reasons.push(lookalikeReason);

    if (/^https?:\/\/\d+\.\d+\.\d+\.\d+/.test(url)) {
      reasons.push('IP address URL (not a domain)');
    }

    return {
      url,
      isSuspicious: reasons.length > 0,
      reason: reasons.join('; ') || 'No issues detected',
      domain,
      isShortener,
    };
  });
}

function matchPatterns(text: string, normalized: string): MatchedPattern[] {
  const matches: MatchedPattern[] = [];
  
  for (const pattern of SCAN_PATTERNS) {
    const match = normalized.match(pattern.regex);
    if (match) {
      matches.push({
        category: pattern.category,
        pattern: pattern.regex.source,
        matchedText: match[0].substring(0, 80),
        severity: pattern.severity,
        description: pattern.description,
      });
    }
  }
  
  return matches;
}

function calculateUrgencyScore(normalized: string): number {
  let score = 0;
  for (const up of URGENCY_PATTERNS) {
    if (up.regex.test(normalized)) {
      score += up.weight;
    }
  }
  return Math.min(50, score);
}

// ============================================================
// MAIN SCAN FUNCTION
// ============================================================

export function scanMessage(message: string): ScanResult {
  const normalized = message
    .toLowerCase()
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim();

  const detectedLinks = detectLinks(message);
  const matchedPatterns = matchPatterns(message, normalized);
  const urgencyScore = calculateUrgencyScore(normalized);

  let patternScore = 0;
  const evidence: string[] = [];
  const warnings: string[] = [];
  
  for (const mp of matchedPatterns) {
    patternScore += {
      'critical': 40,
      'high': 30,
      'medium': 20,
      'low': 10,
    }[mp.severity] || 0;
    
    evidence.push(`[${mp.severity.toUpperCase()}] ${mp.description}: matched "${mp.matchedText}"`);
  }

  const uniqueCategories = new Set(matchedPatterns.map(m => m.category));
  
  let linkScore = 0;
  for (const link of detectedLinks) {
    if (link.isSuspicious) {
      linkScore += link.isShortener ? 15 : 20;
      warnings.push(`Suspicious link: ${link.domain} — ${link.reason}`);
      evidence.push(`Suspicious link detected: ${link.domain} (${link.reason})`);
    }
  }
  linkScore = Math.min(50, linkScore);

  const phoneMatches = normalized.match(/(?:\+91[-\s]?)?[6-9]\d{9}/g) || [];
  if (phoneMatches.length > 0) {
    evidence.push(`Contains ${phoneMatches.length} phone number(s): ${phoneMatches.join(', ')}`);
  }

  const threatScore = Math.min(100, patternScore + linkScore + urgencyScore);
  
  const confidence = Math.min(0.99,
    0.3 + (uniqueCategories.size * 0.1) + (detectedLinks.filter(l => l.isSuspicious).length * 0.1) + (urgencyScore / 100)
  );

  let verdict: ScanResult['verdict'];
  const criticalPatterns = matchedPatterns.filter(m => m.severity === 'critical');
  
  if (criticalPatterns.length >= 2 || threatScore >= 80) {
    verdict = 'critical';
  } else if (threatScore >= 60 || criticalPatterns.length >= 1) {
    verdict = 'scam';
  } else if (threatScore >= 35 || uniqueCategories.size >= 2) {
    verdict = 'suspicious';
  } else {
    verdict = 'safe';
  }

  const isScam = verdict === 'scam' || verdict === 'critical';

  const recommendations: string[] = [];
  if (isScam) {
    recommendations.push('This message appears to be a scam. Do NOT click any links or share personal information.');
    recommendations.push('Block the sender and report the number to CallShield.');
    if (detectedLinks.some(l => l.isSuspicious)) {
      recommendations.push('Do NOT visit any links in this message.');
    }
  } else if (verdict === 'suspicious') {
    recommendations.push('This message has suspicious patterns. Verify through official channels before responding.');
    recommendations.push('If you did not expect this message, it is likely a scam.');
  } else {
    recommendations.push('This message appears safe, but always verify unexpected communications.');
  }

  return {
    isScam,
    confidence,
    threatScore,
    verdict,
    matchedPatterns,
    detectedLinks,
    urgencyScore,
    evidence,
    warnings,
    recommendations,
  };
}

export function isScamMessage(message: string): boolean {
  return scanMessage(message).isScam;
}

export function scanMessageQuick(message: string): string {
  const result = scanMessage(message);
  const flags = [
    result.verdict === 'critical' || result.verdict === 'scam' ? 'SCAM' :
    result.verdict === 'suspicious' ? 'SUSPICIOUS' : 'SAFE',
    `Score: ${result.threatScore}/100`,
    result.matchedPatterns.length > 0 ?
      `${result.matchedPatterns.length} red flags` : 'No red flags',
  ];
  return flags.join(' | ');
}
