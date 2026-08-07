/**
 * CallShield Decoy AI API
 * 
 * POST { scammerMessage } → AI decoy response.
 * Pretends to be a confused elder, gives fake OTPs/UPI IDs,
 * and asks scammers to repeat themselves — wasting their time.
 * Also collects intel on new numbers, UPI IDs, and script phrases.
 * 
 * @ts-nocheck
 */

import { NextRequest, NextResponse } from 'next/server';

// ─── Templates ─────────────────────────────────────────────

const ELDER_SCENARIOS = [
  'hearing_impaired',
  'tech_confused',
  'overly_trusting',
  'distracted_grandparent',
  'worried_parent',
];

interface DecoyTemplate {
  tone: string;
  openings: string[];
  fakeOtps: string[];
  fakeUpiIds: string[];
  confusions: string[];
  closings: string[];
  delayTactics: string[];
}

const TEMPLATES: Record<string, DecoyTemplate> = {
  hearing_impaired: {
    tone: 'friendly elder with hearing issues',
    openings: [
      'Beta, zor se bolo na... sunai nahi de raha. Kaun bol rahe ho?',
      'Hello? Hello? Koi hai? Awaz bahut dheemi aa rahi hai beta.',
      'Kaun? Kaun bol raha hai? Mera phone theek se kaam nahi kar raha.',
    ],
    fakeOtps: ['8569', '2947', '1735', '4082', '9613'],
    fakeUpiIds: ['rameshkumar1952@okhdfc', 'senior.citizen.del@oksbi', 'pensioner.ramesh@okaxis'],
    confusions: [
      'OTP? Beta OTP kya hota hai? Mujhe to bas missed calls aate hain.',
      'Achha... to aap bank se ho? Mera to passbook wala account hai, OTP nahi aata usme.',
      'Beta ek kaam karo, mera beta office se aane do, woh karega yeh sab.',
    ],
    closings: [
      'Theek hai beta, main thodi der mein karta hoon. Abhi thoda kaam hai.',
      'Achha beta, tumhara number save kar leta hoon. Kya naam bataya aapne?',
    ],
    delayTactics: [
      'Ruko beta, chashma dhundh raha hoon... phone number padhna hai.',
      'Ek minute beta, doorbell baj rahi hai. Main abhi aaya.',
    ],
  },
  tech_confused: {
    tone: 'technologically challenged elder',
    openings: [
      'Arre beta, yeh smartphone hai na? Mujhe samajh nahi aata. Kaunsa button dabana hai?',
      'Namaste beta! Aapne message kiya? Main WhatsApp nahi chalata, bas phone uthata hoon.',
      'Beta yeh Google Pay kya hota hai? Meri beti ne install kar diya tha par main bhool gaya.',
    ],
    fakeOtps: ['5421', '7038', '1864', '3290', '6157'],
    fakeUpiIds: ['dadi.ji.1948@okicici', 'retired.teacher@okhdfc', 'sharma.ji.indore@paytm'],
    confusions: [
      'UPI? Beta woh kya hai? Mere paas to sirf ATM card hai, woh bhi expired ho gaya.',
      'Aap payment ki baat kar rahe ho? Main to bas kirane ki dukaan pe cash diya karta hoon.',
      'Beta screen pe kuch numbers aaye hain, main kya karoon? Cancel dabaa doon?',
    ],
    closings: [
      'Beta main apni beti ko bulata hoon. Woh engineer hai, woh samajh legi.',
      'Achha beta, thodi der baad message karta hoon. Abhi net slow ho raha hai.',
    ],
    delayTactics: [
      'Ruko beta, phone charge lagana hai. Battery 2% bachi hai.',
      'Beta WiFi ka password bhool gaya. Data khatam ho gaya hai shayad.',
    ],
  },
  overly_trusting: {
    tone: 'friendly, overly trusting grandparent',
    openings: [
      'Haan beta, bolo bolo! Bahut din baad kisi ne phone kiya. Aap kaun?',
      'Arre wah! Aap bank se ho? Bahut achhe! Mera pension account SBI mein hai.',
      'Beta tumhari awaz to mere pote jaisi hai. Kaun si branch se bol rahe ho?',
    ],
    fakeOtps: ['9927', '3351', '4780', '2236', '8092'],
    fakeUpiIds: ['nanaji.lucknow@oksbi', 'happy.grandpa@okicici', 'sitaram.sharma@paytm'],
    confusions: [
      'Balance check karna hai? Haan haan, batata hoon... par mera account number yaad nahi. Kya main apni diary dekh loon?',
      'Beta tum to bahut acche ho, free mein help kar rahe ho. Aajkal ke bachche to time nahi dete.',
      'Toh aapke hisaab se mera account block ho gaya? Arre bhagwan! Kya karna padega?',
    ],
    closings: [
      'Beta tumhara number le leta hoon. Kal subah phone karoge? Main diary nikaal kar rakhunga.',
      'Bahut bahut dhanyavad beta! Bhagwan tumhara bhala kare.',
    ],
    delayTactics: [
      'Arre beta, meri tabiyat thodi kharab hai. Thodi der baat karoge? Dawa leni hai.',
      'Beta ghar pe mehmaan aa gaye hain. 10 minute baad phone kar sakte ho?',
    ],
  },
  distracted_grandparent: {
    tone: 'caring but easily distracted elder',
    openings: [
      'Ek minute beta, pota rone laga. Haan bolo, kaun?',
      'Haan ji bolo... Arre Chintu, woh ball mat feko! Sorry beta, bolo.',
      'Hello! TV ki awaz kam kar do koi! Haan beta, sunai de raha hai ab.',
    ],
    fakeOtps: ['7714', '6302', '5981', '4429', '1078'],
    fakeUpiIds: ['dadaji.surat@okhdfc', 'grandpa.ramesh@oksbi', 'pensioner.delhi@paytm'],
    confusions: [
      'Beta tumne kaha OTP bheja? Mujhe to bas WhatsApp pe good morning aate hain.',
      'Account number? Ruko main apni purani diary nikaalta hoon... kahin rakhi thi.',
      'Beta pin code pooch rahe ho? Mera ghar ka pin code hai 110001. Sahi hai?',
    ],
    closings: [
      'Beta pota school se aa gaya. Main baad mein phone karta hoon!',
      'Achha beta rakhata hoon. Bahut shor ho raha hai ghar mein.',
    ],
    delayTactics: [
      'Arre beta, doodhwala aa gaya. 5 minute ruko...',
      'Beta pressure cooker ki seeti baj rahi hai. Gas band karni hai.',
    ],
  },
  worried_parent: {
    tone: 'anxious parent worried about their child',
    openings: [
      'Hello? Kya meri beti ke baare mein phone kiya? Woh theek to hai?',
      'Kaun bol raha hai? Police se ho? Meri beti ke saath kuch hua kya?',
      'Beta tum bank se ho? Mera beta bhi bank mein kaam karta hai. Shubham Naik, jaante ho?',
    ],
    fakeOtps: ['8934', '5621', '3147', '7096', '2480'],
    fakeUpiIds: ['worried.mom@okhdfc', 'anxious.parent@oksbi', 'familyfirst@paytm'],
    confusions: [
      'Police verification? Beta meri beti to doctor hai, uska kuch galat nahi ho sakta.',
      'Arre mera to beta khud IT cell mein hai. Usse baat karwa doon? Woh sab sambhal lega.',
      'Beta aap kaunse department se ho? Mera close friend DIG hai Delhi Police mein.',
    ],
    closings: [
      'Beta main apne bete ko phone karti hoon. Woh cyber crime mein hai, woh verify karega.',
      'Achha beta, tumhara ID number batao. Main police station mein check karwaungi.',
    ],
    delayTactics: [
      'Beta main thodi der mein wapas phone karti hoon. Abhi beti ka hospital se call aa raha hai.',
      'Ek minute, door pe koi aaya hai. Shayad police hi hogi.',
    ],
  },
};

