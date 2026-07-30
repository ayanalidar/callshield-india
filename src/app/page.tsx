'use client';

import { useState, useEffect, useCallback, useRef, FormEvent } from 'react';

// ============================================================
// TYPES
// ============================================================

interface Stats {
  totalScamsBlocked: number;
  totalScamsTracked: number;
  activeScamNumbers: number;
  accuracyRate: number;
}

interface LookupResult {
  phoneNumber: string;
  normalized: string;
  telecomCircle?: string;
  state?: string;
  carrier?: string;
  numberType: string;
  isIndian: boolean;
  countryName?: string;
  isVoip: boolean;
  isScam: boolean;
  verdict: 'safe' | 'suspicious' | 'scam' | 'critical';
  threatScore: number;
  severity: string;
  scamType?: string;
  evidence: string[];
  warnings: string[];
  dbMatch: { found: boolean; reportCount: number; verified: boolean };
  blockReason?: string;
  responseTime: number;
}

interface BlockEntry {
  id: number;
  phoneNumber: string;
  reason: string;
  blockedAt: string;
}

// ============================================================
// HOOKS
// ============================================================

function useStats() {
  const [stats, setStats] = useState<Stats>({
    totalScamsBlocked: 0, totalScamsTracked: 0, activeScamNumbers: 0, accuracyRate: 98,
  });

  useEffect(() => {
    fetch('/api/stats')
      .then(r => r.json())
      .then(data => setStats(data))
      .catch(() => {});
  }, []);

  return stats;
}

function useAnimatedCounter(target: number, duration = 1500) {
  const [value, setValue] = useState(0);
  const startRef = useRef<number>(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    startRef.current = performance.now();
    const animate = (now: number) => {
      const elapsed = now - startRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.floor(target * eased));
      if (progress < 1) rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);

  return value.toLocaleString('en-IN');
}

// ============================================================
// COMPONENTS
// ============================================================

function StatCard({ value, targetValue, label, icon, color, trend, trendLabel }: {
  value: string; targetValue: number; label: string; icon: string;
  color: 'g' | 'r' | 'o' | 'b'; trend: 'up' | 'dn'; trendLabel: string;
}) {
  return (
    <div className={`st ${color}`}>
      <div className="st-h">
        <div className={`st-ic ${color}`}><i className={`fas ${icon}`} /></div>
        <span className={`st-tr ${trend}`}>
          <i className={`fas fa-arrow-${trend}`} /> {trendLabel}
        </span>
      </div>
      <div className="st-v">{useAnimatedCounter(targetValue)}</div>
      <div className="st-l">{label}</div>
    </div>
  );
}

function ShieldToggle() {
  const [on, setOn] = useState(true);
  const [mode, setMode] = useState<'off' | 'standard' | 'strict'>('strict');

  return (
    <div className={`shp ${!on ? 'off' : ''}`}>
      <div className="shv">
        <div className="sh-pl" />
        <svg className="sh-svg" viewBox="0 0 100 110">
          <path d="M50 5 L90 22 L90 55 C90 80 50 105 50 105 C50 105 10 80 10 55 L10 22 Z" />
          <path d="M38 55 L47 64 L65 42" strokeWidth={3} opacity={on ? 1 : 0.2} />
        </svg>
      </div>
      <div className="sh-st">{on ? 'Protection Active' : 'Disabled'}</div>
      <div className="sh-sub">{on ? 'Guarding against Indian phone scams' : 'No filtering'}</div>
      <div className="modes">
        {(['off', 'standard', 'strict'] as const).map(m => (
          <button key={m} className={`mb ${mode === m ? 'act' : ''}`}
            onClick={() => { if (m === 'off') setOn(false); else { setOn(true); } setMode(m); }}>
            {m === 'off' ? 'Off' : m === 'standard' ? 'Standard' : 'Strict'}
          </button>
        ))}
      </div>
    </div>
  );
}

