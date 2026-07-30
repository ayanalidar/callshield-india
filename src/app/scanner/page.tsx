'use client';

import { useState, useCallback } from 'react';
import { scanMessage, type ScanResult, type MatchedPattern } from '@/engines/sms-scanner';

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'bg-red-600 text-white',
  high: 'bg-orange-500 text-white',
  medium: 'bg-yellow-500 text-black',
  low: 'bg-blue-500 text-white',
};

const SEVERITY_ICONS: Record<string, string> = {
  critical: '🔴',
  high: '🟠',
  medium: '🟡',
  low: '🔵',
};

const VERDICT_COLORS: Record<string, string> = {
  safe: 'bg-green-600',
  suspicious: 'bg-yellow-500 text-black',
  scam: 'bg-orange-600',
  critical: 'bg-red-600',
};

const VERDICT_ICONS: Record<string, string> = {
  safe: '✅',
  suspicious: '⚠️',
  scam: '🚨',
  critical: '🛑',
};

const SCAM_EXAMPLES = [
  "Dear customer, your SBI bank account has been blocked due to KYC pending. Update immediately: https://sbi-kyc-verify.tk",
  "Congratulations! You have won ₹25,00,000 in Kaun Banega Crorepati lottery. Call 9876543210 to claim.",
  "Your parcel has been held by customs. ₹2,500 payment required for clearance. Pay now: https://bit.ly/customs-pay",
  "हैलो, आपका बिजली बिल का भुगतान नहीं हुआ है। आज रात 9 बजे कनेक्शन काट दिया जाएगा। कॉल करें: 9210012345",
  "URGENT: Your Aadhaar card will be blocked in 24 hours. Verify now: https://aadhaar-verify.tk",
  "Work from home! Earn ₹5000/day. Part time job, no experience needed. WhatsApp: 9876543210",
];

