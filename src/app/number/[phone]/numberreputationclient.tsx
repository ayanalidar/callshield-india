/**
 * CallShield Number Reputation — Client Component
 *
 * Mobile-first, notch-safe UI for scam number reputation pages.
 * SEO data (JSON-LD, meta) is handled by the server page.tsx.
 *
 * @ts-nocheck
 */

'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { ReputationData } from './page';

/* ------------------------------------------------------------------ */
/*  Constants                                                           */
/* ------------------------------------------------------------------ */

const VERDICT_COLORS: Record<string, string> = {
  safe: '#00e676',
  suspicious: '#ff9800',
  scam: '#ff3d3d',
  critical: '#d50000',
};

const VERDICT_EMOJI: Record<string, string> = {
  safe: '✅',
  suspicious: '⚠️',
  scam: '🚨',
  critical: '🛑',
};

const VERDICT_LABELS: Record<string, string> = {
  safe: 'SAFE',
  suspicious: 'SUSPICIOUS',
  scam: 'SCAM',
  critical: 'CRITICAL THREAT',
};

const SCAM_TYPE_ICONS: Record<string, string> = {
  upi_fraud: '💸',
  bank_otp_scam: '🏦',
  it_department: '📞',
  insurance: '📋',
  loan_app: '💰',
  fedex_customs: '📦',
  crypto: '₿',
  lottery: '🎰',
  ecommerce: '🛒',
  police_fake: '👮',
  aadhaar_kyc: '🪪',
  electricity: '⚡',
  sextortion: '🔞',
  wangiri: '📵',
  sms_phishing: '💬',
  job_scam: '💼',
  other: '⚠️',
};

/* ------------------------------------------------------------------ */
/*  Sub-Components                                                      */
/* ------------------------------------------------------------------ */

/** Circular threat score gauge (SVG) */
function ThreatGauge({ score, verdict }: { score: number; verdict: string }) {
  const color = VERDICT_COLORS[verdict] || '#00e676';
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.min(100, Math.max(0, score));
  const offset = circumference - (pct / 100) * circumference;

  return (
    <div className="rg-gauge">
      <svg width="110" height="110" viewBox="0 0 110 110" className="rg-svg">
        {/* Background track */}
        <circle
          cx="55" cy="55" r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="7"
        />
        {/* Score arc */}
        <circle
          cx="55" cy="55" r={radius}
          fill="none"
          stroke={color}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 55 55)"
          style={{ transition: 'stroke-dashoffset 1s ease-out' }}
        />
        {/* Soft glow */}
        <circle
          cx="55" cy="55" r={radius}
          fill="none"
          stroke={color}
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 55 55)"
          opacity="0.12"
          style={{ transition: 'stroke-dashoffset 1s ease-out' }}
        />
      </svg>
      <div className="rg-center">
        <div className="rg-score" style={{ color }}>{score}</div>
        <div className="rg-label">/100</div>
      </div>
    </div>
  );
}

/** Skeleton loader */
function Skeleton() {
  return (
    <div className="sk-wrap">
      <div className="sk-hero">
        <div className="sk-pill" />
        <div className="sk-phone" />
        <div className="sk-meta" />
      </div>
      <div className="sk-gauge" />
      <div className="sk-row">
        <div className="sk-box" />
        <div className="sk-box" />
      </div>
      <div className="sk-card">
        <div className="sk-line" />
        <div className="sk-line sk-line-s" />
        <div className="sk-line sk-line-s" />
      </div>
      <div className="sk-card">
        <div className="sk-line" />
        <div className="sk-line sk-line-s" />
      </div>
    </div>
  );
}