function LiveActivity({ items }: { items: { text: string; dot: string; time: string }[] }) {
  return (
    <div className="af">
      {items.map((a, i) => (
        <div className="ai" key={i}>
          <div className={`ad ${a.dot}`} />
          <div>
            <div className="at" dangerouslySetInnerHTML={{ __html: a.text }} />
            <div className="atm">{a.time}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function CallLogItem({ call, onBlock }: { call: any; onBlock: (num: string) => void }) {
  const cls = call.tp === 'spam' ? 'spam' : call.tp === 'blocked' ? 'blocked' : call.tp === 'safe' ? 'safe' : 'unk';
  const tag = call.tp === 'spam' ? 'Scam' : call.tp === 'blocked' ? 'Blocked' : call.tp === 'unk' ? '?' : '';

  return (
    <div className="ci" data-tp={call.tp}>
      <div className={`ca ${cls}`}><i className={`fas ${call.ic}`} /></div>
      <div className="ci-info">
        <div className="ci-nm">
          {call.nm}
          {tag && <span className={`tg ${cls === 'spam' ? 'sp' : cls === 'blocked' ? 'bl' : 'up'}`}>{tag}</span>}
        </div>
        <div className="ci-meta">{call.num} · {call.du} · {call.tm}</div>
      </div>
      <div className="ci-acts">
        <button className="cab" onClick={() => onBlock(call.num)} title="Block"><i className="fas fa-ban" /></button>
        <button className="cab wl" title="Whitelist"><i className="fas fa-check" /></button>
      </div>
    </div>
  );
}

function ThreatAlert({ result }: { result: LookupResult }) {
  if (!result.isScam && result.verdict === 'safe') return null;

  return (
    <div className="ta">
      <div className="ta-ic"><i className="fas fa-exclamation-triangle" /></div>
      <div>
        <h3>{result.verdict === 'critical' ? 'CRITICAL THREAT' : result.verdict === 'scam' ? 'SCAM DETECTED' : 'SUSPICIOUS'}</h3>
        <p>{result.scamType ? result.scamType.replace(/_/g, ' ').toUpperCase() : 'Unknown pattern'} · Score: {result.threatScore}/100</p>
      </div>
    </div>
  );
}

// ============================================================
// PAGE
// ============================================================

export default function Dashboard() {
  const stats = useStats();
  const [page, setPage] = useState<string>('dash');
  const [lookupQuery, setLookupQuery] = useState('');
  const [lookupResult, setLookupResult] = useState<LookupResult | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState('');
  const [toastMsg, setToastMsg] = useState('');
  const [blockList, setBlockList] = useState<BlockEntry[]>([]);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [blockNumber, setBlockNumber] = useState('');
  const [blockReason, setBlockReason] = useState('UPI Fraud');
  const [scamCallId, setScamCallId] = useState(0);
  const [callHistory, setCallHistory] = useState<any[]>([]);
  const [activityFeed, setActivityFeed] = useState<any[]>([]);

  const scamTypes = [
    'UPI Fraud', 'Bank OTP Scam', 'IT Dept Impersonation', 'Insurance Scam',
    'Loan App Harassment', 'FedEx/Customs Scam', 'Crypto Scam', 'Lottery Scam',
    'E-commerce Fraud', 'Police Fake', 'Aadhaar KYC Scam', 'Electricity Bill Scam', 'Other',
  ];

  // Load block list
  useEffect(() => {
    fetch('/api/blocklist')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setBlockList(data); })
      .catch(() => {});
  }, []);

  // Default mock calls (would be from user's call history in production)
  const defaultCalls = [
    { num: '+91 98765 43210', nm: 'UPI Payment Fraud', tp: 'spam', tm: '2m ago', du: '0s', ic: 'fa-indian-rupee-sign' },
    { num: '+91 87654 32109', nm: 'SBI Card OTP Scam', tp: 'spam', tm: '5m ago', du: '0s', ic: 'fa-building-columns' },
    { num: '+91 88776 65544', nm: 'Amit Sharma', tp: 'safe', tm: '15m ago', du: '3:45', ic: 'fa-user' },
    { num: '+91 77665 54433', nm: 'FedEx Parcel Scam', tp: 'spam', tm: '20m ago', du: '0s', ic: 'fa-box' },
    { num: '+91 66554 43322', nm: 'Maa (Mom)', tp: 'safe', tm: '30m ago', du: '8:22', ic: 'fa-heart' },
    { num: '+91 44332 21100', nm: 'Crypto Investment', tp: 'spam', tm: '1h ago', du: '0s', ic: 'fa-bitcoin-sign' },
  ];

  const defaultActivity = [
    { text: '<strong>UPI Fraud</strong> traced to Noida', dot: 'r', time: '2m ago' },
    { text: '<strong>SBI OTP</strong> blocked — Gurgaon', dot: 'r', time: '5m ago' },
    { text: '<strong>Amit</strong> call — whitelisted', dot: 'g', time: '15m ago' },
    { text: '<strong>IT Dept fake</strong> blocked — Delhi', dot: 'r', time: '8m ago' },
    { text: 'Unknown flagged', dot: 'o', time: '2h ago' },
  ];

  const doLookup = useCallback(async (e?: FormEvent) => {
    if (e) e.preventDefault();
    if (!lookupQuery.trim()) return;
    setLookupLoading(true);
    setLookupError('');
    setLookupResult(null);

    try {
      const res = await fetch('/api/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: lookupQuery.trim(), protectionLevel: 'strict' }),
      });
      const data = await res.json();
      if (data.error) { setLookupError(data.error); return; }
      setLookupResult(data);

      // Add to call history
      setCallHistory(prev => [{
        num: lookupQuery.trim(),
        nm: data.scamType || data.verdict,
        tp: data.verdict === 'scam' || data.verdict === 'critical' ? 'spam' : data.verdict === 'safe' ? 'safe' : 'unk',
        tm: 'Now',
        du: '0s',
        ic: 'fa-phone',
      }, ...prev.slice(0, 14)]);

      // Add to activity feed
      setActivityFeed(prev => [{
        text: data.verdict === 'scam' || data.verdict === 'critical'
          ? `<strong>${data.scamType || 'Scam'}</strong> detected — Score ${data.threatScore}/100`
          : `<strong>${lookupQuery.trim()}</strong> checked — ${data.verdict}`,
        dot: data.verdict === 'scam' || data.verdict === 'critical' ? 'r' : data.verdict === 'suspicious' ? 'o' : 'g',
        time: 'Now',
      }, ...prev.slice(0, 9)]);

    } catch (err: any) {
      setLookupError('Lookup failed. Is the server running?');
    } finally {
      setLookupLoading(false);
    }
  }, [lookupQuery]);

  const handleBlock = async (num: string) => {
    try {
      await fetch('/api/blocklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: num, reason: 'Scam', scamType: 'other' }),
      });
      setBlockList(prev => [...prev, { id: Date.now(), phoneNumber: num, reason: 'Scam', blockedAt: 'Now' }]);
      setToastMsg(`Blocked ${num}`);
      setTimeout(() => setToastMsg(''), 3000);
    } catch {
      setToastMsg('Failed to block');
      setTimeout(() => setToastMsg(''), 3000);
    }
  };

  const handleBlockModal = async () => {
    if (!blockNumber.trim()) return;
    try {
      await fetch('/api/blocklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: blockNumber.trim(), reason: blockReason, scamType: 'other' }),
      });
      setBlockList(prev => [{ id: Date.now(), phoneNumber: blockNumber.trim(), reason: blockReason, blockedAt: 'Now' }, ...prev]);
      setShowBlockModal(false);
      setBlockNumber('');
      setToastMsg(`Blocked ${blockNumber.trim()}`);
      setTimeout(() => setToastMsg(''), 3000);
    } catch {
      setToastMsg('Failed to block');
      setTimeout(() => setToastMsg(''), 3000);
    }
  };

  // =============== RENDER ===============

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: STYLES }} />

      <nav className="bnav">
        {[
          { p: 'dash', icon: 'fa-chart-line', label: 'Home' },
          { p: 'lookup', icon: 'fa-search', label: 'Lookup' },
          { p: 'blocklist', icon: 'fa-ban', label: 'Blocked' },
          { p: 'calls', icon: 'fa-phone-flip', label: 'Calls' },
        ].map(item => (
          <div key={item.p} className={`bnav-i ${page === item.p ? 'act' : ''}`}
            onClick={() => setPage(item.p)}>
            <i className={`fas ${item.icon}`} />
            <span>{item.label}</span>
            {item.p === 'blocklist' && blockList.length > 0 && <div className="ld" />}
          </div>
        ))}
      </nav>

      <div className="tc" id="toastC">
        {toastMsg && <div className="toast ok"><i className="fas fa-check-circle" /> {toastMsg}</div>}
      </div>

      {/* Block Modal */}
      {showBlockModal && (
        <div className="mo show" onClick={e => { if (e.target === e.currentTarget) setShowBlockModal(false); }}>
          <div className="md">
            <h3>Block Number</h3>
            <p>Add to block list.</p>
            <input type="tel" className="md-in" placeholder="+91 98765 43210"
              value={blockNumber} onChange={e => setBlockNumber(e.target.value)} autoFocus />
            <select className="md-sel" value={blockReason} onChange={e => setBlockReason(e.target.value)}>
              {scamTypes.map(t => <option key={t}>{t}</option>)}
            </select>
            <div className="md-bs">
              <button className="md-b cn" onClick={() => setShowBlockModal(false)}>Cancel</button>
              <button className="md-b dn" onClick={handleBlockModal}>Block</button>
            </div>
          </div>
        </div>
      )}

      <div className="main">
        <div className="top">
          <div>
            <h1>{page === 'dash' ? 'Dashboard' : page === 'lookup' ? 'Number Lookup' : page === 'blocklist' ? 'Block List' : 'Call Log'}</h1>
            <p>{page === 'dash' ? 'Real-time scam protection' : page === 'lookup' ? 'Check any number instantly' : page === 'blocklist' ? `${blockList.length} blocked` : 'Recent calls'}</p>
          </div>
          <div className="top-r">
            <button className="ib" onClick={() => setShowBlockModal(true)}><i className="fas fa-plus" /></button>
          </div>
        </div>

        {/* DASHBOARD PAGE */}
        {page === 'dash' && (
          <>
            <div className="stats">
              <StatCard value="" targetValue={stats.totalScamsBlocked} label="Scams Blocked" icon="fa-shield-halved" color="g" trend="up" trendLabel="18%" />
              <StatCard value="" targetValue={stats.activeScamNumbers} label="Active Today" icon="fa-triangle-exclamation" color="r" trend="dn" trendLabel="5%" />
              <StatCard value="" targetValue={stats.totalScamsTracked} label="Tracked" icon="fa-map-marker-alt" color="o" trend="up" trendLabel="32%" />
              <StatCard value="" targetValue={stats.accuracyRate} label="Accuracy %" icon="fa-bullseye" color="b" trend="up" trendLabel="2%" />
            </div>

            <ShieldToggle />

            <div className="pn" style={{ marginBottom: 14 }}>
              <div className="ph">
                <div className="pt"><i className="fas fa-search" /> Quick Lookup</div>
              </div>
              <div className="qbr">
                <input type="tel" className="qb-in" placeholder="+91 98765 43210"
                  value={lookupQuery} onChange={e => setLookupQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && doLookup()} />
                <button className="abtn bl" style={{ padding: '8px 14px', whiteSpace: 'nowrap' }}
                  onClick={() => doLookup()} disabled={lookupLoading}>
                  <i className="fas fa-search" />
                </button>
              </div>
            </div>

            {lookupLoading && (
              <div style={{ textAlign: 'center', padding: 20, color: 'var(--muted)', fontSize: 12 }}>
                <i className="fas fa-spinner fa-spin" /> Looking up...
              </div>
            )}
            {lookupError && (
              <div className="ta">
                <div className="ta-ic"><i className="fas fa-exclamation-circle" /></div>
                <div><h3>Error</h3><p>{lookupError}</p></div>
              </div>
            )}
            {lookupResult && <ThreatAlert result={lookupResult} />}

            {lookupResult && (
              <div className="sc" style={{ marginBottom: 14 }}>
                <div className="sc-h">
                  <div className={`sc-av ${lookupResult.verdict === 'critical' || lookupResult.verdict === 'scam' ? 'r' : lookupResult.verdict === 'suspicious' ? 'o' : 'g'}`}
                    style={{ color: lookupResult.verdict === 'critical' || lookupResult.verdict === 'scam' ? 'var(--danger)' : lookupResult.verdict === 'suspicious' ? 'var(--warn)' : 'var(--accent)' }}>
                    <i className={`fas ${lookupResult.verdict === 'critical' ? 'fa-skull' : lookupResult.verdict === 'scam' ? 'fa-triangle-exclamation' : lookupResult.verdict === 'suspicious' ? 'fa-question' : 'fa-shield-halved'}`} />
                  </div>
                  <div>
                    <div className="sc-nm">{lookupResult.phoneNumber}</div>
                    <div className="sc-num">{lookupResult.normalized}</div>
                  </div>
                </div>
                <div className="sd-r"><span className="sd-l"><i className="fas fa-signal" /> Carrier</span><span className="sd-v">{lookupResult.carrier || 'Unknown'}</span></div>
                <div className="sd-r"><span className="sd-l"><i className="fas fa-map-pin" /> Circle</span><span className="sd-v">{lookupResult.telecomCircle || 'N/A'}</span></div>
                <div className="sd-r"><span className="sd-l"><i className="fas fa-globe" /> Origin</span><span className="sd-v">{lookupResult.isIndian ? 'India' : lookupResult.countryName || 'International'}</span></div>
                <div className="sd-r"><span className="sd-l"><i className="fas fa-mobile-screen" /> Type</span><span className="sd-v">{lookupResult.numberType}{lookupResult.isVoip ? ' · VoIP' : ''}</span></div>
                <div className="sd-r"><span className="sd-l"><i className="fas fa-shield" /> Verdict</span><span className={`sd-v ${lookupResult.verdict === 'critical' ? 'dg' : lookupResult.verdict === 'scam' ? 'fh' : ''}`}>{lookupResult.verdict.toUpperCase()}</span></div>
                <div className="sd-r"><span className="sd-l"><i className="fas fa-gauge-high" /> Threat Score</span><span className="sd-v dg">{lookupResult.threatScore}/100</span></div>
                <div className="sd-r"><span className="sd-l"><i className="fas fa-clock" /> Response</span><span className="sd-v">{lookupResult.responseTime}ms</span></div>
                {lookupResult.dbMatch.found && (
                  <div className="sd-r"><span className="sd-l"><i className="fas fa-database" /> Scam DB</span><span className="sd-v">{lookupResult.dbMatch.reportCount} reports · {lookupResult.dbMatch.verified ? 'Verified' : 'Unverified'}</span></div>
                )}
              </div>
            )}

            <div className="pn">
              <div className="ph">
                <div className="pt"><i className="fas fa-phone-flip" /> Recent Calls</div>
                <button className="pa" onClick={() => setPage('calls')}>All</button>
              </div>
              <div className="cl">
                {(callHistory.length ? callHistory : defaultCalls).slice(0, 5).map((c, i) => (
                  <CallLogItem key={i} call={c} onBlock={handleBlock} />
                ))}
              </div>
            </div>

            <div className="pn" style={{ marginTop: 14 }}>
              <div className="ph">
                <div className="pt"><i className="fas fa-bolt" /> Live Activity</div>
              </div>
              <LiveActivity items={activityFeed.length ? activityFeed : defaultActivity} />
            </div>
          </>
        )}

        {/* LOOKUP PAGE */}
        {page === 'lookup' && (
          <>
            <form onSubmit={doLookup} className="pn" style={{ marginBottom: 14 }}>
              <div className="qbr">
                <input type="tel" className="qb-in" placeholder="Enter any phone number..."
                  value={lookupQuery} onChange={e => setLookupQuery(e.target.value)} />
                <button className="abtn bl" style={{ padding: '8px 14px', whiteSpace: 'nowrap' }} type="submit" disabled={lookupLoading}>
                  <i className={`fas ${lookupLoading ? 'fa-spinner fa-spin' : 'fa-search'}`} />
                </button>
              </div>
            </form>

            {lookupError && (
              <div className="ta"><div className="ta-ic"><i className="fas fa-exclamation-circle" /></div>
                <div><h3>Error</h3><p>{lookupError}</p></div></div>
            )}
            {lookupResult && <ThreatAlert result={lookupResult} />}
            {lookupResult && (
              <div className="sc" style={{ marginBottom: 14 }}>
                <div className="sc-h">
                  <div className={`sc-av ${lookupResult.verdict === 'critical' || lookupResult.verdict === 'scam' ? '' : ''}`}
                    style={{ background: lookupResult.verdict === 'critical' ? 'var(--dg)' : lookupResult.verdict === 'scam' ? 'var(--dd)' : lookupResult.verdict === 'suspicious' ? 'var(--wd)' : 'var(--ad)',
                      color: lookupResult.verdict === 'critical' || lookupResult.verdict === 'scam' ? 'var(--danger)' : lookupResult.verdict === 'suspicious' ? 'var(--warn)' : 'var(--accent)' }}>
                    <i className={`fas ${lookupResult.verdict === 'critical' ? 'fa-skull' : lookupResult.verdict === 'scam' ? 'fa-triangle-exclamation' : lookupResult.verdict === 'suspicious' ? 'fa-question' : 'fa-shield-halved'}`} />
                  </div>
                  <div>
                    <div className="sc-nm">{lookupResult.phoneNumber}</div>
                    <div className="sc-num">{lookupResult.normalized} · {lookupResult.responseTime}ms</div>
                  </div>
                </div>
                <div className="sd-r"><span className="sd-l"><i className="fas fa-signal" /> Carrier</span><span className="sd-v">{lookupResult.carrier || 'Unknown'}</span></div>
                <div className="sd-r"><span className="sd-l"><i className="fas fa-map-pin" /> Circle</span><span className="sd-v">{lookupResult.telecomCircle || 'N/A'}{lookupResult.state ? `, ${lookupResult.state}` : ''}</span></div>
                <div className="sd-r"><span className="sd-l"><i className="fas fa-globe" /> Origin</span><span className="sd-v">{lookupResult.isIndian ? 'India' : lookupResult.countryName || 'International'}</span></div>
                <div className="sd-r"><span className="sd-l"><i className="fas fa-mobile-screen" /> Type</span><span className="sd-v">{lookupResult.numberType}{lookupResult.isVoip ? ' · VoIP' : ''}</span></div>
                <div className="sd-r"><span className="sd-l"><i className="fas fa-shield" /> Verdict</span><span className={`sd-v ${lookupResult.verdict === 'critical' ? 'dg' : lookupResult.verdict === 'scam' ? 'fh' : ''}`}>{lookupResult.verdict.toUpperCase()}</span></div>
                <div className="sd-r"><span className="sd-l"><i className="fas fa-gauge-high" /> Threat Score</span><span className="sd-v dg">{lookupResult.threatScore}/100</span></div>
                <div className="sd-r"><span className="sd-l"><i className="fas fa-database" /> Scam DB</span><span className="sd-v">{lookupResult.dbMatch.found ? `${lookupResult.dbMatch.reportCount} reports · ${lookupResult.dbMatch.verified ? 'Verified' : 'Unverified'}` : 'Not found'}</span></div>
                {lookupResult.evidence.length > 0 && (
                  <div className="sd-r"><span className="sd-l"><i className="fas fa-file-lines" /> Evidence</span><span className="sd-v">{lookupResult.evidence.slice(0, 3).join('; ')}</span></div>
                )}
              </div>
            )}
            {lookupResult && (
              <div className="acb">
                <button className="abtn bl" onClick={() => lookupResult && handleBlock(lookupResult.phoneNumber)}>
                  <i className="fas fa-ban" /> Block & Report
                </button>
              </div>
            )}
          </>
        )}

        {/* BLOCK LIST PAGE */}
        {page === 'blocklist' && (
          <div className="pn">
            <div className="ph">
              <div className="pt"><i className="fas fa-ban" /> Block List</div>
              <button className="pa" onClick={() => setShowBlockModal(true)}><i className="fas fa-plus" /> Add</button>
            </div>
            <div className="bl">
              {blockList.length === 0 && (
                <div style={{ padding: 30, textAlign: 'center', color: 'var(--muted)', fontSize: 11 }}>No blocked numbers</div>
              )}
              {blockList.map((b, i) => (
                <div className="bi" key={b.id || i}>
                  <div className="bi-ic"><i className="fas fa-ban" /></div>
                  <div className="bi-info">
                    <div className="bi-num">{b.phoneNumber}</div>
                    <div className="bi-rsn">{b.reason} · {b.blockedAt}</div>
                  </div>
                  <button className="bi-rm" onClick={async () => {
                    try {
                      await fetch('/api/blocklist', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: b.id }) });
                      setBlockList(prev => prev.filter(x => x.id !== b.id));
                    } catch {}
                  }}><i className="fas fa-xmark" /></button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CALL LOG PAGE */}
        {page === 'calls' && (
          <div className="pn">
            <div className="ph">
              <div className="pt"><i className="fas fa-phone-flip" /> Call Log</div>
            </div>
            <div className="cl" style={{ maxHeight: 500, overflowY: 'auto' }}>
              {defaultCalls.map((c, i) => (
                <CallLogItem key={i} call={c} onBlock={handleBlock} />
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ============================================================
// STYLES (from original CallShield design)
// ============================================================

const STYLES = `
:root{--bg:#050c07;--bg2:#091410;--card:#0d1c14;--border:#1a3326;--accent:#00e676;--ad:rgba(0,230,118,.1);--ag:rgba(0,230,118,.25);--danger:#ff3d3d;--dd:rgba(255,61,61,.1);--dg:rgba(255,61,61,.3);--warn:#ffab40;--wd:rgba(255,171,64,.1);--info:#40c4ff;--id:rgba(64,196,255,.1);--fg:#e0f2e9;--fg2:#a5c4b5;--muted:#4a6b58;--r:14px;--rs:8px}
*{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent}
body{font-family:'Space Grotesk',sans-serif;background:var(--bg);color:var(--fg);min-height:100vh;min-height:100dvh;overflow-x:hidden}
body::before{content:'';position:fixed;inset:0;background:radial-gradient(ellipse 600px 400px at 15% 5%,rgba(0,230,118,.05),transparent 70%),radial-gradient(ellipse 400px 300px at 85% 90%,rgba(255,61,61,.03),transparent 70%);pointer-events:none}
::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:var(--bg2)}::-webkit-scrollbar-thumb{background:var(--border);border-radius:2px}
.bnav{position:fixed;bottom:0;left:0;right:0;z-index:100;background:rgba(9,20,16,.95);border-top:1px solid var(--border);padding:5px 0 5px;backdrop-filter:blur(12px);display:flex;justify-content:space-around}
.bnav-i{display:flex;flex-direction:column;align-items:center;gap:2px;padding:5px 2px;cursor:pointer;color:var(--muted);transition:color .2s;min-width:44px;position:relative;font-size:10px}
.bnav-i.act{color:var(--accent)}.bnav-i i{font-size:16px}.bnav-i span{font-size:8px;font-weight:600}
.bnav-i .ld{position:absolute;top:3px;right:calc(50% - 16px);width:5px;height:5px;background:var(--danger);border-radius:50%;animation:bk 1s infinite}
@keyframes bk{0%,100%{opacity:1}50%{opacity:.3}}
.tc{position:fixed;bottom:70px;left:50%;transform:translateX(-50%);z-index:9999;display:flex;flex-direction:column;gap:5px;align-items:center;pointer-events:none}
.toast{padding:10px 18px;background:var(--card);border:1px solid var(--border);border-radius:var(--rs);font-size:12px;font-weight:500;display:flex;align-items:center;gap:7px;animation:ti .35s ease;box-shadow:0 6px 24px rgba(0,0,0,.5);pointer-events:auto;white-space:nowrap;max-width:90vw;overflow:hidden;text-overflow:ellipsis}
.toast.ok{border-left:3px solid var(--accent)}.toast.ok i{color:var(--accent)}
@keyframes ti{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
.mo{position:fixed;inset:0;background:rgba(0,0,0,.6);backdrop-filter:blur(4px);z-index:8000;display:flex;align-items:center;justify-content:center}
.mo.show{opacity:1;pointer-events:all}
.mo:not(.show){opacity:0;pointer-events:none;transition:opacity .3s}
.md{background:var(--card);border:1px solid var(--border);border-radius:var(--r);padding:20px;width:340px;max-width:90vw}
.md h3{font-size:14px;font-weight:700;margin-bottom:3px}
.md p{font-size:11px;color:var(--muted);margin-bottom:12px;line-height:1.5}
.md-in{width:100%;padding:9px 11px;background:var(--bg2);border:1px solid var(--border);border-radius:var(--rs);color:var(--fg);font-family:'JetBrains Mono',monospace;font-size:12px;outline:none;margin-bottom:8px;transition:border-color .2s}
.md-in:focus{border-color:var(--accent)}.md-in::placeholder{color:var(--muted)}
.md-sel{width:100%;padding:9px 11px;background:var(--bg2);border:1px solid var(--border);border-radius:var(--rs);color:var(--fg);font-family:inherit;font-size:11px;outline:none;margin-bottom:12px;appearance:none;cursor:pointer}
.md-bs{display:flex;gap:6px;justify-content:flex-end}
.md-b{padding:8px 14px;border-radius:var(--rs);font-family:inherit;font-size:11px;font-weight:600;cursor:pointer;transition:all .2s;border:1px solid var(--border)}
.md-b.cn{background:transparent;color:var(--fg2)}.md-b.ok{background:var(--accent);color:var(--bg);border-color:var(--accent)}
.md-b.dn{background:var(--danger);color:#fff;border-color:var(--danger)}
.main{position:relative;z-index:1;padding:16px 14px 80px;max-width:600px;margin:0 auto}
.top{display:flex;align-items:center;justify-content:space-between;margin-bottom:18px}
.top h1{font-size:20px;font-weight:800;letter-spacing:-.5px}
.top p{font-size:10px;color:var(--muted);margin-top:1px}
.top-r{display:flex;gap:6px}
.ib{width:34px;height:34px;border-radius:8px;border:1px solid var(--border);background:var(--card);color:var(--fg2);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all .2s;font-size:12px;position:relative}
.ib:hover{color:var(--fg)}
.stats{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:18px}
@media(min-width:500px){.stats{grid-template-columns:repeat(4,1fr)}}
.st{background:var(--card);border:1px solid var(--border);border-radius:var(--r);padding:14px;position:relative;overflow:hidden}
.st::before{content:'';position:absolute;top:0;left:0;right:0;height:2px}
.st.g::before{background:var(--accent)}.st.r::before{background:var(--danger)}.st.o::before{background:var(--warn)}.st.b::before{background:var(--info)}
.st-h{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}
.st-ic{width:28px;height:28px;border-radius:7px;display:flex;align-items:center;justify-content:center;font-size:11px}
.st-ic.g{background:var(--ad);color:var(--accent)}.st-ic.r{background:var(--dd);color:var(--danger)}.st-ic.o{background:var(--wd);color:var(--warn)}.st-ic.b{background:var(--id);color:var(--info)}
.st-tr{font-size:8px;font-weight:700;padding:2px 5px;border-radius:4px;font-family:'JetBrains Mono',monospace}
.st-tr.up{background:var(--ad);color:var(--accent)}.st-tr.dn{background:var(--dd);color:var(--danger)}
.st-v{font-size:22px;font-weight:800;font-family:'JetBrains Mono',monospace;letter-spacing:-1px;line-height:1;margin-bottom:2px}
.st-l{font-size:9px;color:var(--muted);font-weight:500}
.pn{background:var(--card);border:1px solid var(--border);border-radius:var(--r);overflow:hidden;margin-bottom:14px}
.ph{display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border-bottom:1px solid var(--border)}
.pt{font-size:12px;font-weight:700;display:flex;align-items:center;gap:6px}
.pt i{color:var(--accent);font-size:11px}
.pa{font-size:10px;color:var(--accent);cursor:pointer;font-weight:600;background:none;border:none;font-family:inherit}
.shp{background:var(--card);border:1px solid var(--border);border-radius:var(--r);padding:18px 14px;text-align:center;position:relative;overflow:hidden;margin-bottom:14px}
.shp::before{content:'';position:absolute;top:-35%;left:50%;transform:translateX(-50%);width:140px;height:140px;background:radial-gradient(circle,var(--ag),transparent 70%);opacity:.25;transition:opacity .5s}
.shp.off::before{opacity:.02}
.shv{position:relative;width:60px;height:66px;margin:0 auto 10px}
.sh-svg{width:100%;height:100%;filter:drop-shadow(0 0 12px var(--ag));transition:filter .5s}
.shp.off .sh-svg{filter:drop-shadow(0 0 3px rgba(74,107,88,.15))}
.sh-svg path{fill:none;stroke:var(--accent);stroke-width:2.5;stroke-linecap:round;stroke-linejoin:round;transition:stroke .5s}
.shp.off .sh-svg path{stroke:var(--muted)}
.sh-pl{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:44px;height:44px;border-radius:50%;border:1px solid var(--accent);opacity:0;animation:sp 2.5s ease-out infinite}
.shp.off .sh-pl{animation:none;opacity:0}
@keyframes sp{0%{transform:translate(-50%,-50%) scale(.8);opacity:.4}100%{transform:translate(-50%,-50%) scale(2.5);opacity:0}}
.sh-st{font-size:13px;font-weight:700;margin-bottom:2px;position:relative}.shp.off .sh-st{color:var(--muted)}
.sh-sub{font-size:9px;color:var(--muted);position:relative}
.modes{display:flex;gap:4px;margin-top:12px}
.mb{flex:1;padding:6px 2px;border-radius:var(--rs);border:1px solid var(--border);background:transparent;color:var(--muted);font-family:inherit;font-size:9px;font-weight:700;cursor:pointer;transition:all .25s;text-align:center}
.mb:hover{border-color:var(--muted);color:var(--fg2)}.mb.act{background:var(--ad);border-color:rgba(0,230,118,.2);color:var(--accent)}
.cl{max-height:300px;overflow-y:auto}
.ci{display:flex;align-items:center;gap:10px;padding:10px 14px;border-bottom:1px solid var(--border)}
.ci:last-child{border-bottom:none}.ci:hover{background:var(--ad)}
.ca{width:32px;height:32px;border-radius:7px;display:flex;align-items:center;justify-content:center;font-size:11px;flex-shrink:0}
.ca.spam{background:var(--dd);color:var(--danger)}.ca.blocked{background:rgba(255,61,61,.12);color:var(--danger)}.ca.safe{background:var(--ad);color:var(--accent)}.ca.unk{background:var(--wd);color:var(--warn)}
.ci-info{flex:1;min-width:0}
.ci-nm{font-size:11px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ci-nm .tg{font-size:7px;font-weight:700;text-transform:uppercase;letter-spacing:.3px;padding:1px 4px;border-radius:3px;margin-left:4px;vertical-align:middle}
.ci-nm .tg.sp{background:var(--dd);color:var(--danger)}.ci-nm .tg.bl{background:var(--dd);color:var(--danger)}.ci-nm .tg.up{background:var(--wd);color:var(--warn)}
.ci-meta{font-size:9px;color:var(--muted);margin-top:1px;font-family:'JetBrains Mono',monospace;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ci-acts{display:flex;gap:4px;flex-shrink:0}
.cab{width:26px;height:26px;border-radius:6px;border:1px solid var(--border);background:var(--bg2);color:var(--fg2);display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:9px;transition:all .2s}
.cab:hover{border-color:var(--danger);color:var(--danger);background:var(--dd)}
.cab.wl:hover{border-color:var(--accent);color:var(--accent);background:var(--ad)}
.bl{padding:0}
.bi{display:flex;align-items:center;gap:8px;padding:9px 14px;border-bottom:1px solid var(--border)}
.bi:last-child{border-bottom:none}
.bi-ic{width:26px;height:26px;border-radius:6px;background:var(--dd);color:var(--danger);display:flex;align-items:center;justify-content:center;font-size:9px;flex-shrink:0}
.bi-info{flex:1;min-width:0}
.bi-num{font-size:10px;font-weight:600;font-family:'JetBrains Mono',monospace}
.bi-rsn{font-size:8px;color:var(--muted);margin-top:1px}
.bi-rm{width:22px;height:22px;border-radius:5px;border:1px solid transparent;background:transparent;color:var(--muted);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:9px;flex-shrink:0}
.bi-rm:hover{border-color:var(--danger);color:var(--danger);background:var(--dd)}
.af{padding:0}
.ai{display:flex;gap:8px;padding:8px 14px;border-bottom:1px solid var(--border);font-size:10px}
.ai:last-child{border-bottom:none}
.ad{width:5px;height:5px;border-radius:50%;margin-top:5px;flex-shrink:0}
.ad.g{background:var(--accent)}.ad.r{background:var(--danger)}.ad.o{background:var(--warn)}
.at{color:var(--fg2);line-height:1.5}.at strong{color:var(--fg);font-weight:600}
.atm{color:var(--muted);font-size:8px;margin-top:1px;font-family:'JetBrains Mono',monospace}
.ta{background:linear-gradient(135deg,rgba(255,61,61,.12),rgba(255,61,61,.04));border:1px solid rgba(255,61,61,.2);border-radius:var(--r);padding:12px 14px;margin-bottom:14px;display:flex;align-items:center;gap:10px;animation:ap 2s ease-in-out infinite}
@keyframes ap{0%,100%{border-color:rgba(255,61,61,.2)}50%{border-color:rgba(255,61,61,.4)}}
.ta-ic{width:36px;height:36px;border-radius:9px;background:var(--dd);color:var(--danger);display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;animation:aic 1s ease-in-out infinite}
@keyframes aic{0%,100%{transform:scale(1)}50%{transform:scale(1.1)}}
.ta h3{font-size:13px;font-weight:700;color:var(--danger)}.ta p{font-size:10px;color:var(--fg2);margin-top:1px}
.sc{background:var(--card);border:1px solid var(--border);border-radius:var(--r);overflow:hidden;margin-bottom:14px}
.sc-h{padding:12px 14px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px}
.sc-av{width:36px;height:36px;border-radius:9px;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:800;flex-shrink:0}
.sc-nm{font-size:12px;font-weight:700}.sc-num{font-size:10px;color:var(--muted);font-family:'JetBrains Mono',monospace;margin-top:1px}
.sd-r{display:flex;justify-content:space-between;align-items:center;padding:8px 14px;border-bottom:1px solid var(--border);font-size:10px}
.sd-r:last-child{border-bottom:none}
.sd-l{color:var(--muted);font-weight:500;display:flex;align-items:center;gap:4px}
.sd-l i{font-size:8px;width:10px;text-align:center}
.sd-v{font-weight:600;text-align:right;max-width:55%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sd-v.fh{color:var(--warn);animation:bk 1s infinite}.sd-v.dg{color:var(--danger)}
.acb{display:flex;flex-direction:column;gap:6px}
.abtn{padding:10px;border-radius:var(--rs);font-family:inherit;font-size:11px;font-weight:700;cursor:pointer;transition:all .25s;border:none;display:flex;align-items:center;justify-content:center;gap:6px}
.abtn.bl{background:var(--danger);color:#fff}.abtn.bl:hover{box-shadow:0 0 14px var(--dg)}
.abtn.bl:disabled{opacity:0.5;cursor:not-allowed}
.qbr{display:flex;gap:6px;padding:8px 14px}
.qb-in{flex:1;padding:8px 10px;background:var(--bg2);border:1px solid var(--border);border-radius:var(--rs);color:var(--fg);font-family:'JetBrains Mono',monospace;font-size:11px;outline:none}
.qb-in:focus{border-color:var(--accent)}.qb-in::placeholder{color:var(--muted)}
`;
