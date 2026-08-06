/**
 * CallShield Number Reputation Page
 *
 * Server component — handles SEO metadata, structured data,
 * generateStaticParams for top scam numbers, and SSR data fetching.
 *
 * @ts-nocheck
 */

import type { Metadata } from 'next';
import { createClient } from '@supabase/supabase-js';
import NumberReputationClient from './numberreputationclient';

/* ------------------------------------------------------------------ */
/*  Shared Types                                                       */
/* ------------------------------------------------------------------ */

export interface ReputationData {
  phoneNumber: string;
  normalized: string;
  verdict: 'safe' | 'suspicious' | 'scam' | 'critical';
  threatScore: number;
  confidence: number;
  scamType: string | null;
  scamTypes: string[];
  severity: string;
  isScam: boolean;
  shouldBlock: boolean;
  carrier: string | null;
  telecomCircle: string | null;
  state: string | null;
  city: string | null;
  numberType: string;
  isIndian: boolean;
  countryName: string | null;
  isVoip: boolean;
  evidence: string[];
  warnings: string[];
  recommendations: string[];
  dbMatch: {
    found: boolean;
    reportCount: number;
    recentReportCount: number;
    verified: boolean;
    source: string | null;
  };
  // caller-id extras
  location: string | null;
  displayName: string | null;
  name: string | null;
  firstReportedAt: string | null;
  lastReportedAt: string | null;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
}

function formatPhone(phone: string): string {
  const digits = phone.replace(/[^0-9]/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  }
  if (digits.length === 11 && digits.startsWith('0')) {
    return `+91 ${digits.slice(1, 6)} ${digits.slice(6)}`;
  }
  if (digits.length === 10) {
    return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  }
  return phone;
}

function decodePhone(raw: string): string {
  let n = decodeURIComponent(raw).replace(/[^0-9+]/g, '');
  if (n.length === 10) n = '+91' + n;
  else if (n.length === 11 && n.startsWith('0')) n = '+91' + n.slice(1);
  else if (n.length === 12 && n.startsWith('91')) n = '+' + n;
  else if (n.length > 10 && !n.startsWith('+')) n = '+' + n;
  return n;
}

async function fetchReputationData(phone: string): Promise<ReputationData | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) return null;
  
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Normalize phone number
    const digits = phone.replace(/[^0-9]/g, '');
    let normalized = phone;
    if (digits.length === 10) normalized = '+91' + digits;
    else if (digits.length === 11 && digits.startsWith('0')) normalized = '+91' + digits.slice(1);
    else if (digits.length === 12 && digits.startsWith('91')) normalized = '+' + digits;
    else if (digits.length > 10 && !digits.startsWith('+')) normalized = '+' + digits;
    
    // Query scam_numbers directly
    const { data: scamData, error: scamErr } = await supabase
      .from('scam_numbers')
      .select('*')
      .or(`normalized_number.eq.${normalized},phone_number.eq.${normalized}`)
      .limit(1)
      .single();
    
    // Query prefixes for carrier/location
    const prefix4 = digits.length >= 10 ? digits.slice(digits.length-10, digits.length-6) : digits.slice(0,4);
    const { data: prefixData } = await supabase
      .from('indian_prefixes')
      .select('*')
      .eq('prefix', prefix4)
      .limit(1)
      .single();
    
    // Query intl patterns
    let countryCode = '';
    if (normalized.startsWith('+')) {
      const rest = normalized.slice(1);
      if (rest.startsWith('91')) countryCode = '91';
      else if (rest.startsWith('92')) countryCode = '92';
      else if (rest.startsWith('880')) countryCode = '880';
      else countryCode = rest.substring(0, rest.length-10 > 0 ? rest.length-10 : 1);
    }
    const { data: intlData } = await supabase
      .from('intl_scam_patterns')
      .select('*')
      .eq('country_code', countryCode)
      .eq('is_active', true)
      .limit(5);
    
    if (!scamData && !prefixData) return null;
    
    const d = scamData as any;
    const p = prefixData as any;
    const hasDb = !!d;
    
    const isScam = hasDb && (d.scam_type !== 'telemarketing' || (d.threat_score >= 40));
    const verdict = isScam 
      ? (d.severity === 'critical' ? 'critical' : d.severity === 'high' ? 'scam' : 'suspicious')
      : 'safe';
    
    const merged: ReputationData = {
      phoneNumber: d?.phone_number || phone,
      normalized: d?.normalized_number || normalized,
      verdict: verdict as any,
      threatScore: d?.threat_score ?? 0,
      confidence: hasDb ? 0.9 : 0.3,
      scamType: d?.scam_type || null,
      scamTypes: d?.scam_type ? [d.scam_type] : [],
      severity: d?.severity || 'low',
      isScam,
      shouldBlock: hasDb && (d.threat_score >= 40),
      carrier: d?.carrier || p?.carrier || null,
      telecomCircle: d?.telecom_circle || p?.telecom_circle || null,
      state: d?.state || p?.state || null,
      city: d?.city || null,
      numberType: d?.number_type || 'mobile',
      isIndian: normalized.startsWith('+91'),
      countryName: normalized.startsWith('+91') ? 'India' : (intlData?.[0] as any)?.country || null,
      isVoip: d?.is_voip || false,
      evidence: hasDb ? [`Found in scam database: ${d.report_count} reports`] : [],
      warnings: (intlData || []).map((r: any) => `International scam pattern: ${r.description}`),
      recommendations: isScam ? ['Block this number', 'Report to cyber cell'] : ['No action needed'],
      dbMatch: {
        found: hasDb,
        reportCount: d?.report_count || 0,
        recentReportCount: d?.recent_report_count || 0,
        verified: d?.verified || false,
        source: d?.source || null,
      },
      location: p?.telecom_circle || d?.telecom_circle || null,
      displayName: d?.scam_type ? d.scam_type.replace(/_/g, ' ') : null,
      name: null,
      firstReportedAt: d?.first_reported_at || null,
      lastReportedAt: d?.last_reported_at || null,
    };

    return merged;
  } catch (e) {
    console.error('[NumberPage] fetch error:', e);
    return null;
  }
}

