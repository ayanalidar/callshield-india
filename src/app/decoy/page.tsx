'use client';

import { useState, useRef, useEffect } from 'react';

// ─── Types ─────────────────────────────────────────────────

interface Message {
  id: string;
  role: 'scammer' | 'decoy';
  text: string;
  timestamp: number;
}

interface IntelBadge {
  label: string;
  value: string;
}

// ─── Sample scammer messages ───────────────────────────────

const SAMPLE_MESSAGES = [
  'Hello sir, your SBI bank account has been blocked due to pending KYC. Please share your OTP immediately to avoid permanent closure.',
  'Dear customer, your electricity bill payment is pending. Your connection will be disconnected tonight at 9 PM. Call 9876543210 immediately.',
  'FedEx here: Your parcel containing illegal items has been held by Mumbai Customs. ₹25,000 fine pending. Pay via UPI: customs@paytm',
  'नमस्ते, आपके आधार कार्ड से ₹50,000 का लोन approve हुआ है। Verify करने के लिए OTP share करें।',
  'Congratulations! You won KBC lottery ₹25 lakh. Share your bank details and ₹4999 processing fee to claim: 9210012345',
  'Part-time job offer: Earn ₹5000/day working from home. No experience needed. 2 hours daily. WhatsApp: wa.me/919876543210',
  'Mummy papa ko phone karo, main police station mein hoon. Accident ho gaya. ₹50,000 urgently chahiye. Is number pe Google Pay kar do.',
  'Hello, I am calling from TRAI. Your mobile number will be deactivated in 2 hours. Press 1 to speak with officer. Press 9 for details.',
];

// ─── Component ─────────────────────────────────────────────