// ─── Intel Collection (in-memory, replace with DB in prod) ──

const collectedIntel = {
  newNumbers: new Set<string>(),
  upiIds: new Set<string>(),
  scriptPhrases: new Set<string>(),
};

// Common scam script patterns to detect
const SCAM_SCRIPT_PATTERNS = [
  /KYC\s*(?:update|pending|expired|verification)/i,
  /account\s*(?:blocked|frozen|suspended|deactivated)/i,
  /OTP\s*(?:share|send|verify|confirm)/i,
  /digital\s*arrest/i,
  /parcel\s*(?:held|stuck|customs|FedEx)/i,
  /electricity\s*(?:bill|disconnect|cut)/i,
  /lottery|prize|won|lucky/i,
  /job|work\s*from\s*home|earn\s*(?:\d|₹)/i,
  /Aadhaar\s*(?:block|verify|update)/i,
  /credit\s*card\s*(?:block|offer|reward)/i,
  /google\s*pay|paytm|phonepe|upi/i,
  /फेडेक्स|कस्टम्स|पार्सल/i,
  /बिजली\s*(?:बिल|कनेक्शन)/i,
  /डिजिटल\s*अरेस्ट/i,
];

// ─── Detection ─────────────────────────────────────────────

function extractIntel(message: string): { numbers: string[]; upiIds: string[]; phrases: string[] } {
  const numbers: string[] = [];
  const upiIds: string[] = [];
  const phrases: string[] = [];

  // Extract phone numbers
  const phoneRegex = /(?:\+91[\s-]?)?[6-9]\d{9}/g;
  let match;
  while ((match = phoneRegex.exec(message)) !== null) {
    numbers.push(match[0].replace(/[^\d]/g, ''));
  }

  // Extract UPI IDs
  const upiRegex = /[\w.]+@(?:okhdfc|oksbi|okicici|okaxis|paytm|ybl|upi|apl)/gi;
  while ((match = upiRegex.exec(message)) !== null) {
    upiIds.push(match[0].toLowerCase());
  }

  // Match scam script patterns
  for (const pattern of SCAM_SCRIPT_PATTERNS) {
    if (pattern.test(message)) {
      phrases.push(pattern.source);
    }
  }

  return { numbers, upiIds, phrases };
}

