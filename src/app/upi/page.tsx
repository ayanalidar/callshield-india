'use client';

/**
 * CallShield UPI Scam Check
 *
 * Search any UPI ID or phone number before sending money.
 * Color‑coded verdict with risk details.
 * Dark green theme, mobile‑first, notch‑safe.
 */

import { useState } from 'react';
import Link from 'next/link';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface UPICheckResult {
  risk: 'SAFE' | 'LOW_RISK' | 'SUSPICIOUS' | 'HIGH_RISK' | 'INVALID';
  scamReports: number;
  categories: string[];
  recommendation: string;
  numberIntel?: {
    normalized: string;
    carrier?: string;
    telecomCircle?: string;
    isIndian: boolean;
  };
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const RISK_COLORS: Record<string, string> = {
  SAFE: '#00e676',
  LOW_RISK: '#ff9800',
  SUSPICIOUS: '#ff9800',
  HIGH_RISK: '#ff3d3d',
  INVALID: '#ff3d3d',
};

const RISK_ICONS: Record<string, string> = {
  SAFE: '✅',
  LOW_RISK: '⚠️',
  SUSPICIOUS: '⚠️',
  HIGH_RISK: '🚨',
  INVALID: '❌',
};

const RISK_LABELS: Record<string, string> = {
  SAFE: 'Safe',
  LOW_RISK: 'Low Risk',
  SUSPICIOUS: 'Suspicious',
  HIGH_RISK: 'High Risk',
  INVALID: 'Invalid',
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function UPICheckPage() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<UPICheckResult | null>(null);
  const [error, setError] = useState('');
  const time = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

  const isUpi = query.includes('@');
  const placeholder = isUpi
    ? 'name@bankhandle (e.g., name@okhdfcbank)'
    : 'Enter UPI ID or phone number';

  const handleCheck = async () => {
    const q = query.trim();
    if (!q) { setError('Enter a UPI ID or phone number'); return; }
    setLoading(true); setError(''); setResult(null);
    try {
      const body: Record<string, string> = q.includes('@')
        ? { upiId: q }
        : { phoneNumber: q };

      const res = await fetch('/api/upi/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Check failed');
      setResult(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const color = result ? RISK_COLORS[result.risk] || '#00e676' : 'var(--accent)';

  return (
    <>
      <style>{CSS}</style>
      <div className="upi-main">
        {/* Header */}
        <header className="upi-top">
          <Link href="/dashboard" className="upi-back">←</Link>
          <div className="upi-top-t">💸 UPI Safety Check</div>
          <span className="upi-time">{time}</span>
        </header>

        <div className="upi-body">
          {/* Search */}
          <div className="upi-card">
            <div className="upi-card-head">
              <span>🔍 Check Before You Pay</span>
              <span className="upi-card-badge">Free</span>
            </div>
            <p className="upi-card-desc">
              Verify any UPI ID or phone number against our scam database before sending money
            </p>
            <div className="upi-row">
              <input
                className="upi-inp"
                type="text"
                placeholder={placeholder}
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCheck()}
                autoFocus
              />
              <button className="upi-btn" onClick={handleCheck} disabled={loading || !query.trim()}>
                {loading ? '…' : 'Check'}
              </button>
            </div>
            {error && <div className="upi-err">⚠️ {error}</div>}

            {/* Quick examples */}
            {!result && !loading && (
              <div className="upi-chips">
                <span className="upi-chip-l">Try:</span>
                {[
                  { l: 'Fake SBI', v: 'fraud@oksbi' },
                  { l: 'Scam UPI', v: 'verify@paytm.cc' },
                  { l: 'Scam Phone', v: '+919988776655' },
                ].map(e => (
                  <button key={e.v} className="upi-chip"
                    onClick={() => { setQuery(e.v); setTimeout(() => handleCheck(), 50); }}>
                    {e.l}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Result */}
          {result && (
            <div className="upi-card upi-res-card" style={{ borderColor: color + '44' }}>
              {/* Verdict Banner */}
              <div className="upi-verdict" style={{ background: color + '10', borderColor: color + '33' }}>
                <div className="upi-verdict-icon" style={{ fontSize: 40 }}>
                  {RISK_ICONS[result.risk]}
                </div>
                <div>
                  <div className="upi-verdict-label" style={{ color }}>
                    {RISK_LABELS[result.risk]}
                  </div>
                  <div className="upi-verdict-rec">{result.recommendation}</div>
                </div>
              </div>

              {/* Details */}
              <div className="upi-details">
                {(result.scamReports > 0 || result.categories.length > 0) && (
                  <div className="upi-detail-row">
                    <div className="upi-detail-i">
                      <span className="upi-detail-l">Scam Reports</span>
                      <span className="upi-detail-v upi-detail-danger">{result.scamReports}</span>
                    </div>
                    <div className="upi-detail-i">
                      <span className="upi-detail-l">Categories</span>
                      <span className="upi-detail-v">{result.categories.length > 0 ? result.categories.join(', ') : 'None'}</span>
                    </div>
                  </div>
                )}
                {result.numberIntel && (
                  <div className="upi-detail-row">
                    <div className="upi-detail-i">
                      <span className="upi-detail-l">Number</span>
                      <span className="upi-detail-v upi-mono">{result.numberIntel.normalized || query}</span>
                    </div>
                    {(result.numberIntel.carrier || result.numberIntel.telecomCircle) && (
                      <div className="upi-detail-i">
                        <span className="upi-detail-l">Carrier</span>
                        <span className="upi-detail-v">
                          {[result.numberIntel.carrier, result.numberIntel.telecomCircle].filter(Boolean).join(' · ')}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tips */}
          <div className="upi-card">
            <div className="upi-card-head">🛡️ UPI Safety Tips</div>
            <div className="upi-tips">
              <div className="upi-tip">Never share your UPI PIN with anyone</div>
              <div className="upi-tip">Banks never ask you to scan QR codes to receive money</div>
              <div className="upi-tip">Verify the receiver&apos;s name before completing payment</div>
              <div className="upi-tip">Fake UPI handles often use lookalike names (oksb‌i instead of oksbi)</div>
              <div className="upi-tip">Report scam UPI IDs to your bank and cybercrime.gov.in</div>
            </div>
          </div>
        </div>

        {/* Bottom Nav */}
        <nav className="bot-nav">
          <Link href="/dashboard" className="bot-nav-i">📞<span>Scan</span></Link>
          <Link href="/scanner" className="bot-nav-i">📱<span>Scanner</span></Link>
          <Link href="/upi" className="bot-nav-i bot-nav-a">💸<span>UPI Check</span></Link>
          <Link href="/trends" className="bot-nav-i">🔥<span>Trends</span></Link>
          <Link href="/wiki" className="bot-nav-i">📖<span>Wiki</span></Link>
        </nav>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Styles                                                              */
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
  }

  .upi-main{
    display:flex;flex-direction:column;height:100dvh;
    padding:var(--safe-top) 0 var(--safe-bottom) 0
  }
  .upi-top{
    display:flex;align-items:center;justify-content:space-between;
    padding:10px 16px;background:var(--surface);border-bottom:1px solid var(--border);
    flex-shrink:0;min-height:48px;gap:8px
  }
  .upi-back{font-size:20px;color:var(--accent);text-decoration:none;padding:4px}
  .upi-top-t{font-size:15px;font-weight:800}
  .upi-time{font-size:11px;color:var(--accent);font-weight:600;font-family:monospace}

  .upi-body{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:14px;-webkit-overflow-scrolling:touch}

  /* Card */
  .upi-card{background:var(--card);border:1px solid var(--border);border-radius:var(--r);padding:16px}
  .upi-card-head{font-size:13px;font-weight:700;color:var(--text);display:flex;align-items:center;gap:8px;margin-bottom:2px}
  .upi-card-badge{
    font-size:9px;background:rgba(0,230,118,.1);color:var(--accent);
    padding:2px 8px;border-radius:20px;font-weight:600;text-transform:uppercase
  }
  .upi-card-desc{font-size:10px;color:var(--muted);margin-bottom:12px;line-height:1.5}

  /* Search row */
  .upi-row{display:flex;gap:8px}
  .upi-inp{
    flex:1;min-width:0;background:#050a05;border:1px solid var(--border);
    border-radius:8px;padding:12px 14px;color:var(--text);font-size:15px;
    font-family:inherit;outline:none
  }
  .upi-inp:focus{border-color:var(--accent)}
  .upi-btn{
    padding:12px 20px;background:var(--accent);color:#050c07;
    border:none;border-radius:8px;font-weight:700;font-size:14px;
    font-family:inherit;cursor:pointer;white-space:nowrap;min-width:72px
  }
  .upi-btn:active{opacity:.75}
  .upi-btn:disabled{opacity:.35;cursor:default}
  .upi-err{
    background:rgba(255,61,61,.08);border:1px solid rgba(255,61,61,.2);
    border-radius:8px;padding:8px 12px;color:var(--danger);font-size:11px;margin-top:8px;display:flex;align-items:center;gap:6px
  }
  .upi-chips{display:flex;align-items:center;gap:6px;margin-top:10px;flex-wrap:wrap}
  .upi-chip-l{font-size:9px;color:var(--muted)}
  .upi-chip{
    background:rgba(0,230,118,.06);border:1px solid rgba(0,230,118,.12);
    border-radius:20px;padding:5px 12px;color:var(--text2);font-size:10px;
    font-family:inherit;cursor:pointer;transition:background .15s
  }
  .upi-chip:active{background:rgba(0,230,118,.14)}

  /* Result */
  .upi-res-card{border-width:2px}
  .upi-verdict{
    display:flex;align-items:center;gap:14px;padding:16px;
    border-radius:10px;border:1px solid;margin-bottom:14px
  }
  .upi-verdict-label{font-size:22px;font-weight:800}
  .upi-verdict-rec{font-size:12px;margin-top:3px;color:var(--text2);line-height:1.5}
  .upi-details{display:flex;flex-direction:column;gap:8px}
  .upi-detail-row{display:grid;grid-template-columns:1fr 1fr;gap:10px}
  @media(max-width:400px){.upi-detail-row{grid-template-columns:1fr}}
  .upi-detail-i{display:flex;flex-direction:column;gap:2px}
  .upi-detail-l{font-size:8px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px}
  .upi-detail-v{font-size:12px;font-weight:600}
  .upi-detail-danger{color:var(--danger)}
  .upi-mono{font-family:'JetBrains Mono',monospace}

  /* Tips */
  .upi-tips{display:flex;flex-direction:column;gap:6px;margin-top:8px}
  .upi-tip{
    font-size:11px;padding:8px 12px;background:rgba(0,230,118,.03);
    border-radius:6px;color:var(--text2);line-height:1.5;display:flex;gap:6px
  }
  .upi-tip::before{content:'▸';color:var(--accent);flex-shrink:0}

  /* Bottom nav */
  .bot-nav{
    display:flex;justify-content:space-around;align-items:center;
    background:var(--surface);border-top:1px solid var(--border);
    flex-shrink:0;min-height:56px;padding-bottom:var(--safe-bottom)
  }
  .bot-nav-i{display:flex;flex-direction:column;align-items:center;gap:3px;font-size:18px;color:var(--muted);padding:6px 0;text-decoration:none}
  .bot-nav-i span{font-size:9px;font-weight:500}
  .bot-nav-a,.bot-nav-i:active{color:var(--accent)}
`;
