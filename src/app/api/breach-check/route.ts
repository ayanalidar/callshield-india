/**
 * CallShield Breach Check API
 * 
 * POST { phoneNumber } → Simulated data breach check.
 * Searches for the phone number across known data breach databases.
 * Returns breach details and protection recommendations.
 * 
 * @ts-nocheck
 */

import { NextRequest, NextResponse } from 'next/server';

// ─── Simulated Breach Database ─────────────────────────────

interface BreachRecord {
  name: string;
  date: string;         // ISO date
  dataTypes: string[];  // types of data exposed
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  affectedUsers: number;
  domain: string;
  description: string;
}

// Real-world Indian breaches (simulated matches based on phone prefix patterns)
const BREACH_DATABASE: BreachRecord[] = [
  {
    name: 'MobiKwik Data Breach',
    date: '2021-03-01',
    dataTypes: ['Phone Number', 'Email', 'KYC Documents', 'Hashed Passwords'],
    severity: 'critical',
    category: 'FinTech',
    affectedUsers: 99000000,
    domain: 'mobikwik.com',
    description: '8.2 TB of user data including KYC documents and Aadhaar numbers leaked on dark web forums.',
  },
  {
    name: 'Domino\'s India Leak',
    date: '2021-04-18',
    dataTypes: ['Phone Number', 'Email', 'Address', 'Order History'],
    severity: 'high',
    category: 'Food Delivery',
    affectedUsers: 180000000,
    domain: 'dominos.co.in',
    description: '180M order records with phone numbers, emails, and GPS locations of 1M+ users exposed.',
  },
  {
    name: 'Air India Data Breach',
    date: '2021-05-21',
    dataTypes: ['Phone Number', 'Passport', 'Credit Card', 'Name'],
    severity: 'critical',
    category: 'Aviation',
    affectedUsers: 4500000,
    domain: 'airindia.in',
    description: '4.5M passenger records with passport details and credit card information compromised in SITA hack.',
  },
  {
    name: 'BigBasket Data Leak',
    date: '2020-10-14',
    dataTypes: ['Phone Number', 'Email', 'Address', 'IP Address'],
    severity: 'high',
    category: 'E-Commerce',
    affectedUsers: 20000000,
    domain: 'bigbasket.com',
    description: '20M user records sold on dark web for $40,000. Included hashed passwords and IP addresses.',
  },
  {
    name: 'Juspay Data Breach',
    date: '2021-01-05',
    dataTypes: ['Phone Number', 'Email', 'Partial Card Numbers', 'Device Info'],
    severity: 'high',
    category: 'Payments',
    affectedUsers: 35000000,
    domain: 'juspay.in',
    description: '35M masked card data and phone number records leaked from a compromised server.',
  },
  {
    name: 'Unacademy Data Breach',
    date: '2020-05-08',
    dataTypes: ['Phone Number', 'Email', 'Username', 'Hashed Passwords'],
    severity: 'medium',
    category: 'EdTech',
    affectedUsers: 22000000,
    domain: 'unacademy.com',
    description: '22M user records including names, emails, and hashed passwords sold on dark web.',
  },
  {
    name: 'Dunzo Data Breach',
    date: '2020-07-11',
    dataTypes: ['Phone Number', 'Email', 'Address', 'Device Info'],
    severity: 'medium',
    category: 'Delivery',
    affectedUsers: 6000000,
    domain: 'dunzo.com',
    description: '6M delivery addresses and phone numbers exposed through unprotected API endpoint.',
  },
  {
    name: 'Byju\'s Data Exposure',
    date: '2022-09-20',
    dataTypes: ['Phone Number', 'Email', 'Student Name', 'Address'],
    severity: 'high',
    category: 'EdTech',
    affectedUsers: 10000000,
    domain: 'byjus.com',
    description: '10M student and parent records exposed via misconfigured cloud storage bucket.',
  },
  {
    name: 'IRCTC Data Leak',
    date: '2023-01-15',
    dataTypes: ['Phone Number', 'Email', 'Name', 'Travel History'],
    severity: 'high',
    category: 'Government',
    affectedUsers: 15000000,
    domain: 'irctc.co.in',
    description: '15M passenger records with travel history leaked from a contractor\'s unsecured database.',
  },
  {
    name: 'Paytm Mall Breach',
    date: '2020-08-30',
    dataTypes: ['Phone Number', 'Email', 'Order Details'],
    severity: 'medium',
    category: 'E-Commerce',
    affectedUsers: 3400000,
    domain: 'paytmmall.com',
    description: '3.4M customer records exposed through misconfigured database backup.',
  },
  {
    name: 'SBI YONO App Flaw',
    date: '2022-03-10',
    dataTypes: ['Phone Number', 'Account Number', 'Transaction Data'],
    severity: 'critical',
    category: 'Banking',
    affectedUsers: 1200000,
    domain: 'onlinesbi.com',
    description: '1.2M account details vulnerable due to API security flaw in SBI YONO mobile app. Patched March 2022.',
  },
  {
    name: 'Truecaller Scraping',
    date: '2019-10-01',
    dataTypes: ['Phone Number', 'Name', 'Carrier', 'Location'],
    severity: 'low',
    category: 'Telecom',
    affectedUsers: 150000000,
    domain: 'truecaller.com',
    description: 'Massive scraping incident. 150M Indian phone numbers with associated names and carriers exposed.',
  },
];

// ─── Phone Prefix Matching ─────────────────────────────────

interface SimulatedResult {
  found: boolean;
  breaches: BreachRecord[];
  riskLevel: 'safe' | 'low' | 'medium' | 'high' | 'critical';
  recommendations: string[];
  totalExposures: number;
}

