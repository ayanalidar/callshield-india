'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
type LookupResult = {
  phoneNumber: string; verdict: string; threatScore: number;
  isScam: boolean; scamType?: string; severity?: string; confidence: number;
  shouldBlock: boolean; telecomCircle?: string; carrier?: string;
  numberType?: string; evidence: string[]; warnings: string[];
  dbMatch: { found: boolean; reportCount: number; verified: boolean; source: string };
  responseTime: number; cached: boolean;
};

type Stats = { totalScams: number; activeThreats: number; reportsToday: number; verifiedCount: number };

/* ------------------------------------------------------------------ */
/*  Auth helpers                                                       */
/* ------------------------------------------------------------------ */
function getUser(): { id: string; phone: string } | null {
  if (typeof window === 'undefined') return null;
  try { const u = localStorage.getItem('callshield_user'); return u ? JSON.parse(u) : null; } catch { return null; }
}

function signOut() { localStorage.removeItem('callshield_user'); }

/* ------------------------------------------------------------------ */
/*  Login Form (Phone → OTP)                                          */
/* ------------------------------------------------------------------ */
function LoginPanel({ onLogin }: { onLogin: () => void }) {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const sendOtp = async () => {
    const c = phone.replace(/[^0-9]/g, '');
    if (c.length < 10) { setError('Enter a valid 10-digit Indian mobile number'); return; }
    setLoading(true); setError('');
    try {
      const r = await fetch('/api/auth/otp/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: c }) });
      const d = await r.json();
      if (d.success) setStep('otp'); else setError(d.error || 'Send failed');
    } catch { setError('Network error. Check your connection.'); }
    finally { setLoading(false); }
  };

  const verifyOtp = async () => {
    if (otp.length < 6) { setError('Enter the 6-digit OTP'); return; }
    const c = phone.replace(/[^0-9]/g, '');
    setLoading(true); setError('');
    try {
      const r = await fetch('/api/auth/otp/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: c, otp }) });
      const d = await r.json();
      if (d.success && d.user) {
        localStorage.setItem('callshield_user', JSON.stringify(d.user));
        onLogin();
      } else setError(d.error || 'Invalid OTP');
    } catch { setError('Network error. Check your connection.'); }
    finally { setLoading(false); }
  };

  const maskPhone = (p: string) => { const n = p.replace(/[^0-9]/g, ''); return n.length === 10 ? `+91 ${n.slice(0,3)} ${n.slice(3,6)} ${n.slice(6)}` : p; };

  return (
    <div className="login-panel">
      <div className="login-logo">🛡️ CallShield</div>
      {step === 'phone' ? (
        <form onSubmit={e => { e.preventDefault(); sendOtp(); }} className="login-form">
          <div className="login-step">Step 1 of 2</div>
          <h2 className="login-title">Sign In</h2>
          <p className="login-sub">Enter your mobile number to continue</p>
          <div className="login-row">
            <span className="login-pfx">+91</span>
            <input className="login-inp" type="tel" placeholder="Enter mobile number" value={phone}
              onChange={e => setPhone(e.target.value.replace(/[^0-9]/g, '').slice(0, 10))}
              maxLength={10} autoFocus disabled={loading} />
          </div>
          {error && <div className="login-err">⚠️ {error}</div>}
          <button className="login-btn" disabled={loading || phone.length < 10}>
            {loading ? 'Sending OTP...' : 'Send OTP'}
          </button>
        </form>
      ) : (
        <form onSubmit={e => { e.preventDefault(); verifyOtp(); }} className="login-form">
          <div className="login-step">Step 2 of 2</div>
          <h2 className="login-title">Verify OTP</h2>
          <p className="login-sub">We sent a 6-digit code to <strong>{maskPhone(phone)}</strong></p>
          <input className="login-otp" type="text" placeholder="000000" value={otp}
            onChange={e => setOtp(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
            maxLength={6} autoFocus disabled={loading} />
          {error && <div className="login-err">⚠️ {error}</div>}
          <button className="login-btn" disabled={loading || otp.length < 6}>
            {loading ? 'Verifying...' : 'Verify OTP'}
          </button>
          <button type="button" className="login-link" onClick={() => { setStep('phone'); setError(''); }} disabled={loading}>
            ← Change number
          </button>
        </form>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Dashboard (authenticated)                                    */
/* ------------------------------------------------------------------ */
function Dashboard({ user, stats }: { user: { id: string; phone: string }; stats: Stats }) {
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<LookupResult | null>(null);
  const [error, setError] = useState('');
  const [protection, setProtection] = useState<string>('strict');
  const [time, setTime] = useState('');

  useEffect(() => {
    setTime(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }));
    const iv = setInterval(() => setTime(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })), 30000);
    return () => clearInterval(iv);
  }, []);

  const handleLookup = useCallback(async () => {
    const c = phone.replace(/[^0-9+]/g, '');
    if (c.length < 8) { setError('Enter a valid phone number (min 8 digits)'); return; }
    setLoading(true); setError(''); setResult(null);
    try {
      const r = await fetch('/api/lookup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phoneNumber: c, protectionLevel: protection }) });
      const d: LookupResult = await r.json();
      if (!r.ok) throw new Error((d as any).error || 'Lookup failed');
      setResult(d);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [phone, protection]);

  const V = result?.verdict || 'safe';
  const vc: Record<string, string> = { safe: '#00e676', suspicious: '#ff9800', scam: '#ff3d3d', critical: '#d50000' };
  const color = vc[V] || '#00e676';

  const phoneDisplay = user.phone.replace(/^\+91/, '');

  return (
    <div className="dash-main">
      {/* ── Top Bar ── */}
      <header className="dash-top">
        <div className="dash-top-l">🛡️ CallShield India</div>
        <div className="dash-top-r">
          <span className="dash-time">{time}</span>
          <span className="dash-user">+91 {phoneDisplay.slice(0,5)}...</span>
          <button className="dash-top-btn" onClick={() => { signOut(); window.location.reload(); }}>Sign Out</button>
        </div>
      </header>

      {/* ── Scrollable Body ── */}
      <div className="dash-body">
        {/* Stats */}
        <div className="stats-row">
          {[
            { n: stats.totalScams.toLocaleString(), l: 'Numbers Tracked' },
            { n: stats.activeThreats.toLocaleString(), l: 'Active Threats' },
            { n: stats.reportsToday.toLocaleString(), l: 'Reports Today' },
            { n: stats.verifiedCount.toLocaleString(), l: 'Verified Scams' },
          ].map((s, i) => (
            <div key={i} className="stat-card">
              <div className="stat-n">{s.n}</div>
              <div className="stat-l">{s.l}</div>
            </div>
          ))}
        </div>

        {/* Lookup */}
        <div className="card">
          <div className="card-head">📞 Scan a Phone Number</div>
          <p className="card-desc">Check any number for scam reports, carrier details, and threat analysis</p>
          <div className="lk-row">
            <input className="lk-inp" type="tel" placeholder="+91 98765 43210" value={phone}
              onChange={e => setPhone(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLookup()} autoFocus />
            <select className="lk-sel" value={protection} onChange={e => setProtection(e.target.value)}>
              <option value="strict">Strict</option>
              <option value="standard">Standard</option>
              <option value="permissive">Permissive</option>
            </select>
            <button className="lk-btn" onClick={handleLookup} disabled={loading}>{loading ? '...' : 'Scan'}</button>
          </div>
          {error && <div className="lk-err">⚠️ {error}</div>}
          {!result && !loading && !error && (
            <div className="lk-chips">
              <span className="lk-chip-l">Try scanning:</span>
              {[{ l: 'UPI Fraud', n: '+919876543210' }, { l: 'Bank OTP Scam', n: '+918765432109' }, { l: 'FedEx Customs', n: '+919988776655' }].map(e => (
                <button key={e.n} className="lk-chip" onClick={() => { setPhone(e.n); handleLookup(); }}>{e.l}</button>
              ))}
            </div>
          )}
        </div>

        {/* Result */}
        {result && (
          <div className="card res-card" style={{ borderColor: color }}>
            <div className="res-banner" style={{ background: color + '14', borderColor: color }}>
              <div>
                <div className="res-verdict" style={{ color }}>
                  {V === 'critical' ? '🛑' : V === 'scam' ? '🚨' : V === 'suspicious' ? '⚠️' : '✅'} {V.toUpperCase()}
                </div>
                <div className="res-num">{result.phoneNumber}</div>
                {result.carrier && <div className="res-meta">{result.carrier}{result.telecomCircle ? ' · ' + result.telecomCircle : ''}{result.numberType ? ' · ' + result.numberType : ''}</div>}
              </div>
              <div className="res-ring" style={{ borderColor: color }}>
                <div className="res-score">{result.threatScore}</div>
                <div className="res-max">/100</div>
              </div>
            </div>
            <div className="res-grid">
              <div><span className="res-label">Scam Type</span><span className="res-val">{result.scamType?.replace(/_/g, ' ') || 'None detected'}</span></div>
              <div><span className="res-label">Severity</span><span className={`res-val res-sev-${result.severity || 'low'}`}>{result.severity ? result.severity.toUpperCase() : 'LOW'}</span></div>
              <div><span className="res-label">Confidence</span><span className="res-val">{Math.round(result.confidence * 100)}%</span></div>
              <div><span className="res-label">Recommendation</span><span className={`res-val ${result.shouldBlock ? 'res-tag-red' : 'res-tag-green'}`}>{result.shouldBlock ? '🛑 Block This Number' : '✅ Safe to Answer'}</span></div>
              <div><span className="res-label">Community Reports</span><span className="res-val">{result.dbMatch.reportCount}{result.dbMatch.verified ? ' · Verified' : ''}</span></div>
              <div><span className="res-label">Response Time</span><span className="res-val">{result.responseTime}ms</span></div>
            </div>
            {result.warnings.length > 0 && (
              <div className="res-sec res-sec-warn">
                <div className="res-sec-t">⚠️ Warnings</div>
                {result.warnings.map((w, i) => <div key={i} className="res-sec-i">{w}</div>)}
              </div>
            )}
            {result.evidence.length > 0 && (
              <div className="res-sec">
                <div className="res-sec-t">📋 Evidence</div>
                {result.evidence.map((e, i) => <div key={i} className="res-sec-i">{e}</div>)}
              </div>
            )}
          </div>
        )}

        {/* Quick Actions */}
        <div className="card">
          <div className="card-head">⚡ Quick Actions</div>
          <div className="ql-grid">
            <Link href="/scanner" className="ql-card">
              <div className="ql-icon">📱</div>
              <div className="ql-title">Message Scanner</div>
              <div className="ql-desc">Scan SMS and WhatsApp</div>
            </Link>
            <Link href="/trends" className="ql-card">
              <div className="ql-icon">🔥</div>
              <div className="ql-title">Scam Trends</div>
              <div className="ql-desc">Live heatmap and alerts</div>
            </Link>
            <Link href="/wiki" className="ql-card">
              <div className="ql-icon">📖</div>
              <div className="ql-title">Scam Encyclopedia</div>
              <div className="ql-desc">17 types, scripts, tips</div>
            </Link>
            <Link href="/history" className="ql-card">
              <div className="ql-icon">📄</div>
              <div className="ql-title">Lookup History</div>
              <div className="ql-desc">Past number checks</div>
            </Link>
          </div>
        </div>
      </div>

      {/* ── Bottom Nav ── */}
      <nav className="bot-nav">
        <Link href="/dashboard" className="bot-nav-i bot-nav-a">📞<span>Scan</span></Link>
        <Link href="/scanner" className="bot-nav-i">📱<span>Scanner</span></Link>
        <Link href="/trends" className="bot-nav-i">🔥<span>Trends</span></Link>
        <Link href="/wiki" className="bot-nav-i">📖<span>Wiki</span></Link>
        <Link href="/history" className="bot-nav-i">📄<span>History</span></Link>
      </nav>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page Root                                                          */
/* ------------------------------------------------------------------ */
export default function DashboardPage() {
  const [auth, setAuth] = useState<{ id: string; phone: string } | null>(null);
  const [checking, setChecking] = useState(true);
  const [stats] = useState<Stats>(() => ({ totalScams: 736, activeThreats: 148, reportsToday: 23, verifiedCount: 52 }));

  useEffect(() => { const u = getUser(); if (u) setAuth(u); setChecking(false); }, []);
  const onLogin = useCallback(() => { const u = getUser(); if (u) setAuth(u); }, []);

  if (checking) {
    return (
      <div className="dash-load">
        <style>{CSS}</style>
        <div className="dash-load-s">🛡️</div>
        <div>Loading CallShield...</div>
      </div>
    );
  }

  return (
    <>
      <style>{CSS}</style>
      {auth ? <Dashboard user={auth} stats={stats} /> : <LoginPanel onLogin={onLogin} />}
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Styles — notch-safe, responsive, zero overflow                     */
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
    font-family:'Inter','Space Grotesk',system-ui,sans-serif;
    background:var(--bg);color:var(--text);
    -webkit-font-smoothing:antialiased;
    overscroll-behavior:none;
    overflow:hidden;
  }
  a{text-decoration:none;color:inherit}

  .dash-load{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100dvh;gap:12px;color:var(--muted);font-size:14px;padding:var(--safe-top) var(--safe-right) var(--safe-bottom) var(--safe-left)}
  .dash-load-s{font-size:48px;margin-bottom:4px}

  /* ── Login ── */
  .login-panel{
    display:flex;flex-direction:column;align-items:center;justify-content:center;
    min-height:100dvh;gap:24px;
    padding:max(40px,var(--safe-top)) max(20px,var(--safe-right)) max(40px,var(--safe-bottom)) max(20px,var(--safe-left));
    background:radial-gradient(ellipse 60% 40% at 50% 25%,rgba(0,230,118,.06),transparent 60%);
  }
  .login-logo{font-size:24px;font-weight:800;display:flex;align-items:center;gap:8px;letter-spacing:-.3px}
  .login-form{background:var(--card);border:1px solid var(--border);border-radius:var(--r);padding:24px 20px;width:100%;max-width:380px;display:flex;flex-direction:column}
  .login-step{font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:1.5px;margin-bottom:8px}
  .login-title{font-size:22px;font-weight:700;margin-bottom:4px}
  .login-sub{font-size:12px;color:var(--muted);margin-bottom:20px;line-height:1.5}
  .login-sub strong{color:var(--text2)}
  .login-row{display:flex;gap:8px;margin-bottom:12px}
  .login-pfx{display:flex;align-items:center;padding:11px 14px;background:#050a05;border:1px solid var(--border);border-radius:8px;font-size:14px;color:var(--muted);white-space:nowrap}
  .login-inp{flex:1;min-width:0;background:#050a05;border:1px solid var(--border);border-radius:8px;padding:11px 14px;color:var(--text);font-size:16px;font-family:monospace;outline:none}
  .login-inp:focus{border-color:var(--accent)}
  .login-otp{width:100%;background:#050a05;border:1px solid var(--border);border-radius:8px;padding:14px;color:var(--text);font-size:28px;font-family:monospace;text-align:center;letter-spacing:14px;outline:none;margin-bottom:12px}
  .login-otp:focus{border-color:var(--accent)}
  .login-btn{width:100%;padding:13px;background:var(--accent);color:#050c07;border:none;border-radius:8px;font-weight:700;font-size:14px;font-family:inherit;cursor:pointer;transition:opacity .15s}
  .login-btn:active{opacity:.75}
  .login-btn:disabled{opacity:.35;cursor:default}
  .login-err{background:rgba(255,61,61,.08);border:1px solid rgba(255,61,61,.2);border-radius:8px;padding:10px 14px;color:var(--danger);font-size:11px;margin-bottom:12px;display:flex;align-items:center;gap:8px}
  .login-link{width:100%;margin-top:10px;padding:10px;background:none;border:none;color:var(--muted);font-size:11px;font-family:inherit;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px}
  .login-link:hover{color:var(--text2)}
  .login-link:disabled{opacity:.4}

  /* ── Dashboard ── */
  .dash-main{
    display:flex;flex-direction:column;
    height:100dvh;height:100vh;
    padding:var(--safe-top) var(--safe-right) var(--safe-bottom) var(--safe-left);
    overflow:hidden;
  }
  .dash-top{
    display:flex;align-items:center;justify-content:space-between;
    padding:10px 16px;background:var(--surface);border-bottom:1px solid var(--border);
    flex-shrink:0;min-height:48px;gap:8px;flex-wrap:wrap;
  }
  .dash-top-l{font-size:15px;font-weight:800;display:flex;align-items:center;gap:6px}
  .dash-top-r{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
  .dash-time{font-size:11px;color:var(--accent);font-weight:600;font-family:monospace}
  .dash-user{font-size:10px;color:var(--text2)}
  .dash-top-btn{background:rgba(255,61,61,.15);color:var(--danger);border:1px solid rgba(255,61,61,.25);padding:5px 12px;border-radius:6px;font-size:10px;font-weight:600;font-family:inherit;cursor:pointer;transition:background .15s}
  .dash-top-btn:active{background:rgba(255,61,61,.25)}

  .dash-body{
    flex:1;overflow-y:auto;overflow-x:hidden;
    padding:16px;display:flex;flex-direction:column;gap:14px;
    -webkit-overflow-scrolling:touch;scroll-behavior:smooth;
  }

  .stats-row{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
  @media(max-width:480px){.stats-row{grid-template-columns:repeat(2,1fr)}}
  .stat-card{background:var(--card);border:1px solid var(--border);border-radius:var(--rs);padding:14px 12px;text-align:center}
  .stat-n{font-size:22px;font-weight:800;color:var(--accent);line-height:1.2}
  .stat-l{font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-top:3px}

  .card{background:var(--card);border:1px solid var(--border);border-radius:var(--r);padding:16px;width:100%}
  .card-head{font-size:13px;font-weight:700;margin-bottom:2px;color:var(--text);display:flex;align-items:center;gap:6px}
  .card-desc{font-size:10px;color:var(--muted);margin-bottom:12px}

  .lk-row{display:flex;gap:8px}
  .lk-inp{flex:1;min-width:0;background:#050a05;border:1px solid var(--border);border-radius:8px;padding:10px 12px;color:var(--text);font-size:15px;font-family:monospace;outline:none}
  .lk-inp:focus{border-color:var(--accent)}
  .lk-sel{background:#050a05;border:1px solid var(--border);border-radius:8px;padding:10px 6px;color:var(--text2);font-size:11px;font-family:inherit;outline:none;cursor:pointer;min-width:0}
  .lk-btn{padding:10px 16px;background:var(--accent);color:#050c07;border:none;border-radius:8px;font-weight:700;font-size:13px;font-family:inherit;cursor:pointer;white-space:nowrap}
  .lk-btn:active{opacity:.75}
  .lk-btn:disabled{opacity:.35;cursor:default}
  .lk-err{background:rgba(255,61,61,.06);border:1px solid rgba(255,61,61,.15);border-radius:8px;padding:8px 12px;color:var(--danger);font-size:11px;margin-top:8px;display:flex;align-items:center;gap:6px}
  .lk-chips{display:flex;align-items:center;gap:6px;margin-top:8px;flex-wrap:wrap}
  .lk-chip-l{font-size:9px;color:var(--muted)}
  .lk-chip{background:rgba(0,230,118,.06);border:1px solid rgba(0,230,118,.12);border-radius:20px;padding:4px 10px;color:var(--text2);font-size:9px;font-family:inherit;cursor:pointer;transition:background .15s}
  .lk-chip:active{background:rgba(0,230,118,.14)}

  .res-card{border-width:2px}
  .res-banner{display:flex;justify-content:space-between;align-items:center;padding:14px;border-radius:10px;border:1px solid;margin-bottom:12px;gap:12px}
  .res-verdict{font-size:18px;font-weight:800}
  .res-num{font-size:18px;font-family:monospace;font-weight:600;margin:2px 0;word-break:break-all}
  .res-meta{font-size:10px;color:var(--muted)}
  .res-ring{width:64px;min-width:64px;height:64px;border-radius:50%;border:3px solid;display:flex;flex-direction:column;align-items:center;justify-content:center}
  .res-score{font-size:18px;font-weight:800;line-height:1}
  .res-max{font-size:8px;opacity:.6}
  .res-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:10px}
  @media(max-width:420px){.res-grid{grid-template-columns:1fr 1fr}}
  .res-grid div{display:flex;flex-direction:column;gap:2px;min-width:0}
  .res-label{font-size:8px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px}
  .res-val{font-size:11px;font-weight:600;word-break:break-word;text-transform:capitalize}
  .res-sev-critical{color:#ff5252;background:rgba(213,0,0,.1);padding:1px 6px;border-radius:3px;display:inline-block}
  .res-sev-high{color:#ff5252;background:rgba(255,61,61,.08);padding:1px 6px;border-radius:3px;display:inline-block}
  .res-sev-medium{color:#ff9800;background:rgba(255,152,0,.08);padding:1px 6px;border-radius:3px;display:inline-block}
  .res-sev-low{color:#00e676;background:rgba(0,230,118,.08);padding:1px 6px;border-radius:3px;display:inline-block}
  .res-tag-red{color:#ff5252;background:rgba(255,61,61,.08);padding:1px 6px;border-radius:3px;display:inline-block}
  .res-tag-green{color:#00e676;background:rgba(0,230,118,.08);padding:1px 6px;border-radius:3px;display:inline-block}
  .res-sec{margin-top:10px}
  .res-sec-t{font-size:11px;font-weight:600;color:var(--text2);margin-bottom:6px}
  .res-sec-i{font-size:10px;color:var(--muted);padding:5px 8px;background:rgba(0,230,118,.03);border-radius:6px;margin:2px 0;display:flex;gap:6px;word-break:break-word}
  .res-sec-i::before{content:'▸';color:var(--accent);flex-shrink:0}
  .res-sec-warn .res-sec-i{background:rgba(255,152,0,.04);color:#ff9800}
  .res-sec-warn .res-sec-i::before{content:'⚠';color:#ff9800}

  .ql-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}
  @media(min-width:600px){.ql-grid{grid-template-columns:repeat(4,1fr)}}
  .ql-card{background:#050a05;border:1px solid var(--border);border-radius:var(--rs);padding:16px 12px;display:flex;flex-direction:column;align-items:center;text-align:center;gap:6px;cursor:pointer;transition:border-color .15s}
  .ql-card:active{border-color:var(--accent)}
  .ql-icon{font-size:24px}
  .ql-title{font-size:11px;font-weight:700;color:var(--text)}
  .ql-desc{font-size:9px;color:var(--muted)}

  .bot-nav{
    display:flex;justify-content:space-around;align-items:center;
    background:var(--surface);border-top:1px solid var(--border);
    flex-shrink:0;min-height:56px;
    padding-bottom:var(--safe-bottom);
  }
  .bot-nav-i{display:flex;flex-direction:column;align-items:center;gap:3px;font-size:18px;color:var(--muted);padding:6px 0;font-family:inherit;background:none;border:none;cursor:pointer;text-decoration:none;transition:color .15s}
  .bot-nav-i span{font-size:9px;font-weight:500}
  .bot-nav-a,.bot-nav-i:active{color:var(--accent)}
`;