export default function DecoyPage() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [intelBadges, setIntelBadges] = useState<IntelBadge[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const addMessage = (role: 'scammer' | 'decoy', text: string) => {
    setMessages(prev => [...prev, {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      role,
      text,
      timestamp: Date.now(),
    }]);
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text) return;
    if (loading) return;

    addMessage('scammer', text);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/decoy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scammerMessage: text }),
      });

      if (!res.ok) throw new Error('API error');

      const data = await res.json();
      addMessage('decoy', data.response);

      // Update intel badges
      const badges: IntelBadge[] = [];
      if (data.metadata?.intelCollected?.newNumbers?.length > 0) {
        data.metadata.intelCollected.newNumbers.forEach((n: string) => {
          badges.push({ label: '📱 New Number', value: n });
        });
      }
      if (data.metadata?.intelCollected?.upiIds?.length > 0) {
        data.metadata.intelCollected.upiIds.forEach((u: string) => {
          badges.push({ label: '💳 UPI ID', value: u });
        });
      }
      if (data.metadata?.intelCollected?.scriptPhrases?.length > 0) {
        data.metadata.intelCollected.scriptPhrases.forEach((p: string) => {
          const short = p.replace(/\\/g, '').replace(/[()?:]/g, '').replace(/\|/g, '/').slice(0, 50);
          badges.push({ label: '📝 Scam Script', value: short });
        });
      }
      if (badges.length > 0) {
        setIntelBadges(prev => [...badges, ...prev].slice(0, 20));
      }
    } catch {
      addMessage('decoy', 'Beta, network problem ho gaya. Thodi der baad try karo. 😕');
    } finally {
      setLoading(false);
    }
  };

  const handleSample = (sample: string) => {
    setInput(sample);
  };

  const handleClear = () => {
    setMessages([]);
    setIntelBadges([]);
  };

  return (
    <main className="min-h-screen bg-[#060e08] text-gray-100">
      {/* Header */}
      <div className="bg-[#050a06] border-b border-[#00e67622] px-4 py-4">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🎣</span>
            <div>
              <h1 className="text-xl font-bold text-[#00e676]">Decoy AI Mode</h1>
              <p className="text-xs text-[#3a5a3a] mt-0.5">
                Waste scammers&apos; time with a confused elder. Collects intel.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto p-4 flex flex-col" style={{ minHeight: 'calc(100vh - 73px)' }}>
        {/* Intel Badges */}
        {intelBadges.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {intelBadges.map((badge, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] bg-[#00e67615] border border-[#00e67633] text-[#00e676] font-medium"
              >
                {badge.label}: <span className="font-mono text-[10px] text-gray-300">{badge.value}</span>
              </span>
            ))}
          </div>
        )}

        {/* Chat Area */}
        <div className="flex-1 bg-[#0a120c] border border-[#00e67618] rounded-xl p-4 mb-4 overflow-y-auto max-h-[55vh] space-y-3">
          {messages.length === 0 && (
            <div className="text-center py-12">
              <div className="text-5xl mb-3">👴</div>
              <h3 className="text-sm text-gray-500 mb-2">No conversation yet</h3>
              <p className="text-xs text-[#3a5a3a] max-w-xs mx-auto">
                Paste a scammer&apos;s message above and watch the decoy AI waste their time.
              </p>
            </div>
          )}

          {messages.map(msg => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'scammer' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                  msg.role === 'scammer'
                    ? 'bg-red-900/20 border border-red-500/20 text-red-200 rounded-br-md'
                    : 'bg-[#00e67610] border border-[#00e67622] text-gray-200 rounded-bl-md'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold opacity-70">
                    {msg.role === 'scammer' ? '🎭 Scammer' : '👴 Decoy (Elder)'}
                  </span>
                  <span className="text-[10px] opacity-40">
                    {new Date(msg.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.text}</p>
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-[#00e67610] border border-[#00e67622] rounded-2xl rounded-bl-md px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-[#00e676] rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-[#00e676] rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                  <div className="w-2 h-2 bg-[#00e676] rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                </div>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Input Area */}
        <div className="bg-[#050a06] border border-[#00e67622] rounded-xl p-3">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Paste scammer's message here (e.g., KYC update, FedEx parcel, lottery...)"
            rows={3}
            className="w-full bg-transparent text-gray-200 placeholder-[#2a4a2a] text-sm resize-none outline-none mb-2"
          />
          <div className="flex gap-2">
            <button
              onClick={handleSend}
              disabled={!input.trim() || loading}
              className="flex-1 bg-[#00e676] hover:bg-[#00c853] disabled:bg-[#0a1a0e] disabled:text-[#3a5a3a] text-[#060e08] font-bold py-2.5 rounded-lg text-sm transition-colors"
            >
              {loading ? '⏳ Generating...' : '🎣 Send Decoy Response'}
            </button>
            <button
              onClick={handleClear}
              className="px-4 bg-[#0a1a0e] hover:bg-[#0f2012] border border-[#00e67622] text-gray-400 rounded-lg text-sm transition-colors"
            >
              Clear
            </button>
          </div>
        </div>

        {/* Sample Messages */}
        {messages.length < 2 && (
          <div className="mt-4">
            <h3 className="text-xs text-[#3a5a3a] font-semibold mb-2 uppercase tracking-wider">
              🔰 Try a scammer message
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {SAMPLE_MESSAGES.slice(0, 4).map((sample, i) => (
                <button
                  key={i}
                  onClick={() => handleSample(sample)}
                  className="text-left bg-[#0a120c] border border-[#00e67618] hover:border-[#00e67644] rounded-lg px-3 py-2 text-xs text-gray-400 hover:text-gray-200 transition-colors line-clamp-2"
                >
                  {sample.length > 100 ? sample.slice(0, 100) + '...' : sample}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Info Footer */}
        <div className="mt-4 p-3 bg-[#0a120c] border border-[#00e67615] rounded-lg">
          <p className="text-[10px] text-[#3a5a3a] text-center">
            🛡️ The decoy AI pretends to be a confused Indian elder. It gives fake OTPs and UPI IDs.
            All scammer messages are analyzed for new phone numbers, UPI IDs, and scam scripts.
            No real data is ever shared.
          </p>
        </div>
      </div>
    </main>
  );
}
