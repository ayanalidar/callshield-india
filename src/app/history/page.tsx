'use client';

/**
 * CallShield Call History Page
 * Shows all lookups the authenticated user has made.
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth-provider';
import { useRouter } from 'next/navigation';
import { ReportModal, type ReportState } from '@/components/report-modal';

// ============================================================
// TYPES
// ============================================================

interface LookupRecord {
  id: number;
  phoneNumber: string;
  normalizedNumber: string;
  verdict: 'safe' | 'suspicious' | 'scam' | 'critical';
  threatScore: number;
  scamType: string | null;
  reported: boolean;
  blocked: boolean;
  whitelisted: boolean;
  createdAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

// ============================================================
// HELPERS
// ============================================================

const SCAM_TYPE_LABELS: Record<string, string> = {
  upi_fraud: 'UPI Fraud',
  bank_otp_scam: 'Bank OTP',
  it_department: 'IT Dept',
  insurance: 'Insurance',
  loan_app: 'Loan App',
  fedex_customs: 'FedEx/Customs',
  crypto: 'Crypto',
  lottery: 'Lottery',
  ecommerce: 'E-commerce',
  police_fake: 'Fake Police',
  aadhaar_kyc: 'Aadhaar KYC',
  electricity: 'Electricity',
  sextortion: 'Sextortion',
  wangiri: 'Wangiri',
  sms_phishing: 'SMS Phishing',
  job_scam: 'Fake Job',
  other: 'Scam',
};

const VERDICT_CONFIG: Record<string, { color: string; bg: string; icon: string; label: string }> = {
  safe: { color: '#00e676', bg: 'rgba(0,230,118,.1)', icon: 'fa-shield-halved', label: 'SAFE' },
  suspicious: { color: '#ffab40', bg: 'rgba(255,171,64,.1)', icon: 'fa-question-circle', label: 'SUSPICIOUS' },
  scam: { color: '#ff3d3d', bg: 'rgba(255,61,61,.1)', icon: 'fa-exclamation-triangle', label: 'SCAM' },
  critical: { color: '#ff3d3d', bg: 'rgba(255,61,61,.15)', icon: 'fa-skull', label: 'CRITICAL' },
};

function VerdictBadge({ verdict }: { verdict: string }) {
  const m = VERDICT_CONFIG[verdict] || VERDICT_CONFIG.safe;
  return (
    <span className="hv-badge" style={{ color: m.color, background: m.bg }}>
      <i className={`fas ${m.icon}`} /> {m.label}
    </span>
  );
}

function ThreatScoreBar({ score }: { score: number }) {
  const color = score >= 70 ? '#ff3d3d' : score >= 40 ? '#ffab40' : '#00e676';
  return (
    <div className="ht-bar-wrap">
      <div className="ht-bar-track">
        <div
          className="ht-bar-fill"
          style={{ width: `${score}%`, background: color }}
        />
      </div>
      <span className="ht-bar-label" style={{ color }}>{score}</span>
    </div>
  );
}

// ============================================================
// PAGE
// ============================================================

export default function HistoryPage() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const router = useRouter();

  const [lookups, setLookups] = useState<LookupRecord[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0, hasMore: false });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Report modal state
  const [reportModal, setReportModal] = useState<{ open: boolean; phoneNumber: string; scamType?: string }>({ open: false, phoneNumber: '' });

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace('/auth/login?redirect=/history');
    }
  }, [authLoading, isAuthenticated, router]);

  const fetchHistory = useCallback(async (page: number) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/history?page=${page}&limit=20`);
      if (!res.ok) {
        if (res.status === 401) {
          router.replace('/auth/login?redirect=/history');
          return;
        }
        throw new Error('Failed to fetch history');
      }
      const data = await res.json();
      setLookups(data.lookups);
      setPagination(data.pagination);
      setCurrentPage(page);
    } catch (err: any) {
      setError(err.message || 'Failed to load history');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchHistory(1);
    }
  }, [isAuthenticated, fetchHistory]);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffHours < 48) return 'Yesterday';

    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  const handleAction = async (action: string, lookupId: number, phoneNumber: string) => {
    if (action === 'report') {
      setReportModal({ open: true, phoneNumber });
      return;
    }

    try {
      const res = await fetch('/api/blocklist', {
        method: action === 'block' ? 'POST' : 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(action === 'block' ? { phoneNumber } : { id: lookupId }),
      });
      if (res.ok) {
        // Update local state
        setLookups(prev =>
          prev.map(l =>
            l.id === lookupId
              ? { ...l, blocked: action === 'block' ? true : l.blocked, whitelisted: action === 'whitelist' ? true : l.whitelisted }
              : l
          )
        );
      }
    } catch {}
  };

  const handleReported = (phoneNumber: string) => {
    // Update lookup record that matches this number
    setLookups(prev =>
      prev.map(l =>
        l.phoneNumber === phoneNumber ? { ...l, reported: true } : l
      )
    );
  };

  if (authLoading) {
    return (
      <>
        <style dangerouslySetInnerHTML={{ __html: HISTORY_STYLES }} />
        <div className="history-wrap">
          <div className="history-loading">
            <i className="fas fa-spinner fa-spin" /> Loading...
          </div>
        </div>
      </>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: HISTORY_STYLES }} />

      <div className="history-bg" />
      <div className="history-wrap">
        {/* Header */}
        <div className="history-header">
          <div className="history-header-left">
            <a href="/" className="history-back">
              <i className="fas fa-arrow-left" /> Dashboard
            </a>
            <h1>
              <i className="fas fa-history" /> Call History
            </h1>
          </div>
          <div className="history-header-right">
            <span className="history-user">
              <i className="fas fa-user-circle" /> {user?.phone ? `+91 ${user.phone.slice(0, 4)}...` : 'You'}
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="history-main">
          {/* Loading State */}
          {loading && (
            <div className="history-loading">
              <i className="fas fa-spinner fa-spin" /> Loading history...
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="history-error">
              <i className="fas fa-exclamation-circle" /> {error}
              <button onClick={() => fetchHistory(currentPage)} className="history-retry-btn">
                Try Again
              </button>
            </div>
          )}

          {/* Empty State */}
          {!loading && !error && lookups.length === 0 && (
            <div className="history-empty">
              <div className="history-empty-icon">
                <i className="fas fa-phone-slash" />
              </div>
              <h2>No lookups yet</h2>
              <p>When you check phone numbers on the dashboard, they&apos;ll appear here.</p>
              <a href="/" className="history-empty-btn">
                <i className="fas fa-search" /> Start Checking Numbers
              </a>
            </div>
          )}

          {/* History Table */}
          {!loading && !error && lookups.length > 0 && (
            <>
              <div className="history-count">
                <span className="history-count-num">{pagination.total}</span> total lookups
              </div>

              <div className="history-table-wrap">
                {/* Desktop table */}
                <table className="history-table desktop-only">
                  <thead>
                    <tr>
                      <th>Phone Number</th>
                      <th>Verdict</th>
                      <th>Threat Score</th>
                      <th>Scam Type</th>
                      <th>Time</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lookups.map((lookup) => (
                      <tr key={lookup.id}>
                        <td className="ht-phone">{lookup.phoneNumber}</td>
                        <td><VerdictBadge verdict={lookup.verdict} /></td>
                        <td><ThreatScoreBar score={lookup.threatScore} /></td>
                        <td className="ht-scam-type">
                          {lookup.scamType ? SCAM_TYPE_LABELS[lookup.scamType] || lookup.scamType : '—'}
                        </td>
                        <td className="ht-time" title={new Date(lookup.createdAt).toLocaleString()}>
                          {formatDate(lookup.createdAt)}<br />
                          <span className="ht-time-sub">{formatTime(lookup.createdAt)}</span>
                        </td>
                        <td>
                          <div className="ht-actions">
                            {!lookup.reported && lookup.verdict !== 'safe' && (
                              <button
                                className="ht-action-btn report"
                                title="Report as scam"
                                onClick={() => handleAction('report', lookup.id, lookup.phoneNumber)}
                              >
                                <i className="fas fa-flag" />
                              </button>
                            )}
                            {lookup.reported && (
                              <span className="ht-reported-badge" title="Reported">
                                <i className="fas fa-check-circle" />
                              </span>
                            )}
                            {!lookup.blocked && lookup.verdict !== 'safe' && (
                              <button
                                className="ht-action-btn block"
                                title="Block number"
                                onClick={() => handleAction('block', lookup.id, lookup.phoneNumber)}
                              >
                                <i className="fas fa-ban" />
                              </button>
                            )}
                            {lookup.blocked && (
                              <span className="ht-blocked-badge" title="Blocked">
                                <i className="fas fa-ban" style={{ color: 'var(--danger)' }} />
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Mobile cards */}
                <div className="history-cards mobile-only">
                  {lookups.map((lookup) => (
                    <div key={lookup.id} className="history-card">
                      <div className="hc-top">
                        <div className="hc-phone">{lookup.phoneNumber}</div>
                        <VerdictBadge verdict={lookup.verdict} />
                      </div>
                      <div className="hc-meta">
                        <div className="hc-meta-item">
                          <span className="hc-label">Threat</span>
                          <span className="hc-value">
                            <ThreatScoreBar score={lookup.threatScore} />
                          </span>
                        </div>
                        <div className="hc-meta-item">
                          <span className="hc-label">Type</span>
                          <span className="hc-value">
                            {lookup.scamType ? SCAM_TYPE_LABELS[lookup.scamType] || lookup.scamType : '—'}
                          </span>
                        </div>
                        <div className="hc-meta-item">
                          <span className="hc-label">When</span>
                          <span className="hc-value">{formatDate(lookup.createdAt)}</span>
                        </div>
                      </div>
                      <div className="hc-actions">
                        {!lookup.reported && lookup.verdict !== 'safe' && (
                          <button
                            className="ht-action-btn report"
                            onClick={() => handleAction('report', lookup.id, lookup.phoneNumber)}
                          >
                            <i className="fas fa-flag" /> Report
                          </button>
                        )}
                        {lookup.reported && (
                          <span className="ht-reported-badge">
                            <i className="fas fa-check-circle" /> Reported
                          </span>
                        )}
                        {!lookup.blocked && lookup.verdict !== 'safe' && (
                          <button
                            className="ht-action-btn block"
                            onClick={() => handleAction('block', lookup.id, lookup.phoneNumber)}
                          >
                            <i className="fas fa-ban" /> Block
                          </button>
                        )}
                        {lookup.blocked && (
                          <span className="ht-blocked-badge">
                            <i className="fas fa-ban" style={{ color: 'var(--danger)' }} /> Blocked
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="history-pagination">
                  <button
                    className="hp-btn"
                    disabled={currentPage <= 1}
                    onClick={() => fetchHistory(currentPage - 1)}
                  >
                    <i className="fas fa-chevron-left" /> Previous
                  </button>
                  <div className="hp-info">
                    Page {currentPage} of {pagination.totalPages}
                  </div>
                  <button
                    className="hp-btn"
                    disabled={!pagination.hasMore}
                    onClick={() => fetchHistory(currentPage + 1)}
                  >
                    Next <i className="fas fa-chevron-right" />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Report Modal */}
      <ReportModal
        isOpen={reportModal.open}
        phoneNumber={reportModal.phoneNumber}
        initialScamType={reportModal.scamType}
        onClose={() => setReportModal({ open: false, phoneNumber: '' })}
        onReported={handleReported}
      />
    </>
  );
}

// ============================================================
// STYLES
// ============================================================

const HISTORY_STYLES = `
:root{--bg:#050c07;--bg2:#091410;--card:#0d1c14;--border:#1a3326;--accent:#00e676;--ad:rgba(0,230,118,.1);--ag:rgba(0,230,118,.25);--danger:#ff3d3d;--dd:rgba(255,61,61,.1);--warn:#ffab40;--wd:rgba(255,171,64,.1);--fg:#e0f2e9;--fg2:#a5c4b5;--muted:#4a6b58;--r:14px;--rs:8px}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Space Grotesk',sans-serif;background:var(--bg);color:var(--fg);min-height:100vh}
::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:var(--bg2)}::-webkit-scrollbar-thumb{background:var(--border)}

.history-bg{position:fixed;inset:0;background:radial-gradient(ellipse 600px 350px at 50% 10%,rgba(0,230,118,.04),transparent 60%);pointer-events:none}
.history-wrap{position:relative;z-index:1;min-height:100vh;padding:0}

/* Header */
.history-header{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid var(--border);background:rgba(5,12,7,.92);backdrop-filter:blur(12px);position:sticky;top:0;z-index:10;flex-wrap:wrap;gap:10px}
.history-header-left{display:flex;align-items:center;gap:14px}
.history-back{color:var(--muted);text-decoration:none;font-size:10px;display:flex;align-items:center;gap:4px;transition:color .2s}
.history-back:hover{color:var(--fg2)}
.history-header h1{font-size:18px;font-weight:700;display:flex;align-items:center;gap:8px}
.history-header h1 i{color:var(--accent)}
.history-header-right{display:flex;align-items:center;gap:12px}
.history-user{font-size:10px;color:var(--fg2);display:flex;align-items:center;gap:5px}

/* Main */
.history-main{padding:20px;max-width:960px;margin:0 auto}

/* Loading / Error / Empty */
.history-loading{padding:60px 20px;text-align:center;color:var(--muted);font-size:12px;display:flex;align-items:center;justify-content:center;gap:8px}
.history-loading i{font-size:14px}
.history-error{padding:20px;text-align:center;background:var(--dd);border:1px solid rgba(255,61,61,.15);border-radius:var(--r);color:var(--danger);font-size:11px;display:flex;flex-direction:column;align-items:center;gap:10px}
.history-retry-btn{background:var(--card);border:1px solid var(--border);color:var(--fg);padding:6px 14px;border-radius:var(--rs);font-family:inherit;font-size:10px;cursor:pointer}
.history-empty{padding:80px 20px;text-align:center}
.history-empty-icon{width:64px;height:64px;border-radius:50%;background:var(--ad);display:flex;align-items:center;justify-content:center;margin:0 auto 20px;font-size:24px;color:var(--accent)}
.history-empty h2{font-size:18px;font-weight:700;margin-bottom:6px}
.history-empty p{font-size:11px;color:var(--muted);margin-bottom:20px;max-width:300px;margin-left:auto;margin-right:auto;line-height:1.6}
.history-empty-btn{display:inline-flex;align-items:center;gap:6px;padding:10px 20px;background:var(--accent);color:var(--bg);text-decoration:none;border-radius:var(--rs);font-size:11px;font-weight:700;transition:opacity .2s}
.history-empty-btn:hover{opacity:.85}

/* Count */
.history-count{font-size:10px;color:var(--muted);margin-bottom:12px}
.history-count-num{color:var(--fg2);font-weight:700}

/* Table */
.history-table-wrap{background:var(--card);border:1px solid var(--border);border-radius:var(--r);overflow:hidden}
.history-table{width:100%;border-collapse:collapse}
.history-table th{padding:10px 14px;font-size:9px;font-weight:600;color:var(--muted);text-align:left;text-transform:uppercase;letter-spacing:.5px;border-bottom:1px solid var(--border);background:var(--bg2)}
.history-table td{padding:12px 14px;font-size:11px;border-bottom:1px solid rgba(26,51,38,.5);vertical-align:middle}
.history-table tr:last-child td{border-bottom:none}
.history-table tr:hover td{background:rgba(0,230,118,.02)}

.desktop-only{display:table}
.mobile-only{display:none}
@media(max-width:700px){.desktop-only{display:none}.mobile-only{display:block}}

.ht-phone{font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:500}
.ht-scam-type{color:var(--fg2);font-size:10px}
.ht-time{color:var(--fg2);font-size:10px;white-space:nowrap}
.ht-time-sub{font-size:8px;color:var(--muted)}

/* Verdict Badge */
.hv-badge{padding:3px 9px;border-radius:5px;font-size:9px;font-weight:700;display:inline-flex;align-items:center;gap:4px;white-space:nowrap}

/* Threat bar */
.ht-bar-wrap{display:flex;align-items:center;gap:8px;min-width:70px}
.ht-bar-track{flex:1;height:4px;background:rgba(255,255,255,.06);border-radius:2px;overflow:hidden;min-width:40px}
.ht-bar-fill{height:100%;border-radius:2px;transition:width .3s}
.ht-bar-label{font-family:'JetBrains Mono',monospace;font-size:10px;font-weight:600;min-width:22px}

/* Actions */
.ht-actions{display:flex;gap:6px;align-items:center}
.ht-action-btn{width:28px;height:28px;border-radius:6px;border:1px solid var(--border);background:var(--bg2);display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:11px;transition:all .2s}
.ht-action-btn.report:hover{background:rgba(255,171,64,.1);border-color:var(--warn);color:var(--warn)}
.ht-action-btn.block:hover{background:var(--dd);border-color:var(--danger);color:var(--danger)}
.ht-reported-badge{font-size:9px;color:var(--accent);display:flex;align-items:center;gap:3px}
.ht-blocked-badge{font-size:9px;color:var(--danger);display:flex;align-items:center;gap:3px}

/* Mobile Cards */
.history-cards{display:flex;flex-direction:column;gap:8px}
.history-card{background:var(--card);border:1px solid var(--border);border-radius:var(--r);padding:14px}
.hc-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}
.hc-phone{font-family:'JetBrains Mono',monospace;font-size:13px;font-weight:600}
.hc-meta{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:10px}
.hc-meta-item{display:flex;flex-direction:column;gap:2px}
.hc-label{font-size:8px;color:var(--muted);text-transform:uppercase}
.hc-value{font-size:10px;color:var(--fg2)}
.hc-actions{display:flex;gap:8px;border-top:1px solid var(--border);padding-top:10px}
.hc-actions .ht-action-btn{width:auto;height:auto;padding:5px 12px;font-size:10px;border-radius:var(--rs);gap:4px}

/* Pagination */
.history-pagination{display:flex;align-items:center;justify-content:center;gap:16px;padding:20px 0}
.hp-btn{display:flex;align-items:center;gap:5px;padding:8px 16px;background:var(--card);border:1px solid var(--border);border-radius:var(--rs);color:var(--fg2);font-family:inherit;font-size:10px;cursor:pointer;transition:all .2s}
.hp-btn:hover:not(:disabled){border-color:var(--accent);color:var(--accent)}
.hp-btn:disabled{opacity:.3;cursor:not-allowed}
.hp-info{font-size:10px;color:var(--muted)}
`;