/** Report modal */
function ReportModal({
  phone,
  onClose,
}: {
  phone: string;
  onClose: () => void;
}) {
  const [scamType, setScamType] = useState('other');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const scamTypes = [
    { value: 'upi_fraud', label: 'UPI Payment Fraud' },
    { value: 'bank_otp_scam', label: 'Bank OTP Scam' },
    { value: 'it_department', label: 'IT Dept Impersonation' },
    { value: 'insurance', label: 'Insurance Scam' },
    { value: 'loan_app', label: 'Loan App Harassment' },
    { value: 'fedex_customs', label: 'FedEx/Customs Scam' },
    { value: 'crypto', label: 'Crypto Investment Scam' },
    { value: 'lottery', label: 'Lottery/Win Scam' },
    { value: 'ecommerce', label: 'E-commerce Fraud' },
    { value: 'police_fake', label: 'Fake Police Call' },
    { value: 'aadhaar_kyc', label: 'Aadhaar KYC Scam' },
    { value: 'electricity', label: 'Electricity Bill Scam' },
    { value: 'sextortion', label: 'Sextortion/Blackmail' },
    { value: 'wangiri', label: 'Wangiri Missed Call' },
    { value: 'sms_phishing', label: 'SMS Phishing' },
    { value: 'job_scam', label: 'Fake Job Offer' },
    { value: 'other', label: 'Other Scam' },
  ];

  const submit = async () => {
    setSubmitting(true);
    setError('');
    try {
      const r = await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: phone, scamType, description, spamScore: 5 }),
      });
      const d = await r.json();
      if (d.success) setDone(true);
      else setError(d.message || 'Failed to submit');
    } catch {
      setError('Network error. Try again.');
    }
    setSubmitting(false);
  };

  return (
    <div className="rm-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="rm-modal">
        {done ? (
          <div className="rm-done">
            <div className="rm-done-icon">✅</div>
            <div className="rm-done-title">Report Submitted!</div>
            <p className="rm-done-text">Thank you for helping protect the community. Your report will be reviewed.</p>
            <button className="rm-btn rm-btn-close" onClick={onClose}>Close</button>
          </div>
        ) : (
          <>
            <div className="rm-header">
              <div className="rm-title">📢 Report This Number</div>
              <button className="rm-x" onClick={onClose}>✕</button>
            </div>
            <div className="rm-phone">{phone}</div>
            <label className="rm-label">Scam Type</label>
            <select className="rm-sel" value={scamType} onChange={(e) => setScamType(e.target.value)}>
              {scamTypes.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <label className="rm-label">Description (optional)</label>
            <textarea
              className="rm-textarea"
              placeholder="Describe what happened..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              maxLength={500}
            />
            {error && <div className="rm-err">⚠️ {error}</div>}
            <button className="rm-btn" onClick={submit} disabled={submitting}>
              {submitting ? 'Submitting...' : 'Submit Report'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/** Toast notification */
function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2000);
    return () => clearTimeout(t);
  }, [onDone]);
  return <div className="toast">{message}</div>;
}

/* ------------------------------------------------------------------ */
/*  Main Client Component                                               */
/* ------------------------------------------------------------------ */

interface Props {
  phone: string;
  initialData: ReputationData | null;
}

export default function NumberReputationClient({ phone, initialData }: Props) {
  const router = useRouter();
  const [data, setData] = useState<ReputationData | null>(initialData);
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [searchPhone, setSearchPhone] = useState('');

  // Fetch data if not provided server-side (ISR fallback)
  useEffect(() => {
    if (initialData) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const [lookupRes, callerRes] = await Promise.all([
          fetch('/api/lookup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phoneNumber: phone, protectionLevel: 'standard', includeDbDetails: true }),
          }),
          fetch('/api/caller-id', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phoneNumber: phone }),
          }),
        ]);
        const lookupData = lookupRes.ok ? await lookupRes.json() : null;
        const callerData = callerRes.ok ? await callerRes.json() : null;
        if (cancelled) return;

        if (!lookupData && !callerData) { setError(true); return; }

        setData({
          phoneNumber: lookupData?.phoneNumber || callerData?.phoneNumber || phone,
          normalized: lookupData?.normalized || phone,
          verdict: lookupData?.verdict || callerData?.verdict || 'safe',
          threatScore: lookupData?.threatScore ?? callerData?.threatScore ?? 0,
          confidence: lookupData?.confidence ?? 0.5,
          scamType: lookupData?.scamType || callerData?.scamType || null,
          scamTypes: lookupData?.scamTypes || [],
          severity: lookupData?.severity || callerData?.severity || 'low',
          isScam: lookupData?.isScam ?? callerData?.isScam ?? false,
          shouldBlock: lookupData?.shouldBlock ?? callerData?.shouldBlock ?? false,
          carrier: lookupData?.carrier || callerData?.carrier || null,
          telecomCircle: lookupData?.telecomCircle || callerData?.telecomCircle || null,
          state: lookupData?.state || callerData?.state || null,
          city: lookupData?.city || callerData?.city || null,
          numberType: lookupData?.numberType || callerData?.numberType || 'mobile',
          isIndian: lookupData?.isIndian ?? callerData?.isIndian ?? true,
          countryName: lookupData?.countryName || null,
          isVoip: lookupData?.isVoip ?? callerData?.isVoip ?? false,
          evidence: lookupData?.evidence || [],
          warnings: lookupData?.warnings || callerData?.warnings || [],
          recommendations: lookupData?.recommendations || [],
          dbMatch: lookupData?.dbMatch || { found: false, reportCount: 0, recentReportCount: 0, verified: false, source: null },
          location: callerData?.location || null,
          displayName: callerData?.displayName || null,
          name: callerData?.name || null,
          firstReportedAt: null,
          lastReportedAt: null,
        } as ReputationData);
      } catch { if (!cancelled) setError(true); }
      if (!cancelled) setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [phone, initialData]);

  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = searchPhone.replace(/[^0-9+]/g, '');
    if (cleaned.length >= 8) {
      router.push(`/number/${encodeURIComponent(cleaned)}`);
    }
  }, [searchPhone, router]);

  // Copy link
  const copyLink = useCallback(() => {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      setToast('Link copied!');
    }).catch(() => setToast('Failed to copy'));
  }, []);

  // Share URLs
  const shareText = typeof window !== 'undefined'
    ? encodeURIComponent(`🚨 Is ${phone} a scam? Check on CallShield India: ${window.location.href}`)
    : '';
  const whatsappShare = `https://wa.me/?text=${shareText}`;
  const telegramShare = `https://t.me/share/url?url=${encodeURIComponent(typeof window !== 'undefined' ? window.location.href : '')}&text=${shareText}`;

  /* ---- Loading ---- */
  if (loading) {
    return (
      <>
        <style>{CSS}</style>
        <div className="pg-wrap">
          <TopBar phone={phone} />
          <Skeleton />
        </div>
      </>
    );
  }

  /* ---- Error / Not Found ---- */
  if (error || !data) {
    return (
      <>
        <style>{CSS}</style>
        <div className="pg-wrap">
          <TopBar phone={phone} />
          <div className="not-found">
            <div className="nf-icon">🔍</div>
            <div className="nf-title">Number Not Found</div>
            <p className="nf-text">
              {phone} is not yet in our scam database. Be the first to report it and help protect the community!
            </p>
            <button className="nf-btn" onClick={() => setShowReport(true)}>
              📢 Report This Number
            </button>
            <form className="nf-search" onSubmit={handleSearch}>
              <input
                className="nf-inp"
                type="tel"
                placeholder="+91 98765 43210"
                value={searchPhone}
                onChange={(e) => setSearchPhone(e.target.value)}
              />
              <button className="nf-search-btn" type="submit">Check</button>
            </form>
          </div>
          {showReport && <ReportModal phone={phone} onClose={() => setShowReport(false)} />}
        </div>
      </>
    );
  }

  /* ---- Main Page ---- */
  const v = data.verdict;
  const color = VERDICT_COLORS[v] || '#00e676';
  const emoji = VERDICT_EMOJI[v] || '✅';
  const label = VERDICT_LABELS[v] || 'UNKNOWN';
  const displayPhone = formatPhoneDisplay(phone);
  const scamIcon = data.scamType ? (SCAM_TYPE_ICONS[data.scamType] || '⚠️') : '📞';
  const scamLabel = data.scamType ? data.scamType.replace(/_/g, ' ') : 'Not classified';
  const reportCount = data.dbMatch.reportCount || 0;
  const hasReports = data.dbMatch.found;

  // Build structured data (JSON-LD)
  const jsonLd: any = {
    '@context': 'https://schema.org',
    '@type': 'Report',
    name: `Scam Report: ${displayPhone}`,
    about: {
      '@type': 'Thing',
      name: displayPhone,
      description: `${displayPhone} - ${label} phone number reported for ${scamLabel}`,
    },
    url: typeof window !== 'undefined' ? window.location.href : '',
    datePublished: data.firstReportedAt || undefined,
    author: {
      '@type': 'Organization',
      name: 'CallShield India',
      url: typeof window !== 'undefined' ? window.location.origin : '',
    },
  };

  if (data.dbMatch.found) {
    jsonLd.reportedCount = reportCount;
    jsonLd.verified = data.dbMatch.verified;
  }

  return (
    <>
      <style>{CSS}</style>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="pg-wrap">
        <TopBar phone={phone} />

        {/* ── Hero ── */}
        <section className="hero" style={{ borderColor: color }}>
          <div className="hero-badge" style={{ background: color + '18', color, borderColor: color + '40' }}>
            {emoji}&nbsp;{label}
          </div>
          <h1 className="hero-phone">{displayPhone}</h1>
          {data.displayName && (
            <div className="hero-display">{data.displayName}</div>
          )}
          <div className="hero-meta">
            {data.carrier && <span className="hero-meta-chip">{data.carrier}</span>}
            {data.numberType && <span className="hero-meta-chip">{data.numberType}</span>}
            {data.isVoip && <span className="hero-meta-chip hero-meta-voip">VoIP</span>}
          </div>
        </section>

        {/* ── Threat Gauge ── */}
        <section className="card card-center">
          <ThreatGauge score={data.threatScore} verdict={v} />
          <div className="gauge-detail">
            <span className="gauge-conf">Confidence: {Math.round(data.confidence * 100)}%</span>
          </div>
        </section>

        {/* ── Scam Type + Reports ── */}
        <section className="card">
          <div className="info-grid">
            <div className="info-item">
              <div className="info-label">Scam Type</div>
              <div className="info-val info-scam-type">
                <span className="scam-icon">{scamIcon}</span>
                <span style={{ textTransform: 'capitalize' }}>{scamLabel}</span>
              </div>
            </div>
            <div className="info-item">
              <div className="info-label">Community Reports</div>
              <div className="info-val">
                <span className="info-big">{reportCount}</span>
                {data.dbMatch.recentReportCount > 0 && (
                  <span className="info-trend info-trend-up">
                    ↑ {data.dbMatch.recentReportCount} recent
                  </span>
                )}
                {data.dbMatch.verified && (
                  <span className="info-verified">✓ Verified</span>
                )}
              </div>
            </div>
            <div className="info-item">
              <div className="info-label">Severity</div>
              <div className={`info-val info-sev info-sev-${data.severity}`}>
                {data.severity.toUpperCase()}
              </div>
            </div>
            <div className="info-item">
              <div className="info-label">Recommendation</div>
              <div className={`info-val ${data.shouldBlock ? 'info-block' : 'info-safe'}`}>
                {data.shouldBlock ? '🛑 Block' : '✅ Safe'}
              </div>
            </div>
          </div>
          {/* Additional scam types */}
          {data.scamTypes.length > 1 && (
            <div className="scam-type-list">
              <span className="info-label">Also reported as:</span>
              <div className="scam-chips">
                {data.scamTypes.filter((t) => t !== data.scamType).slice(0, 4).map((t) => (
                  <span key={t} className="scam-chip">{SCAM_TYPE_ICONS[t] || '⚠️'} {t.replace(/_/g, ' ')}</span>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* ── Location & Carrier ── */}
        <section className="card">
          <div className="card-title">📍 Location & Carrier</div>
          <div className="info-grid info-grid-2">
            <div className="info-item">
              <div className="info-label">Carrier</div>
              <div className="info-val">{data.carrier || 'Unknown'}</div>
            </div>
            <div className="info-item">
              <div className="info-label">Number Type</div>
              <div className="info-val" style={{ textTransform: 'capitalize' }}>{data.numberType || 'Unknown'}</div>
            </div>
            <div className="info-item">
              <div className="info-label">Telecom Circle</div>
              <div className="info-val">{data.telecomCircle || data.state || 'Unknown'}</div>
            </div>
            <div className="info-item">
              <div className="info-label">Location</div>
              <div className="info-val">{data.location || data.city || (data.isIndian ? 'India' : data.countryName || 'Unknown')}</div>
            </div>
            {!data.isIndian && (
              <div className="info-item info-full">
                <div className="info-label">Country</div>
                <div className="info-val">{data.countryName || 'International'}</div>
              </div>
            )}
          </div>
        </section>

        {/* ── Warnings ── */}
        {data.warnings.length > 0 && (
          <section className="card card-warn">
            <div className="card-title">⚠️ Security Warnings</div>
            {data.warnings.map((w, i) => (
              <div key={i} className="warn-item">{w}</div>
            ))}
          </section>
        )}

        {/* ── Recommendations ── */}
        {data.recommendations.length > 0 && (
          <section className="card">
            <div className="card-title">🛡️ Recommendations</div>
            {data.recommendations.map((r, i) => (
              <div key={i} className="rec-item">{r}</div>
            ))}
          </section>
        )}

        {/* ── Evidence ── */}
        {data.evidence.length > 0 && (
          <section className="card">
            <div className="card-title">📋 Evidence</div>
            {data.evidence.map((e, i) => (
              <div key={i} className="evi-item">
                <span className="evi-bullet">▸</span>
                <span>{e}</span>
              </div>
            ))}
          </section>
        )}

        {/* ── Report Timeline ── */}
        {hasReports && (
          <section className="card">
            <div className="card-title">📊 Report Stats</div>
            <div className="timeline">
              <div className="tl-row">
                <span className="tl-label">Total Reports</span>
                <span className="tl-val">{reportCount}</span>
              </div>
              <div className="tl-row">
                <span className="tl-label">Recent (30 days)</span>
                <span className="tl-val">{data.dbMatch.recentReportCount}</span>
              </div>
              <div className="tl-row">
                <span className="tl-label">Verification</span>
                <span className={`tl-val ${data.dbMatch.verified ? 'tl-verified' : 'tl-pending'}`}>
                  {data.dbMatch.verified ? '✓ Verified' : 'Pending'}
                </span>
              </div>
              <div className="tl-row">
                <span className="tl-label">Data Source</span>
                <span className="tl-val">{data.dbMatch.source || 'Community reports'}</span>
              </div>
            </div>
          </section>
        )}

        {/* ── Actions ── */}
        <section className="actions">
          <button className="act-btn act-btn-report" onClick={() => setShowReport(true)}>
            📢 Report This Number
          </button>

          <form className="act-search" onSubmit={handleSearch}>
            <input
              className="act-inp"
              type="tel"
              placeholder="Check another number..."
              value={searchPhone}
              onChange={(e) => setSearchPhone(e.target.value)}
            />
            <button className="act-search-btn" type="submit">🔍</button>
          </form>

          <a href="/dashboard" className="act-btn act-btn-cta">
            🛡️ Get CallShield Protection
          </a>

          {/* Share */}
          <div className="share-row">
            <span className="share-label">Share this report:</span>
            <div className="share-btns">
              <a href={whatsappShare} target="_blank" rel="noopener noreferrer" className="share-btn share-wa" title="WhatsApp">
                💬
              </a>
              <a href={telegramShare} target="_blank" rel="noopener noreferrer" className="share-btn share-tg" title="Telegram">
                ✈️
              </a>
              <button className="share-btn share-copy" onClick={copyLink} title="Copy Link">
                🔗
              </button>
            </div>
          </div>
        </section>

        {/* ── Footer ── */}
        <footer className="pg-footer">
          <div className="ft-brand">🛡️ CallShield India</div>
          <div className="ft-text">
            AI-powered scam call protection for every Indian. Community-driven database helps identify and block scam numbers in real-time.
          </div>
          <div className="ft-links">
            <a href="/dashboard">Dashboard</a>
            <span>·</span>
            <a href="/trends">Trends</a>
            <span>·</span>
            <a href="/wiki">Encyclopedia</a>
            <span>·</span>
            <a href="/scanner">Scanner</a>
          </div>
        </footer>
      </div>

      {/* Modals */}
      {showReport && <ReportModal phone={phone} onClose={() => setShowReport(false)} />}
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Top Bar                                                             */
/* ------------------------------------------------------------------ */

function TopBar({ phone }: { phone: string }) {
  return (
    <header className="topbar">
      <a href="/dashboard" className="tb-back">← Dashboard</a>
      <a href="/" className="tb-logo">🛡️ CallShield</a>
    </header>
  );
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */

function formatPhoneDisplay(phone: string): string {
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

/* ------------------------------------------------------------------ */
/*  Styles — Mobile-first, notch-safe, dark green theme                */
/* ------------------------------------------------------------------ */

const CSS = `
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  :root{
    --bg:#060e08;--surface:#0b1a0f;--card:#0e1f13;--border:#142a1b;
    --accent:#00e676;--text:#e0f2e9;--text2:#9ab7a5;--muted:#4a6b58;
    --danger:#ff3d3d;--warn:#ff9800;
    --r:12px;--rs:8px;
    --safe-top:env(safe-area-inset-top,0px);
    --safe-bottom:env(safe-area-inset-bottom,0px);
    --safe-left:env(safe-area-inset-left,0px);
    --safe-right:env(safe-area-inset-right,0px);
  }
  body{
    font-family:'Space Grotesk','Inter',system-ui,sans-serif;
    background:var(--bg);color:var(--text);
    -webkit-font-smoothing:antialiased;
    overscroll-behavior:none;
  }
  a{text-decoration:none;color:inherit}

  /* ── Page Wrap ── */
  .pg-wrap{
    min-height:100dvh;
    padding:var(--safe-top) var(--safe-right) var(--safe-bottom) var(--safe-left);
    padding-bottom:max(40px,var(--safe-bottom));
    background:radial-gradient(ellipse 50% 30% at 50% 15%,rgba(0,230,118,.04),transparent 60%);
  }

  /* ── Top Bar ── */
  .topbar{
    display:flex;align-items:center;justify-content:space-between;
    padding:14px 16px;position:sticky;top:0;z-index:10;
    background:rgba(6,14,8,.85);backdrop-filter:blur(16px);
    -webkit-backdrop-filter:blur(16px);
    border-bottom:1px solid var(--border);
  }
  .tb-back{font-size:13px;color:var(--accent);font-weight:600;display:flex;align-items:center;gap:4px}
  .tb-logo{font-size:14px;font-weight:800;display:flex;align-items:center;gap:6px}

  /* ── Hero ── */
  .hero{
    text-align:center;padding:32px 16px 24px;
    border-bottom:2px solid var(--border);
  }
  .hero-badge{
    display:inline-flex;align-items:center;gap:4px;
    padding:6px 16px;border-radius:20px;
    font-size:14px;font-weight:800;letter-spacing:.5px;
    border:1px solid;
    margin-bottom:12px;
  }
  .hero-phone{
    font-size:clamp(22px,6vw,32px);
    font-family:'JetBrains Mono',monospace;
    font-weight:700;letter-spacing:1px;
    margin:8px 0;word-break:break-all;
  }
  .hero-display{
    font-size:13px;color:var(--muted);margin-top:4px;
  }
  .hero-meta{
    display:flex;flex-wrap:wrap;justify-content:center;gap:6px;margin-top:10px;
  }
  .hero-meta-chip{
    background:rgba(0,230,118,.06);border:1px solid var(--border);
    border-radius:16px;padding:3px 10px;font-size:10px;
    color:var(--text2);text-transform:capitalize;
  }
  .hero-meta-voip{background:rgba(255,152,0,.08);border-color:rgba(255,152,0,.2);color:var(--warn)}

  /* ── Card ── */
  .card{
    background:var(--card);border:1px solid var(--border);
    border-radius:var(--r);padding:16px;margin:12px 16px;
    width:auto;
  }
  .card-center{display:flex;flex-direction:column;align-items:center}
  .card-title{
    font-size:13px;font-weight:700;margin-bottom:10px;
    display:flex;align-items:center;gap:6px;
  }
  .card-warn{
    background:rgba(255,61,61,.04);border-color:rgba(255,61,61,.2);
  }

  /* ── Gauge ── */
  .rg-gauge{position:relative;display:inline-flex}
  .rg-svg{display:block}
  .rg-center{
    position:absolute;inset:0;display:flex;flex-direction:column;
    align-items:center;justify-content:center;
  }
  .rg-score{font-size:28px;font-weight:800;line-height:1}
  .rg-label{font-size:10px;color:var(--muted);margin-top:2px}
  .gauge-detail{margin-top:8px}
  .gauge-conf{font-size:11px;color:var(--muted)}

  /* ── Info Grid ── */
  .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
  .info-grid-2 .info-item:nth-child(3),
  .info-grid-2 .info-item:nth-child(4){margin-top:0}
  .info-item{display:flex;flex-direction:column;gap:3px;min-width:0}
  .info-full{grid-column:1/-1}
  .info-label{font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px}
  .info-val{font-size:12px;font-weight:600;word-break:break-word}
  .info-big{font-size:20px;font-weight:800;color:var(--accent)}
  .info-scam-type{display:flex;align-items:center;gap:6px}
  .scam-icon{font-size:16px}
  .info-trend{font-size:10px;margin-left:6px;display:inline-flex;align-items:center;gap:2px}
  .info-trend-up{color:var(--danger)}
  .info-verified{
    display:inline-flex;align-items:center;gap:2px;
    font-size:9px;color:var(--accent);
    background:rgba(0,230,118,.1);padding:2px 6px;border-radius:4px;
    margin-left:6px;
  }
  .info-sev{font-size:10px;padding:2px 8px;border-radius:4px;display:inline-block;align-self:flex-start}
  .info-sev-critical{color:#ff5252;background:rgba(213,0,0,.12)}
  .info-sev-high{color:#ff5252;background:rgba(255,61,61,.08)}
  .info-sev-medium{color:#ff9800;background:rgba(255,152,0,.08)}
  .info-sev-low{color:#00e676;background:rgba(0,230,118,.08)}
  .info-block{color:#ff5252;background:rgba(255,61,61,.08);padding:2px 8px;border-radius:4px;display:inline-block;align-self:flex-start}
  .info-safe{color:#00e676;background:rgba(0,230,118,.08);padding:2px 8px;border-radius:4px;display:inline-block;align-self:flex-start}

  .scam-type-list{margin-top:12px;padding-top:10px;border-top:1px solid var(--border)}
  .scam-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}
  .scam-chip{
    background:rgba(0,230,118,.04);border:1px solid var(--border);
    border-radius:16px;padding:3px 10px;font-size:10px;
    color:var(--text2);text-transform:capitalize;
  }

  /* ── Warnings ── */
  .warn-item{
    padding:10px 12px;margin:4px 0;
    background:rgba(255,61,61,.06);border:1px solid rgba(255,61,61,.12);
    border-radius:8px;font-size:12px;color:#ff6b6b;
    display:flex;align-items:flex-start;gap:8px;
  }
  .warn-item::before{content:'⚠️';flex-shrink:0;font-size:14px}

  /* ── Recommendations ── */
  .rec-item{
    padding:8px 12px;margin:3px 0;
    background:rgba(0,230,118,.04);border-radius:8px;
    font-size:11px;color:var(--text2);
    display:flex;align-items:flex-start;gap:8px;
  }
  .rec-item::before{content:'▸';color:var(--accent);flex-shrink:0}

  /* ── Evidence ── */
  .evi-item{
    padding:6px 10px;margin:2px 0;
    border-radius:6px;font-size:10px;color:var(--muted);
    display:flex;align-items:flex-start;gap:8px;
  }
  .evi-bullet{color:var(--accent);flex-shrink:0}

  /* ── Report Timeline ── */
  .timeline{display:flex;flex-direction:column;gap:8px}
  .tl-row{display:flex;justify-content:space-between;align-items:center;padding:6px 0}
  .tl-row:not(:last-child){border-bottom:1px solid rgba(255,255,255,.04)}
  .tl-label{font-size:11px;color:var(--muted)}
  .tl-val{font-size:11px;font-weight:600}
  .tl-verified{color:var(--accent)}
  .tl-pending{color:var(--warn)}

  /* ── Actions ── */
  .actions{
    display:flex;flex-direction:column;gap:10px;
    margin:16px 16px 0;padding:16px;
    background:var(--card);border:1px solid var(--border);border-radius:var(--r);
  }
  .act-btn{
    display:flex;align-items:center;justify-content:center;gap:6px;
    width:100%;padding:13px;border-radius:8px;
    font-size:13px;font-weight:700;font-family:inherit;
    cursor:pointer;text-align:center;transition:opacity .15s;
  }
  .act-btn:active{opacity:.75}
  .act-btn-report{
    background:rgba(255,61,61,.12);color:var(--danger);
    border:1px solid rgba(255,61,61,.25);
  }
  .act-btn-report:hover{background:rgba(255,61,61,.18)}
  .act-btn-cta{
    background:var(--accent);color:#050c07;border:none;
  }
  .act-search{display:flex;gap:8px;width:100%}
  .act-inp{
    flex:1;min-width:0;
    background:#050a05;border:1px solid var(--border);border-radius:8px;
    padding:11px 14px;color:var(--text);font-size:14px;
    font-family:'JetBrains Mono',monospace;outline:none;
  }
  .act-inp:focus{border-color:var(--accent)}
  .act-search-btn{
    background:var(--accent);color:#050c07;border:none;
    border-radius:8px;padding:11px 16px;font-size:16px;
    font-family:inherit;cursor:pointer;
  }
  .act-search-btn:active{opacity:.75}

  /* ── Share ── */
  .share-row{
    display:flex;align-items:center;justify-content:space-between;
    margin-top:4px;flex-wrap:wrap;gap:8px;
  }
  .share-label{font-size:10px;color:var(--muted)}
  .share-btns{display:flex;gap:8px}
  .share-btn{
    width:38px;height:38px;display:flex;align-items:center;justify-content:center;
    border-radius:50%;font-size:18px;cursor:pointer;
    background:rgba(255,255,255,.04);border:1px solid var(--border);
    transition:background .15s;
  }
  .share-btn:hover{background:rgba(255,255,255,.08)}
  .share-wa:hover{background:rgba(37,211,102,.15)}
  .share-tg:hover{background:rgba(0,136,204,.15)}
  .share-copy{
    background:rgba(0,230,118,.06);border-color:rgba(0,230,118,.2);
    font-size:16px;font-family:inherit;color:var(--text);
  }

  /* ── Footer ── */
  .pg-footer{
    text-align:center;padding:24px 16px 32px;margin-top:8px;
  }
  .ft-brand{font-size:14px;font-weight:800;margin-bottom:8px}
  .ft-text{font-size:10px;color:var(--muted);max-width:360px;margin:0 auto 12px;line-height:1.5}
  .ft-links{display:flex;justify-content:center;gap:10px;font-size:11px;color:var(--text2);flex-wrap:wrap}
  .ft-links a{color:var(--muted);transition:color .15s}
  .ft-links a:hover{color:var(--accent)}

  /* ── Not Found ── */
  .not-found{
    display:flex;flex-direction:column;align-items:center;
    padding:48px 24px;text-align:center;gap:16px;
  }
  .nf-icon{font-size:56px}
  .nf-title{font-size:20px;font-weight:700}
  .nf-text{font-size:13px;color:var(--muted);max-width:320px;line-height:1.5}
  .nf-btn{
    background:rgba(255,61,61,.1);color:var(--danger);
    border:1px solid rgba(255,61,61,.2);
    padding:12px 28px;border-radius:8px;font-size:13px;font-weight:700;
    font-family:inherit;cursor:pointer;
  }
  .nf-btn:active{opacity:.75}
  .nf-search{display:flex;gap:8px;width:100%;max-width:340px}
  .nf-inp{
    flex:1;min-width:0;
    background:#050a05;border:1px solid var(--border);border-radius:8px;
    padding:11px 14px;color:var(--text);font-size:14px;
    font-family:'JetBrains Mono',monospace;outline:none;
  }
  .nf-inp:focus{border-color:var(--accent)}
  .nf-search-btn{
    background:var(--accent);color:#050c07;border:none;
    border-radius:8px;padding:11px 18px;font-size:13px;font-weight:700;
    font-family:inherit;cursor:pointer;
  }

  /* ── Report Modal ── */
  .rm-overlay{
    position:fixed;inset:0;z-index:100;
    background:rgba(0,0,0,.7);backdrop-filter:blur(4px);
    display:flex;align-items:flex-end;justify-content:center;
    padding:max(20px,var(--safe-top)) max(16px,var(--safe-right)) max(20px,var(--safe-bottom)) max(16px,var(--safe-left));
  }
  @media(min-width:480px){
    .rm-overlay{align-items:center}
  }
  .rm-modal{
    background:var(--surface);border:1px solid var(--border);
    border-radius:16px;padding:20px;width:100%;max-width:420px;
    max-height:85dvh;overflow-y:auto;
  }
  @media(max-width:479px){
    .rm-modal{border-radius:16px 16px 0 0}
  }
  .rm-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}
  .rm-title{font-size:16px;font-weight:700}
  .rm-x{
    background:none;border:none;color:var(--muted);font-size:18px;
    cursor:pointer;padding:4px;font-family:inherit;
  }
  .rm-phone{
    font-size:18px;font-family:'JetBrains Mono',monospace;font-weight:600;
    margin-bottom:16px;word-break:break-all;
  }
  .rm-label{display:block;font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px}
  .rm-sel{
    width:100%;background:#050a05;border:1px solid var(--border);
    border-radius:8px;padding:10px 12px;color:var(--text);font-size:13px;
    font-family:inherit;outline:none;margin-bottom:16px;cursor:pointer;
  }
  .rm-sel:focus{border-color:var(--accent)}
  .rm-textarea{
    width:100%;background:#050a05;border:1px solid var(--border);
    border-radius:8px;padding:10px 12px;color:var(--text);font-size:12px;
    font-family:inherit;outline:none;resize:vertical;margin-bottom:16px;
  }
  .rm-textarea:focus{border-color:var(--accent)}
  .rm-err{background:rgba(255,61,61,.06);padding:8px 12px;border-radius:6px;color:var(--danger);font-size:11px;margin-bottom:12px;display:flex;align-items:center;gap:6px}
  .rm-btn{
    width:100%;padding:12px;background:var(--accent);color:#050c07;
    border:none;border-radius:8px;font-size:13px;font-weight:700;
    font-family:inherit;cursor:pointer;transition:opacity .15s;
  }
  .rm-btn:active{opacity:.75}
  .rm-btn:disabled{opacity:.35;cursor:default}
  .rm-btn-close{background:var(--card);color:var(--text);border:1px solid var(--border);margin-top:12px}

  .rm-done{text-align:center;padding:12px 0}
  .rm-done-icon{font-size:48px;margin-bottom:12px}
  .rm-done-title{font-size:18px;font-weight:700;margin-bottom:8px}
  .rm-done-text{font-size:12px;color:var(--muted);margin-bottom:16px;line-height:1.5}

  /* ── Toast ── */
  .toast{
    position:fixed;bottom:max(20px,var(--safe-bottom));left:50%;transform:translateX(-50%);
    background:var(--accent);color:#050c07;padding:12px 28px;
    border-radius:24px;font-size:13px;font-weight:700;
    z-index:200;box-shadow:0 4px 24px rgba(0,230,118,.25);
    animation:toastIn .25s ease-out;
  }
  @keyframes toastIn{from{opacity:0;transform:translateX(-50%) translateY(10px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}

  /* ── Skeleton ── */
  .sk-wrap{padding:0 16px}
  .sk-hero{display:flex;flex-direction:column;align-items:center;padding:32px 0 24px;gap:10px}
  .sk-pill{width:100px;height:28px;border-radius:20px;background:var(--card);animation:skPulse 1.5s infinite}
  .sk-phone{width:220px;height:32px;border-radius:6px;background:var(--card);animation:skPulse 1.5s infinite;animation-delay:.1s}
  .sk-meta{width:150px;height:14px;border-radius:6px;background:var(--card);animation:skPulse 1.5s infinite;animation-delay:.2s}
  .sk-gauge{width:110px;height:110px;border-radius:50%;background:var(--card);margin:0 auto;animation:skPulse 1.5s infinite;animation-delay:.3s}
  .sk-row{display:flex;gap:12px;margin:12px 0}
  .sk-box{flex:1;height:60px;border-radius:var(--r);background:var(--card);animation:skPulse 1.5s infinite;animation-delay:.1s}
  .sk-card{margin:12px 0;padding:16px;border-radius:var(--r);background:var(--card);display:flex;flex-direction:column;gap:8px}
  .sk-line{width:70%;height:12px;border-radius:4px;background:var(--border);animation:skPulse 1.5s infinite}
  .sk-line-s{width:45%;animation-delay:.1s}
  @keyframes skPulse{0%,100%{opacity:.4}50%{opacity:.8}}

  /* ── Responsive ── */
  @media(min-width:600px){
    .pg-wrap{max-width:600px;margin:0 auto}
    .hero{padding:40px 24px 28px}
    .info-grid{grid-template-columns:repeat(2,1fr)}
  }
`;
