'use client';

export default function RootPage() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: ROOT_STYLES }} />
      <div className="root-bg" />
      <div className="root-wrap">
        {/* Header */}
        <div className="root-header">
          <div className="root-logo">
            <i className="fas fa-shield-halved" />
            CallShield India
          </div>
          <div className="root-tagline">AI-Powered Scam Call Protection</div>
        </div>

        {/* Cards */}
        <div className="root-cards">
          {/* Dashboard Card */}
          <a href="/" className="root-card">
            <div className="root-card-icon" style={{ '--c': 'var(--accent)' } as React.CSSProperties}>
              <i className="fas fa-chart-line" />
            </div>
            <h2>Go to Dashboard</h2>
            <p>Real-time scam detection, call history, block list, and threat monitoring. Your command center for phone safety.</p>
            <div className="root-card-features">
              <span><i className="fas fa-check-circle" /> Live Lookup</span>
              <span><i className="fas fa-check-circle" /> Call History</span>
              <span><i className="fas fa-check-circle" /> Block Management</span>
              <span><i className="fas fa-check-circle" /> Activity Feed</span>
            </div>
            <div className="root-card-cta">
              <i className="fas fa-arrow-right" /> Open Dashboard
            </div>
          </a>

          {/* Landing Page Card */}
          <a href="/landing" className="root-card">
            <div className="root-card-icon" style={{ '--c': 'var(--info)' } as React.CSSProperties}>
              <i className="fas fa-globe" />
            </div>
            <h2>Try Live Demo</h2>
            <p>Quick scam number lookup, learn how CallShield works, and see our features. No account needed.</p>
            <div className="root-card-features">
              <span><i className="fas fa-check-circle" /> Instant Lookup</span>
              <span><i className="fas fa-check-circle" /> How It Works</span>
              <span><i className="fas fa-check-circle" /> Live Stats</span>
              <span><i className="fas fa-check-circle" /> Trust Info</span>
            </div>
            <div className="root-card-cta">
              <i className="fas fa-arrow-right" /> Try Demo
            </div>
          </a>
        </div>

        {/* Footer link */}
        <div className="root-footer">
          <a href="/admin">
            <i className="fas fa-lock" /> Admin Panel
          </a>
        </div>
      </div>
    </>
  );
}

const ROOT_STYLES = `
:root{--bg:#050c07;--bg2:#091410;--card:#0d1c14;--border:#1a3326;--accent:#00e676;--ad:rgba(0,230,118,.1);--ag:rgba(0,230,118,.25);--danger:#ff3d3d;--info:#40c4ff;--id:rgba(64,196,255,.1);--fg:#e0f2e9;--fg2:#a5c4b5;--muted:#4a6b58;--r:14px;--rs:8px}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Space Grotesk',sans-serif;background:var(--bg);color:var(--fg);min-height:100vh;overflow-x:hidden}
::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:var(--bg2)}::-webkit-scrollbar-thumb{background:var(--border)}
.root-bg{position:fixed;inset:0;background:radial-gradient(ellipse 600px 400px at 50% 15%,rgba(0,230,118,.05),transparent 60%),radial-gradient(ellipse 400px 300px at 80% 85%,rgba(64,196,255,.03),transparent 50%),radial-gradient(ellipse 350px 300px at 20% 80%,rgba(255,61,61,.02),transparent 50%);pointer-events:none}
.root-wrap{position:relative;z-index:1;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px 20px}

/* Header */
.root-header{text-align:center;margin-bottom:36px}
.root-logo{font-size:28px;font-weight:800;display:flex;align-items:center;justify-content:center;gap:10px;margin-bottom:6px}
.root-logo i{color:var(--accent);font-size:30px}
.root-tagline{font-size:12px;color:var(--muted)}

/* Cards */
.root-cards{display:flex;gap:16px;max-width:700px;width:100%}
@media(max-width:600px){.root-cards{flex-direction:column;max-width:380px}}
.root-card{flex:1;background:var(--card);border:1px solid var(--border);border-radius:var(--r);padding:28px 22px;text-decoration:none;color:var(--fg);transition:all .3s;display:flex;flex-direction:column}
.root-card:hover{border-color:rgba(0,230,118,.2);transform:translateY(-3px);box-shadow:0 8px 30px rgba(0,0,0,.3)}
.root-card-icon{width:50px;height:50px;border-radius:12px;background:color-mix(in srgb,var(--c) 12%,transparent);display:flex;align-items:center;justify-content:center;font-size:20px;color:var(--c);margin-bottom:14px}
.root-card h2{font-size:16px;font-weight:700;margin-bottom:6px}
.root-card p{font-size:10px;color:var(--muted);line-height:1.6;margin-bottom:16px;flex:1}
.root-card-features{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:16px}
.root-card-features span{font-size:9px;color:var(--fg2);display:flex;align-items:center;gap:4px}
.root-card-features span i{color:var(--accent);font-size:8px}
.root-card-cta{margin-top:auto;display:flex;align-items:center;justify-content:center;gap:6px;padding:10px;border-radius:var(--rs);background:var(--ad);border:1px solid rgba(0,230,118,.15);font-size:11px;font-weight:600;color:var(--accent);transition:all .2s}
.root-card:hover .root-card-cta{background:var(--ag)}
.root-footer{margin-top:24px}
.root-footer a{font-size:10px;color:var(--muted);text-decoration:none;display:flex;align-items:center;gap:5px;transition:color .2s}
.root-footer a:hover{color:var(--fg2)}
`;
