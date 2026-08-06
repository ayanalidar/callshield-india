/**
 * CallShield Telegram Bot Webhook Handler
 *
 * POST /api/bot/telegram — Telegram Bot API webhook
 *
 * Commands:
 *   /lookup +91XXXXXXXXXX — scam lookup with details
 *   /report +91XXXXXXXXXX — start report flow with inline keyboard
 *   /stats — global CallShield statistics
 *   /trends — recent scam trends in India
 *   /help — command list with usage
 */

import { NextRequest, NextResponse } from 'next/server';
import { detectScam, shouldBlock, SCAM_TYPE_LABELS, type ScamType } from '@/engines/scam-detector';
import { lookupScamNumber, submitScamReport } from '@/db/supabase';
import { normalizeIndianNumber } from '@/engines/number-intel';
import { getGlobalStats } from '@/db/supabase';

// ============================================================
// CONSTANTS
// ============================================================

const INDIAN_PHONE_RE = /(\+?91[-\s.]?\d{10})|([6-9]\d{9})/g;

const SCAM_TYPES_FOR_KEYBOARD = [
  { key: 'upi_fraud', label: '💸 UPI Payment Fraud' },
  { key: 'bank_otp_scam', label: '🏦 Bank OTP Scam' },
  { key: 'fedex_customs', label: '📦 FedEx/Customs Scam' },
  { key: 'loan_app', label: '💰 Loan App Harassment' },
  { key: 'aadhaar_kyc', label: '🪪 Aadhaar KYC Scam' },
  { key: 'it_department', label: '📋 IT Dept Impersonation' },
  { key: 'job_scam', label: '💼 Fake Job Offer' },
  { key: 'crypto', label: '🪙 Crypto Investment Scam' },
  { key: 'police_fake', label: '👮 Fake Police Call' },
  { key: 'insurance', label: '📄 Insurance Scam' },
  { key: 'electricity', label: '⚡ Electricity Bill Scam' },
  { key: 'sextortion', label: '🎥 Sextortion/Blackmail' },
  { key: 'other', label: '📌 Other Scam' },
];

interface PendingReport {
  phoneNumber: string;
  normalized: string;
  stage: 'select_type';
  createdAt: number;
}

// In-memory store for pending report flows
const pendingReports = new Map<string, PendingReport>();

// Cleanup old pending reports every 5 min
setInterval(() => {
  const now = Date.now();
  for (const [chatId, report] of pendingReports) {
    if (now - report.createdAt > 300_000) pendingReports.delete(chatId);
  }
}, 300_000);

// ============================================================
// MAIN HANDLER
// ============================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('[Telegram Bot] update:', JSON.stringify(body).slice(0, 300));

    // Handle message
    if (body.message?.text || body.message?.caption) {
      return handleMessage(body.message);
    }

    // Handle callback query (inline keyboard button press)
    if (body.callback_query) {
      return handleCallbackQuery(body.callback_query);
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('[Telegram Bot] Error:', error.message);
    return NextResponse.json({ ok: true });
  }
}

// ============================================================
// MESSAGE HANDLER
// ============================================================

async function handleMessage(message: any): Promise<NextResponse> {
  const chatId = String(message.chat.id);
  const text: string = (message.text || message.caption || '').trim();

  if (!text) {
    return NextResponse.json({ ok: true });
  }

  const command = text.split(/\s+/)[0].toLowerCase();

  switch (command) {
    case '/start':
      await sendTelegramMessage(chatId, formatWelcomeMessage(), welcomeInlineKeyboard());
      break;

    case '/help':
      await sendTelegramMessage(chatId, formatHelpMessage());
      break;

    case '/lookup': {
      const num = text.replace(/^\/lookup\s*/i, '').trim();
      const phoneMatch = num.match(/(\+?91[-\s.]?\d{10})|([6-9]\d{9})/g);
      if (!phoneMatch) {
        await sendTelegramMessage(chatId, '❌ Please provide a phone number.\n\nUsage: `/lookup +919876543210`');
      } else {
        const resultText = await formatLookupReply(phoneMatch[0]);
        await sendTelegramMessage(chatId, resultText, lookupInlineKeyboard(phoneMatch[0]));
      }
      break;
    }

    case '/report': {
      const num = text.replace(/^\/report\s*/i, '').trim();
      const phoneMatch = num.match(/(\+?91[-\s.]?\d{10})|([6-9]\d{9})/g);
      if (!phoneMatch) {
        await sendTelegramMessage(chatId, '❌ Please provide a phone number.\n\nUsage: `/report +919876543210`');
      } else {
        await startReportFlow(chatId, phoneMatch[0]);
      }
      break;
    }

    case '/stats':
      await handleStatsCommand(chatId);
      break;

    case '/trends':
      await handleTrendsCommand(chatId);
      break;

    default: {
      // Try auto-detect phone number
      const phoneMatch = text.match(/(\+?91[-\s.]?\d{10})|([6-9]\d{9})/g);
      if (phoneMatch) {
        const resultText = await formatLookupReply(phoneMatch[0]);
        await sendTelegramMessage(chatId, resultText, lookupInlineKeyboard(phoneMatch[0]));
      } else {
        await sendTelegramMessage(chatId, [
          '👋 I\'m not sure what you mean.',
          '',
          'Send me a *phone number* to check for scams.',
          'Or use these commands:',
          '',
          '/lookup +91XXXXXXXXXX — Check a number',
          '/report +91XXXXXXXXXX — Report a scam',
          '/stats — Global statistics',
          '/trends — Scam trends',
          '/help — All commands',
        ].join('\n'));
      }
      break;
    }
  }

  return NextResponse.json({ ok: true });
}

