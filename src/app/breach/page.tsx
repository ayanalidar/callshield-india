'use client';

import { useState, useCallback } from 'react';

// ─── Types ─────────────────────────────────────────────────

interface Breach {
  name: string;
  date: string;
  dataTypes: string[];
  severity: string;
  category: string;
  affectedUsers: number;
  domain: string;
  description: string;
}

interface BreachResult {
  found: boolean;
  breaches: Breach[];
  riskLevel: string;
  recommendations: string[];
  totalExposures: number;
  disclaimer: string;
}

// ─── Constants ─────────────────────────────────────────────

const SEVERITY_STYLES: Record<string, { bg: string; border: string; icon: string; text: string }> = {
  safe:     { bg: 'bg-[#00e67615]', border: 'border-[#00e67644]', icon: '🟢', text: 'text-[#00e676]' },
  low:      { bg: 'bg-blue-900/10', border: 'border-blue-500/30', icon: '🔵', text: 'text-blue-400' },
  medium:   { bg: 'bg-yellow-900/10', border: 'border-yellow-500/30', icon: '🟡', text: 'text-yellow-400' },
  high:     { bg: 'bg-orange-900/10', border: 'border-orange-500/40', icon: '🟠', text: 'text-orange-400' },
  critical: { bg: 'bg-red-900/20', border: 'border-red-500/50', icon: '🔴', text: 'text-red-400' },
};

const RISK_LEVELS = {
  safe:     { label: 'Safe', desc: 'No known breaches' },
  low:      { label: 'Low Risk', desc: 'Minor exposure' },
  medium:   { label: 'Medium Risk', desc: 'Data exposed in 1-2 breaches' },
  high:     { label: 'High Risk', desc: 'Multiple exposures detected' },
  critical: { label: 'Critical Risk', desc: 'Sensitive data compromised' },
};

const PROTECTION_TIPS = [
  { icon: '🔐', title: 'Unique Passwords', desc: 'Use a different password for every service.' },
  { icon: '📱', title: 'Enable 2FA', desc: 'Two-factor authentication stops 99% of account takeovers.' },
  { icon: '👁️', title: 'Monitor Accounts', desc: 'Check bank and email activity weekly.' },
  { icon: '🔍', title: 'Google Yourself', desc: 'Search your phone number periodically.' },
  { icon: '🛡️', title: 'SIM Lock', desc: 'Set a SIM PIN to prevent SIM swap fraud.' },
  { icon: '🚫', title: 'Never Share OTP', desc: 'OTPs unlock everything. Never share with anyone.' },
];

