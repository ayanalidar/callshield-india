/**
 * CallShield WhatsApp Bot Webhook Handler
 *
 * POST /api/bot/whatsapp — WhatsApp Cloud API + Twilio webhook
 *
 * Supported formats:
 *   1. WhatsApp Cloud API (Meta Graph API v21.0)
 *   2. Twilio WhatsApp (Twilio API for WhatsApp)
 *
 * Commands:
 *   Send a phone number (+91XXXXXXXXXX or 10-digit) → auto-lookup
 *   REPORT +91XXXXXXXXXX [scam_type] → file a community report
 *   HELP → usage instructions
 */

import { NextRequest, NextResponse } from 'next/server';
import { detectScam, shouldBlock, SCAM_TYPE_LABELS } from '@/engines/scam-detector';
import { lookupScamNumber, submitScamReport } from '@/db/supabase';
import { normalizeIndianNumber } from '@/engines/number-intel';

// ============================================================
// PHONE PATTERN FOR INDIAN NUMBERS
// ============================================================

const INDIAN_PHONE_RE = /(\+?91[-\s.]?\d{10})|(^[6-9]\d{9}$)/;

// ============================================================
// MAIN HANDLER
// ============================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('[WhatsApp Bot] webhook:', JSON.stringify(body).slice(0, 300));

    // --- WhatsApp Cloud API webhook verification ---
    if (body.hub?.challenge) {
      const verifyToken = body.hub?.verify_token;
      if (verifyToken === process.env.WHATSAPP_VERIFY_TOKEN) {
        return new NextResponse(String(body.hub.challenge), {
          headers: { 'Content-Type': 'text/plain' },
        });
      }
      return NextResponse.json({ error: 'Invalid verify token' }, { status: 403 });
    }

    // Determine format: Twilio vs WhatsApp Cloud API
    if (isTwilioFormat(body)) {
      return handleTwilio(body);
    }
    return handleWhatsAppCloud(body);
  } catch (error: any) {
    console.error('[WhatsApp Bot] Error:', error.message);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// ============================================================
// FORMAT DETECTION
// ============================================================

function isTwilioFormat(body: any): boolean {
  // Twilio sends form-encoded Body, From, To fields (or JSON Body)
  return !!(body.Body && body.From) || !!(body.SmsMessageSid);
}

// ============================================================
// TWILIO WHATSAPP WEBHOOK
// ============================================================

async function handleTwilio(body: any): Promise<NextResponse> {
  const incomingText: string = (body.Body || '').trim();
  const from: string = body.From?.replace('whatsapp:', '') || '';
  console.log('[WhatsApp Twilio] From:', from, 'Body:', incomingText);

  if (!incomingText) {
    return twilioReply('👋 Welcome to *CallShield India*!\n\nSend a phone number to check for scams, or type HELP for instructions.');
  }

  const replyText = await processMessage(incomingText);
  return twilioReply(replyText);
}

function twilioReply(message: string): NextResponse {
  // Twilio expects TwiML (XML) response
  const twiml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<Response>',
    '  <Message>',
    message.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
    '  </Message>',
    '</Response>',
  ].join('\n');

  return new NextResponse(twiml, {
    headers: { 'Content-Type': 'text/xml' },
  });
}

// ============================================================
// WHATSAPP CLOUD API (META GRAPH API)
// ============================================================

async function handleWhatsAppCloud(body: any): Promise<NextResponse> {
  const entry = body.entry?.[0];
  const change = entry?.changes?.[0];
  const message = change?.value?.messages?.[0];

  // Also support flat webhook structures (some simulators)
  const from = message?.from || body.from || '';
  const incomingText: string = (
    message?.text?.body ||
    message?.button?.text ||
    body.text ||
    ''
  ).trim();

  if (!incomingText || !from) {
    return NextResponse.json({ ok: true });
  }

  console.log('[WhatsApp Cloud] From:', from, 'Text:', incomingText);

  const replyText = await processMessage(incomingText);
  await sendWhatsAppMessage(from, replyText);

  return NextResponse.json({ ok: true });
}

async function sendWhatsAppMessage(to: string, text: string): Promise<boolean> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_ID;

  if (!token || !phoneId) {
    console.log('[WhatsApp] No credentials configured; reply would be:', text.slice(0, 100));
    return false;
  }

  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: text, preview_url: false },
      }),
    });
    const data = await res.json();
    if (!res.ok) console.error('[WhatsApp] Send error:', data);
    return res.ok;
  } catch (e: any) {
    console.error('[WhatsApp] Send failed:', e.message);
    return false;
  }
}

// ============================================================
// MESSAGE PROCESSING
// ============================================================