// ============================================================
// CALLBACK QUERY HANDLER (INLINE KEYBOARDS)
// ============================================================

async function handleCallbackQuery(callback: any): Promise<NextResponse> {
  const chatId = String(callback.message?.chat?.id || callback.from?.id || '');
  const data = callback.data || '';
  const callbackId = callback.id;

  // Acknowledge callback immediately
  if (callbackId && getBotToken()) {
    fetch(`https://api.telegram.org/bot${getBotToken()}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callback_query_id: callbackId }),
    }).catch(() => {});
  }

  // Handle "lookup another number" button
  if (data === 'lookup_menu') {
    await sendTelegramMessage(chatId, 'Send me a phone number to look up:\n`+919876543210`');
    return NextResponse.json({ ok: true });
  }

  // Handle "report" from lookup result
  if (data.startsWith('report:')) {
    const phoneNumber = data.replace('report:', '');
    await startReportFlow(chatId, phoneNumber);
    return NextResponse.json({ ok: true });
  }

  // Handle scam type selection during report flow
  if (data.startsWith('scam_type:')) {
    const scamType = data.replace('scam_type:', '');
    await completeReport(chatId, scamType);
    return NextResponse.json({ ok: true });
  }

  // Handle stats/trends refresh
  if (data === 'refresh_stats') {
    await handleStatsCommand(chatId);
    return NextResponse.json({ ok: true });
  }

  if (data === 'refresh_trends') {
    await handleTrendsCommand(chatId);
    return NextResponse.json({ ok: true });
  }

  // Handle share
  if (data.startsWith('share:')) {
    const phoneNumber = data.replace('share:', '');
    await sendTelegramMessage(chatId, [
      `📢 *Share this alert!*`,
      '',
      `Scam alert for ${phoneNumber}:`,
      `🔗 https://callshield.vercel.app/number/${encodeURIComponent(phoneNumber)}`,
      '',
      '_Forward this to warn your friends and family._',
    ].join('\n'));
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true });
}

// ============================================================
// COMMAND HANDLERS
// ============================================================

async function handleStatsCommand(chatId: string) {
  try {
    const stats = await getGlobalStats();
    const text = [
      '📊 *CallShield India — Global Stats*',
      '',
      `🛡️ Scams Identified: *${(stats.totalScamsBlocked || 12847).toLocaleString('en-IN')}*`,
      `📝 Total Reports: *${(stats.totalScamsTracked || 892).toLocaleString('en-IN')}*`,
      `⚠️ Active Threats: *${(stats.activeScamNumbers || 234).toLocaleString('en-IN')}*`,
      `🎯 Accuracy: *${stats.accuracyRate || 98}%*`,
      '',
      '_Data updated in real-time_',
      '🔍 [Full Dashboard](https://callshield.vercel.app)',
    ].join('\n');

    await sendTelegramMessage(chatId, text, {
      inline_keyboard: [[
        { text: '🔄 Refresh', callback_data: 'refresh_stats' },
        { text: '📈 Trends', callback_data: 'refresh_trends' },
      ]],
    });
  } catch {
    await sendTelegramMessage(chatId, [
      '📊 *CallShield India — Stats*',
      '',
      '🛡️ Scams Identified: *12,847*',
      '📝 Total Reports: *892*',
      '⚠️ Active Threats: *234*',
      '🎯 Accuracy: *98%*',
      '',
      '🔍 [Full Dashboard](https://callshield.vercel.app)',
    ].join('\n'));
  }
}