// ─── Response Generator ────────────────────────────────────

function generateResponse(scammerMessage: string): {
  response: string;
  scenario: string;
  intel: { newNumbers: string[]; upiIds: string[]; scriptPhrases: string[] };
} {
  const scenarioKey = ELDER_SCENARIOS[Math.floor(Math.random() * ELDER_SCENARIOS.length)];
  const template = TEMPLATES[scenarioKey];
  const intel = extractIntel(scammerMessage);

  // Store intel
  intel.numbers.forEach(n => collectedIntel.newNumbers.add(n));
  intel.upiIds.forEach(u => collectedIntel.upiIds.add(u));
  intel.phrases.forEach(p => collectedIntel.scriptPhrases.add(p));

  // Build response with randomized elements
  const parts: string[] = [];

  // 1. Opening (confused elder + reaction to scammer's message)
  parts.push(template.openings[Math.floor(Math.random() * template.openings.length)]);

  // 2. Confusion about the scammer's request
  parts.push(template.confusions[Math.floor(Math.random() * template.confusions.length)]);

  // 3. Give a fake OTP (scammers love this — it's worthless)
  const fakeOtp = template.fakeOtps[Math.floor(Math.random() * template.fakeOtps.length)];
  if (scammerMessage.toLowerCase().includes('otp') || scammerMessage.includes('OTP')) {
    parts.push(`OTP chahiye? Mera OTP hai: ${fakeOtp}. Sahi aaya? Ya phir se bhejoon?`);
  } else {
    parts.push(`Beta ek OTP aaya tha abhi: ${fakeOtp}. Yeh wohi hai kya? Ya kuch aur number?`);
  }

  // 4. Offer a fake UPI ID if payment-related
  if (scammerMessage.toLowerCase().includes('pay') || scammerMessage.includes('rupay') || scammerMessage.includes('पे')) {
    const fakeUpi = template.fakeUpiIds[Math.floor(Math.random() * template.fakeUpiIds.length)];
    parts.push(`Payment karni hai? Mera UPI ID hai: ${fakeUpi}. Ispe bhej do.`);
  }

  // 5. Confusion / delay tactic
  parts.push(template.delayTactics[Math.floor(Math.random() * template.delayTactics.length)]);

  // 6. Ask scammer to repeat (waste their time)
  parts.push('Ek baar phir se batao beta, kya karna hai? Mujhe theek se yaad nahi raha.');

  // 7. Closing (polite, keeps them on the hook)
  parts.push(template.closings[Math.floor(Math.random() * template.closings.length)]);

  return {
    response: parts.join('\n\n'),
    scenario: scenarioKey,
    intel: {
      newNumbers: intel.numbers,
      upiIds: intel.upiIds,
      scriptPhrases: intel.phrases,
    },
  };
}

// ─── API Route ─────────────────────────────────────────────

interface DecoyRequest {
  scammerMessage: string;
}

interface DecoyResponse {
  response: string;
  scenario: string;
  metadata: {
    messageLength: number;
    timestamp: string;
    intelCollected: {
      newNumbers: string[];
      upiIds: string[];
      scriptPhrases: string[];
    };
  };
}

export async function POST(request: NextRequest) {
  try {
    const body: DecoyRequest = await request.json();
    const { scammerMessage } = body;

    if (!scammerMessage || scammerMessage.trim().length < 3) {
      return NextResponse.json(
        { error: 'scammerMessage is required (min 3 chars)', code: 'INVALID_INPUT' },
        { status: 400 }
      );
    }

    const result = generateResponse(scammerMessage.trim());

    const response: DecoyResponse = {
      response: result.response,
      scenario: result.scenario,
      metadata: {
        messageLength: scammerMessage.length,
        timestamp: new Date().toISOString(),
        intelCollected: {
          newNumbers: result.intel.newNumbers,
          upiIds: result.intel.upiIds,
          scriptPhrases: result.intel.scriptPhrases,
        },
      },
    };

    return NextResponse.json(response);

  } catch (error: any) {
    console.error('[decoy] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate decoy response', code: 'DECOY_FAILED', detail: error.message },
      { status: 500 }
    );
  }
}