async function processMessage(text: string): Promise<string> {
  const upper = text.toUpperCase().trim();

  // HELP command
  if (upper === 'HELP' || upper === 'HI' || upper === 'HELLO') {
    return formatHelpMessage();
  }

  // REPORT command: "REPORT +919876543210 upi_fraud" or "REPORT 9876543210 upi_fraud"
  const reportMatch = text.match(/^REPORT\s+([\+]?91[-\s.]?\d{10}|\d{10})\s*(.*)/i);
  if (reportMatch) {
    const rawNumber = reportMatch[1];
    const rawType = reportMatch[2]?.trim() || '';
    return await handleReportCommand(rawNumber, rawType);
  }

  // Phone number detection: +91XXXXXXXXXX or 10-digit
  const phoneMatch = text.match(INDIAN_PHONE_RE);
  if (phoneMatch) {
    const number = phoneMatch[1] || phoneMatch[2];
    return await formatLookupReply(number);
  }

  // Unknown input
  return [
    '👋 *CallShield India*',
    '',
    'I can help you check if a phone number is a scam.',
    '',
    'Just send me a phone number like:',
    '`+919876543210` or `9876543210`',
    '',
    'Type *HELP* for all commands.',
  ].join('\n');
}

// ============================================================
// LOOKUP REPLY
// ============================================================

async function formatLookupReply(phoneNumber: string): Promise<string> {
  // Normalize the number
  let normalized = normalizeIndianNumber(phoneNumber);
  if (!normalized) {
    normalized = phoneNumber.replace(/[^0-9]/g, '');
  }

  // Edge analysis
  const edgeResult = detectScam(phoneNumber, { protectionLevel: 'standard' });
  const { block } = shouldBlock(edgeResult, 'standard');

  // DB enrichment
  let dbMatch: any = null;
  try {
    dbMatch = await lookupScamNumber(normalized);
  } catch {}

  const score = dbMatch
    ? Math.round((dbMatch.threatScore || 50) * 0.7 + edgeResult.threatScore * 0.3)
    : edgeResult.threatScore;

  const verdict = score >= 80 ? '🛑 CRITICAL' : score >= 60 ? '🚨 SCAM' : score >= 35 ? '⚠️ SUSPICIOUS' : '✅ SAFE';
  const scamType = (dbMatch?.scam_type || edgeResult.primaryScamType || 'other') as import('@/engines/scam-detector').ScamType;
  const scamLabel = SCAM_TYPE_LABELS[scamType] || scamType;
  const reportCount = dbMatch?.reportCount || 0;
  const circle = dbMatch?.telecom_circle || edgeResult.numberIntel.telecomCircle || 'Unknown';
  const carrier = dbMatch?.carrier || edgeResult.numberIntel.carrier || 'Unknown';

  const lines: string[] = [
    `🔍 *CallShield Lookup:* ${formatPhone(phoneNumber)}`,
    `${verdict} — ${scamLabel}`,
    `📊 *Threat Score:* ${score}/100`,
    `👥 *${reportCount}* community reports`,
    `📍 ${circle}, ${carrier}`,
  ];

  if (block) {
    lines.push('');
    lines.push('⚠️ *WARNING: Block this number*');
  }

  if (edgeResult.warnings?.length) {
    lines.push('');
    edgeResult.warnings.slice(0, 2).forEach((w: string) => lines.push(`• ${w}`));
  }

  lines.push('');
  lines.push('_Report this number? Reply_');
  lines.push(`REPORT ${phoneNumber} [type]`);

  return lines.join('\n');
}

// ============================================================
// REPORT COMMAND HANDLER
// ============================================================