/* ------------------------------------------------------------------ */
/*  generateStaticParams — Top 100 reported numbers                    */
/* ------------------------------------------------------------------ */

export async function generateStaticParams() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) return [];

  try {
    const supabase = createClient(url, key);
    const { data, error } = await supabase
      .from('scam_numbers')
      .select('normalized_number')
      .order('report_count', { ascending: false })
      .limit(20);

    if (error || !data) return [];

    return data.map((row: any) => ({
      phone: encodeURIComponent(row.normalized_number),
    }));
  } catch {
    return [];
  }
}

/* ------------------------------------------------------------------ */
/*  generateMetadata — SEO                                             */
/* ------------------------------------------------------------------ */

export async function generateMetadata({
  params,
}: {
  params: { phone: string };
}): Promise<Metadata> {
  const phone = decodePhone(params.phone);
  const displayPhone = formatPhone(phone);
  const data = await fetchReputationData(phone);

  const reportCount = data?.dbMatch?.reportCount || 0;
  const scamTypeLabel = data?.scamType
    ? data.scamType.replace(/_/g, ' ')
    : 'scam activity';
  const verdict = data?.verdict || 'scam';
  const verdictEmoji =
    verdict === 'critical' ? '🛑' : verdict === 'scam' ? '🚨' : verdict === 'suspicious' ? '⚠️' : '✅';

  const title = data
    ? `${verdictEmoji} Is ${displayPhone} a Scam? | CallShield India`
    : `Check ${displayPhone} | CallShield India`;

  const description = data?.dbMatch?.found
    ? `${displayPhone} has been reported ${reportCount} time${reportCount !== 1 ? 's' : ''} as ${scamTypeLabel}. Threat score: ${data.threatScore}/100. Verified by CallShield community.`
    : `Is ${displayPhone} a scam? Check community reports, carrier details, and threat analysis on CallShield India. Be the first to report this number!`;

  const baseUrl = getAppUrl();
  const ogImage = `${baseUrl}/api/og/number?phone=${encodeURIComponent(phone)}&score=${data?.threatScore || 0}&verdict=${verdict}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `${baseUrl}/number/${encodeURIComponent(phone)}`,
      siteName: 'CallShield India',
      type: 'website',
      images: [{ url: ogImage, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage],
    },
    alternates: {
      canonical: `${baseUrl}/number/${encodeURIComponent(phone)}`,
    },
    robots: data?.dbMatch?.found
      ? 'index, follow'
      : 'noindex, follow',
  };
}

/* ------------------------------------------------------------------ */
/*  Page Component                                                     */
/* ------------------------------------------------------------------ */

export default async function NumberPage({
  params,
}: {
  params: { phone: string };
}) {
  const phone = decodePhone(params.phone);

  // Fetch data server-side for initial render (SEO)
  const initialData = await fetchReputationData(phone);

  return (
    <NumberReputationClient
      phone={phone}
      initialData={initialData}
    />
  );
}