export default function ScannerPage() {
  const [message, setMessage] = useState('');
  const [result, setResult] = useState<ScanResult | null>(null);
  const [scanning, setScanning] = useState(false);

  const handleScan = useCallback(() => {
    if (!message.trim()) return;
    setScanning(true);
    // Artificial delay for UX (scan feels more real)
    setTimeout(() => {
      const res = scanMessage(message);
      setResult(res);
      setScanning(false);
    }, 400);
  }, [message]);

  const handleExample = (example: string) => {
    setMessage(example);
    setTimeout(() => {
      const res = scanMessage(example);
      setResult(res);
    }, 100);
  };

  return (
    <main className="min-h-screen bg-[#0D1F0D] text-gray-100">
      {/* Header */}
      <div className="bg-[#0A150A] border-b border-green-900/30 px-4 py-4">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📱</span>
            <h1 className="text-xl font-bold text-green-400">Message Scanner</h1>
          </div>
          <p className="text-gray-400 text-sm mt-1 ml-9">
            Paste any SMS or WhatsApp message to check for scams
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto p-4 space-y-6">
        {/* Input Area */}
        <div className="bg-[#0A150A] border border-green-900/30 rounded-xl p-4">
          <label className="text-sm text-gray-400 mb-2 block">
            Paste message text here
          </label>
          <textarea
            value={message}
            onChange={(e) => { setMessage(e.target.value); setResult(null); }}
            placeholder="Paste SMS, WhatsApp, or any message text..."
            rows={4}
            className="w-full bg-[#050A05] border border-green-900/20 rounded-lg p-3 text-gray-200 placeholder-gray-600 resize-none focus:border-green-500 focus:outline-none text-sm"
          />
          <button
            onClick={handleScan}
            disabled={!message.trim() || scanning}
            className="mt-3 w-full bg-green-600 hover:bg-green-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-semibold py-2.5 rounded-lg transition-colors"
          >
            {scanning ? '🔍 Scanning...' : '🔍 Scan Message'}
          </button>
        </div>

        {/* Example Messages */}
        {!result && (
          <div className="bg-[#0A150A] border border-green-900/30 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-gray-400 mb-3">🔰 Try a scam example</h3>
            <div className="grid gap-2">
              {SCAM_EXAMPLES.slice(0, 3).map((example, i) => (
                <button
                  key={i}
                  onClick={() => handleExample(example)}
                  className="text-left bg-[#050A05] border border-green-900/20 rounded-lg p-3 text-sm text-gray-400 hover:text-gray-200 hover:border-green-500/50 transition-colors line-clamp-2"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="space-y-4">
            {/* Verdict Banner */}
            <div className={`${VERDICT_COLORS[result.verdict]} rounded-xl p-5`}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-3xl mb-1">{VERDICT_ICONS[result.verdict]}</div>
                  <div className="text-2xl font-bold uppercase">{result.verdict}</div>
                  <div className="text-sm opacity-80 mt-1">
                    Confidence: {Math.round(result.confidence * 100)}% · Score: {result.threatScore}/100
                  </div>
                </div>
                {/* Score Ring */}
                <div className="w-20 h-20 rounded-full border-4 border-white/30 flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-2xl font-bold">{result.threatScore}</div>
                    <div className="text-[10px] opacity-70">/100</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Threat Breakdown */}
            {result.matchedPatterns.length > 0 && (
              <div className="bg-[#0A150A] border border-green-900/30 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-gray-400 mb-3">
                  🎯 Detected Patterns ({result.matchedPatterns.length})
                </h3>
                <div className="space-y-2">
                  {result.matchedPatterns.map((pattern: MatchedPattern, i: number) => (
                    <div key={i} className="flex items-start gap-3 bg-[#050A05] border border-green-900/10 rounded-lg p-3">
                      <span className="mt-0.5">{SEVERITY_ICONS[pattern.severity]}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded ${SEVERITY_COLORS[pattern.severity]}`}>
                            {pattern.severity.toUpperCase()}
                          </span>
                          <span className="text-sm text-gray-300 font-medium">{pattern.description}</span>
                        </div>
                        {pattern.matchedText && pattern.matchedText.length < 60 && (
                          <code className="text-xs text-gray-500 mt-1 block truncate">
                            matched: "{pattern.matchedText}"
                          </code>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Links Found */}
            {result.detectedLinks.length > 0 && (
              <div className="bg-[#0A150A] border border-green-900/30 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-gray-400 mb-3">
                  🔗 Links Found ({result.detectedLinks.length})
                </h3>
                <div className="space-y-2">
                  {result.detectedLinks.map((link, i) => (
                    <div key={i} className="bg-[#050A05] border border-green-900/10 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs px-2 py-0.5 rounded bg-gray-700 text-gray-300 font-mono">
                          {link.domain}
                        </span>
                        {link.isSuspicious && (
                          <span className="text-xs px-2 py-0.5 rounded bg-red-900/50 text-red-400">⚠ Suspicious</span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 truncate">
                        {link.url.length > 60 ? link.url.substring(0, 60) + '...' : link.url}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Evidence */}
            {result.evidence.length > 0 && (
              <div className="bg-[#0A150A] border border-green-900/30 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-gray-400 mb-3">📋 Evidence</h3>
                <ul className="space-y-1">
                  {result.evidence.map((e, i) => (
                    <li key={i} className="text-sm text-gray-400 flex items-start gap-2">
                      <span className="text-gray-600 mt-1">▸</span>
                      {e}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Recommendations */}
            <div className="bg-green-900/10 border border-green-500/20 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-green-400 mb-3">💡 Recommendations</h3>
              <ul className="space-y-2">
                {result.recommendations.map((r, i) => (
                  <li key={i} className="text-sm text-gray-300 flex items-start gap-2">
                    <span className="text-green-400 mt-0.5">•</span>
                    {r}
                  </li>
                ))}
              </ul>
            </div>

            {/* Scan Another */}
            <div className="flex gap-2">
              <button
                onClick={() => { setMessage(''); setResult(null); }}
                className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 py-2.5 rounded-lg text-sm transition-colors"
              >
                🔄 Scan Another
              </button>
              <button
                onClick={() => setMessage(SCAM_EXAMPLES[Math.floor(Math.random() * SCAM_EXAMPLES.length)])}
                className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 py-2.5 rounded-lg text-sm transition-colors"
              >
                🎲 Try Random Example
              </button>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!result && !message.trim() && (
          <div className="bg-[#0A150A] border border-green-900/30 rounded-xl p-8 text-center">
            <div className="text-5xl mb-4">🛡️</div>
            <h3 className="text-lg font-semibold text-gray-300 mb-2">Message Scam Scanner</h3>
            <p className="text-sm text-gray-500 max-w-md mx-auto">
              Paste any suspicious SMS or WhatsApp message above. 
              We check for scam scripts, phishing links, UPI fraud patterns, and more.
            </p>
            <div className="flex flex-wrap gap-2 justify-center mt-4">
              {['Bank OTP', 'FedEx Parcel', 'UPI Fraud', 'KYC Scam', 'Job Scam'].map(tag => (
                <span key={tag} className="text-xs px-2 py-1 rounded-full bg-green-900/20 text-green-400 border border-green-800/30">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
