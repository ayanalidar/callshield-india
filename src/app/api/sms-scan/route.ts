/**
 * CallShield SMS Scan API
 *
 * POST /api/sms-scan
 * Body: { smsText: string }
 *
 * Uses the existing sms-scanner.ts engine to scan SMS/WhatsApp messages.
 */

import { NextRequest, NextResponse } from 'next/server';
import { scanMessage } from '@/engines/sms-scanner';

/* ------------------------------------------------------------------ */
/*  POST handler                                                       */
/* ------------------------------------------------------------------ */

export async function POST(request: NextRequest) {
  let body: Record<string, any>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { smsText } = body;

  if (!smsText || typeof smsText !== 'string' || smsText.trim().length === 0) {
    return NextResponse.json({ error: 'smsText is required and must be a non‑empty string' }, { status: 400 });
  }

  if (smsText.length > 10000) {
    return NextResponse.json({ error: 'Message too long. Maximum 10,000 characters.' }, { status: 400 });
  }

  // Run the existing scanner engine
  const result = scanMessage(smsText);

  // Extract phone numbers from the message
  const phoneMatches = smsText.match(/(?:\+91[-\s]?)?[6-9]\d{9}/g) || [];

  return NextResponse.json({
    isScam: result.isScam,
    threatScore: result.threatScore,
    verdict: result.verdict,
    confidence: result.confidence,
    matchedPatterns: result.matchedPatterns.map(p => ({
      category: p.category,
      severity: p.severity,
      description: p.description,
      matchedText: p.matchedText,
    })),
    detectedLinks: result.detectedLinks.map(l => ({
      url: l.url,
      isSuspicious: l.isSuspicious,
      reason: l.reason,
      domain: l.domain,
      isShortener: l.isShortener,
    })),
    urgencyScore: result.urgencyScore,
    evidence: result.evidence,
    warnings: result.warnings,
    recommendations: result.recommendations,
    detectedNumbers: phoneMatches,
  });
}