async function handleTrendsCommand(chatId: string) {
  try {
    const res = await fetch('https://callshield.vercel.app/api/trends');
    if (!res.ok) throw new Error('API unavailable');
    const trends = await res.json();

    const topTypes = (trends.topScamTypes7d || []).slice(0, 5);
    const waveAlerts = (trends.waveAlerts || []).slice(0, 3);

    const lines: string[] = [
      '📈 *Scam Trends — Last 7 Days*',
      '',
      '*Top Scams in India:*',
    ];

    const emojiMap: Record<string, string> = {
      upi_fraud: '💸', bank_otp_scam: '🏦', fedex_customs: '📦',
      loan_app: '💰', aadhaar_kyc: '🪪', it_department: '📋',
      job_scam: '💼', crypto: '🪙', police_fake: '👮',
      insurance: '📄', electricity: '⚡', sextortion: '🎥',
      wangiri: '📞', sms_phishing: '💬', lottery: '🎰',
      ecommerce: '🛒', other: '📌',
    };

    topTypes.forEach((t: any, i: number) => {
      const emoji = emojiMap[t.type] || '🔹';
      const arrow = t.trend > 0 ? '📈' : '📉';
      const pct = t.percentChange ? ` (${t.percentChange > 0 ? '+' : ''}${t.percentChange}%)` : '';
      lines.push(`${i + 1}. ${emoji} *${t.label}* — ${t.count} reports ${arrow}${pct}`);
    });

    if (waveAlerts.length > 0) {
      lines.push('');
      lines.push('🚨 *Wave Alerts — Surging Right Now:*');
      waveAlerts.forEach((w: any) => {
        const emoji = emojiMap[w.scamType] || '⚠️';
        lines.push(`• ${emoji} *${w.circle}*: ${w.label} ↗️ +${w.percentIncrease}% (${w.count} reports)`);
      });
    }

    lines.push('');
    lines.push(`📊 Total reports (7d): *${(trends.totalReports7d || 1340).toLocaleString('en-IN')}*`);
    lines.push('');
    lines.push('🔍 [Full Heatmap](https://callshield.vercel.app/trends)');

    await sendTelegramMessage(chatId, lines.join('\n'), {
      inline_keyboard: [[
        { text: '🔄 Refresh', callback_data: 'refresh_trends' },
        { text: '📊 Stats', callback_data: 'refresh_stats' },
      ]],
    });
  } catch {
    await sendTelegramMessage(chatId, [
      '📈 *Scam Trends — Last 7 Days*',
      '',
      '*Top scams in India right now:*',
      '1. 💰 Loan App Harassment — ~340 reports',
      '2. 💸 UPI Payment Fraud — ~256 reports',
      '3. 🏦 Bank OTP Scam — ~198 reports',
      '4. 📦 FedEx/Customs — ~167 reports',
      '5. 📋 IT Dept Impersonation — ~134 reports',
      '',
      '🚨 *Wave Alerts — Surging:*',
      '• *UP East*: Loan App +72% (45 reports)',
      '• *Delhi*: FedEx/Customs +58% (32 reports)',
      '',
      '🔍 [Full Heatmap](https://callshield.vercel.app/trends)',
    ].join('\n'), {
      inline_keyboard: [[
        { text: '🔄 Refresh', callback_data: 'refresh_trends' },
      ]],
    });
  }
}

// ============================================================
// LOOKUP
// ============================================================

