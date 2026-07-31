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
  try {
    const u = localStorage.getItem('callshield_user');
    return u ? JSON.parse(u) : null;
  } catch { return null; }
}

function signOut() { localStorage.removeItem('callshield_user'); }

/* ------------------------------------------------------------------ */
/*  Login form (rendered inside dashboard when unauthenticated)        */
/* ------------------------------------------------------------------ */
function LoginPanel({ onLogin }: { onLogin: () => void }) {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const sendOtp = async () => {
    const c = phone.replace(/[^0-9]/g, '');
    if (c.length < 10) { setError('Enter 10-digit mobile number'); return; }
    setLoading(true); setError('');
    try {
      const r = await fetch('/api/auth/otp/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: c }) });
      const d = await r.json();
      if (d.success) setStep('otp'); else setError(d.error || 'Failed');
    } catch { setError('Network error'); }
    finally { setLoading(false); }
  };

  const verifyOtp = async () => {
    if (otp.length < 6) { setError('Enter 6-digit OTP'); return; }
    const c = phone.replace(/[^0-9]/g, '');
    setLoading(true); setError('');
    try {
      const r = await fetch('/api/auth/otp/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: c, otp }) });
      const d = await r.json();
      if (d.success && d.user) {
        localStorage.setItem('callshield_user', JSON.stringify(d.user));
        onLogin();
      } else setError(d.error || 'Invalid OTP');
    } catch { setError('Network error'); }
    finally { setLoading(false); }
  };

  return (
    <div className="login-panel">
      <div className="login-logo">&#x1F6E1;&#xFE0F; CallShield</div>
      {step === 'phone' ? (
        <form onSubmit={e => { e.preventDefault(); sendOtp(); }} className="login-form">
          <div className="login-step">Step 1 of 2</div>
          <h2>Sign In</h2>
          <p className="login-sub">Enter your mobile number</p>
          <div className="login-row">
            <span className="login-pfx">+91</span>
            <input className="login-inp" type="tel" placeholder="Mobile number" value={phone}
              onChange={e => setPhone(e.target.value.replace(/[^0-9]/g, '').slice(0, 10))}
              maxLength={10} autoFocus disabled={loading} />
          </div>
          {error && <div className="login-err">&#x26A0; {error}</div>}
          <button className="login-btn" disabled={loading || phone.length < 10}>
            {loading ? 'Sending...' : 'Send OTP'}
          </button>
        </form>
      ) : (
        <form onSubmit={e => { e.preventDefault(); verifyOtp(); }} className="login-form">
          <div className="login-step">Step 2 of 2</div>
          <h2>Enter OTP</h2>
          <p className="login-sub">Sent to +91 {phone.replace(/[^0-9]/g, '').slice(0,3)} {phone.replace(/[^0-9]/g, '').slice(3,6)} {phone.replace(/[^0-9]/g, '').slice(6)}</p>
          <input className="login-otp" type="text" placeholder="000000" value={otp}
            onChange={e => setOtp(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
            maxLength={6} autoFocus disabled={loading} />
          {error && <div className="login-err">&#x26A0; {error}</div>}
          <button className="login-btn" disabled={loading || otp.length < 6}>
            {loading ? 'Verifying...' : 'Verify OTP'}
          </button>
          <button type="button" className="login-link" onClick={() => { setStep('phone'); setError(''); }} disabled={loading}>
            &#x2190; Change number
          </button>
        </form>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Dashboard (authenticated)                                          */
/* ------------------------------------------------------------------ */
function Dashboard({ user, stats }: { user: { id: string; phone: string }; stats: Stats }) {
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<LookupResult | null>(null);
  const [error, setError] = useState('');
  const [protection, setProtection] = useState<string>('strict');

  const handleLookup = useCallback(async () => {
    const c = phone.replace(/[^0-9+]/g, '');
    if (c.length < 8) { setError('Min 8 digits'); return; }
    setLoading(true); setError(''); setResult(null);
    try {
      const r = await fetch('/api/lookup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phoneNumber: c, protectionLevel: protection }) });
      const d: LookupResult = await r.json();
      if (!r.ok) throw new Error((d as any).error || 'Failed');
      setResult(d);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [phone, protection]);

  const V = (result?.verdict || 'safe') as string;
  const vc: Record<string, string> = { safe: '#00e676', suspicious: '#ff9800', scam: '#ff3d3d', critical: '#d50000' };
  const color = vc[V] || '#00e676';

  return (
    <div className="dash-main">
      {/* â”€â”€ Top Bar â”€â”€ */}
      <header className="dash-top">
        <div className="dash-top-l">&#x1F6E1;&#xFE0F; CallShield</div>
        <div className="dash-top-r">
          <span className="dash-user">+91 {user.phone.replace(/^\+91/, '').slice(0,4)}...</span>
          <button className="dash-top-btn" onClick={() => { signOut(); window.location.reload(); }}>Logout</button>
        </div>
      </header>

      {/* â”€â”€ Content â”€â”€ */}
      <div className="dash-body">
        {/* Stats row */}
        <div className="stats-row">
          {[
            { n: stats.totalScams.toLocaleString(), l: 'Tracked' },
            { n: stats.activeThreats.toLocaleString(), l: 'Active' },
            { n: stats.reportsToday.toLocaleString(), l: 'Today' },
            { n: stats.verifiedCount.toLocaleString(), l: 'Verified' },
          ].map((s, i) => (
            <div key={i} className="stat-card">
              <div className="stat-n">{s.n}</div>
              <div className="stat-l">{s.l}</div>
            </div>
          ))}
        </div>

        {/* Lookup card */}
        <div className="card">
          <div className="card-head">&#x1F4DE; Scan a Number</div>
          <div className="lk-row">
            <input className="lk-inp" type="tel" placeholder="+919876543210" value={phone}
              onChange={e => setPhone(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLookup()} autoFocus />
            <select className="lk-sel" value={protection} onChange={e => setProtection(e.target.value)}>
              <option value="strict">Strict</option>
              <option value="standard">Standard</option>
              <option value="permissive">Permissive</option>
            </select>
            <button className="lk-btn" onClick={handleLookup} disabled={loading}>{loading ? '...' : 'Scan'}</button>
          </div>
          {error && <div className="lk-err">{error}</div>}
          {!result && !loading && !error && (
            <div className="lk-chips">
              <span className="lk-chip-l">Try:</span>
              {[{ l: 'UPI Fraud', n: '+919876543210' }, { l: 'Bank OTP', n: '+918765432109' }, { l: 'FedEx', n: '+919988776655' }].map(e => (
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
                  {V === 'critical' ? '&#x1F6D1;' : V === 'scam' ? '&#x1F6A8;' : V === 'suspicious' ? '&#x26A0;' : '&#x2705;'} {V.toUpperCase()}
                </div>
                <div className="res-num">{result.phoneNumber}</div>
                <div className="res-meta">{result.carrier || 'Unknown'}{result.telecomCircle ? ' Â· ' + result.telecomCircle : ''}</div>
              </div>
              <div className="res-ring" style={{ borderColor: color }}>
                <div className="res-score">{result.threatScore}</div>
                <div className="res-max">/100</div>
              </div>
            </div>
            <div className="res-grid">
              <div><span className="res-label">Type</span><span className="res-val">{result.scamType || 'None'}</span></div>
              <div><span className="res-label">Severity</span><span className={`res-val res-sev-${result.severity || 'low'}`}>{result.severity || 'low'}</span></div>
              <div><span className="res-label">Confidence</span><span className="res-val">{Math.round(result.confidence * 100)}%</span></div>
              <div><span className="res-label">Action</span><span className={`res-val res-tag-${result.shouldBlock ? 'red' : 'green'}`}>{result.shouldBlock ? '&#x1F6D1; Block' : '&#x2705; Allow'}</span></div>
              <div><span className="res-label">Reports</span><span className="res-val">{result.dbMatch.reportCount}{result.dbMatch.verified ? ' âœ“ verified' : ''}</span></div>
              <div><span className="res-label">Response</span><span className="res-val">{result.responseTime}ms</span></div>
            </div>
            {result.evidence.length > 0 && (
              <div className="res-sec">
                <div className="res-sec-t">&#x1F4CB; Evidence</div>
                {result.evidence.map((e, i) => <div key={i} className="res-sec-i">{e}</div>)}
              </div>
            )}
            {result.warnings.length > 0 && (
              <div className="res-sec res-sec-warn">
                <div className="res-sec-t">&#x26A0; Warnings</div>
                {result.warnings.map((w, i) => <div key={i} className="res-sec-i">{w}</div>)}
              </div>
            )}
          </div>
        )}

        {/* Quick Links */}
        <div className="card">
          <div className="card-head">&#x26A1; Quick Actions</div>
          <div className="ql-grid">
            <Link href="/scanner" className="ql-card">
              <div className="ql-icon">&#x1F4F1;</div>
              <div className="ql-title">Message Scanner</div>
              <div className="ql-desc">Scan SMS/WhatsApp for scams</div>
            </Link>
            <Link href="/trends" className="ql-card">
              <div className="ql-icon">&#x1F525;</div>
              <div className="ql-title">Scam Trends</div>
              <div className="ql-desc">Heatmap &amp; wave alerts</div>
            </Link>
            <Link href="/wiki" className="ql-card">
              <div className="ql-icon">&#x1F4D6;</div>
              <div className="ql-title">Scam Wiki</div>
              <div className="ql-desc">17 types, scripts, tips</div>
            </Link>
            <Link href="/history" className="ql-card">
              <div className="ql-icon">&#x1F4C4;</div>
              <div className="ql-title">History</div>
              <div className="ql-desc">Past lookups & blocks</div>
            </Link>
          </div>
        </div>
      </div>

      {/* Bottom Nav */}
      <nav className="bot-nav">
        <Link href="/dashboard" className="bot-nav-i bot-nav-a">&#x1F4DE;<span>Scan</span></Link>
        <Link href="/scanner" className="bot-nav-i">&#x1F4F1;<span>Scanner</span></Link>
        <Link href="/trends" className="bot-nav-i">&#x1F525;<span>Trends</span></Link>
        <Link href="/wiki" className="bot-nav-i">&#x1F4D6;<span>Wiki</span></Link>
        <Link href="/history" className="bot-nav-i">&#x1F4C4;<span>History</span></Link>
      </nav>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page root                                                          */
/* ------------------------------------------------------------------ */
export default function DashboardPage() {
  const router = useRouter();
  const [auth, setAuth] = useState<{ id: string; phone: string } | null>(null);
  const [checking, setChecking] = useState(true);
  const [stats] = useState<Stats>(() => {
    // Use DB stats or sensible defaults
    return { totalScams: 736, activeThreats: 148, reportsToday: 23, verifiedCount: 52 };
  });

  useEffect(() => {
    const u = getUser();
    if (u) setAuth(u);
    setChecking(false);
  }, []);

  const onLogin = useCallback(() => {
    const u = getUser();
    if (u) setAuth(u);
  }, []);

  if (checking) {
    return (
      <div className="dash-load">
        <style>{CSS}</style>
        <div className="dash-load-s">&#x1F6E1;&#xFE0F;</div>
        <div>Loading...</div>
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
/*  Styles â€” notch-safe, no overflow, responsive cards                 */
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
    /* prevent rubber-banding / over-scroll */
    overscroll-behavior:none;
    overflow:hidden;
  }
  a{text-decoration:none;color:inherit}

  /* === Loading === */
  .dash-load{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100dvh;gap:12px;color:var(--muted);font-size:14px;padding:var(--safe-top) var(--safe-right) var(--safe-bottom) var(--safe-left)}
  .dash-load-s{font-size:40px}

  /* === Login Panel (unauthenticated) === */
  .login-panel{
    display:flex;flex-direction:column;align-items:center;
    justify-content:center;min-height:100dvh;gap:24px;
    padding:max(40px,var(--safe-top)) max(20px,var(--safe-right)) max(40px,var(--safe-bottom)) max(20px,var(--safe-left));
    background:radial-gradient(ellipse 60% 40% at 50% 25%,rgba(0,230,118,.05),transparent 60%);
  }
  .login-logo{font-size:22px;font-weight:800;display:flex;align-items:center;gap:6px}
  .login-form{background:var(--card);border:1px solid var(--border);border-radius:var(--r);padding:24px 20px;width:100%;max-width:360px;display:flex;flex-direction:column}
  .login-step{font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:1.5px;margin-bottom:6px}
  .login-form h2{font-size:20px;font-weight:700;margin-bottom:4px}
  .login-sub{font-size:12px;color:var(--muted);margin-bottom:18px}
  .login-row{display:flex;gap:8px;margin-bottom:10px}
  .login-pfx{display:flex;align-items:center;padding:10px 12px;background:#050a05;border:1px solid var(--border);border-radius:8px;font-size:14px;color:var(--muted);white-space:nowrap}
  .login-inp{flex:1;background:#050a05;border:1px solid var(--border);border-radius:8px;padding:10px 14px;color:var(--text);font-size:16px;font-family:monospace;outline:none;min-width:0}
  .login-inp:focus{border-color:var(--accent)}
  .login-inp:disabled{opacity:.5}
  .login-otp{width:100%;background:#050a05;border:1px solid var(--border);border-radius:8px;padding:14px;color:var(--text);font-size:28px;font-family:monospace;text-align:center;letter-spacing:14px;outline:none;margin-bottom:10px}
  .login-otp:focus{border-color:var(--accent)}
  .login-otp:disabled{opacity:.5}
  .login-btn{width:100%;padding:12px;background:var(--accent);color:#050c07;border:none;border-radius:8px;font-weight:700;font-size:14px;font-family:inherit;cursor:pointer;transition:opacity .15s}
  .login-btn:active{opacity:.7}
  .login-btn:disabled{opacity:.35;cursor:default}
  .login-err{background:rgba(255,61,61,.08);border:1px solid rgba(255,61,61,.2);border-radius:8px;padding:10px 14px;color:var(--danger);font-size:11px;margin-bottom:10px;display:flex;align-items:center;gap:6px}
  .login-link{width:100%;margin-top:8px;padding:10px;background:none;border:none;color:var(--muted);font-size:11px;font-family:inherit;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:5px}
  .login-link:hover{color:var(--text2)}
  .login-link:disabled{opacity:.4}

  /* === Dashboard Main (authenticated) === */
  .dash-main{
    display:flex;flex-direction:column;
    height:100dvh;height:100vh;
    padding:var(--safe-top) var(--safe-right) var(--safe-bottom) var(--safe-left);
    overflow:hidden;
  }

  /* Top bar */
  .dash-top{
    display:flex;align-items:center;justify-content:space-between;
    padding:10px 16px;
    background:var(--surface);
    border-bottom:1px solid var(--border);
    flex-shrink:0;
    min-height:48px;
  }
  .dash-top-l{font-size:14px;font-weight:800;display:flex;align-items:center;gap:6px}
  .dash-top-r{display:flex;align-items:center;gap:10px}
  .dash-user{font-size:10px;color:var(--text2)}
  .dash-top-btn{background:var(--danger);color:#fff;border:none;padding:5px 12px;border-radius:6px;font-size:10px;font-weight:600;font-family:inherit;cursor:pointer}
  .dash-top-btn:active{opacity:.8}

  /* Scrollable body */
  .dash-body{
    flex:1;overflow-y:auto;overflow-x:hidden;
    padding:16px;
    display:flex;flex-direction:column;gap:14px;
    -webkit-overflow-scrolling:touch;
    scroll-behavior:smooth;
  }

  /* Stats row â€” 4 cols, adapts to 2 on tiny screens */
  .stats-row{
    display:grid;
    grid-template-columns:repeat(4,1fr);
    gap:10px;
  }
  @media(max-width:480px){
    .stats-row{grid-template-columns:repeat(2,1fr)}
  }
  .stat-card{
    background:var(--card);border:1px solid var(--border);
    border-radius:var(--rs);padding:14px 12px;
    text-align:center;
  }
  .stat-n{font-size:22px;font-weight:800;color:var(--accent);line-height:1.2}
  .stat-l{font-size:10px;color:var(--muted);text-transform:uppercase;margin-top:2px;letter-spacing:.5px}

  /* Generic card */
  .card{
    background:var(--card);border:1px solid var(--border);
    border-radius:var(--r);padding:16px;
    width:100%;
  }
  .card-head{font-size:12px;font-weight:700;margin-bottom:12px;color:var(--text);display:flex;align-items:center;gap:6px}

  /* Lookup */
  .lk-row{display:flex;gap:8px}
  .lk-inp{
    flex:1;min-width:0;
    background:#050a05;border:1px solid var(--border);border-radius:8px;
    padding:10px 12px;color:var(--text);font-size:15px;font-family:monospace;outline:none;
  }
  .lk-inp:focus{border-color:var(--accent)}
  .lk-sel{
    background:#050a05;border:1px solid var(--border);border-radius:8px;
    padding:10px 6px;color:var(--text2);font-size:11px;font-family:inherit;outline:none;cursor:pointer;
    /* prevent select from being too wide */
    min-width:0;
  }
  .lk-btn{
    padding:10px 16px;background:var(--accent);color:#050c07;
    border:none;border-radius:8px;font-weight:700;font-size:13px;font-family:inherit;
    cursor:pointer;white-space:nowrap;transition:opacity .15s;
  }
  .lk-btn:active{opacity:.7}
  .lk-btn:disabled{opacity:.35;cursor:default}
  .lk-err{
    background:rgba(255,61,61,.06);border:1px solid rgba(255,61,61,.15);
    border-radius:8px;padding:8px 12px;color:var(--danger);font-size:11px;margin-top:8px;
  }
  .lk-chips{display:flex;align-items:center;gap:6px;margin-top:8px;flex-wrap:wrap}
  .lk-chip-l{font-size:9px;color:var(--muted)}
  .lk-chip{
    background:rgba(0,230,118,.06);border:1px solid rgba(0,230,118,.12);
    border-radius:20px;padding:3px 10px;color:var(--text2);font-size:9px;
    font-family:inherit;cursor:pointer;transition:background .15s;
  }
  .lk-chip:active{background:rgba(0,230,118,.12)}

  /* Result */
  .res-card{border-width:2px}
  .res-banner{
    display:flex;justify-content:space-between;align-items:center;
    padding:14px;border-radius:10px;border:1px solid;margin-bottom:12px;
    gap:12px;
  }
  .res-verdict{font-size:18px;font-weight:800}
  .res-num{font-size:18px;font-family:monospace;font-weight:600;margin:2px 0;word-break:break-all}
  .res-meta{font-size:10px;color:var(--muted)}
  .res-ring{
    width:64px;min-width:64px;height:64px;border-radius:50%;border:3px solid;
    display:flex;flex-direction:column;align-items:center;justify-content:center;
  }
  .res-score{font-size:18px;font-weight:800;line-height:1}
  .res-max{font-size:8px;opacity:.6}
  .res-grid{
    display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:10px;
  }
  @media(max-width:420px){.res-grid{grid-template-columns:1fr 1fr}}
  .res-grid div{display:flex;flex-direction:column;gap:2px}
  .res-label{font-size:8px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px}
  .res-val{font-size:12px;font-weight:600}
  .res-sev-critical{color:#ff5252;background:rgba(213,0,0,.1);padding:1px 6px;border-radius:3px;display:inline-block}
  .res-sev-high{color:#ff5252;background:rgba(255,61,61,.08);padding:1px 6px;border-radius:3px;display:inline-block}
  .res-sev-medium{color:#ff9800;background:rgba(255,152,0,.08);padding:1px 6px;border-radius:3px;display:inline-block}
  .res-sev-low{color:#00e676;background:rgba(0,230,118,.08);padding:1px 6px;border-radius:3px;display:inline-block}
  .res-tag-red{color:#ff5252;background:rgba(255,61,61,.08);padding:1px 6px;border-radius:3px;display:inline-block}
  .res-tag-green{color:#00e676;background:rgba(0,230,118,.08);padding:1px 6px;border-radius:3px;display:inline-block}
  .res-sec{margin-top:10px}
  .res-sec-t{font-size:11px;font-weight:600;color:var(--text2);margin-bottom:6px}
  .res-sec-i{font-size:10px;color:var(--muted);padding:5px 8px;background:rgba(0,230,118,.03);border-radius:6px;margin:2px 0;display:flex;gap:6px;word-break:break-word}
  .res-sec-i::before{content:'\u25B8';color:var(--accent);flex-shrink:0}
  .res-sec-warn .res-sec-i{background:rgba(255,152,0,.04);color:#ff9800}
  .res-sec-warn .res-sec-i::before{content:'\u26A0';color:#ff9800}

  /* Quick links grid */
  .ql-grid{
    display:grid;grid-template-columns:repeat(2,1fr);gap:8px;
  }
  @media(min-width:600px){
    .ql-grid{grid-template-columns:repeat(4,1fr)}
  }
  .ql-card{
    background:#050a05;border:1px solid var(--border);border-radius:var(--rs);
    padding:14px 12px;display:flex;flex-direction:column;align-items:center;
    text-align:center;gap:4px;transition:border-color .15s;cursor:pointer;
  }
  .ql-card:active{border-color:var(--accent)}
  .ql-icon{font-size:22px}
  .ql-title{font-size:11px;font-weight:700;color:var(--text)}
  .ql-desc{font-size:9px;color:var(--muted)}

  /* Bottom nav */
  .bot-nav{
    display:flex;justify-content:space-around;align-items:center;
    background:var(--surface);border-top:1px solid var(--border);
    flex-shrink:0;min-height:56px;
    padding-bottom:var(--safe-bottom);
  }
  .bot-nav-i{
    display:flex;flex-direction:column;align-items:center;gap:2px;
    font-size:18px;color:var(--muted);padding:6px 0;transition:color .15s;
    font-family:inherit;background:none;border:none;cursor:pointer;
    text-decoration:none;
  }
  .bot-nav-i span{font-size:9px;font-weight:500}
  .bot-nav-a,.bot-nav-i:active{color:var(--accent)}
`;
