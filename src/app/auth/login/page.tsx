'use client';

/**
 * CallShield Login Page
 * Phone OTP authentication flow.
 */

import { Suspense, useState, FormEvent, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { useRouter, useSearchParams } from 'next/navigation';

function LoginForm() {
  const { user, sendOtp, verifyOtp, isAuthenticated } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') || '/';

  const [phone, setPhone] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      router.replace(redirect);
    }
  }, [isAuthenticated, router, redirect]);

  const handleSendOtp = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    const cleaned = phone.replace(/[^0-9]/g, '');
    if (cleaned.length < 10) {
      setError('Please enter a valid 10-digit Indian mobile number');
      return;
    }

    setLoading(true);
    setError('');
    const result = await sendOtp(cleaned);
    setLoading(false);

    if (result.success) {
      setOtpSent(true);
    } else {
      setError(result.error || 'Failed to send OTP. Please try again.');
    }
  };

  const handleVerifyOtp = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    if (otp.length < 6) {
      setError('Please enter the 6-digit OTP');
      return;
    }

    setLoading(true);
    setError('');
    const result = await verifyOtp(phone.replace(/[^0-9]/g, ''), otp);
    setLoading(false);

    if (!result.success) {
      setError(result.error || 'Invalid OTP. Please try again.');
    }
    // On success, the useEffect above will redirect
  };

  const maskPhone = (p: string) => {
    const nums = p.replace(/[^0-9]/g, '');
    if (nums.length === 10) {
      return `+91 ${nums.slice(0, 3)} ${nums.slice(3, 6)} ${nums.slice(6)}`;
    }
    return p;
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: LOGIN_STYLES }} />
      <div className="auth-bg" />

      <div className="auth-wrap">
        {/* Logo */}
        <div className="auth-logo">
          <i className="fas fa-shield-halved" />
          <span>CallShield India</span>
        </div>

        <div className="auth-card">
          {!otpSent ? (
            /* Step 1: Enter Phone */
            <>
              <div className="auth-step-badge">Step 1 of 2</div>
              <h1>Sign In with Phone</h1>
              <p className="auth-sub">
                Enter your Indian mobile number. We&apos;ll send you a one-time password.
              </p>

              <form onSubmit={handleSendOtp}>
                <div className="auth-phone-group">
                  <div className="auth-country-code">+91</div>
                  <input
                    type="tel"
                    className="auth-phone-input"
                    placeholder="Enter mobile number"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, '').slice(0, 10))}
                    maxLength={10}
                    autoFocus
                    disabled={loading}
                  />
                </div>

                {error && (
                  <div className="auth-error">
                    <i className="fas fa-exclamation-circle" /> {error}
                  </div>
                )}

                <button type="submit" className="auth-btn" disabled={loading || phone.length < 10}>
                  {loading ? (
                    <>
                      <i className="fas fa-spinner fa-spin" /> Sending OTP...
                    </>
                  ) : (
                    <>
                      <i className="fas fa-paper-plane" /> Send OTP
                    </>
                  )}
                </button>
              </form>

              <p className="auth-footer-text">
                By signing in, you agree to our Terms of Service and Privacy Policy.
              </p>
            </>
          ) : (
            /* Step 2: Enter OTP */
            <>
              <div className="auth-step-badge">Step 2 of 2</div>
              <h1>Enter OTP</h1>
              <p className="auth-sub">
                We sent a 6-digit code to <strong>{maskPhone(phone)}</strong>
              </p>

              <form onSubmit={handleVerifyOtp}>
                <input
                  type="text"
                  className="auth-otp-input"
                  placeholder="000000"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                  maxLength={6}
                  autoFocus
                  disabled={loading}
                />

                {error && (
                  <div className="auth-error">
                    <i className="fas fa-exclamation-circle" /> {error}
                  </div>
                )}

                <button type="submit" className="auth-btn" disabled={loading || otp.length < 6}>
                  {loading ? (
                    <>
                      <i className="fas fa-spinner fa-spin" /> Verifying...
                    </>
                  ) : (
                    <>
                      <i className="fas fa-check-circle" /> Verify OTP
                    </>
                  )}
                </button>
              </form>

              <button
                className="auth-link-btn"
                onClick={() => { setOtpSent(false); setOtp(''); setError(''); }}
                disabled={loading}
              >
                <i className="fas fa-arrow-left" /> Change phone number
              </button>

              <button
                className="auth-link-btn"
                onClick={handleSendOtp}
                disabled={loading}
              >
                <i className="fas fa-redo" /> Resend OTP
              </button>
            </>
          )}
        </div>

        {/* Back link */}
        <div className="auth-back">
          <a href="/">
            <i className="fas fa-arrow-left" /> Back to Dashboard
          </a>
        </div>
      </div>
    </>
  );
}