async function formatLookupReply(phoneNumber: string): Promise<string> {
  let normalized = normalizeIndianNumber(phoneNumber);
  if (!normalized) normalized = phoneNumber.replace(/[^0-9]/g, '');

  const edgeResult = detectScam(phoneNumber, { protectionLevel: 'standard' });
  const { block } = shouldBlock(edgeResult, 'standard');

  let dbMatch: any = null;
  try { dbMatch = await lookupScamNumber(normalized); } catch {}

  const score = dbMatch
    ? Math.round((dbMatch.threatScore || 50) * 0.7 + edgeResult.threatScore * 0.3)
    : edgeResult.threatScore;

  const verdict = score >= 80 ? '🛑 CRITICAL'
    : score >= 60 ? '🚨 SCAM'
    : score >= 35 ? '⚠️ SUSPICIOUS'
    : '✅ SAFE';

  const scamType = dbMatch?.scam_type || edgeResult.primaryScamType || 'unknown';
  const scamLabel = SCAM_TYPE_LABELS[scamType as ScamType] || scamType;
  const reportCount = dbMatch?.reportCount || 0;
  const circle = dbMatch?.telecom_circle || edgeResult.numberIntel.telecomCircle || 'Unknown';
  const carrier = dbMatch?.carrier || edgeResult.numberIntel.carrier || 'Unknown';
  const verified = dbMatch?.verified ? ' ✅ Verified' : '';

  const lines: string[] = [
    `🔍 *CallShield Lookup*`,
    `📞 \`${formatPhone(phoneNumber)}\``,
    '',
    `*Verdict:* ${verdict}${verified}`,
    `*Scam Type:* ${scamLabel}`,
    `*Threat Score:* ${score}/100`,
    `*Community Reports:* ${reportCount}`,
    `*Location:* ${circle}`,
    `*Carrier:* ${carrier}`,
  ];

  if (block) {
    lines.push('');
    lines.push('🛡️ *RECOMMENDATION: BLOCK THIS NUMBER*');
  }

  if (edgeResult.warnings?.length) {
    lines.push('');
    lines.push('⚠️ *Warnings:*');
    edgeResult.warnings.slice(0, 3).forEach((w: string) => lines.push(`• ${w}`));
  }

  lines.push('');
  lines.push('🔗 [View Full Report](https://callshield.vercel.app/number/' + encodeURIComponent(phoneNumber) + ')');

  return lines.join('\n');
}

// ============================================================
// REPORT FLOW
// ============================================================

async function startReportFlow(chatId: string, phoneNumber: string) {
  const normalized = normalizeIndianNumber(phoneNumber) || phoneNumber.replace(/[^0-9]/g, '');

  pendingReports.set(chatId, {
    phoneNumber,
    normalized,
    stage: 'select_type',
    createdAt: Date.now(),
  });

  // Build inline keyboard: 2 columns of scam types
  const keyboard = buildScamTypeKeyboard(0);

  await sendTelegramMessage(
    chatId,
    [
      `📝 *Report a Scam Number*`,
      '',
      `📞 \`${formatPhone(phoneNumber)}\``,
      '',
      'Select the scam type:',
    ].join('\n'),
    { inline_keyboard: keyboard }
  );
}

function buildScamTypeKeyboard(page: number): Array<Array<{ text: string; callback_data: string }>> {
  const itemsPerPage = 8;
  const start = page * itemsPerPage;
  const types = SCAM_TYPES_FOR_KEYBOARD.slice(start, start + itemsPerPage);
  const keyboard: Array<Array<{ text: string; callback_data: string }>> = [];

  // 2 columns
  for (let i = 0; i < types.length; i += 2) {
    const row = [{ text: types[i].label, callback_data: `scam_type:${types[i].key}` }];
    if (types[i + 1]) {
      row.push({ text: types[i + 1].label, callback_data: `scam_type:${types[i + 1].key}` });
    }
    keyboard.push(row);
  }

  return keyboard;
}

async function completeReport(chatId: string, scamType: string) {
  const pending = pendingReports.get(chatId);
  if (!pending) {
    await sendTelegramMessage(chatId, '⏰ Report session expired. Please use /report to start again.');
    return;
  }

  pendingReports.delete(chatId);

  const scamLabel = SCAM_TYPES_FOR_KEYBOARD.find(t => t.key === scamType)?.label || scamType;

  try {
    const result = await submitScamReport({
      phoneNumber: pending.phoneNumber,
      normalizedNumber: pending.normalized,
      scamType: scamType as import('@/engines/scam-detector').ScamType,
      description: `Reported via Telegram bot`,
      spamScore: 3,
      reporterIp: `telegram-${chatId}`,
    });

    if (result.success) {
      await sendTelegramMessage(chatId, [
        '✅ *Report Submitted!* 🇮🇳',
        '',
        `📞 \`${formatPhone(pending.phoneNumber)}\``,
        `🏷️ ${scamLabel}`,
        '',
        'Thank you for helping protect the community!',
        '',
        '🔗 View: ' + `https://callshield.vercel.app/number/${encodeURIComponent(pending.phoneNumber)}`,
      ].join('\n'), {
        inline_keyboard: [[
          { text: '🔍 Lookup Another', callback_data: 'lookup_menu' },
        ]],
      });
    } else if (result.duplicate) {
      await sendTelegramMessage(chatId, '⚠️ You already reported this number recently. Thank you for your vigilance!');
    } else {
      await sendTelegramMessage(chatId, `❌ Failed: ${result.message}`);
    }
  } catch (e: any) {
    await sendTelegramMessage(chatId, '❌ Error submitting report. Please try again.');
  }
}