async function handleReportCommand(rawNumber: string, rawType: string): Promise<string> {
  let normalized = normalizeIndianNumber(rawNumber);
  if (!normalized) {
    normalized = rawNumber.replace(/[^0-9]/g, '');
    if (normalized.length === 10) normalized = '91' + normalized;
  }

  // Validate number
  if (normalized.length < 10) {
    return '❌ Invalid phone number. Please send a valid Indian number.\n\nExample: `REPORT +919876543210 upi_fraud`';
  }

  // Map or default scam type
  let scamType = 'other';
  let scamLabel = 'Other Scam';

  if (rawType) {
    const upperType = rawType.toUpperCase().trim();
    // Try exact match or partial match
    const match = SCAM_TYPES_LIST.find(
      t => t.key === upperType.toLowerCase() || t.label.toLowerCase().includes(upperType.toLowerCase())
    );
    if (match) {
      scamType = match.key;
      scamLabel = match.label;
    } else {
      // Not recognized: list available types
      const typesList = SCAM_TYPES_LIST.map(t => `• ${t.key} (${t.label})`).join('\n');
      return [
        `❓ Unknown scam type: "${rawType}"`,
        '',
        'Available types:',
        typesList,
        '',
        `Reply with: REPORT ${rawNumber} [type]`,
      ].join('\n');
    }
  }

  try {
    const result = await submitScamReport({
      phoneNumber: rawNumber,
      normalizedNumber: normalized,
      scamType: scamType as import('@/engines/scam-detector').ScamType,
      description: `Reported via WhatsApp bot`,
      spamScore: 3,
      reporterIp: 'whatsapp-bot',
    });

    if (result.success) {
      return [
        '✅ *Report Submitted!*',
        '',
        `📞 ${formatPhone(rawNumber)}`,
        `🏷️ ${scamLabel}`,
        '',
        'Thank you for helping protect the community! 🇮🇳',
        '',
        '_Your report helps others avoid this scam._',
      ].join('\n');
    }

    if (result.duplicate) {
      return '⚠️ You already reported this number recently. Thank you for helping!';
    }

    return `❌ Failed to submit report: ${result.message}`;
  } catch (e: any) {
    return '❌ Error submitting report. Please try again later.';
  }
}

// ============================================================
// HELP MESSAGE
// ============================================================

function formatHelpMessage(): string {
  return [
    '🛡️ *CallShield India — WhatsApp Bot* 🛡️',
    '',
    'AI-powered scam call protection for India.',
    '',
    '*How to use:*',
    '',
    '1️⃣ Send a phone number to check for scams:',
    '   `+919876543210` or `9876543210`',
    '',
    '2️⃣ Report a scam number:',
    '   `REPORT +919876543210 upi_fraud`',
    '',
    '3️⃣ Get help anytime:',
    '   `HELP`',
    '',
    '*Scam Types for REPORT:*',
    '• upi_fraud — UPI Payment Fraud',
    '• bank_otp_scam — Bank OTP Scam',
    '• fedex_customs — FedEx/Customs Scam',
    '• loan_app — Loan App Harassment',
    '• aadhaar_kyc — Aadhaar KYC Scam',
    '• it_department — IT Dept Impersonation',
    '• job_scam — Fake Job Offer',
    '• crypto — Crypto Investment Scam',
    '• police_fake — Fake Police Call',
    '• insurance — Insurance Scam',
    '• electricity — Electricity Bill Scam',
    '• sextortion — Sextortion/Blackmail',
    '• lottery — Lottery/Win Scam',
    '• ecommerce — E-commerce Fraud',
    '• wangiri — Wangiri Missed Call',
    '• sms_phishing — SMS Phishing',
    '• other — Other Scam',
    '',
    '🔍 _Powered by CallShield India_',
  ].join('\n');
}

// ============================================================
// HELPERS
// ============================================================

function formatPhone(raw: string): string {
  const digits = raw.replace(/[^0-9]/g, '');
  if (digits.length === 10) return `+91 ${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+91 ${digits.slice(2, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`;
  return raw;
}

/**
 * GET handler: webhook verification endpoint
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode');
  const challenge = searchParams.get('hub.challenge');
  const verifyToken = searchParams.get('hub.verify_token');

  if (mode === 'subscribe' && verifyToken === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(challenge || '', {
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  return NextResponse.json({ error: 'Invalid verification' }, { status: 403 });
}

// ============================================================
// SCAM TYPES REFERENCE
// ============================================================

const SCAM_TYPES_LIST = [
  { key: 'upi_fraud', label: 'UPI Payment Fraud' },
  { key: 'bank_otp_scam', label: 'Bank OTP Scam' },
  { key: 'fedex_customs', label: 'FedEx/Customs Scam' },
  { key: 'it_department', label: 'IT Dept Impersonation' },
  { key: 'insurance', label: 'Insurance Scam' },
  { key: 'loan_app', label: 'Loan App Harassment' },
  { key: 'crypto', label: 'Crypto Investment Scam' },
  { key: 'lottery', label: 'Lottery/Win Scam' },
  { key: 'ecommerce', label: 'E-commerce Fraud' },
  { key: 'police_fake', label: 'Fake Police Call' },
  { key: 'aadhaar_kyc', label: 'Aadhaar KYC Scam' },
  { key: 'electricity', label: 'Electricity Bill Scam' },
  { key: 'sextortion', label: 'Sextortion/Blackmail' },
  { key: 'wangiri', label: 'Wangiri Missed Call' },
  { key: 'sms_phishing', label: 'SMS Phishing' },
  { key: 'job_scam', label: 'Fake Job Offer' },
  { key: 'other', label: 'Other Scam' },
];
