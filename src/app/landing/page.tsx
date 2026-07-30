'use client';

import { useState, useEffect, useCallback, useRef, FormEvent } from 'react';

// ============================================================
// TYPES
// ============================================================

interface LandingStats {
  totalScamsBlocked: number;
  totalScamsTracked: number;
  activeScamNumbers: number;
  accuracyRate: number;
}

interface LookupResult {
  phoneNumber: string;
  normalized: string;
  verdict: 'safe' | 'suspicious' | 'scam' | 'critical';
  threatScore: number;
  scamType?: string;
  severity: string;
  evidence: string[];
  warnings: string[];
  dbMatch: { found: boolean; reportCount: number; verified: boolean };
  carrier?: string;
  telecomCircle?: string;
  numberType: string;
  isVoip: boolean;
  responseTime: number;
}

// ============================================================
// HOOKS
// ============================================================

function useStats() {
  const [stats, setStats] = useState<LandingStats>({
    totalScamsBlocked: 12847,
    totalScamsTracked: 892,
    activeScamNumbers: 234,
    accuracyRate: 98,
  });

  useEffect(() => {
    fetch('/api/stats')
      .then(r => r.json())
      .then(data => setStats(data))
      .catch(() => {});
  }, []);

  return stats;
}

function useAnimatedCounter(target: number, duration = 2000) {
  const [value, setValue] = useState(0);
  const startRef = useRef(0);
  const rafRef = useRef(0);

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

function FeatureCard({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <div className="lfc">
      <div className="lfc-icon">
        <i className={`fas ${icon}`} />
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}

function StepCard({ number, icon, title, description }: { number: number; icon: string; title: string; description: string }) {
  return (
    <div className="lsc">
      <div className="lsc-number">{number}</div>
      <div className="lsc-icon">
        <i className={`fas ${icon}`} />
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}

function VerdictBadge({ verdict }: { verdict: string }) {
  const map: Record<string, { icon: string; color: string; bg: string; label: string }> = {
    safe: { icon: 'fa-shield-halved', color: '#00e676', bg: 'rgba(0,230,118,.1)', label: 'SAFE' },
    suspicious: { icon: 'fa-question-circle', color: '#ffab40', bg: 'rgba(255,171,64,.1)', label: 'SUSPICIOUS' },
    scam: { icon: 'fa-exclamation-triangle', color: '#ff3d3d', bg: 'rgba(255,61,61,.1)', label: 'SCAM' },
    critical: { icon: 'fa-skull', color: '#ff3d3d', bg: 'rgba(255,61,61,.15)', label: 'CRITICAL' },
  };
  const m = map[verdict] || map.safe;

  return (
    <span className="lvb" style={{ color: m.color, background: m.bg }}>
      <i className={`fas ${m.icon}`} /> {m.label}
    </span>
  );
}

// ============================================================
// PAGE
// ============================================================

export default function LandingPage() {
  const stats = useStats();
  const [lookupQuery, setLookupQuery] = useState('');
  const [lookupResult, setLookupResult] = useState<LookupResult | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState('');
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

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
    } catch {
      setLookupError('Lookup failed. Please try again.');
    } finally {
      setLookupLoading(false);
    }
  }, [lookupQuery]);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: LANDING_STYLES }} />

      {/* Navigation */}
      <nav className={`lnav ${scrolled ? 'scrolled' : ''}`}>
        <div className="lnav-inner">
          <div className="lnav-brand">
            <i className="fas fa-shield-halved" style={{ color: 'var(--accent)', marginRight: 8 }} />
            CallShield India
          </div>
          <div className="lnav-links">
            <a href="/">Dashboard</a>
            <a href="/trends">Trends</a>
            <a href="/wiki">Wiki</a>
            <a href="/admin">Admin</a>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="lhero">
        <div className="lhero-bg" />
        <div className="lhero-content">
          <div className="lhero-badge">
            <i className="fas fa-bolt" /> AI-Powered Scam Protection
          </div>
          <h1>
            CallShield <span className="lhero-highlight">India</span>
          </h1>
          <p className="lhero-sub">
            AI-powered scam call protection for every Indian. Real-time detection, instant lookup, and community-powered reporting — all in one place.
          </p>

          {/* Live Lookup Demo */}
          <div className="lhero-lookup">
            <form onSubmit={doLookup} className="lhl-form">
              <div className="lhl-icon">
                <i className="fas fa-phone" />
              </div>
              <input
                type="tel"
                className="lhl-input"
                placeholder="Enter a phone number to check..."
                value={lookupQuery}
                onChange={e => setLookupQuery(e.target.value)}
              />
              <button type="submit" className="lhl-btn" disabled={lookupLoading}>
                {lookupLoading ? (
                  <i className="fas fa-spinner fa-spin" />
                ) : (
                  <>
                    <i className="fas fa-search" /> Check Now
                  </>
                )}
              </button>
            </form>

            {lookupError && (
              <div className="lhl-error">{lookupError}</div>
            )}

            {lookupResult && (
              <div className="lhl-result">
                <div className="lhl-result-header">
                  <div className="lhl-result-left">
                    <div className="lhl-result-number">{lookupResult.phoneNumber}</div>
                    <div className="lhl-result-meta">
                      {lookupResult.carrier || 'Unknown'} · {lookupResult.numberType}
                      {lookupResult.isVoip && ' · VoIP'}
                    </div>
                  </div>
                  <VerdictBadge verdict={lookupResult.verdict} />
                </div>
                <div className="lhl-result-details">
                  <div className="lhl-detail">
                    <span className="lhl-dlabel">Threat Score</span>
                    <span className="lhl-dval-score">{lookupResult.threatScore}/100</span>
                  </div>
                  <div className="lhl-detail">
                    <span className="lhl-dlabel">Severity</span>
                    <span className="lhl-dval">{lookupResult.severity.toUpperCase()}</span>
                  </div>
                  <div className="lhl-detail">
                    <span className="lhl-dlabel">Scam Type</span>
                    <span className="lhl-dval">{lookupResult.scamType || 'N/A'}</span>
                  </div>
                  <div className="lhl-detail">
                    <span className="lhl-dlabel">DB Reports</span>
                    <span className="lhl-dval">{lookupResult.dbMatch.found ? `${lookupResult.dbMatch.reportCount} reports` : 'None'}</span>
                  </div>
                </div>
                {lookupResult.warnings.length > 0 && (
                  <div className="lhl-warnings">
                    {lookupResult.warnings.slice(0, 3).map((w, i) => (
                      <div key={i} className="lhl-warning">
                        <i className="fas fa-exclamation-triangle" /> {w}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="lhero-trust">
            <div className="lhero-trust-item">
              <i className="fas fa-check-circle" /> Free to use
            </div>
            <div className="lhero-trust-item">
              <i className="fas fa-bolt" /> Instant results
            </div>
            <div className="lhero-trust-item">
              <i className="fas fa-users" /> Community powered
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="lfeatures" id="features">
        <div className="lsection-header">
          <h2>Why CallShield?</h2>
          <p>Built specifically for Indian phone users, powered by real-time data and community intelligence</p>
        </div>
        <div className="lfeatures-grid">
          <FeatureCard
            icon="fa-bolt"
            title="Real-time Detection"
            description="Instantly analyze any phone number against our database of known scam patterns, prefixes, and community reports. Results in milliseconds."
          />
          <FeatureCard
            icon="fa-gauge-high"
            title="Threat Scoring"
            description="Every number gets a threat score from 0-100 with detailed reasoning. Critical threats are flagged immediately with specific scam type identification."
          />
          <FeatureCard
            icon="fa-users"
            title="Community Reports"
            description="Thousands of Indians contribute to our shared scam database. Each report strengthens the protection for everyone. Report with one tap."
          />
          <FeatureCard
            icon="fa-globe-asia"
            title="International Scam Detection"
            description="Detects international scam numbers targeting Indians — including WhatsApp scams, fake job offers, and phishing calls from abroad."
          />
        </div>
      </section>

      {/* How It Works */}
      <section className="lhow" id="how">
        <div className="lsection-header">
          <h2>How It Works</h2>
          <p>Three simple steps to protect yourself from phone scams</p>
        </div>
        <div className="lhow-steps">
          <StepCard
            number={1}
            icon="fa-keyboard"
            title="Enter Number"
            description="Type or paste any phone number you want to verify. Works for Indian mobile, landline, and international numbers."
          />
          <div className="lhow-arrow">
            <i className="fas fa-arrow-right" />
          </div>
          <StepCard
            number={2}
            icon="fa-brain"
            title="AI Analyzes"
            description="Our engine cross-references against scam databases, number intelligence, carrier data, and community reports in real-time."
          />
          <div className="lhow-arrow">
            <i className="fas fa-arrow-right" />
          </div>
          <StepCard
            number={3}
            icon="fa-shield-halved"
            title="Get Verdict"
            description="Instantly see if the number is safe, suspicious, or a confirmed scam with detailed evidence and recommendations."
          />
        </div>
      </section>

      {/* Stats Section */}
      <section className="lstats" id="stats">
        <div className="lstats-inner">
          <div className="lstats-item">
            <div className="lstats-value">{useAnimatedCounter(stats.totalScamsBlocked)}</div>
            <div className="lstats-label">Scams Identified</div>
          </div>
          <div className="lstats-divider" />
          <div className="lstats-item">
            <div className="lstats-value">{useAnimatedCounter(stats.activeScamNumbers)}</div>
            <div className="lstats-label">Active Threats Today</div>
          </div>
          <div className="lstats-divider" />
          <div className="lstats-item">
            <div className="lstats-value">{useAnimatedCounter(stats.totalScamsTracked)}</div>
            <div className="lstats-label">Reports Tracked</div>
          </div>
          <div className="lstats-divider" />
          <div className="lstats-item">
            <div className="lstats-value">{stats.accuracyRate}%</div>
            <div className="lstats-label">Detection Accuracy</div>
          </div>
        </div>
      </section>

      {/* Trust Section */}
      <section className="ltrust">
        <div className="ltrust-content">
          <div className="ltrust-badge">
            <i className="fas fa-shield-halved" />
          </div>
          <h2>Powered by Indian Telecom Data + Community Intelligence</h2>
          <p>
            CallShield combines official Indian telecom numbering plans, carrier databases, and real-time community
            reports to give you the most accurate scam detection available. Our data covers all 22 telecom circles
            across India.
          </p>
          <div className="ltrust-logos">
            <div className="ltrust-logo-item">
              <i className="fas fa-database" /> Telecom Circle Mapping
            </div>
            <div className="ltrust-logo-item">
              <i className="fas fa-map-marker-alt" /> All 28 States Covered
            </div>
            <div className="ltrust-logo-item">
              <i className="fas fa-clock" /> Real-time Updates
            </div>
            <div className="ltrust-logo-item">
              <i className="fas fa-lock" /> Community Verified
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="lcta">
        <h2>Ready to Protect Yourself?</h2>
        <p>Start checking numbers now. It&apos;s free, instant, and could save you from losing thousands to scammers.</p>
        <div className="lcta-buttons">
          <a href="/" className="lcta-btn primary">
            <i className="fas fa-rocket" /> Go to Dashboard
          </a>
          <a href="#lookup" className="lcta-btn secondary" onClick={e => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
            <i className="fas fa-search" /> Try Lookup
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="lfooter">
        <div className="lfooter-inner">
          <div className="lfooter-brand">
            <i className="fas fa-shield-halved" style={{ color: 'var(--accent)' }} /> CallShield India
          </div>
          <div className="lfooter-text">
            © 2024 CallShield India. Protecting Indians from phone scams with AI.
          </div>
          <div className="lfooter-links">
            <a href="/">Dashboard</a>
            <a href="/trends">Trends</a>
            <a href="/wiki">Wiki</a>
            <a href="/admin">Admin</a>
            <a href="/landing">Landing</a>
          </div>
        </div>
      </footer>
    </>
  );
}

// ============================================================
// STYLES
// ============================================================

const LANDING_STYLES = `
:root{--bg:#050c07;--bg2:#091410;--card:#0d1c14;--border:#1a3326;--accent:#00e676;--ad:rgba(0,230,118,.1);--ag:rgba(0,230,118,.25);--danger:#ff3d3d;--dd:rgba(255,61,61,.1);--warn:#ffab40;--wd:rgba(255,171,64,.1);--info:#40c4ff;--id:rgba(64,196,255,.1);--fg:#e0f2e9;--fg2:#a5c4b5;--muted:#4a6b58;--r:14px;--rs:8px}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Space Grotesk',sans-serif;background:var(--bg);color:var(--fg);min-height:100vh;overflow-x:hidden}
::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:var(--bg2)}::-webkit-scrollbar-thumb{background:var(--border)}

/* Nav */
.lnav{position:fixed;top:0;left:0;right:0;z-index:1000;padding:12px 0;transition:all .3s}
.lnav.scrolled{background:rgba(5,12,7,.92);border-bottom:1px solid var(--border);backdrop-filter:blur(12px)}
.lnav-inner{max-width:1200px;margin:0 auto;padding:0 20px;display:flex;align-items:center;justify-content:space-between}
.lnav-brand{font-size:15px;font-weight:800;display:flex;align-items:center}
.lnav-links{display:flex;gap:16px}
.lnav-links a{color:var(--fg2);text-decoration:none;font-size:11px;font-weight:500;transition:color .2s}
.lnav-links a:hover{color:var(--accent)}

/* Hero */
.lhero{position:relative;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:100px 20px 60px;overflow:hidden}
.lhero-bg{position:absolute;inset:0;background:radial-gradient(ellipse 800px 500px at 50% 20%,rgba(0,230,118,.06),transparent 60%),radial-gradient(ellipse 400px 300px at 30% 80%,rgba(64,196,255,.03),transparent 50%),radial-gradient(ellipse 300px 300px at 80% 60%,rgba(255,61,61,.02),transparent 50%);pointer-events:none}
.lhero-content{position:relative;z-index:1;max-width:680px;text-align:center}
.lhero-badge{display:inline-flex;align-items:center;gap:6px;padding:5px 14px;border-radius:20px;background:var(--ad);border:1px solid rgba(0,230,118,.15);font-size:10px;font-weight:600;color:var(--accent);margin-bottom:20px}
.lhero-content h1{font-size:clamp(32px,6vw,56px);font-weight:800;line-height:1.1;letter-spacing:-1.5px;margin-bottom:16px}
.lhero-highlight{color:var(--accent)}
.lhero-sub{font-size:15px;color:var(--fg2);line-height:1.7;margin-bottom:32px;max-width:500px;margin-left:auto;margin-right:auto}

/* Live Lookup in Hero */
.lhero-lookup{margin-bottom:20px}
.lhl-form{display:flex;gap:0;align-items:stretch;background:var(--card);border:1px solid var(--border);border-radius:var(--r);overflow:hidden;max-width:560px;margin:0 auto}
.lhl-icon{display:flex;align-items:center;padding-left:14px;color:var(--muted);font-size:12px}
.lhl-input{flex:1;padding:14px 12px;background:transparent;border:none;color:var(--fg);font-family:'JetBrains Mono',monospace;font-size:13px;outline:none}
.lhl-input::placeholder{color:var(--muted)}
.lhl-btn{display:flex;align-items:center;gap:6px;padding:14px 20px;background:var(--accent);color:var(--bg);border:none;font-family:inherit;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;transition:opacity .2s}
.lhl-btn:hover{opacity:.85}
.lhl-btn:disabled{opacity:.5;cursor:not-allowed}

/* Live Lookup Result */
.lhl-error{margin-top:10px;padding:8px 14px;border-radius:var(--rs);background:var(--dd);color:var(--danger);font-size:10px;max-width:560px;margin-left:auto;margin-right:auto}
.lhl-result{max-width:560px;margin:12px auto 0;background:var(--card);border:1px solid var(--border);border-radius:var(--r);overflow:hidden;text-align:left;animation:lfr .3s ease}
@keyframes lfr{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
.lhl-result-header{display:flex;align-items:center;justify-content:space-between;padding:14px;border-bottom:1px solid var(--border)}
.lhl-result-number{font-family:'JetBrains Mono',monospace;font-weight:600;font-size:13px}
.lhl-result-meta{font-size:9px;color:var(--muted);margin-top:2px}
.lvb{padding:4px 10px;border-radius:5px;font-size:9px;font-weight:700;display:flex;align-items:center;gap:4px;white-space:nowrap}
.lhl-result-details{display:grid;grid-template-columns:1fr 1fr;gap:1px;background:var(--border)}
.lhl-detail{padding:10px 14px;background:var(--bg2);display:flex;justify-content:space-between;align-items:center}
.lhl-dlabel{font-size:9px;color:var(--muted)}
.lhl-dval{font-size:10px;font-weight:600;color:var(--fg2)}
.lhl-dval-score{font-size:11px;font-weight:700;font-family:'JetBrains Mono',monospace;color:var(--accent)}
.lhl-warnings{padding:10px 14px;border-top:1px solid var(--border);background:var(--dd)}
.lhl-warning{font-size:9px;color:var(--danger);display:flex;align-items:flex-start;gap:6px;padding:3px 0}
.lhl-warning i{font-size:8px;margin-top:2px;flex-shrink:0}

.lhero-trust{display:flex;justify-content:center;gap:24px;margin-top:16px;flex-wrap:wrap}
.lhero-trust-item{font-size:10px;color:var(--muted);display:flex;align-items:center;gap:5px}
.lhero-trust-item i{color:var(--accent);font-size:9px}

/* Section Headers */
.lsection-header{text-align:center;margin-bottom:40px}
.lsection-header h2{font-size:28px;font-weight:800;margin-bottom:8px}
.lsection-header p{font-size:12px;color:var(--muted);max-width:400px;margin:0 auto;line-height:1.6}

/* Features */
.lfeatures{padding:80px 20px;max-width:1100px;margin:0 auto}
.lfeatures-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
@media(max-width:900px){.lfeatures-grid{grid-template-columns:repeat(2,1fr)}}
@media(max-width:500px){.lfeatures-grid{grid-template-columns:1fr}}
.lfc{background:var(--card);border:1px solid var(--border);border-radius:var(--r);padding:24px 20px;transition:border-color .3s,transform .3s}
.lfc:hover{border-color:rgba(0,230,118,.2);transform:translateY(-2px)}
.lfc-icon{width:44px;height:44px;border-radius:10px;background:var(--ad);display:flex;align-items:center;justify-content:center;font-size:18px;color:var(--accent);margin-bottom:14px}
.lfc h3{font-size:13px;font-weight:700;margin-bottom:6px}
.lfc p{font-size:10px;color:var(--muted);line-height:1.6}

/* How It Works */
.lhow{padding:80px 20px;background:var(--bg2);border-top:1px solid var(--border);border-bottom:1px solid var(--border)}
.lhow-steps{display:flex;align-items:center;justify-content:center;gap:0;max-width:900px;margin:0 auto;flex-wrap:wrap}
@media(max-width:768px){.lhow-steps{flex-direction:column;gap:12px}}
.lsc{text-align:center;flex:1;min-width:200px;position:relative}
.lsc-number{width:32px;height:32px;border-radius:50%;background:var(--accent);color:var(--bg);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;margin:0 auto 10px}
.lsc-icon{width:48px;height:48px;border-radius:12px;background:var(--ad);display:flex;align-items:center;justify-content:center;font-size:20px;color:var(--accent);margin:0 auto 10px}
.lsc h3{font-size:13px;font-weight:700;margin-bottom:4px}
.lsc p{font-size:10px;color:var(--muted);line-height:1.5;max-width:200px;margin:0 auto}
.lhow-arrow{color:var(--muted);font-size:18px;margin:0 8px;flex-shrink:0}
@media(max-width:768px){.lhow-arrow{transform:rotate(90deg);margin:4px 0}}

/* Stats */
.lstats{padding:60px 20px;max-width:1000px;margin:0 auto}
.lstats-inner{display:flex;align-items:center;justify-content:space-around;background:var(--card);border:1px solid var(--border);border-radius:var(--r);padding:32px 20px;flex-wrap:wrap;gap:20px}
.lstats-item{text-align:center;min-width:120px}
.lstats-value{font-size:28px;font-weight:800;font-family:'JetBrains Mono',monospace}
.lstats-label{font-size:9px;color:var(--muted);margin-top:2px}
.lstats-divider{width:1px;height:40px;background:var(--border)}
@media(max-width:600px){.lstats-divider{width:60px;height:1px}}

/* Trust */
.ltrust{padding:80px 20px;background:var(--bg2);border-top:1px solid var(--border)}
.ltrust-content{max-width:700px;margin:0 auto;text-align:center}
.ltrust-badge{width:56px;height:56px;border-radius:50%;background:var(--ad);display:flex;align-items:center;justify-content:center;font-size:22px;color:var(--accent);margin:0 auto 16px}
.ltrust h2{font-size:20px;font-weight:800;margin-bottom:10px}
.ltrust p{font-size:12px;color:var(--muted);line-height:1.7;margin-bottom:24px}
.ltrust-logos{display:flex;justify-content:center;gap:20px;flex-wrap:wrap}
.ltrust-logo-item{font-size:10px;color:var(--fg2);display:flex;align-items:center;gap:5px;padding:8px 14px;background:var(--card);border:1px solid var(--border);border-radius:6px}
.ltrust-logo-item i{color:var(--accent);font-size:9px}

/* CTA */
.lcta{padding:80px 20px;text-align:center}
.lcta h2{font-size:28px;font-weight:800;margin-bottom:8px}
.lcta p{font-size:13px;color:var(--muted);margin-bottom:24px;max-width:450px;margin-left:auto;margin-right:auto;line-height:1.6}
.lcta-buttons{display:flex;gap:10px;justify-content:center;flex-wrap:wrap}
.lcta-btn{display:inline-flex;align-items:center;gap:6px;padding:12px 24px;border-radius:var(--rs);font-family:inherit;font-size:12px;font-weight:700;text-decoration:none;cursor:pointer;transition:all .2s}
.lcta-btn.primary{background:var(--accent);color:var(--bg);border:1px solid var(--accent)}
.lcta-btn.primary:hover{opacity:.85}
.lcta-btn.secondary{background:transparent;border:1px solid var(--border);color:var(--fg)}
.lcta-btn.secondary:hover{border-color:var(--accent);color:var(--accent)}

/* Footer */
.lfooter{padding:20px;border-top:1px solid var(--border);background:var(--bg2)}
.lfooter-inner{max-width:1100px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px}
.lfooter-brand{font-size:11px;font-weight:700;display:flex;align-items:center;gap:5px;color:var(--fg2)}
.lfooter-text{font-size:9px;color:var(--muted)}
.lfooter-links{display:flex;gap:12px}
.lfooter-links a{font-size:9px;color:var(--muted);text-decoration:none;transition:color .2s}
.lfooter-links a:hover{color:var(--accent)}
`;