function formatNumber(n: number): string {
  if (n >= 100000000) return `${(n / 100000000).toFixed(1)}Cr+`;
  if (n >= 10000000) return `${(n / 10000000).toFixed(1)}Cr`;
  if (n >= 100000) return `${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return `${n}`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

// ─── Component ─────────────────────────────────────────────

export default function BreachPage() {
  const [phone, setPhone] = useState('');
  const [result, setResult] = useState<BreachResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSearch = useCallback(async () => {
    const digits = phone.replace(/[\s\-+]/g, '');
    if (digits.length < 10) {
      setError('Enter a valid 10-digit Indian phone number');
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const res = await fetch('/api/breach-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: phone }),
      });

      if (!res.ok) throw new Error('API error');

      const data: BreachResult = await res.json();
      setResult(data);
    } catch {
      setError('Check failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [phone]);

  const severityStyle = result ? SEVERITY_STYLES[result.riskLevel] || SEVERITY_STYLES.safe : SEVERITY_STYLES.safe;
  const riskInfo = result ? RISK_LEVELS[result.riskLevel as keyof typeof RISK_LEVELS] || RISK_LEVELS.safe : RISK_LEVELS.safe;

  return (
    <main className="min-h-screen bg-[#060e08] text-gray-100">
      {/* Header */}
      <div className="bg-[#050a06] border-b border-[#00e67622] px-4 py-4">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🔓</span>
            <div>
              <h1 className="text-xl font-bold text-[#00e676]">Breach Check</h1>
              <p className="text-xs text-[#3a5a3a] mt-0.5">
                Check if your phone number appeared in any data breaches
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto p-4 space-y-6">
        {/* Search */}
        <div className="bg-[#0a120c] border border-[#00e67618] rounded-xl p-5">
          <label className="text-sm text-gray-400 mb-2 block">
            Enter phone number to check
          </label>
          <div className="flex gap-2">
            <input
              type="tel"
              value={phone}
              onChange={e => { setPhone(e.target.value); setResult(null); setError(''); }}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="+91 9876543210"
              className="flex-1 bg-[#060e08] border border-[#00e67622] rounded-lg px-4 py-3 text-gray-200 placeholder-[#2a4a2a] outline-none focus:border-[#00e676] text-sm"
            />
            <button
              onClick={handleSearch}
              disabled={loading || phone.length < 10}
              className="bg-[#00e676] hover:bg-[#00c853] disabled:bg-[#0a1a0e] disabled:text-[#3a5a3a] text-[#060e08] font-bold px-6 py-3 rounded-lg text-sm transition-colors whitespace-nowrap"
            >
              {loading ? '⏳ Checking...' : '🔍 Check'}
            </button>
          </div>
          {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
        </div>

        {/* Results */}
        {result && (
          <>
            {/* Risk Banner */}
            <div className={`rounded-xl p-5 ${severityStyle.bg} ${severityStyle.border} border`}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-3xl mb-1">{severityStyle.icon}</div>
                  <div className={`text-2xl font-bold ${severityStyle.text}`}>
                    {riskInfo.label}
                  </div>
                  <div className="text-sm text-gray-400 mt-1">{riskInfo.desc}</div>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-gray-300">{result.totalExposures}</div>
                  <div className="text-xs text-gray-500">breaches found</div>
                </div>
              </div>
            </div>

            {/* Breach Cards */}
            {result.breaches.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-400 mb-3">
                  🗂️ Breach Details ({result.breaches.length})
                </h3>
                <div className="space-y-3">
                  {result.breaches.map((breach, i) => {
                    const bStyle = SEVERITY_STYLES[breach.severity] || SEVERITY_STYLES.low;
                    return (
                      <div
                        key={i}
                        className={`bg-[#0a120c] border ${bStyle.border} rounded-xl p-4`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h4 className="text-sm font-semibold text-gray-200">{breach.name}</h4>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {breach.category} · {breach.domain}
                            </p>
                          </div>
                          <span className={`text-xs px-2 py-0.5 rounded font-bold ${bStyle.text} uppercase`}>
                            {breach.severity}
                          </span>
                        </div>

                        <p className="text-xs text-gray-400 mb-3 leading-relaxed">
                          {breach.description}
                        </p>

                        <div className="flex flex-wrap gap-2 mb-3">
                          {breach.dataTypes.map((dt, j) => (
                            <span
                              key={j}
                              className="text-[10px] px-2 py-0.5 rounded-full bg-[#00e67610] text-[#6b9a7a] border border-[#00e67622]"
                            >
                              {dt}
                            </span>
                          ))}
                        </div>

                        <div className="flex items-center gap-4 text-[10px] text-gray-500">
                          <span>📅 {formatDate(breach.date)}</span>
                          <span>👥 {formatNumber(breach.affectedUsers)} affected</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Recommendations */}
            <div className="bg-[#00e67608] border border-[#00e67622] rounded-xl p-5">
              <h3 className="text-sm font-semibold text-[#00e676] mb-3">
                🛡️ What You Should Do
              </h3>
              <ul className="space-y-2">
                {result.recommendations.map((rec, i) => (
                  <li key={i} className="text-sm text-gray-300 flex items-start gap-2">
                    <span className="text-[#00e676] mt-1">▸</span>
                    {rec}
                  </li>
                ))}
              </ul>
            </div>

            {/* All Breaches Found */}
            {result.breaches.length === 0 && (
              <div className="bg-[#0a120c] border border-[#00e67618] rounded-xl p-8 text-center">
                <div className="text-5xl mb-3">🎉</div>
                <h3 className="text-lg font-semibold text-gray-300 mb-2">
                  No Breaches Found!
                </h3>
                <p className="text-sm text-gray-500 max-w-md mx-auto">
                  Your phone number doesn&apos;t appear in any known data breach databases. Stay safe!
                </p>
              </div>
            )}
          </>
        )}

        {/* Empty State */}
        {!result && (
          <>
            <div className="bg-[#0a120c] border border-[#00e67618] rounded-xl p-8 text-center">
              <div className="text-5xl mb-3">🔍</div>
              <h3 className="text-lg font-semibold text-gray-300 mb-2">
                Data Breach Scanner
              </h3>
              <p className="text-sm text-gray-500 max-w-md mx-auto">
                Enter your phone number above to check if it appears in any known Indian data breaches.
                We match against 12+ major breach databases.
              </p>
            </div>

            {/* Protection Tips */}
            <div>
              <h3 className="text-sm font-semibold text-gray-400 mb-3">
                🔐 Protection Tips
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {PROTECTION_TIPS.map((tip, i) => (
                  <div
                    key={i}
                    className="bg-[#0a120c] border border-[#00e67618] rounded-xl p-4"
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-xl mt-0.5">{tip.icon}</span>
                      <div>
                        <h4 className="text-sm font-semibold text-gray-300">{tip.title}</h4>
                        <p className="text-xs text-gray-500 mt-1">{tip.desc}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Disclaimer */}
        {result && (
          <div className="bg-[#0a120c] border border-[#00e67618] rounded-lg p-3">
            <p className="text-[10px] text-[#3a5a3a] text-center">
              ⚠️ {result.disclaimer}
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
