'use client';

import { useState, FormEvent, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();

  const [phone, setPhone] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [user, setUser] = useState<any>(null);

  // Check if already logged in
  useEffect(() => {
    const stored = localStorage.getItem('callshield_user');
    if (stored) {
      try { const u = JSON.parse(stored); if (u?.phone) router.replace('/dashboard'); } catch {}
    }
  }, [router]);

  // Redirect on successful login
  useEffect(() => {
    if (user?.phone) {
      localStorage.setItem('callshield_user', JSON.stringify(user));
      router.replace('/dashboard');
    }
  }, [user, router]);

  const sendOtp = async () => {
    const cleaned = phone.replace(/[^0-9]/g, '');
    if (cleaned.length < 10) {
      setError('Enter a valid 10-digit Indian mobile number');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: cleaned }),
      });
      const data = await res.json();
      if (data.success) {
        setOtpSent(true);
      } else {
        setError(data.error || 'Failed to send OTP');
      }
    } catch {
      setError('Network error — check your connection');
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    if (otp.length < 6) {
      setError('Enter the 6-digit OTP');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone.replace(/[^0-9]/g, ''), otp }),
      });
      const data = await res.json();
      if (data.success && data.user) {
        setUser(data.user);
      } else {
        setError(data.error || 'Invalid OTP');
      }
    } catch {
      setError('Network error — check your connection');
    } finally {
      setLoading(false);
    }
  };

  const maskPhone = (p: string) => {
    const nums = p.replace(/[^0-9]/g, '');
    if (nums.length === 10) return `+91 ${nums.slice(0,3)} ${nums.slice(3,6)} ${nums.slice(6)}`;
    return p;
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
:root{--bg:#050c07;--card:#0d1c14;--border:#1a3326;--accent:#00e676;--fg:#e0f2e9;--fg2:#a5c4b5;--muted:#4a6b58}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Space Grotesk',sans-serif;background:var(--bg);color:var(--fg);min-height:100vh}
.auth-wrap{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px;background:radial-gradient(ellipse 500px 300px at 50% 30%,rgba(0,230,118,.04),transparent 60%)}
.auth-logo{display:flex;align-items:center;gap:8px;margin-bottom:32px;font-size:20px;font-weight:800}
.auth-logo i{color:var(--accent);font-size:24px}
.auth-card{background:var(--card);border:1px solid var(--border);border-radius:14px;padding:28px 24px;width:100%;max-width:380px}
.auth-step{font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px}
.auth-card h1{font-size:20px;font-weight:700;margin-bottom:4px}
.auth-sub{font-size:11px;color:var(--muted);margin-bottom:20px;line-height:1.5}
.auth-sub strong{color:var(--fg2)}
.auth-phone-row{display:flex;gap:8px;margin-bottom:12px}
.auth-country{display:flex;align-items:center;padding:10px 12px;background:#050A05;border:1px solid var(--border);border-radius:8px;font-size:13px;color:var(--muted);white-space:nowrap}
.auth-input{flex:1;background:#050A05;border:1px solid var(--border);border-radius:8px;padding:10px 14px;color:var(--fg);font-size:16px;font-family:monospace;outline:none}
.auth-input:focus{border-color:var(--accent)}
.auth-input:disabled{opacity:.5}
.auth-otp-input{width:100%;background:#050A05;border:1px solid var(--border);border-radius:8px;padding:14px;color:var(--fg);font-size:28px;font-family:monospace;text-align:center;letter-spacing:12px;outline:none;margin-bottom:12px}
.auth-otp-input:focus{border-color:var(--accent)}
.auth-otp-input:disabled{opacity:.5}
.auth-btn{width:100%;padding:12px;background:var(--accent);color:var(--bg);border:none;border-radius:8px;font-weight:700;font-size:14px;font-family:inherit;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;transition:opacity .2s}
.auth-btn:hover{opacity:.85}
.auth-btn:disabled{opacity:.4;cursor:default}
.auth-error{background:rgba(255,61,61,.08);border:1px solid rgba(255,61,61,.2);border-radius:8px;padding:10px 14px;color:#ff5252;font-size:11px;margin-bottom:12px;display:flex;align-items:center;gap:6px}
.auth-link{width:100%;margin-top:10px;padding:10px;background:transparent;border:none;color:var(--muted);font-size:10px;font-family:inherit;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:5px}
.auth-link:hover{color:var(--fg2)}
.auth-link:disabled{opacity:.4}
.auth-footer{font-size:9px;color:var(--muted);text-align:center;margin-top:14px;line-height:1.5}
.auth-back{margin-top:20px}
.auth-back a{font-size:10px;color:var(--muted);text-decoration:none;display:flex;align-items:center;gap:5px}
.auth-back a:hover{color:var(--fg2)}
`}} />

      <div className="auth-wrap">
        <div className="auth-logo">
          <i className="fas fa-shield-halved" />
          <span>CallShield India</span>
        </div>

        <div className="auth-card">
          {!otpSent ? (
            <>
              <div className="auth-step">Step 1 of 2</div>
              <h1>Sign In with Phone</h1>
              <p className="auth-sub">Enter your Indian mobile number.</p>

              <form onSubmit={e => { e.preventDefault(); sendOtp(); }}>
                <div className="auth-phone-row">
                  <div className="auth-country">+91</div>
                  <input
                    type="tel"
                    className="auth-input"
                    placeholder="Enter mobile number"
                    value={phone}
                    onChange={e => setPhone(e.target.value.replace(/[^0-9]/g, '').slice(0, 10))}
                    maxLength={10}
                    autoFocus
                    disabled={loading}
                  />
                </div>

                {error && <div className="auth-error"><i className="fas fa-exclamation-circle" />{error}</div>}

                <button type="submit" className="auth-btn" disabled={loading || phone.length < 10}>
                  {loading ? <><i className="fas fa-spinner fa-spin" /> Sending...</> : <><i className="fas fa-paper-plane" /> Send OTP</>}
                </button>
              </form>
            </>
          ) : (
            <>
              <div className="auth-step">Step 2 of 2</div>
              <h1>Enter OTP</h1>
              <p className="auth-sub">Code sent to <strong>{maskPhone(phone)}</strong></p>

              <form onSubmit={e => { e.preventDefault(); verifyOtp(); }}>
                <input
                  type="text"
                  className="auth-otp-input"
                  placeholder="000000"
                  value={otp}
                  onChange={e => setOtp(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                  maxLength={6}
                  autoFocus
                  disabled={loading}
                />

                {error && <div className="auth-error"><i className="fas fa-exclamation-circle" />{error}</div>}

                <button type="submit" className="auth-btn" disabled={loading || otp.length < 6}>
                  {loading ? <><i className="fas fa-spinner fa-spin" /> Verifying...</> : <><i className="fas fa-check-circle" /> Verify OTP</>}
                </button>
              </form>

              <button className="auth-link" onClick={() => { setOtpSent(false); setOtp(''); setError(''); }} disabled={loading}>
                <i className="fas fa-arrow-left" /> Change number
              </button>
              <button className="auth-link" onClick={sendOtp} disabled={loading}>
                <i className="fas fa-redo" /> Resend OTP
              </button>
            </>
          )}
        </div>

        <div className="auth-back">
          <a href="/dashboard"><i className="fas fa-arrow-left" /> Back to Dashboard</a>
        </div>
      </div>
    </>
  );
}