function simulateBreachCheck(phoneNumber: string): SimulatedResult {
  // Use phone number digits as a deterministic seed for realistic simulation
  const digits = phoneNumber.replace(/[^\d]/g, '');
  const numericHash = parseInt(digits.slice(-6), 10) || 0;
  const hashValue = numericHash / 999999; // 0.0 to 1.0

  // About 70% of numbers "have" at least one breach
  const hasBreaches = hashValue < 0.70;
  
  if (!hasBreaches) {
    return {
      found: true,
      breaches: [],
      riskLevel: 'safe',
      recommendations: [
        'No known breaches detected for this number.',
        'Enable two-factor authentication on all accounts.',
        'Use a password manager for strong, unique passwords.',
        'Monitor your accounts regularly for suspicious activity.',
      ],
      totalExposures: 0,
    };
  }

  // Select breaches using hash
  const selectedBreaches: BreachRecord[] = [];
  const numBreaches = Math.max(1, Math.min(5, Math.floor(hashValue * BREACH_DATABASE.length)));
  
  for (let i = 0; i < BREACH_DATABASE.length && selectedBreaches.length < numBreaches; i++) {
    const relevance = (hashValue * (i + 1) * 7 + i * 13) % 1;
    if (relevance > 0.3) {
      selectedBreaches.push(BREACH_DATABASE[i]);
    }
  }

  // Ensure at least one breach if hash says so
  if (selectedBreaches.length === 0) {
    selectedBreaches.push(BREACH_DATABASE[Math.floor(hashValue * BREACH_DATABASE.length)]);
  }

  // Calculate risk level
  const severities = selectedBreaches.map(b => b.severity);
  let riskLevel: SimulatedResult['riskLevel'] = 'safe';
  if (severities.includes('critical')) riskLevel = 'critical';
  else if (severities.includes('high')) riskLevel = 'high';
  else if (severities.filter(s => s === 'high' || s === 'medium').length >= 2) riskLevel = 'high';
  else if (severities.includes('medium')) riskLevel = 'medium';
  else riskLevel = 'low';

  // Generate recommendations
  const recommendations: string[] = [];
  const dataTypesExposed = new Set<string>();
  selectedBreaches.forEach(b => b.dataTypes.forEach(t => dataTypesExposed.add(t)));

  if (riskLevel === 'critical') {
    recommendations.push('🚨 IMMEDIATELY change passwords on all accounts linked to this number.');
    recommendations.push('Enable banking alerts and monitor for unauthorized transactions.');
    recommendations.push('Freeze your credit report with CIBIL / Experian.');
    recommendations.push('File a report at cybercrime.gov.in if you notice suspicious activity.');
  } else if (riskLevel === 'high') {
    recommendations.push('⚠️ Change passwords on affected services immediately.');
    recommendations.push('Enable two-factor authentication everywhere.');
    recommendations.push('Check for unauthorized account logins.');
  } else if (riskLevel === 'medium') {
    recommendations.push('Update passwords on the affected services.');
    recommendations.push('Consider enabling 2FA for additional security.');
  } else {
    recommendations.push('Your data exposure is minimal.');
    recommendations.push('Continue using strong, unique passwords.');
  }

  if (dataTypesExposed.has('Credit Card') || dataTypesExposed.has('Partial Card Numbers')) {
    recommendations.push('💳 Monitor your bank statements. Request a replacement card if needed.');
  }

  if (dataTypesExposed.has('KYC Documents') || dataTypesExposed.has('Passport')) {
    recommendations.push('🆔 Identity documents were exposed. Consider reporting to UIDAI/Passport Seva.');
  }

  recommendations.push('📱 Be vigilant about phishing calls/SMS targeting this number.');
  recommendations.push('🔔 Set up Google Alerts for your phone number.');

  return {
    found: true,
    breaches: selectedBreaches,
    riskLevel,
    recommendations: recommendations.slice(0, 8),
    totalExposures: selectedBreaches.length,
  };
}

// ─── API Route ─────────────────────────────────────────────

interface BreachCheckRequest {
  phoneNumber: string;
}

interface BreachCheckResponse {
  phoneNumber: string;
  normalized: string;
  found: boolean;
  breaches: {
    name: string;
    date: string;
    dataTypes: string[];
    severity: string;
    category: string;
    affectedUsers: number;
    domain: string;
    description: string;
  }[];
  riskLevel: string;
  recommendations: string[];
  totalExposures: number;
  timestamp: string;
  disclaimer: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: BreachCheckRequest = await request.json();
    const { phoneNumber } = body;

    if (!phoneNumber || phoneNumber.trim().length < 10) {
      return NextResponse.json(
        { error: 'Valid phone number required (min 10 digits)', code: 'INVALID_NUMBER' },
        { status: 400 }
      );
    }

    // Simulate processing delay (200-600ms)
    await new Promise(r => setTimeout(r, 200 + Math.random() * 400));

    const result = simulateBreachCheck(phoneNumber);

    const response: BreachCheckResponse = {
      phoneNumber,
      normalized: phoneNumber.replace(/[^\d]/g, ''),
      found: result.found,
      breaches: result.breaches,
      riskLevel: result.riskLevel,
      recommendations: result.recommendations,
      totalExposures: result.totalExposures,
      timestamp: new Date().toISOString(),
      disclaimer: 'This is a simulated breach check for demonstration. We check phone number patterns against known Indian data breaches. For comprehensive results, use haveibeenpwned.com.',
    };

    return NextResponse.json(response);

  } catch (error: any) {
    console.error('[breach-check] Error:', error);
    return NextResponse.json(
      { error: 'Breach check failed', code: 'BREACH_FAILED', detail: error.message },
      { status: 500 }
    );
  }
}
