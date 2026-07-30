'use client';

import { useState, useCallback } from 'react';

type LookupResult = {
  phoneNumber: string;
  verdict: string;
  threatScore: number;
  isScam: boolean;
  scamType?: string;
  severity?: string;
  confidence: number;
  shouldBlock: boolean;
  telecomCircle?: string;
  carrier?: string;
  numberType?: string;
  evidence: string[];
  warnings: string[];
  dbMatch: { found: boolean; reportCount: number; verified: boolean; source: string };
  responseTime: number;
  cached: boolean;
};

type ProtectionLevel = 'strict' | 'standard' | 'permissive';

export default function DashboardPage() {
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<LookupResult | null>(null);
  const [error, setError] = useState('');
  const [protection, setProtection] = useState<ProtectionLevel>('strict');

  const handleLookup = useCallback(async () => {
    if (!phone.trim() || phone.trim().length < 8) {
      setError('Enter a valid phone number (min 8 digits)');
      return;
    }
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const res = await fetch('/api/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: phone.trim(), protectionLevel: protection }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Lookup failed');
      }
      const data: LookupResult = await res.json();
      setResult(data);
    } catch (e: any) {
      setError(e.message || 'Network error');
    } finally {
      setLoading(false);
    }
  }, [phone, protection]);

  const verdictColor: Record<string, string> = {
    safe: '#00e676',
    suspicious: '#ff9800',
    scam: '#ff3d3d',
    critical: '#d50000',
  };

  return (
    <main style={{ minHeight: '100vh', background: '#0D1F0D', color: '#e0f2e9', fontFamily: 'Space Grotesk, sans-serif' }}>
      <style>{STYLES}</style>

      {/* Header */}
      <header className="dash-header">
        <div className="dash-header-inner">
          <div>
            <div className="dash-logo">🛡️ CallShield India</div>
            <div className="dash-tag">Real-Time Scam Call Detection</div>
          </div>
          <div className="dash-stats-pill">
            <span>📊 736 scams tracked</span>
            <span>🔍 1.2M+ lookups</span>
          </div>
        </div>
      </header>

      <div style={{ maxWidth: 800, margin: '0 auto', padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        
        {/* Lookup Card */}
        <div className="card">
          <h2 className="card-title">📞 Scan a Number</h2>
          <p className="card-sub">Enter any phone number to check if it's been reported as a scam</p>

          <div className="lookup-row">
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLookup()}
              placeholder="+919876543210"
              className="lookup-input"
              autoFocus
            />
            <select
              value={protection}
              onChange={e => setProtection(e.target.value as ProtectionLevel)}
              className="protection-select"
              title="Protection level"
            >
              <option value="strict">Strict</option>
              <option value="standard">Standard</option>
              <option value="permissive">Permissive</option>
            </select>
            <button onClick={handleLookup} disabled={loading} className="lookup-btn">
              {loading ? '🔍...' : '🔍 Scan'}
            </button>
          </div>

          {error && <div className="error">{error}</div>}

          {/* Quick Examples */}
          {!result && !loading && (
            <div className="quick-examples">
              <span className="examples-label">Quick test:</span>
              {[
                { label: 'UPI Fraud', num: '+919876543210' },
                { label: 'Bank OTP', num: '+918765432109' },
                { label: 'FedEx', num: '+919988776655' },
              ].map(ex => (
                <button
                  key={ex.num}
                  className="example-chip"
                  onClick={() => { setPhone(ex.num); setTimeout(() => handleLookup(), 50); }}
                >
                  {ex.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Results */}
        {result && (
          <div className="card result-card" style={{ borderColor: verdictColor[result.verdict] || '#333' }}>
            {/* Verdict Banner */}
            <div className="verdict-banner" style={{ background: (verdictColor[result.verdict] || '#333') + '20', borderColor: verdictColor[result.verdict] || '#333' }}>
              <div>
                <div className="verdict-label" style={{ color: verdictColor[result.verdict] || '#888' }}>
                  {result.verdict === 'critical' ? '🛑' : result.verdict === 'scam' ? '🚨' : result.verdict === 'suspicious' ? '⚠️' : '✅'}
                  &nbsp;{result.verdict.toUpperCase()}
                </div>
                <div className="phone-display">{result.phoneNumber}</div>
                {result.carrier && (
                  <div className="carrier-info">{result.carrier}{result.telecomCircle ? ` · ${result.telecomCircle}` : ''}</div>
                )}
              </div>
              <div className="score-ring" style={{ borderColor: verdictColor[result.verdict] || '#888' }}>
                <div className="score-num">{result.threatScore}</div>
                <div className="score-label">/100</div>
              </div>
            </div>

            {/* Details Grid */}
            <div className="detail-grid">
              <div className="detail-item">
                <span className="detail-label">Scam Type</span>
                <span className="detail-value">{result.scamType || 'None detected'}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Severity</span>
                <span className={`detail-value badge severity-${result.severity || 'low'}`}>{result.severity || 'low'}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Confidence</span>
                <span className="detail-value">{Math.round(result.confidence * 100)}%</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Action</span>
                <span className={`detail-value badge ${result.shouldBlock ? 'badge-red' : 'badge-green'}`}>
                  {result.shouldBlock ? '🛑 BLOCK' : '✅ Allow'}
                </span>
              </div>
              <div className="detail-item">
                <span className="detail-label">DB Reports</span>
                <span className="detail-value">{result.dbMatch.reportCount}{result.dbMatch.verified ? ' ✅ verified' : ''}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Response</span>
                <span className="detail-value">{result.responseTime}ms{result.cached ? ' (cached)' : ''}</span>
              </div>
            </div>

            {/* Evidence */}
            {result.evidence.length > 0 && (
              <div className="section">
                <div className="section-title">📋 Evidence</div>
                <ul className="evidence-list">
                  {result.evidence.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Warnings */}
            {result.warnings.length > 0 && (
              <div className="section">
                <div className="section-title">⚠️ Warnings</div>
                <ul className="warning-list">
                  {result.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

const STYLES = `
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Space Grotesk',sans-serif;background:#0D1F0D}

.dash-header{background:#0A150A;border-bottom:1px solid rgba(0,230,118,.15);padding:12px 0}
.dash-header-inner{max-width:800px;margin:0 auto;padding:0 16px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px}
.dash-logo{font-size:18px;font-weight:800;display:flex;align-items:center;gap:6px}
.dash-tag{font-size:10px;color:#4a6b58;margin-top:2px}
.dash-stats-pill{display:flex;gap:12px;font-size:10px;color:#4a6b58;background:rgba(0,230,118,.05);padding:6px 12px;border-radius:20px}

.card{background:#0A150A;border:1px solid rgba(0,230,118,.1);border-radius:12px;padding:20px}
.card-title{font-size:16px;font-weight:700;margin-bottom:4px}
.card-sub{font-size:11px;color:#4a6b58;margin-bottom:14px}

.lookup-row{display:flex;gap:8px}
.lookup-input{flex:1;background:#050A05;border:1px solid rgba(0,230,118,.15);border-radius:8px;padding:10px 14px;color:#e0f2e9;font-size:16px;font-family:monospace;outline:none}
.lookup-input:focus{border-color:#00e676}
.protection-select{background:#050A05;border:1px solid rgba(0,230,118,.15);border-radius:8px;padding:10px 8px;color:#a5c4b5;font-size:11px;font-family:inherit;outline:none;cursor:pointer}
.lookup-btn{padding:10px 20px;background:#00e676;color:#050c07;border:none;border-radius:8px;font-weight:700;font-size:14px;font-family:inherit;cursor:pointer;white-space:nowrap}
.lookup-btn:hover{background:#00c853}
.lookup-btn:disabled{background:#1a3326;color:#4a6b58;cursor:default}

.error{background:rgba(255,61,61,.08);border:1px solid rgba(255,61,61,.2);border-radius:8px;padding:10px 14px;color:#ff5252;font-size:12px;margin-top:10px}

.quick-examples{display:flex;align-items:center;gap:8px;margin-top:10px;flex-wrap:wrap}
.examples-label{font-size:10px;color:#4a6b58}
.example-chip{background:rgba(0,230,118,.08);border:1px solid rgba(0,230,118,.15);border-radius:20px;padding:4px 12px;color:#a5c4b5;font-size:10px;font-family:inherit;cursor:pointer}
.example-chip:hover{background:rgba(0,230,118,.15);color:#e0f2e9}

.result-card{border-width:2px}

.verdict-banner{display:flex;justify-content:space-between;align-items:center;padding:16px;border-radius:10px;border:1px solid;margin-bottom:14px}
.verdict-label{font-size:18px;font-weight:800}
.phone-display{font-size:20px;font-family:monospace;font-weight:600;margin:4px 0}
.carrier-info{font-size:11px;color:#4a6b58}
.score-ring{width:72px;height:72px;border-radius:50%;border:3px solid;display:flex;flex-direction:column;align-items:center;justify-content:center;min-width:72px}
.score-num{font-size:22px;font-weight:800}
.score-label{font-size:9px;opacity:.6}

.detail-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:14px}
@media(max-width:500px){.detail-grid{grid-template-columns:1fr 1fr}}
.detail-item{display:flex;flex-direction:column;gap:2px}
.detail-label{font-size:9px;color:#4a6b58;text-transform:uppercase}
.detail-value{font-size:13px;font-weight:600}
.badge{display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700}
.severity-critical{background:rgba(213,0,0,.2);color:#ff5252}
.severity-high{background:rgba(255,61,61,.15);color:#ff5252}
.severity-medium{background:rgba(255,152,0,.15);color:#ff9800}
.severity-low{background:rgba(0,230,118,.1);color:#00e676}
.badge-red{background:rgba(255,61,61,.15);color:#ff5252}
.badge-green{background:rgba(0,230,118,.1);color:#00e676}

.section{margin-top:12px}
.section-title{font-size:12px;font-weight:600;margin-bottom:6px;color:#a5c4b5}
.evidence-list,.warning-list{list-style:none;display:flex;flex-direction:column;gap:4px}
.evidence-list li{font-size:11px;color:#4a6b58;padding:6px 10px;background:rgba(0,230,118,.04);border-radius:6px;display:flex;align-items:flex-start;gap:6px}
.evidence-list li::before{content:'▸';color:#00e676;min-width:14px}
.warning-list li{font-size:11px;color:#ff9800;padding:6px 10px;background:rgba(255,152,0,.06);border-radius:6px;display:flex;align-items:flex-start;gap:6px}
.warning-list li::before{content:'⚠';min-width:18px}
`;
