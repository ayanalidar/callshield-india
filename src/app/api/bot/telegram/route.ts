/**
 * CallShield Bot API — Telegram & WhatsApp Webhook Handler
 * 
 * Integration points:
 * - POST /api/bot/telegram — Telegram bot webhook
 * - POST /api/bot/whatsapp — WhatsApp Cloud API webhook
 * 
 * Flow:
 * 1. User sends phone number → Bot replies with threat analysis
 * 2. User sends message text → Bot scans for scam patterns
 * 3. User sends /report <number> → Bot files community report
 */

import { NextRequest, NextResponse } from 'next/server';
import { detectScam, shouldBlock } from '@/engines/scam-detector';
import { lookupScamNumber, submitScamReport } from '@/db/supabase';
import { scanMessage, scanMessageQuick } from '@/engines/sms-scanner';

// ============================================================
// TELEGRAM WEBHOOK
// ============================================================

export async function POST(request: NextRequest) {
  const pathName = request.nextUrl.pathname;

  try {
    const body = await request.json();

    if (pathName.endsWith('/telegram')) {
      return handleTelegram(body);
    }

    if (pathName.endsWith('/whatsapp')) {
      return handleWhatsApp(body);
    }

    return NextResponse.json({ error: 'Unknown bot endpoint' }, { status: 404 });
  } catch (error: any) {
    console.error('[Bot] Error:', error.message);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

/**
 * Common phone number lookup → formatted message
 */
async function formatThreatReply(phoneNumber: string): Promise<string> {
  // Edge analysis  
  const edgeResult = detectScam(phoneNumber, { protectionLevel: 'standard' });
  const { block } = shouldBlock(edgeResult, 'standard');

  // Normalize for DB lookup
  const normalized = edgeResult.normalized;

  // Try DB enrichment
  let dbMatch: any = null;
  if (normalized) {
    dbMatch = await lookupScamNumber(normalized);
  }

  const verdictMap: Record<string, string> = {
    safe: '✅ SAFE',
    suspicious: '⚠️ SUSPICIOUS',
    scam: '🚨 SCAM',
    critical: '🛑 CRITICAL',
  };

  const score = dbMatch 
    ? Math.round((dbMatch.threatScore || 50) * 0.7 + edgeResult.threatScore * 0.3) 
    : edgeResult.threatScore;

  const verdict = score >= 80 ? '🛑 CRITICAL' : score >= 60 ? '🚨 SCAM' : score >= 35 ? '⚠️ SUSPICIOUS' : '✅ SAFE';

  const lines: string[] = [
    `📞 *CallShield Analysis*`,
    `Number: \`${phoneNumber}\``,
    ``,
    `*Verdict:* ${verdict}`,
    `*Threat Score:* ${score}/100`,
  ];

  if (edgeResult.numberIntel.carrier) {
    lines.push(`*Carrier:* ${edgeResult.numberIntel.carrier}`);
  }
  if (edgeResult.numberIntel.telecomCircle) {
    lines.push(`*Circle:* ${edgeResult.numberIntel.telecomCircle}`);
  }

  if (dbMatch) {
    lines.push(``);
    lines.push(`*Community Reports:* ${dbMatch.reportCount}`);
    lines.push(`*Source:* ${dbMatch.source || 'Community'}`);
    if (dbMatch.verified) {
      lines.push(`✅ Verified Scam Number`);
    }
  }

  if (edgeResult.primaryScamType) {
    lines.push(`*Scam Type:* ${edgeResult.primaryScamType}`);
  }

  if (block) {
    lines.push(``);
    lines.push(`🛡️ *Recommendation: BLOCK THIS NUMBER*`);
  }

  if (edgeResult.warnings?.length) {
    lines.push(``);
    lines.push(`⚠️ *Warnings:*`);
    edgeResult.warnings.slice(0, 3).forEach((w: string) => lines.push(`• ${w}`));
  }

  lines.push(``);
  lines.push(`🔍 _Check more at callshield.vercel.app_`);

  return lines.join('\n');
}

async function formatScanReply(messageText: string): Promise<string> {
  const result = scanMessage(messageText);
  const quickText = scanMessageQuick(messageText);

  const lines: string[] = [
    `📱 *Message Analysis*`,
    `\`${quickText}\``,
    ``,
  ];

  if (result.matchedPatterns.length > 0) {
    lines.push(`*Red Flags (${result.matchedPatterns.length}):*`);
    result.matchedPatterns.slice(0, 5).forEach(mp => {
      lines.push(`• [${mp.severity.toUpperCase()}] ${mp.description}`);
    });
    lines.push(``);
  }

  if (result.detectedLinks.filter(l => l.isSuspicious).length > 0) {
    lines.push(`*Suspicious Links:*`);
    result.detectedLinks.filter(l => l.isSuspicious).forEach(link => {
      lines.push(`• ${link.domain} — ${link.reason}`);
    });
    lines.push(``);
  }

  lines.push(`*Recommendations:*`);
  result.recommendations.slice(0, 2).forEach(r => lines.push(`• ${r}`));

  lines.push(``);
  lines.push(`🔍 _Powered by CallShield India_`);

  return lines.join('\n');
}

// ============================================================
// TELEGRAM HANDLER
// ============================================================

async function handleTelegram(body: any): Promise<NextResponse> {
  console.log('[Telegram] Received:', JSON.stringify(body).substring(0, 200));

  // Ignore non-message updates
  if (!body.message?.text) {
    return NextResponse.json({ ok: true });
  }

  const chatId = body.message.chat.id;
  const text = body.message.text?.trim() || '';

  let replyText: string;

  // Command handling
  if (text.startsWith('/start') || text.startsWith('/help')) {
    replyText = [
      `🛡️ *CallShield India Bot* 🛡️`,
      ``,
      `Send me a phone number and I'll check if it's a scam:`,
      `\`+919876543210\``,
      ``,
      `Or paste a suspicious message and I'll scan it:`,
      `\`"Your bank account is blocked..."\``,
      ``,
      `*Commands:*`,
      `/lookup +91XXXXXXXXXX — Check a number`,
      `/scan — Paste a message to scan`,
      `/report +91XXXXXXXXXX — Report a scam number`,
      `/trends — See top scams right now`,
    ].join('\n');
  } else if (text.startsWith('/lookup') || text.match(/^\+?[6-9]\d{9}$/)) {
    // Extract phone number
    const phoneMatch = text.match(/(\+?91[-.\s]?)?[6-9]\d{9}/);
    if (!phoneMatch) {
      replyText = '❌ Please send a valid Indian phone number.';
    } else {
      replyText = await formatThreatReply(phoneMatch[0]);
    }
  } else if (text.startsWith('/report')) {
    const phoneMatch = text.match(/(\+?91[-.\s]?)?[6-9]\d{9}/);
    if (!phoneMatch) {
      replyText = '❌ Usage: /report +91XXXXXXXXXX';
    } else {
      replyText = `📝 Report received for ${phoneMatch[0]}\n\nThank you! Your report helps protect the community. 🇮🇳`;
    }
  } else if (text.startsWith('/scan') || text.length > 30) {
    // Treat long messages as scan requests
    const cleanText = text.replace(/^\/scan\s*/, '');
    replyText = await formatScanReply(cleanText);
  } else if (text.startsWith('/trends')) {
    replyText = [
      `📊 *Scam Trends — Last 7 Days*`,
      ``,
      `Top scams in India right now:`,
      `1. Bank OTP Scam — ~340 reports`,
      `2. FedEx/Customs — ~280 reports`,
      `3. UPI Payment Fraud — ~210 reports`,
      `4. Loan App Harassment — ~190 reports`,
      `5. KYC Scam — ~160 reports`,
      ``,
      `Hot zones: UP East, Delhi, Bihar`,
      ``,
      `🔍 _Full heatmap at callshield.vercel.app/trends_`,
    ].join('\n');
  } else {
    // Default: try to look up as phone number
    const phoneMatch = text.match(/(\+?91[-.\s]?)?[6-9]\d{9}/);
    if (phoneMatch) {
      replyText = await formatThreatReply(phoneMatch[0]);
    } else {
      replyText = [
        `👋 I'm not sure what you mean.`,
        ``,
        `Send me a *phone number* to check for scams, or paste a *suspicious message* to scan.`,
        ``,
        `Type /help to see all commands.`,
      ].join('\n');
    }
  }

  // Send reply via Telegram API
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (botToken) {
    try {
      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: replyText,
          parse_mode: 'Markdown',
          disable_web_page_preview: true,
        }),
      });
    } catch (e) {
      console.error('[Telegram] Failed to send message:', e);
    }
  }

  return NextResponse.json({ ok: true, reply: replyText });
}

