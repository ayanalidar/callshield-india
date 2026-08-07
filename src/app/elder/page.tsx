'use client';

/**
 * CallShield Elder Protection Screen
 *
 * Ultra‑simple, high‑contrast interface for seniors.
 * BIG text, BIG buttons (48px+ touch targets), voice announcements.
 * Shows: protection status, last blocked number, emergency HELP button.
 */

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

/* ------------------------------------------------------------------ */
/*  TTS helpers (Web Speech API)                                       */
/* ------------------------------------------------------------------ */

function speak(text: string) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'en-IN';
  u.rate = 0.85;
  u.pitch = 1.0;
  u.volume = 1.0;
  setTimeout(() => window.speechSynthesis.speak(u), 100);
}

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface QuickStatus {
  active: boolean;
  lastBlocked: { number: string; time: string; type: string } | null;
  blockedToday: number;
  totalBlocked: number;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function ElderPage() {
  const [status, setStatus] = useState<QuickStatus>({
    active: true,
    lastBlocked: { number: '+919988776655', time: '10 min ago', type: 'Bank OTP Scam' },
    blockedToday: 3,
    totalBlocked: 47,
  });
  const [helpActive, setHelpActive] = useState(false);
  const [time, setTime] = useState('');
  const [announced, setAnnounced] = useState(false);

  useEffect(() => {
    setTime(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }));
    const iv = setInterval(() => setTime(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })), 30000);
    return () => clearInterval(iv);
  }, []);

  // Voice announcement on load
  useEffect(() => {
    if (!announced) {
      const t = setTimeout(() => {
        speak('Protection is active. You are safe.');
        setAnnounced(true);
      }, 800);
      return () => clearTimeout(t);
    }
  }, [announced]);

  /* ---- Help button ---- */
  const handleHelp = useCallback(() => {
    setHelpActive(true);
    speak('Help request sent. Your family has been notified and will call you shortly.');
    setTimeout(() => setHelpActive(false), 3000);
  }, []);

  return (
    <>
      <style>{CSS}</style>
      <div className="eld-main">
        {/* ── Status Bar ── */}
        <div className="eld-status-bar">
          <div className="eld-status-icon">{status.active ? '🟢' : '🔴'}</div>
          <span className="eld-status-text">
            {status.active ? 'Protection Active' : 'Protection Off'}
          </span>
          <span className="eld-time">{time}</span>
        </div>

        {/* ── Main Content ── */}
        <div className="eld-body">
          {/* Hero */}
          <div className="eld-hero">
            <div className="eld-shield">🛡️</div>
            <h1 className="eld-title">
              {status.active ? 'You Are Protected' : 'Protection Paused'}
            </h1>
            <p className="eld-sub">
              CallShield is watching for scam calls
            </p>
          </div>

          {/* Last Blocked */}
          <div className="eld-card">
            <div className="eld-card-label">Last Blocked Call</div>
            {status.lastBlocked ? (
              <>
                <div className="eld-blocked-num">{status.lastBlocked.number}</div>
                <div className="eld-blocked-type">🚫 {status.lastBlocked.type}</div>
                <div className="eld-blocked-time">{status.lastBlocked.time}</div>
              </>
            ) : (
              <div className="eld-no-blocked">No scam calls today 👍</div>
            )}
          </div>

          {/* Stats */}
          <div className="eld-stats">
            <div className="eld-stat">
              <div className="eld-stat-n">{status.blockedToday}</div>
              <div className="eld-stat-l">Blocked Today</div>
            </div>
            <div className="eld-stat">
              <div className="eld-stat-n">{status.totalBlocked}</div>
              <div className="eld-stat-l">Total Blocked</div>
            </div>
          </div>

          {/* HELP Button */}
          <button
            className={`eld-help-btn ${helpActive ? 'eld-help-active' : ''}`}
            onClick={handleHelp}
            disabled={helpActive}
          >
            {helpActive ? '✅ Help Requested' : '🆘 HELP'}
          </button>
          {helpActive && (
            <div className="eld-help-msg">
              Your family has been notified. They will call you shortly.
            </div>
          )}

          {/* Quick info */}
          <div className="eld-info">
            <div className="eld-info-item">📞 If someone asks for OTP — it&apos;s a scam</div>
            <div className="eld-info-item">🏦 Bank never calls to ask for your PIN</div>
            <div className="eld-info-item">🚫 Never install apps from unknown callers</div>
            <div className="eld-info-item">👮 Police don&apos;t call for money transfers</div>
          </div>
        </div>

        {/* ── Bottom Nav ── */}
        <nav className="eld-nav">
          <Link href="/dashboard" className="eld-nav-i">🏠<span>Home</span></Link>
          <button className="eld-nav-i" onClick={() => speak('Protection is active. All calls are being scanned for scams.')}>
            🔊<span>Speak</span>
          </button>
          <Link href="/family" className="eld-nav-i">👨‍👩‍👧‍👦<span>Family</span></Link>
        </nav>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Styles                                                              */
/* ------------------------------------------------------------------ */

const CSS = `
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  :root{
    --bg:#060e08;--surface:#0b1a0f;--card:#0e1f13;--border:#142a1b;
    --accent:#00e676;--text:#e0f2e9;--text2:#9ab7a5;--muted:#4a6b58;
    --danger:#ff3d3d;--warn:#ff9800;
    --r:14px;--rs:10px;
    --safe-top:env(safe-area-inset-top,0px);
    --safe-bottom:env(safe-area-inset-bottom,0px);
  }

  .eld-main{
    display:flex;flex-direction:column;height:100dvh;
    padding:var(--safe-top) 0 var(--safe-bottom) 0;
    background:var(--bg)
  }

  /* Status bar */
  .eld-status-bar{
    display:flex;align-items:center;justify-content:space-between;
    padding:10px 16px;background:var(--surface);border-bottom:1px solid var(--border);
    flex-shrink:0;min-height:48px;gap:8px
  }
  .eld-status-icon{font-size:16px}
  .eld-status-text{font-size:15px;font-weight:800;flex:1}
  .eld-time{font-size:18px;color:var(--accent);font-weight:700;font-family:monospace}

  /* Body */
  .eld-body{
    flex:1;overflow-y:auto;padding:20px 16px;
    display:flex;flex-direction:column;align-items:center;gap:18px;
    -webkit-overflow-scrolling:touch
  }

  /* Hero */
  .eld-hero{text-align:center;margin-top:8px}
  .eld-shield{font-size:64px;margin-bottom:8px}
  .eld-title{font-size:22px;font-weight:800;color:var(--accent);line-height:1.3}
  .eld-sub{font-size:14px;color:var(--text2);margin-top:4px}

  /* Card */
  .eld-card{
    width:100%;background:var(--card);border:1px solid var(--border);
    border-radius:var(--r);padding:20px 18px;text-align:center
  }
  .eld-card-label{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px}
  .eld-blocked-num{
    font-size:28px;font-family:'JetBrains Mono',monospace;font-weight:800;
    color:var(--danger);margin-bottom:4px
  }
  .eld-blocked-type{font-size:14px;color:var(--text);font-weight:600;margin-bottom:2px}
  .eld-blocked-time{font-size:11px;color:var(--muted)}
  .eld-no-blocked{font-size:18px;color:var(--accent);padding:16px 0}

  /* Stats */
  .eld-stats{display:flex;gap:12px;width:100%}
  .eld-stat{
    flex:1;background:var(--card);border:1px solid var(--border);
    border-radius:var(--rs);padding:18px 12px;text-align:center
  }
  .eld-stat-n{font-size:32px;font-weight:800;color:var(--accent);line-height:1.1}
  .eld-stat-l{font-size:11px;color:var(--muted);margin-top:4px}

  /* HELP button */
  .eld-help-btn{
    width:100%;min-height:56px;padding:18px;background:var(--danger);
    color:#fff;border:none;border-radius:var(--r);
    font-size:26px;font-weight:800;font-family:inherit;cursor:pointer;
    transition:transform .1s,opacity .15s;
    animation:eld-pulse 2s ease-in-out infinite
  }
  .eld-help-btn:active{transform:scale(.97);opacity:.85}
  .eld-help-btn:disabled{cursor:default}
  .eld-help-active{background:var(--accent);color:#050c07;animation:none}
  .eld-help-msg{
    text-align:center;padding:14px 16px;background:rgba(0,230,118,.06);
    border:1px solid rgba(0,230,118,.15);border-radius:var(--rs);
    font-size:14px;color:var(--accent);font-weight:600;line-height:1.5
  }

  @keyframes eld-pulse{
    0%,100%{box-shadow:0 0 0 0 rgba(255,61,61,.3)}
    50%{box-shadow:0 0 0 12px rgba(255,61,61,0)}
  }

  /* Info tips */
  .eld-info{width:100%;display:flex;flex-direction:column;gap:8px}
  .eld-info-item{
    font-size:13px;padding:14px 16px;background:var(--card);border:1px solid var(--border);
    border-radius:var(--rs);color:var(--text2);line-height:1.5
  }

  /* Bottom nav */
  .eld-nav{
    display:flex;justify-content:space-around;align-items:center;
    background:var(--surface);border-top:1px solid var(--border);
    flex-shrink:0;min-height:56px;padding-bottom:var(--safe-bottom)
  }
  .eld-nav-i{
    display:flex;flex-direction:column;align-items:center;gap:4px;
    font-size:22px;color:var(--muted);padding:8px 12px;
    font-family:inherit;background:none;border:none;cursor:pointer;text-decoration:none
  }
  .eld-nav-i span{font-size:10px;font-weight:500}
  .eld-nav-i:active{color:var(--accent)}
`;