const LOGIN_STYLES = `
:root{--bg:#050c07;--bg2:#091410;--card:#0d1c14;--border:#1a3326;--accent:#00e676;--ad:rgba(0,230,118,.1);--ag:rgba(0,230,118,.25);--danger:#ff3d3d;--dd:rgba(255,61,61,.1);--fg:#e0f2e9;--fg2:#a5c4b5;--muted:#4a6b58;--r:14px;--rs:8px}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Space Grotesk',sans-serif;background:var(--bg);color:var(--fg);min-height:100vh;overflow-x:hidden}
.auth-bg{position:fixed;inset:0;background:radial-gradient(ellipse 600px 400px at 50% 20%,rgba(0,230,118,.05),transparent 60%),radial-gradient(ellipse 400px 300px at 80% 80%,rgba(64,196,255,.03),transparent 50%);pointer-events:none}
.auth-wrap{position:relative;z-index:1;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px 20px}

.auth-logo{display:flex;align-items:center;gap:8px;font-size:18px;font-weight:800;margin-bottom:28px;color:var(--fg)}
.auth-logo i{color:var(--accent);font-size:20px}

.auth-card{background:var(--card);border:1px solid var(--border);border-radius:var(--r);padding:32px 28px;width:100%;max-width:420px}

.auth-step-badge{display:inline-block;padding:3px 10px;border-radius:12px;background:var(--ad);border:1px solid rgba(0,230,118,.15);font-size:9px;font-weight:600;color:var(--accent);margin-bottom:12px}

.auth-card h1{font-size:22px;font-weight:700;margin-bottom:6px}
.auth-sub{font-size:11px;color:var(--muted);line-height:1.6;margin-bottom:20px}
.auth-sub strong{color:var(--fg2)}

.auth-phone-group{display:flex;gap:0;align-items:stretch;border:1px solid var(--border);border-radius:var(--rs);overflow:hidden;background:var(--bg2);margin-bottom:14px}
.auth-country-code{display:flex;align-items:center;padding:0 14px;background:rgba(0,230,118,.05);border-right:1px solid var(--border);font-size:13px;font-weight:600;color:var(--fg2);white-space:nowrap}
.auth-phone-input{flex:1;padding:14px 12px;background:transparent;border:none;color:var(--fg);font-family:'JetBrains Mono',monospace;font-size:15px;outline:none;letter-spacing:2px}
.auth-phone-input::placeholder{color:var(--muted);letter-spacing:0}

.auth-otp-input{width:100%;padding:16px 14px;background:var(--bg2);border:1px solid var(--border);border-radius:var(--rs);color:var(--fg);font-family:'JetBrains Mono',monospace;font-size:24px;text-align:center;letter-spacing:12px;outline:none;margin-bottom:14px}
.auth-otp-input:focus{border-color:var(--accent)}
.auth-otp-input::placeholder{color:var(--muted);letter-spacing:4px;font-size:14px}

.auth-error{padding:8px 12px;border-radius:var(--rs);background:var(--dd);color:var(--danger);font-size:10px;display:flex;align-items:center;gap:6px;margin-bottom:12px}

.auth-btn{width:100%;padding:14px;background:var(--accent);color:var(--bg);border:none;border-radius:var(--rs);font-family:inherit;font-size:13px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;transition:opacity .2s}
.auth-btn:hover:not(:disabled){opacity:.85}
.auth-btn:disabled{opacity:.5;cursor:not-allowed}

.auth-link-btn{width:100%;margin-top:10px;padding:10px;background:transparent;border:none;color:var(--muted);font-family:inherit;font-size:10px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:5px;transition:color .2s}
.auth-link-btn:hover{color:var(--fg2)}
.auth-link-btn:disabled{opacity:.4}

.auth-footer-text{font-size:9px;color:var(--muted);text-align:center;margin-top:14px;line-height:1.5}
.auth-back{margin-top:20px}
.auth-back a{font-size:10px;color:var(--muted);text-decoration:none;display:flex;align-items:center;gap:5px;transition:color .2s}
.auth-back a:hover{color:var(--fg2)}
`;

// Wrap in Suspense for useSearchParams
export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#050c07', color: '#a5c4b5' }}>Loading...</div>}>
      <LoginForm />
    </Suspense>
  );
}
