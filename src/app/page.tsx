'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-provider';
import Link from 'next/link';
import { ReportModal } from '@/components/report-modal';

export default function RootPage() {
  const { user, signOut, isAuthenticated } = useAuth();
  const [reportModal, setReportModal] = useState<{ open: boolean; phoneNumber: string }>({ open: false, phoneNumber: '' });

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: ROOT_STYLES }} />
      <div className="root-bg" />

      {/* Navbar */}
      <nav className="root-nav">
        <div className="root-nav-inner">
          <Link href="/" className="root-nav-brand">
            <i className="fas fa-shield-halved" />
            CallShield India
          </Link>
          <div className="root-nav-right">
            <button
              className="root-nav-btn"
              onClick={() => setReportModal({ open: true, phoneNumber: '' })}
            >
              <i className="fas fa-flag" /> Report Scam
            </button>
            {isAuthenticated ? (
              <>
                <Link href="/history" className="root-nav-link">
                  <i className="fas fa-history" /> History
                </Link>
                <span className="root-nav-user">
                  <i className="fas fa-user-circle" />
                  {user?.phone ? `+91 ${user.phone.slice(0, 4)}...` : 'You'}
                </span>
                <button className="root-nav-link logout" onClick={signOut}>
                  <i className="fas fa-sign-out-alt" /> Logout
                </button>
              </>
            ) : (
              <Link href="/auth/login" className="root-nav-link login">
                <i className="fas fa-sign-in-alt" /> Sign In
              </Link>
            )}
          </div>
        </div>
      </nav>

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
          <Link href="/dashboard" className="root-card">
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
          </Link>

          {/* Landing Page Card */}
          <Link href="/landing" className="root-card">
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
          </Link>
        </div>

        {/* Quick Links */}
        <div className="root-quick-links">
          <Link href="/trends" className="root-ql-card">
            <i className="fas fa-chart-line" />
            <span>Scam Trends</span>
          </Link>
          <Link href="/wiki" className="root-ql-card">
            <i className="fas fa-book-open" />
            <span>Scam Wiki</span>
          </Link>
          <Link href="/landing" className="root-ql-card">
            <i className="fas fa-globe" />
            <span>Live Demo</span>
          </Link>
        </div>

        {/* Footer link */}
        <div className="root-footer">
          <Link href="/admin">
            <i className="fas fa-lock" /> Admin Panel
          </Link>
        </div>
      </div>

      {/* Report Modal */}
      <ReportModal
        isOpen={reportModal.open}
        phoneNumber={reportModal.phoneNumber}
        onClose={() => setReportModal({ open: false, phoneNumber: '' })}
        onReported={() => {}}
      />
    </>
  );
}

const ROOT_STYLES = `
:root{--bg:#050c07;--bg2:#091410;--card:#0d1c14;--border:#1a3326;--accent:#00e676;--ad:rgba(0,230,118,.1);--ag:rgba(0,230,118,.25);--danger:#ff3d3d;--dg:rgba(255,61,61,.1);--info:#40c4ff;--id:rgba(64,196,255,.1);--fg:#e0f2e9;--fg2:#a5c4b5;--muted:#4a6b58;--r:14px;--rs:8px}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Space Grotesk',sans-serif;background:var(--bg);color:var(--fg);min-height:100vh;overflow-x:hidden}
::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:var(--bg2)}::-webkit-scrollbar-thumb{background:var(--border)}
.root-bg{position:fixed;inset:0;background:radial-gradient(ellipse 600px 400px at 50% 15%,rgba(0,230,118,.05),transparent 60%),radial-gradient(ellipse 400px 300px at 80% 85%,rgba(64,196,255,.03),transparent 50%),radial-gradient(ellipse 350px 300px at 20% 80%,rgba(255,61,61,.02),transparent 50%);pointer-events:none}

/* Navbar */
.root-nav{position:sticky;top:0;z-index:100;background:rgba(5,12,7,.92);border-bottom:1px solid var(--border);backdrop-filter:blur(12px)}
.root-nav-inner{max-width:1200px;margin:0 auto;padding:0 20px;display:flex;align-items:center;justify-content:space-between;height:48px}
.root-nav-brand{color:var(--fg);text-decoration:none;font-size:14px;font-weight:800;display:flex;align-items:center;gap:8px}
.root-nav-brand i{color:var(--accent)}
.root-nav-right{display:flex;align-items:center;gap:8px}
.root-nav-btn{display:flex;align-items:center;gap:5px;padding:6px 14px;border-radius:var(--rs);background:rgba(255,171,64,.1);border:1px solid rgba(255,171,64,.2);color:#ffab40;font-family:inherit;font-size:10px;font-weight:600;cursor:pointer;transition:all .2s}
.root-nav-btn:hover{background:rgba(255,171,64,.15)}
.root-nav-link{display:flex;align-items:center;gap:4px;padding:6px 12px;border-radius:var(--rs);background:transparent;border:1px solid transparent;color:var(--fg2);font-family:inherit;font-size:10px;font-weight:500;text-decoration:none;cursor:pointer;transition:all .2s}
.root-nav-link:hover{color:var(--accent);border-color:var(--border)}
.root-nav-link.login{background:var(--accent);color:var(--bg);border:none;font-weight:700}
.root-nav-link.login:hover{opacity:.85;border-color:transparent}
.root-nav-link.logout{color:var(--muted)}
.root-nav-link.logout:hover{color:var(--danger);border-color:rgba(255,61,61,.2)}
.root-nav-user{font-size:9px;color:var(--fg2);display:flex;align-items:center;gap:4px;padding:0 4px}

.root-wrap{position:relative;z-index:1;min-height:calc(100vh - 48px);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px 20px}

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
.root-quick-links{display:flex;gap:10px;margin-top:20px;flex-wrap:wrap;justify-content:center}
.root-ql-card{display:flex;align-items:center;gap:6px;padding:8px 16px;background:var(--card);border:1px solid var(--border);border-radius:8px;text-decoration:none;color:var(--fg2);font-size:11px;font-weight:600;transition:all .2s}
.root-ql-card:hover{border-color:rgba(0,230,118,.2);color:var(--accent);transform:translateY(-2px)}
.root-ql-card i{font-size:12px;color:var(--accent)}
.root-footer{margin-top:20px}
.root-footer a{font-size:10px;color:var(--muted);text-decoration:none;display:flex;align-items:center;gap:5px;transition:color .2s}
.root-footer a:hover{color:var(--fg2)}
`;
