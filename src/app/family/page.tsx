'use client';

/**
 * CallShield Family Dashboard
 *
 * Dark green theme, mobile‑first, notch‑safe.
 * Shows member cards (name, phone, protection status),
 * add‑member button with invite code, join‑family input,
 * and alert timeline.
 */

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface FamilyMember {
  id: string;
  name: string;
  phone: string;
  role: 'admin' | 'member';
  joinedAt: string;
  protectionActive: boolean;
}

interface FamilyPlan {
  id: string;
  name: string;
  inviteCode: string;
  adminId: string;
  createdAt: string;
  members: FamilyMember[];
}

interface FamilyAlert {
  id: string;
  elderPhone: string;
  elderName?: string;
  scammerNumber: string;
  scamType: string;
  threatScore: number;
  blocked: boolean;
  timestamp: string;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = Date.now();
  const diff = now - d.getTime();
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

const SCAM_LABELS: Record<string, string> = {
  bank_otp_scam: 'Bank OTP Scam',
  upi_fraud: 'UPI Fraud',
  fedex_customs: 'FedEx Customs Scam',
  it_department: 'IT Dept Scam',
  electricity: 'Electricity Bill Scam',
  sextortion: 'Sextortion',
  loan_app: 'Loan App Scam',
  aadhaar_kyc: 'Aadhaar KYC Scam',
  insurance: 'Insurance Scam',
  lottery: 'Lottery Scam',
  crypto: 'Crypto Scam',
  sms_phishing: 'SMS Phishing',
  wangiri: 'Wangiri Missed Call',
  other: 'Other Scam',
};

function getUser() {
  if (typeof window === 'undefined') return null;
  try { const u = localStorage.getItem('callshield_user'); return u ? JSON.parse(u) : null; } catch { return null; }
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export default function FamilyPage() {
  const [plan, setPlan] = useState<FamilyPlan | null>(null);
  const [alerts, setAlerts] = useState<FamilyAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState('');
  const [createName, setCreateName] = useState('');
  const [creating, setCreating] = useState(false);
  const [memberName, setMemberName] = useState('');
  const [memberPhone, setMemberPhone] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  /* ---- Fetch family data ---- */
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const user = getUser();
      const headers: Record<string, string> = { 'Content-Type': 'application/json', Authorization: `Bearer ${user?.id || ''}` };

      const [planRes, alertsRes] = await Promise.all([
        fetch('/api/family', { headers }),
        fetch('/api/family/alerts', { headers }),
      ]);

      const planData = await planRes.json();
      const alertsData = await alertsRes.json();

      if (planData.hasFamily) {
        setPlan(planData.plan);
      } else {
        setPlan(null);
      }
      setAlerts(alertsData.alerts || []);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* ---- Create family ---- */
  const handleCreate = async () => {
    if (!createName.trim()) return;
    setCreating(true);
    try {
      const user = getUser();
      const res = await fetch('/api/family', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user?.id || ''}` },
        body: JSON.stringify({ action: 'create', planName: createName.trim(), adminName: user?.phone || 'Admin', adminPhone: user?.phone || '' }),
      });
      const data = await res.json();
      if (data.success) {
        setPlan(data.plan);
        setShowInvite(false);
      } else {
        setJoinError(data.error || 'Failed to create family');
      }
    } catch {
      setJoinError('Network error');
    }
    finally { setCreating(false); }
  };

  /* ---- Join family ---- */
  const handleJoin = async () => {
    if (!joinCode.trim()) return;
    setActionLoading(true);
    setJoinError('');
    try {
      const user = getUser();
      const res = await fetch('/api/family', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user?.id || ''}` },
        body: JSON.stringify({ action: 'join', inviteCode: joinCode.trim().toUpperCase(), memberName: memberName || user?.phone || 'Member', memberPhone: memberPhone || user?.phone || '' }),
      });
      const data = await res.json();
      if (data.success) {
        setPlan(data.plan);
        setJoinCode('');
        setMemberName('');
        setMemberPhone('');
      } else {
        setJoinError(data.error || 'Failed to join');
      }
    } catch {
      setJoinError('Network error');
    }
    finally { setActionLoading(false); }
  };

  /* ---- Leave family ---- */
  const handleLeave = async () => {
    if (!confirm('Leave this family plan? You will lose access to shared protection.')) return;
    setActionLoading(true);
    try {
      const user = getUser();
      await fetch('/api/family', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user?.id || ''}` },
        body: JSON.stringify({ action: 'leave' }),
      });
      setPlan(null);
    } catch { /* silent */ }
    finally { setActionLoading(false); }
  };

  const time = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

  return (
    <>
      <style>{CSS}</style>
      <div className="fam-main">
        {/* ── Header ── */}
        <header className="fam-top">
          <Link href="/dashboard" className="fam-back">←</Link>
          <div className="fam-top-t">👨‍👩‍👧‍👦 Family Shield</div>
          <span className="fam-time">{time}</span>
        </header>

        <div className="fam-body">
          {loading ? (
            <div className="fam-load">Loading family data…</div>
          ) : plan ? (
            <>
              {/* ── Plan header ── */}
              <div className="fam-card">
                <div className="fam-plan-title">{plan.name}</div>
                <div className="fam-plan-meta">
                  {plan.members.length} member{plan.members.length !== 1 ? 's' : ''} ·
                  Created {new Date(plan.createdAt).toLocaleDateString('en-IN')}
                </div>
                <div className="fam-plan-actions">
                  <button className="fam-pri-btn" onClick={() => setShowInvite(!showInvite)}>
                    {showInvite ? 'Hide Code' : '+ Add Member'}
                  </button>
                  <button className="fam-ghost-btn" onClick={handleLeave} disabled={actionLoading}>
                    Leave
                  </button>
                </div>
                {showInvite && (
                  <div className="fam-invite-box">
                    <div className="fam-invite-label">Share this code:</div>
                    <div className="fam-invite-code">{plan.inviteCode}</div>
                    <div className="fam-invite-hint">Family members can join using this 6‑character code</div>
                  </div>
                )}
              </div>

              {/* ── Members ── */}
              <div className="fam-section">
                <div className="fam-sec-head">🛡️ Family Members</div>
                <div className="fam-members">
                  {plan.members.map(m => (
                    <div key={m.id} className="fam-mem-card">
                      <div className="fam-mem-avatar">
                        {m.name.charAt(0).toUpperCase()}
                        {m.role === 'admin' && <span className="fam-mem-badge">👑</span>}
                      </div>
                      <div className="fam-mem-info">
                        <div className="fam-mem-name">{m.name}{m.role === 'admin' ? ' (Admin)' : ''}</div>
                        <div className="fam-mem-phone">{m.phone || 'No phone'}</div>
                        <div className={`fam-mem-status ${m.protectionActive ? 'fam-active' : 'fam-inactive'}`}>
                          {m.protectionActive ? '🟢 Protected' : '🔴 Inactive'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Alert Timeline ── */}
              <div className="fam-section">
                <div className="fam-sec-head">🚨 Recent Alerts</div>
                {alerts.length === 0 ? (
                  <div className="fam-empty">No alerts yet. Your family is safe! 🎉</div>
                ) : (
                  <div className="fam-timeline">
                    {alerts.map(a => (
                      <div key={a.id} className={`fam-alert ${a.blocked ? 'fam-alert-blocked' : ''}`}>
                        <div className="fam-alert-top">
                          <span className="fam-alert-type">{SCAM_LABELS[a.scamType] || a.scamType}</span>
                          <span className={`fam-alert-score ${a.blocked ? 'fam-score-blocked' : 'fam-score-warn'}`}>
                            {a.blocked ? '🛑 Blocked' : '⚠️'} {a.threatScore}/100
                          </span>
                        </div>
                        <div className="fam-alert-mid">
                          <span className="fam-alert-elder">{a.elderName || a.elderPhone}</span>
                          <span className="fam-alert-arrow">←</span>
                          <span className="fam-alert-scammer">{a.scammerNumber}</span>
                        </div>
                        <div className="fam-alert-time">{formatTime(a.timestamp)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            /* ── No family: show create / join ── */
            <div className="fam-blank">
              <div className="fam-blank-icon">👨‍👩‍👧‍👦</div>
              <div className="fam-blank-title">Family Shield</div>
              <div className="fam-blank-desc">
                Protect your entire family from scam calls. Get alerts when elders receive suspicious calls.
              </div>

              {/* Create */}
              <div className="fam-card">
                <div className="fam-subtitle">Create a Family Plan</div>
                <input className="fam-inp" type="text" placeholder="Family name (e.g., Sharma Family)"
                  value={createName} onChange={e => setCreateName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCreate()} />
                <button className="fam-pri-btn fam-full" onClick={handleCreate} disabled={creating || !createName.trim()}>
                  {creating ? 'Creating…' : 'Create Family'}
                </button>
              </div>

              <div className="fam-divider">
                <span>or</span>
              </div>

              {/* Join */}
              <div className="fam-card">
                <div className="fam-subtitle">Join an Existing Family</div>
                <input className="fam-inp fam-code-inp" type="text" placeholder="Invite code (6 characters)"
                  value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase().slice(0, 6))}
                  maxLength={6} onKeyDown={e => e.key === 'Enter' && handleJoin()} />
                <input className="fam-inp" type="text" placeholder="Your name (optional)"
                  value={memberName} onChange={e => setMemberName(e.target.value)} style={{ marginTop: 8 }} />
                <input className="fam-inp" type="tel" placeholder="Your phone (optional)"
                  value={memberPhone} onChange={e => setMemberPhone(e.target.value)} style={{ marginTop: 8 }} />
                {joinError && <div className="fam-err">⚠️ {joinError}</div>}
                <button className="fam-pri-btn fam-full" onClick={handleJoin} disabled={actionLoading || joinCode.length < 6}>
                  {actionLoading ? 'Joining…' : 'Join Family'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Bottom Nav ── */}
        <nav className="bot-nav">
          <Link href="/dashboard" className="bot-nav-i">📞<span>Scan</span></Link>
          <Link href="/scanner" className="bot-nav-i">📱<span>Scanner</span></Link>
          <Link href="/family" className="bot-nav-i bot-nav-a">👨‍👩‍👧‍👦<span>Family</span></Link>
          <Link href="/trends" className="bot-nav-i">🔥<span>Trends</span></Link>
          <Link href="/wiki" className="bot-nav-i">📖<span>Wiki</span></Link>
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
    --r:12px;--rs:8px;
    --safe-top:env(safe-area-inset-top,0px);
    --safe-bottom:env(safe-area-inset-bottom,0px);
  }

  .fam-main{
    display:flex;flex-direction:column;height:100dvh;
    padding:var(--safe-top) 0 var(--safe-bottom) 0
  }
  .fam-top{
    display:flex;align-items:center;justify-content:space-between;
    padding:10px 16px;background:var(--surface);border-bottom:1px solid var(--border);
    flex-shrink:0;min-height:48px;gap:8px
  }
  .fam-back{font-size:20px;color:var(--accent);text-decoration:none;padding:4px}
  .fam-top-t{font-size:15px;font-weight:800}
  .fam-time{font-size:11px;color:var(--accent);font-weight:600;font-family:monospace}
  .fam-body{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:14px;-webkit-overflow-scrolling:touch}

  /* loading */
  .fam-load{text-align:center;color:var(--muted);padding:40px 0;font-size:13px}

  /* Cards */
  .fam-card{background:var(--card);border:1px solid var(--border);border-radius:var(--r);padding:16px}
  .fam-plan-title{font-size:18px;font-weight:800;margin-bottom:4px}
  .fam-plan-meta{font-size:11px;color:var(--muted);margin-bottom:12px}
  .fam-plan-actions{display:flex;gap:8px}
  .fam-pri-btn{
    padding:10px 18px;background:var(--accent);color:#050c07;border:none;
    border-radius:8px;font-weight:700;font-size:13px;font-family:inherit;cursor:pointer;transition:opacity .15s
  }
  .fam-pri-btn:active{opacity:.75}
  .fam-pri-btn:disabled{opacity:.35;cursor:default}
  .fam-full{width:100%}
  .fam-ghost-btn{
    padding:10px 16px;background:transparent;border:1px solid var(--border);
    color:var(--text2);border-radius:8px;font-size:12px;font-family:inherit;cursor:pointer
  }
  .fam-ghost-btn:active{background:rgba(255,61,61,.08);color:var(--danger);border-color:rgba(255,61,61,.2)}

  /* invite box */
  .fam-invite-box{
    margin-top:14px;padding:14px;background:rgba(0,230,118,.04);
    border:1px dashed rgba(0,230,118,.2);border-radius:10px;text-align:center
  }
  .fam-invite-label{font-size:10px;color:var(--muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:1px}
  .fam-invite-code{
    font-size:32px;font-family:'JetBrains Mono',monospace;font-weight:800;
    color:var(--accent);letter-spacing:10px;margin-bottom:4px
  }
  .fam-invite-hint{font-size:9px;color:var(--muted)}

  /* sections */
  .fam-section{margin-top:2px}
  .fam-sec-head{font-size:12px;font-weight:700;color:var(--text2);margin-bottom:10px;display:flex;align-items:center;gap:6px}

  /* members */
  .fam-members{display:flex;flex-direction:column;gap:8px}
  .fam-mem-card{
    display:flex;align-items:center;gap:12px;padding:12px;
    background:var(--card);border:1px solid var(--border);border-radius:var(--rs)
  }
  .fam-mem-avatar{
    width:44px;height:44px;border-radius:50%;background:rgba(0,230,118,.08);
    display:flex;align-items:center;justify-content:center;
    font-size:18px;font-weight:800;color:var(--accent);position:relative;flex-shrink:0
  }
  .fam-mem-badge{position:absolute;top:-4px;right:-4px;font-size:14px}
  .fam-mem-info{flex:1;min-width:0}
  .fam-mem-name{font-size:14px;font-weight:600;margin-bottom:2px}
  .fam-mem-phone{font-size:11px;color:var(--muted);font-family:monospace}
  .fam-mem-status{font-size:10px;font-weight:600;margin-top:3px}
  .fam-active{color:var(--accent)}
  .fam-inactive{color:var(--muted)}

  /* alerts timeline */
  .fam-empty{text-align:center;padding:24px;color:var(--muted);font-size:12px}
  .fam-timeline{display:flex;flex-direction:column;gap:8px}
  .fam-alert{
    padding:12px;background:var(--card);border:1px solid var(--border);
    border-left:3px solid var(--warn);border-radius:0 var(--rs) var(--rs) 0
  }
  .fam-alert-blocked{border-left-color:var(--danger)}
  .fam-alert-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px}
  .fam-alert-type{font-size:11px;font-weight:700;color:var(--text)}
  .fam-alert-score{font-size:10px;font-weight:600}
  .fam-score-blocked{color:var(--danger)}
  .fam-score-warn{color:var(--warn)}
  .fam-alert-mid{display:flex;align-items:center;gap:6px;font-size:11px;margin-bottom:4px}
  .fam-alert-elder{color:var(--accent);font-weight:600}
  .fam-alert-arrow{color:var(--muted)}
  .fam-alert-scammer{color:var(--danger);font-family:monospace}
  .fam-alert-time{font-size:9px;color:var(--muted)}

  /* blank state */
  .fam-blank{display:flex;flex-direction:column;align-items:center;gap:14px}
  .fam-blank-icon{font-size:48px;margin-top:20px}
  .fam-blank-title{font-size:22px;font-weight:800}
  .fam-blank-desc{font-size:12px;color:var(--muted);text-align:center;line-height:1.6;max-width:320px}
  .fam-subtitle{font-size:13px;font-weight:700;margin-bottom:10px}
  .fam-inp{
    width:100%;background:#050a05;border:1px solid var(--border);border-radius:8px;
    padding:11px 14px;color:var(--text);font-size:14px;font-family:inherit;outline:none
  }
  .fam-inp:focus{border-color:var(--accent)}
  .fam-code-inp{font-size:20px;font-family:'JetBrains Mono',monospace;text-transform:uppercase;letter-spacing:8px;text-align:center}
  .fam-err{
    background:rgba(255,61,61,.08);border:1px solid rgba(255,61,61,.2);
    border-radius:8px;padding:8px 12px;color:var(--danger);font-size:11px;margin-top:8px;display:flex;align-items:center;gap:6px
  }
  .fam-divider{display:flex;align-items:center;gap:12px;width:100%}
  .fam-divider::before,.fam-divider::after{content:'';flex:1;height:1px;background:var(--border)}
  .fam-divider span{font-size:10px;color:var(--muted)}

  /* bottom nav (shared with dashboard) */
  .bot-nav{
    display:flex;justify-content:space-around;align-items:center;
    background:var(--surface);border-top:1px solid var(--border);
    flex-shrink:0;min-height:56px;padding-bottom:var(--safe-bottom)
  }
  .bot-nav-i{display:flex;flex-direction:column;align-items:center;gap:3px;font-size:18px;color:var(--muted);padding:6px 0;text-decoration:none}
  .bot-nav-i span{font-size:9px;font-weight:500}
  .bot-nav-a,.bot-nav-i:active{color:var(--accent)}
`;