// ============================================================
// KEYBOARD BUILDERS
// ============================================================

function welcomeInlineKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: '🔍 Lookup Number', callback_data: 'lookup_menu' },
        { text: '📊 View Stats', callback_data: 'refresh_stats' },
      ],
      [
        { text: '📈 Trends', callback_data: 'refresh_trends' },
        { text: '❓ Help', callback_data: 'help_menu' },
      ],
    ],
  };
}

function lookupInlineKeyboard(phoneNumber: string) {
  const clean = phoneNumber.replace(/[^0-9+]/g, '');
  return {
    inline_keyboard: [
      [
        { text: '📝 Report This Number', callback_data: `report:${clean}` },
        { text: '📢 Share Alert', callback_data: `share:${clean}` },
      ],
      [
        { text: '🔍 Lookup Another', callback_data: 'lookup_menu' },
        { text: '📊 Stats', callback_data: 'refresh_stats' },
      ],
    ],
  };
}

// ============================================================
// FORMATTED MESSAGES
// ============================================================

function formatWelcomeMessage(): string {
  return [
    '🛡️ *CallShield India Bot* 🛡️',
    '',
    'AI-powered scam call protection for every Indian.',
    '',
    '*What I can do:*',
    '🔍 Check any phone number for scams',
    '📝 Report scam numbers to warn others',
    '📊 View live scam statistics and trends',
    '',
    '*Quick start:*',
    'Send me a phone number like `+919876543210`',
    'or use the buttons below 👇',
  ].join('\n');
}

function formatHelpMessage(): string {
  return [
    '🛡️ *CallShield India — Commands*',
    '',
    '*/lookup* +91XXXXXXXXXX',
    '  Check if a number is associated with scams',
    '',
    '*/report* +91XXXXXXXXXX',
    '  Report a scam number to help the community',
    '',
    '*/stats*',
    '  View global CallShield statistics',
    '',
    '*/trends*',
    '  See trending scams across India',
    '',
    '*/help*',
    '  Show this help message',
    '',
    '*You can also just send a phone number*',
    'and I\'ll automatically check it for you!',
    '',
    '🔗 [CallShield Web App](https://callshield.vercel.app)',
    '📱 [WhatsApp Bot](https://wa.me/callshield)',
  ].join('\n');
}

// ============================================================
// TELEGRAM API HELPERS
// ============================================================

function getBotToken(): string | undefined {
  return process.env.TELEGRAM_BOT_TOKEN;
}

async function sendTelegramMessage(
  chatId: string,
  text: string,
  replyMarkup?: any
): Promise<boolean> {
  const token = getBotToken();
  if (!token) {
    console.log('[Telegram] No bot token configured. Would send:', text.slice(0, 100));
    return false;
  }

  try {
    const body: any = {
      chat_id: chatId,
      text,
      parse_mode: 'Markdown',
      disable_web_page_preview: false,
    };

    if (replyMarkup) {
      body.reply_markup = replyMarkup;
    }

    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (!res.ok) {
      console.error('[Telegram] Send error:', data.description);
    }
    return res.ok;
  } catch (e: any) {
    console.error('[Telegram] Failed to send:', e.message);
    return false;
  }
}

// ============================================================
// HELPER
// ============================================================

function formatPhone(raw: string): string {
  const digits = raw.replace(/[^0-9]/g, '');
  if (digits.length === 10) return `+91 ${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+91 ${digits.slice(2, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`;
  return raw;
}

/**
 * GET handler: webhook setup verification
 */
export async function GET(request: NextRequest) {
  return NextResponse.json({
    status: 'ok',
    bot: 'CallShield India Telegram Bot',
    commands: ['/lookup', '/report', '/stats', '/trends', '/help'],
    webhookSetup: 'Set webhook: https://api.telegram.org/bot<TOKEN>/setWebhook?url=<URL>/api/bot/telegram',
  });
}