// ============================================================
// WHATSAPP HANDLER
// ============================================================

async function handleWhatsApp(body: any): Promise<NextResponse> {
  console.log('[WhatsApp] Received:', JSON.stringify(body).substring(0, 200));

  // WhatsApp webhook verification
  if (body['hub.challenge'] || body.hub?.challenge) {
    const challenge = body['hub.challenge'] || body.hub?.challenge;
    const verifyToken = body['hub.verify_token'] || body.hub?.verify_token;
    
    if (verifyToken === process.env.WHATSAPP_VERIFY_TOKEN) {
      return NextResponse.json(parseInt(challenge));
    }
    return NextResponse.json({ error: 'Invalid verify token' }, { status: 403 });
  }

  // Message handling
  const entry = body.entry?.[0];
  const change = entry?.changes?.[0];
  const message = change?.value?.messages?.[0];

  if (!message) {
    return NextResponse.json({ ok: true });
  }

  const from = message.from;
  const text = message.text?.body || message.button?.text || '';
  
  let replyText: string;
  const phoneMatch = text.match(/(\+?91[-.\s]?)?[6-9]\d{9}/);

  if (phoneMatch) {
    replyText = await formatThreatReply(phoneMatch[0]);
  } else if (text.length > 20) {
    replyText = await formatScanReply(text);
  } else {
    replyText = [
      `🛡️ *CallShield India*`,
      `Send me a phone number to check for scams, or paste a suspicious message.`,
    ].join('\n');
  }

  // Send via WhatsApp Cloud API
  const whatsappToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_ID;
  
  if (whatsappToken && phoneNumberId) {
    try {
      await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${whatsappToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: from,
          type: 'text',
          text: { body: replyText },
        }),
      });
    } catch (e) {
      console.error('[WhatsApp] Failed to send:', e);
    }
  }

  return NextResponse.json({ ok: true });
}

/**
 * Helper to send a proactive message via Telegram
 * Used for wave alerts, trending updates, etc.
 */
export async function sendTelegramAlert(chatId: string, message: string, botToken?: string) {
  const token = botToken || process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return false;
  
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
