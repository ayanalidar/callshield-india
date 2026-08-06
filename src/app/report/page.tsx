'use client';

/**
 * CallShield Cyber Cell Report Generator Page
 *
 * Form to enter details and generate a printable complaint report.
 * /report?phone=+919876543210
 */

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const SCAM_TYPES = [
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

/* ------------------------------------------------------------------ */
/*  Form Component (uses useSearchParams)                              */
/* ------------------------------------------------------------------ */

function ReportForm() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [phoneNumber, setPhoneNumber] = useState('');
  const [scamType, setScamType] = useState('');
  const [description, setDescription] = useState('');
  const [callerName, setCallerName] = useState('');
  const [callTimestamp, setCallTimestamp] = useState('');
  const [callDuration, setCallDuration] = useState('');
  const [deviceInfo, setDeviceInfo] = useState('');
  const [reporterName, setReporterName] = useState('');
  const [reporterPhone, setReporterPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Pre-fill phone from search params
  useEffect(() => {
    const phone = searchParams.get('phone');
    if (phone) setPhoneNumber(phone);
    const type = searchParams.get('type');
    if (type) setScamType(type);
  }, [searchParams]);

  const handleGenerate = async () => {
    if (!phoneNumber || phoneNumber.replace(/[^0-9+]/g, '').length < 8) {
      setError('Enter a valid phone number (min 8 digits)');
      return;
    }
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/report/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber,
          scamType: scamType || 'other',
          description: description.trim(),
          callerName: callerName.trim(),
          callTimestamp: callTimestamp,
          callDuration: callDuration.trim(),
          deviceInfo: deviceInfo.trim(),
          reporterName: reporterName.trim(),
          reporterPhone: reporterPhone.trim(),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to generate report' }));
        throw new Error(err.error || 'Failed to generate report');
      }

      const html = await res.text();
      const w = window.open('', '_blank');
      if (w) {
        w.document.write(html);
        w.document.close();
      } else {
        setError('Pop-up blocked! Please allow pop-ups for this site to view the report.');
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const filledFields =
    phoneNumber.replace(/[^0-9]/g, '').length >= 8;

  return (
    <>
      {/* Header */}
      <header className="rpt-header">
        <Link href="/dashboard" className="rpt-back">← Back</Link>
        <div className="rpt-header-title">📄 Cyber Cell Report</div>
        <div style={{ width: 40 }} />
      </header>

      <div className="rpt-body">
        {/* Intro */}
        <div className="rpt-intro">
          <div className="rpt-intro-icon">🛡️</div>
          <h2 className="rpt-intro-title">Generate Complaint Report</h2>
          <p className="rpt-intro-desc">
            Fill in the details below to generate a professional report that you can print and submit to the Cyber Cell along with your complaint.
          </p>
        </div>

        {/* Form */}
        <div className="card">
          <div className="card-head">
            <span>📞</span> Scam Number Details
            <span className="card-badge-required">*Required</span>
          </div>

          <div className="form-group">
            <label className="form-label">
              Phone Number <span className="form-required">*</span>
            </label>
            <input
              className="form-input mono"
              type="tel"
              placeholder="+91 98765 43210"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              maxLength={20}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Scam Type</label>
            <select
              className="form-input"
              value={scamType}
              onChange={(e) => setScamType(e.target.value)}
            >
              <option value="">Select scam type...</option>
              {SCAM_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Call Date &amp; Time</label>
            <input
              className="form-input"
              type="datetime-local"
              value={callTimestamp}
              onChange={(e) => setCallTimestamp(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Call Duration</label>
            <input
              className="form-input"
              type="text"
              placeholder="e.g. 3 minutes, 45 seconds"
              value={callDuration}
              onChange={(e) => setCallDuration(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Caller Name (if known)</label>
            <input
              className="form-input"
              type="text"
              placeholder="What did the caller say their name was?"
              value={callerName}
              onChange={(e) => setCallerName(e.target.value)}
            />
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <span>📱</span> Device Information
          </div>

          <div className="form-group">
            <label className="form-label">Device Info</label>
            <textarea
              className="form-textarea"
              placeholder="Your device model, OS version, IMEI (optional), tower location, signal strength, etc."
              value={deviceInfo}
              onChange={(e) => setDeviceInfo(e.target.value)}
              rows={3}
            />
            <div className="form-hint">
              Optional — helps cyber cell trace the call origin
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <span>👤</span> Reporter Details
          </div>

          <div className="form-group">
            <label className="form-label">Your Full Name</label>
            <input
              className="form-input"
              type="text"
              placeholder="As it appears on your ID"
              value={reporterName}
              onChange={(e) => setReporterName(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Your Phone Number</label>
            <input
              className="form-input mono"
              type="tel"
              placeholder="+91 98765 43210"
              value={reporterPhone}
              onChange={(e) => setReporterPhone(e.target.value)}
              maxLength={20}
            />
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <span>📝</span> Evidence &amp; Description
          </div>

          <div className="form-group">
            <label className="form-label">Describe the Incident</label>
            <textarea
              className="form-textarea"
              placeholder="What happened? What did the caller say? Did they ask for money, OTP, Aadhaar details? Include as much detail as possible..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              maxLength={2000}
            />
            <div className="form-hint">
              {description.length}/2000 — Include specific details: what was said, amounts demanded, threats made
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="error-box">⚠️ {error}</div>
        )}

        {/* Generate Button */}
        <div className="rpt-actions">
          <button
            className="rpt-btn rpt-btn-primary"
            onClick={handleGenerate}
            disabled={loading || !filledFields}
          >
            {loading ? (
              <>⏳ Generating Report...</>
            ) : (
              <>📄 Generate Cyber Cell Report</>
            )}
          </button>
          <p className="rpt-actions-hint">
            Report opens in a new tab — use <strong>Ctrl+P</strong> (or Cmd+P) to print or save as PDF
          </p>
        </div>

        {/* Info Box */}
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-head">
            <span>ℹ️</span> What to do with this report
          </div>
          <ol className="info-list">
            <li>Fill in all available details above</li>
            <li>Click &quot;Generate Cyber Cell Report&quot;</li>
            <li>Print or save as PDF from the new tab</li>
            <li>Visit <strong>cybercrime.gov.in</strong> to file your complaint</li>
            <li>Attach this report as supporting evidence</li>
            <li>Also call <strong>1930</strong> — the National Cyber Crime Helpline</li>
          </ol>
        </div>
      </div>

      {/* Bottom Nav */}
      <nav className="bot-nav">
        <Link href="/dashboard" className="bot-nav-i">📞<span>Scan</span></Link>
        <Link href="/scanner" className="bot-nav-i">📱<span>Scanner</span></Link>
        <Link href="/trends" className="bot-nav-i">🔥<span>Trends</span></Link>
        <Link href="/wiki" className="bot-nav-i">📖<span>Wiki</span></Link>
        <Link href="/history" className="bot-nav-i">📄<span>History</span></Link>
      </nav>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Page Export with Suspense                                          */
/* ------------------------------------------------------------------ */

export default function ReportPage() {
  return (
    <>
      <style>{CSS}</style>
      <Suspense fallback={
        <div className="rpt-load">
          <div className="rpt-load-s">🛡️</div>
          <div>Loading Report Form...</div>
        </div>
      }>
        <ReportForm />
      </Suspense>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Styles                                                             */
/* ------------------------------------------------------------------ */

const CSS = `
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  :root{
    --bg:#060e08;--surface:#0b1a0f;--card:#0e1f13;--border:#142a1b;
    --accent:#00e676;--text:#e0f2e9;--text2:#9ab7a5;--muted:#4a6b58;
    --danger:#ff3d3d;--warn:#ff9800;
    --r:12px;--rs:8px;
  }
  body{
    font-family:'Inter','Space Grotesk',system-ui,sans-serif;
    background:var(--bg);color:var(--text);
    -webkit-font-smoothing:antialiased;
    overflow-x:hidden;
  }

  .rpt-load{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100dvh;gap:12px;color:var(--muted);font-size:14px}
  .rpt-load-s{font-size:48px;margin-bottom:4px}

  .rpt-header{
    display:flex;align-items:center;justify-content:space-between;
    padding:12px 16px;background:var(--surface);border-bottom:1px solid var(--border);
    position:sticky;top:0;z-index:10;backdrop-filter:blur(10px);
  }
  .rpt-back{font-size:12px;color:var(--text2);text-decoration:none;display:flex;align-items:center;gap:4px;padding:6px 10px;border-radius:6px}
  .rpt-back:hover{color:var(--accent)}
  .rpt-header-title{font-size:14px;font-weight:700;display:flex;align-items:center;gap:6px}

  .rpt-body{padding:16px;max-width:600px;margin:0 auto;display:flex;flex-direction:column;gap:14px}

  .rpt-intro{text-align:center;padding:24px 0 8px}
  .rpt-intro-icon{font-size:48px;margin-bottom:8px}
  .rpt-intro-title{font-size:20px;font-weight:800;margin-bottom:4px}
  .rpt-intro-desc{font-size:11px;color:var(--muted);max-width:400px;margin:0 auto;line-height:1.5}

  .card{background:var(--card);border:1px solid var(--border);border-radius:var(--r);padding:16px;width:100%}
  .card-head{font-size:12px;font-weight:700;color:var(--text);display:flex;align-items:center;gap:8px;margin-bottom:14px}
  .card-badge-required{font-size:8px;color:var(--danger);background:rgba(255,61,61,.1);padding:2px 8px;border-radius:4px;margin-left:auto;text-transform:uppercase;letter-spacing:.5px}

  .form-group{margin-bottom:12px}
  .form-group:last-child{margin-bottom:0}
  .form-label{display:block;font-size:10px;font-weight:600;color:var(--text2);margin-bottom:5px}
  .form-required{color:var(--danger)}
  .form-input{
    width:100%;padding:10px 12px;background:#050a05;border:1px solid var(--border);
    border-radius:var(--rs);color:var(--text);font-size:14px;font-family:inherit;
    outline:none;transition:border-color .15s;
    -webkit-appearance:none;appearance:none;
  }
  .form-input.mono{font-family:'JetBrains Mono','Consolas',monospace}
  .form-input:focus{border-color:var(--accent)}
  .form-input::placeholder{color:var(--muted)}
  select.form-input{cursor:pointer}
  select.form-input option{background:var(--card);color:var(--text)}

  .form-textarea{
    width:100%;padding:10px 12px;background:#050a05;border:1px solid var(--border);
    border-radius:var(--rs);color:var(--text);font-size:13px;font-family:inherit;
    outline:none;resize:vertical;line-height:1.5;transition:border-color .15s;
  }
  .form-textarea:focus{border-color:var(--accent)}
  .form-textarea::placeholder{color:var(--muted)}
  .form-hint{font-size:9px;color:var(--muted);margin-top:4px;display:flex;justify-content:space-between}

  .rpt-actions{display:flex;flex-direction:column;align-items:center;gap:10px;padding:8px 0}
  .rpt-btn{
    width:100%;max-width:360px;padding:14px 20px;border:none;border-radius:var(--rs);
    font-size:15px;font-weight:700;font-family:inherit;cursor:pointer;
    transition:opacity .15s;display:flex;align-items:center;justify-content:center;gap:8px;
  }
  .rpt-btn:active{opacity:.75}
  .rpt-btn:disabled{opacity:.35;cursor:default}
  .rpt-btn-primary{background:var(--accent);color:#050c07}
  .rpt-actions-hint{font-size:10px;color:var(--muted);text-align:center}

  .error-box{
    background:rgba(255,61,61,.06);border:1px solid rgba(255,61,61,.2);
    border-radius:var(--rs);padding:12px;color:var(--danger);font-size:11px;
    display:flex;align-items:center;gap:8px;
  }

  .info-list{counter-reset:info;list-style:none;padding:0}
  .info-list li{
    counter-increment:info;padding:8px 0 8px 28px;position:relative;
    font-size:11px;color:var(--text2);border-bottom:1px solid var(--border);
  }
  .info-list li:last-child{border-bottom:none}
  .info-list li::before{
    content:counter(info);position:absolute;left:0;top:8px;
    width:18px;height:18px;border-radius:50%;background:rgba(0,230,118,.12);
    color:var(--accent);font-size:9px;font-weight:800;display:flex;
    align-items:center;justify-content:center;
  }
  .info-list strong{color:var(--accent)}

  .bot-nav{
    display:flex;justify-content:space-around;align-items:center;
    background:var(--surface);border-top:1px solid var(--border);
    position:sticky;bottom:0;min-height:56px;
    padding-bottom:env(safe-area-inset-bottom,0px);
  }
  .bot-nav-i{display:flex;flex-direction:column;align-items:center;gap:3px;font-size:18px;color:var(--muted);padding:6px 0;text-decoration:none;transition:color .15s}
  .bot-nav-i span{font-size:9px;font-weight:500}
  .bot-nav-i:active,.bot-nav-i:hover{color:var(--accent)}
`;
