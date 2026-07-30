'use client';

import { useState, useEffect, useCallback } from 'react';

// ============================================================
// TYPES
// ============================================================

interface ScamEntry {
  id: number;
  phoneNumber: string;
  normalizedNumber: string;
  scamType: string;
  severity: string;
  threatScore: number;
  telecomCircle: string | null;
  carrier: string | null;
  numberType: string | null;
  isVoip: boolean;
  reportCount: number;
  recentReportCount: number;
  verified: boolean;
  verifiedBy: string | null;
  source: string;
  firstReportedAt: string | null;
  lastReportedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface AdminStats {
  totalScams: number;
  verifiedCount: number;
  verifiedPercent: number;
  reportsToday: number;
}

interface FetchResult {
  items: ScamEntry[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  stats: AdminStats;
}

const SCAM_TYPES = [
  '', 'upi_fraud', 'bank_otp_scam', 'it_dept_impersonation', 'insurance_scam',
  'loan_app_harassment', 'fedex_customs_scam', 'crypto_scam', 'lottery_scam',
  'ecommerce_fraud', 'police_fake', 'aadhaar_kyc_scam', 'electricity_bill_scam',
  'job_scam', 'romance_scam', 'tech_support_scam', 'other',
];

const SEVERITIES = ['', 'low', 'medium', 'high', 'critical'];

function formatLabel(s: string) {
  return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function formatDate(s: string | null) {
  if (!s) return '—';
  const d = new Date(s);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function timeAgo(s: string | null) {
  if (!s) return '—';
  const diff = Date.now() - new Date(s).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

// ============================================================
// COMPONENTS
// ============================================================

function StatCard({ value, label, icon, color }: {
  value: string | number; label: string; icon: string; color: string;
}) {
  return (
    <div className="asc" style={{ borderTop: `2px solid var(--${color})` }}>
      <div className="asc-icon" style={{ color: `var(--${color})` }}>
        <i className={`fas ${icon}`} />
      </div>
      <div className="asc-val">{value}</div>
      <div className="asc-lbl">{label}</div>
    </div>
  );
}

function TableHeader({ label, sortable, active, dir, onClick }: {
  label: string; sortable?: boolean; active?: boolean; dir?: string; onClick?: () => void;
}) {
  return (
    <th onClick={sortable ? onClick : undefined} style={{ cursor: sortable ? 'pointer' : 'default' }}>
      {label}
      {sortable && active && <i className={`fas fa-sort-${dir || 'down'} adh-sort`} />}
    </th>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const colors: Record<string, string> = {
    low: 'var(--ad)', medium: 'var(--wd)', high: 'var(--dd)', critical: 'var(--dd)',
  };
  const fg: Record<string, string> = {
    low: 'var(--accent)', medium: 'var(--warn)', high: 'var(--danger)', critical: 'var(--danger)',
  };
  return (
    <span className="asb" style={{ background: colors[severity] || 'var(--ad)', color: fg[severity] || 'var(--fg2)' }}>
      {severity.toUpperCase()}
    </span>
  );
}

// ============================================================
// PAGE
// ============================================================

export default function AdminDashboard() {
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');

  const [data, setData] = useState<FetchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Filters
  const [page, setPage] = useState(1);
  const [phoneFilter, setPhoneFilter] = useState('');
  const [scamTypeFilter, setScamTypeFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [verifiedFilter, setVerifiedFilter] = useState('');

  // Edit modal
  const [editEntry, setEditEntry] = useState<ScamEntry | null>(null);
  const [editScore, setEditScore] = useState(0);
  const [editSeverity, setEditSeverity] = useState('');

  // Delete confirmation
  const [deleteEntry, setDeleteEntry] = useState<ScamEntry | null>(null);

  // Toast
  const [toast, setToast] = useState('');

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }, []);

  // Auth
  const handleAuth = () => {
    if (password === 'callshield_admin_2024') {
      sessionStorage.setItem('callshield_admin', 'true');
      setAuthed(true);
      setAuthError('');
    } else {
      setAuthError('Invalid admin password');
    }
  };

  useEffect(() => {
    if (sessionStorage.getItem('callshield_admin') === 'true') {
      setAuthed(true);
    }
  }, []);

  // Fetch data
  const fetchData = useCallback(async () => {
    if (!authed) return;
    setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', '15');
      if (phoneFilter) params.set('phone', phoneFilter);
      if (scamTypeFilter) params.set('scam_type', scamTypeFilter);
      if (severityFilter) params.set('severity', severityFilter);
      if (verifiedFilter) params.set('verified', verifiedFilter);

      const res = await fetch(`/api/admin/scam-numbers?${params.toString()}`, {
        headers: { 'x-admin-key': 'callshield_admin_2024' },
      });
      const json = await res.json();
      if (json.error) {
        setError(json.error);
      } else {
        setData(json);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [authed, page, phoneFilter, scamTypeFilter, severityFilter, verifiedFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Search debounce
  const handleSearch = () => {
    setPage(1);
    fetchData();
  };

  // Actions
  const handleVerify = async (entry: ScamEntry) => {
    try {
      const res = await fetch('/api/admin/scam-numbers', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': 'callshield_admin_2024',
        },
        body: JSON.stringify({ id: entry.id, verified: !entry.verified, verifiedBy: 'admin' }),
      });
      const json = await res.json();
      if (json.success) {
        showToast(`${entry.phoneNumber} ${entry.verified ? 'unverified' : 'verified'}`);
        fetchData();
      } else {
        showToast(`Error: ${json.error}`);
      }
    } catch (e: any) {
      showToast(`Failed: ${e.message}`);
    }
  };

  const handleEditSubmit = async () => {
    if (!editEntry) return;
    try {
      const res = await fetch('/api/admin/scam-numbers', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': 'callshield_admin_2024',
        },
        body: JSON.stringify({
          id: editEntry.id,
          threatScore: editScore,
          verified: editEntry.verified,
        }),
      });
      const json = await res.json();
      if (json.success) {
        showToast(`Updated ${editEntry.phoneNumber}: score=${editScore}`);
        setEditEntry(null);
        fetchData();
      } else {
        showToast(`Error: ${json.error}`);
      }
    } catch (e: any) {
      showToast(`Failed: ${e.message}`);
    }
  };

  const handleDelete = async () => {
    if (!deleteEntry) return;
    try {
      const res = await fetch(`/api/admin/scam-numbers?id=${deleteEntry.id}`, {
        method: 'DELETE',
        headers: { 'x-admin-key': 'callshield_admin_2024' },
      });
      const json = await res.json();
      if (json.success) {
        showToast(`Deleted ${deleteEntry.phoneNumber}`);
        setDeleteEntry(null);
        fetchData();
      } else {
        showToast(`Error: ${json.error}`);
      }
    } catch (e: any) {
      showToast(`Failed: ${e.message}`);
    }
  };

  // =============== AUTH GATE ===============
  if (!authed) {
    return (
      <>
        <style dangerouslySetInnerHTML={{ __html: ADMIN_STYLES }} />
        <div className="admin-auth">
          <div className="admin-auth-card">
            <div className="admin-auth-icon">
              <i className="fas fa-shield-halved" />
            </div>
            <h1>Admin Access</h1>
            <p>Enter admin password to manage the scam database</p>
            <input
              type="password"
              className="admin-auth-input"
              placeholder="Admin password"
              value={password}
              onChange={e => { setPassword(e.target.value); setAuthError(''); }}
              onKeyDown={e => e.key === 'Enter' && handleAuth()}
              autoFocus
            />
            {authError && <div className="admin-auth-error">{authError}</div>}
            <button className="admin-auth-btn" onClick={handleAuth}>
              <i className="fas fa-lock-open" /> Unlock Dashboard
            </button>
          </div>
        </div>
      </>
    );
  }

  // =============== ADMIN DASHBOARD ===============
  const stats = data?.stats || { totalScams: 0, verifiedCount: 0, verifiedPercent: 0, reportsToday: 0 };
  const items = data?.items || [];

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: ADMIN_STYLES }} />
      <div className="admin-wrap">
        {/* Header */}
        <header className="admin-header">
          <div className="admin-header-left">
            <h1>
              <i className="fas fa-shield-halved" style={{ color: 'var(--accent)', marginRight: 8 }} />
              CallShield Admin
            </h1>
            <span className="admin-badge">Scam Database Management</span>
          </div>
          <div className="admin-header-right">
            <button className="admin-btn admin-btn-outline" onClick={() => {
              sessionStorage.removeItem('callshield_admin');
              setAuthed(false);
            }}>
              <i className="fas fa-sign-out-alt" /> Lock
            </button>
            <a href="/" className="admin-btn admin-btn-outline" style={{ textDecoration: 'none' }}>
              <i className="fas fa-arrow-left" /> Dashboard
            </a>
            <a href="/landing" className="admin-btn admin-btn-outline" style={{ textDecoration: 'none' }}>
              <i className="fas fa-globe" /> Landing
            </a>
          </div>
        </header>

        {/* Stats */}
        <div className="admin-stats">
          <StatCard value={stats.totalScams} label="Total Scams" icon="fa-database" color="accent" />
          <StatCard value={`${stats.verifiedPercent}%`} label="Verified" icon="fa-check-circle" color="info" />
          <StatCard value={stats.reportsToday} label="Reports Today" icon="fa-calendar-day" color="warn" />
          <StatCard value={stats.verifiedCount} label="Total Verified" icon="fa-badge-check" color="accent" />
        </div>

        {/* Filters */}
        <div className="admin-filters">
          <div className="admin-filter-group">
            <i className="fas fa-search admin-filter-icon" />
            <input
              type="text"
              className="admin-filter-input"
              placeholder="Search by phone number..."
              value={phoneFilter}
              onChange={e => setPhoneFilter(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
            />
          </div>
          <select className="admin-filter-select" value={scamTypeFilter} onChange={e => { setScamTypeFilter(e.target.value); setPage(1); }}>
            <option value="">All Types</option>
            {SCAM_TYPES.slice(1).map(t => (
              <option key={t} value={t}>{formatLabel(t)}</option>
            ))}
          </select>
          <select className="admin-filter-select" value={severityFilter} onChange={e => { setSeverityFilter(e.target.value); setPage(1); }}>
            <option value="">All Severities</option>
            {SEVERITIES.slice(1).map(s => (
              <option key={s} value={s}>{s.toUpperCase()}</option>
            ))}
          </select>
          <select className="admin-filter-select" value={verifiedFilter} onChange={e => { setVerifiedFilter(e.target.value); setPage(1); }}>
            <option value="">All Status</option>
            <option value="true">Verified</option>
            <option value="false">Unverified</option>
          </select>
          <button className="admin-btn admin-btn-primary" onClick={handleSearch}>
            <i className="fas fa-filter" /> Filter
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="admin-error">
            <i className="fas fa-exclamation-triangle" /> {error}
          </div>
        )}

        {/* Table */}
        <div className="admin-table-wrap">
          {loading ? (
            <div className="admin-loading">
              <i className="fas fa-spinner fa-spin" /> Loading...
            </div>
          ) : items.length === 0 ? (
            <div className="admin-empty">
              <i className="fas fa-inbox" style={{ fontSize: 32, display: 'block', marginBottom: 8 }} />
              No scam numbers found
            </div>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Phone Number</th>
                  <th>Type</th>
                  <th>Severity</th>
                  <th>Score</th>
                  <th>Reports</th>
                  <th>Status</th>
                  <th>Last Seen</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((entry, idx) => (
                  <tr key={entry.id}>
                    <td className="admin-td-id">{(data!.page - 1) * data!.limit + idx + 1}</td>
                    <td>
                      <div className="admin-td-phone">{entry.phoneNumber}</div>
                      <div className="admin-td-meta">
                        {entry.carrier && `${entry.carrier} · `}
                        {entry.telecomCircle || '—'}
                        {entry.isVoip && ' · VoIP'}
                      </div>
                    </td>
                    <td>
                      <span className="admin-td-type">{formatLabel(entry.scamType)}</span>
                    </td>
                    <td><SeverityBadge severity={entry.severity} /></td>
                    <td>
                      <span className={`admin-td-score ${entry.threatScore >= 80 ? 'score-danger' : entry.threatScore >= 50 ? 'score-warn' : ''}`}>
                        {entry.threatScore}
                      </span>
                    </td>
                    <td>
                      <span className="admin-td-reports">{entry.reportCount}</span>
                      {entry.recentReportCount > 0 && (
                        <span className="admin-td-recent">+{entry.recentReportCount} recent</span>
                      )}
                    </td>
                    <td>
                      <span className={`admin-status ${entry.verified ? 'verified' : 'unverified'}`}>
                        <i className={`fas ${entry.verified ? 'fa-check-circle' : 'fa-clock'}`} />
                        {entry.verified ? 'Verified' : 'Pending'}
                      </span>
                    </td>
                    <td className="admin-td-date">{timeAgo(entry.lastReportedAt)}</td>
                    <td>
                      <div className="admin-actions">
                        <button
                          className="admin-action-btn"
                          title={entry.verified ? 'Unverify' : 'Verify'}
                          onClick={() => handleVerify(entry)}
                        >
                          <i className={`fas ${entry.verified ? 'fa-rotate-left' : 'fa-check'}`} />
                        </button>
                        <button
                          className="admin-action-btn"
                          title="Edit Score"
                          onClick={() => { setEditEntry(entry); setEditScore(entry.threatScore); setEditSeverity(entry.severity); }}
                        >
                          <i className="fas fa-pen" />
                        </button>
                        <button
                          className="admin-action-btn danger"
                          title="Delete"
                          onClick={() => setDeleteEntry(entry)}
                        >
                          <i className="fas fa-trash-alt" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {data && data.totalPages > 1 && (
          <div className="admin-pagination">
            <button
              className="admin-btn admin-btn-outline"
              disabled={page <= 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
            >
              <i className="fas fa-chevron-left" /> Prev
            </button>
            <span className="admin-pagination-info">
              Page {data.page} of {data.totalPages} ({data.total} total)
            </span>
            <button
              className="admin-btn admin-btn-outline"
              disabled={page >= data.totalPages}
              onClick={() => setPage(p => Math.min(data.totalPages, p + 1))}
            >
              Next <i className="fas fa-chevron-right" />
            </button>
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className="admin-toast">
          <i className="fas fa-check-circle" /> {toast}
        </div>
      )}

      {/* Edit Modal */}
      {editEntry && (
        <div className="admin-modal" onClick={e => { if (e.target === e.currentTarget) setEditEntry(null); }}>
          <div className="admin-modal-card">
            <h2>Edit Threat Score</h2>
            <div className="admin-modal-phone">{editEntry.phoneNumber}</div>
            <label>Threat Score (0-100)</label>
            <input
              type="number"
              min={0}
              max={100}
              value={editScore}
              onChange={e => setEditScore(Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
              className="admin-modal-input"
            />
            <div className="admin-modal-range">
              <input
                type="range"
                min={0}
                max={100}
                value={editScore}
                onChange={e => setEditScore(parseInt(e.target.value))}
                className="admin-modal-slider"
              />
              <span className="admin-modal-score">{editScore}/100</span>
            </div>
            <div className="admin-modal-actions">
              <button className="admin-btn admin-btn-outline" onClick={() => setEditEntry(null)}>Cancel</button>
              <button className="admin-btn admin-btn-primary" onClick={handleEditSubmit}>Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {deleteEntry && (
        <div className="admin-modal" onClick={e => { if (e.target === e.currentTarget) setDeleteEntry(null); }}>
          <div className="admin-modal-card">
            <h2>Confirm Delete</h2>
            <div className="admin-modal-phone">{deleteEntry.phoneNumber}</div>
            <p className="admin-modal-warn">
              This will permanently remove this number from the scam database. This action cannot be undone.
            </p>
            <div className="admin-modal-actions">
              <button className="admin-btn admin-btn-outline" onClick={() => setDeleteEntry(null)}>Cancel</button>
              <button className="admin-btn admin-btn-danger" onClick={handleDelete}>
                <i className="fas fa-trash-alt" /> Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ============================================================
// STYLES
// ============================================================

const ADMIN_STYLES = `
:root{--bg:#050c07;--bg2:#091410;--card:#0d1c14;--border:#1a3326;--accent:#00e676;--ad:rgba(0,230,118,.1);--ag:rgba(0,230,118,.25);--danger:#ff3d3d;--dd:rgba(255,61,61,.1);--warn:#ffab40;--wd:rgba(255,171,64,.1);--info:#40c4ff;--id:rgba(64,196,255,.1);--fg:#e0f2e9;--fg2:#a5c4b5;--muted:#4a6b58;--r:14px;--rs:8px}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Space Grotesk',sans-serif;background:var(--bg);color:var(--fg);min-height:100vh}
::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:var(--bg2)}::-webkit-scrollbar-thumb{background:var(--border);border-radius:2px}

/* Auth Gate */
.admin-auth{display:flex;align-items:center;justify-content:center;min-height:100vh;padding:20px}
.admin-auth-card{background:var(--card);border:1px solid var(--border);border-radius:var(--r);padding:40px 30px;text-align:center;max-width:400px;width:100%}
.admin-auth-icon{width:60px;height:60px;border-radius:50%;background:var(--ad);display:flex;align-items:center;justify-content:center;margin:0 auto 16px;font-size:24px;color:var(--accent)}
.admin-auth-card h1{font-size:20px;font-weight:800;margin-bottom:6px}
.admin-auth-card p{font-size:11px;color:var(--muted);margin-bottom:20px}
.admin-auth-input{width:100%;padding:12px;background:var(--bg2);border:1px solid var(--border);border-radius:var(--rs);color:var(--fg);font-family:'JetBrains Mono',monospace;font-size:14px;outline:none;text-align:center;letter-spacing:2px;transition:border-color .2s}
.admin-auth-input:focus{border-color:var(--accent)}
.admin-auth-input::placeholder{color:var(--muted);letter-spacing:0}
.admin-auth-error{color:var(--danger);font-size:10px;margin-top:8px}
.admin-auth-btn{width:100%;margin-top:14px;padding:12px;background:var(--accent);color:var(--bg);border:none;border-radius:var(--rs);font-family:inherit;font-size:12px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;transition:opacity .2s}
.admin-auth-btn:hover{opacity:.85}

/* Layout */
.admin-wrap{max-width:1200px;margin:0 auto;padding:20px 16px 40px}

/* Header */
.admin-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;padding:16px 20px;background:var(--card);border:1px solid var(--border);border-radius:var(--r);flex-wrap:wrap;gap:12px}
.admin-header-left h1{font-size:18px;font-weight:800;display:flex;align-items:center}
.admin-badge{font-size:9px;color:var(--muted);font-weight:500;margin-top:2px;display:block}
.admin-header-right{display:flex;gap:6px}

/* Buttons */
.admin-btn{padding:8px 14px;border-radius:var(--rs);font-family:inherit;font-size:10px;font-weight:600;cursor:pointer;transition:all .2s;display:flex;align-items:center;gap:5px;border:1px solid transparent}
.admin-btn:disabled{opacity:.4;cursor:not-allowed}
.admin-btn-primary{background:var(--accent);color:var(--bg);border-color:var(--accent)}
.admin-btn-primary:hover{opacity:.85}
.admin-btn-outline{background:transparent;border:1px solid var(--border);color:var(--fg2)}
.admin-btn-outline:hover{border-color:var(--accent);color:var(--accent)}
.admin-btn-danger{background:var(--danger);color:#fff;border-color:var(--danger)}
.admin-btn-danger:hover{opacity:.85}

/* Stats */
.admin-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px}
@media(max-width:768px){.admin-stats{grid-template-columns:repeat(2,1fr)}}
.asc{background:var(--card);border:1px solid var(--border);border-radius:var(--r);padding:16px;text-align:center}
.asc-icon{font-size:18px;margin-bottom:6px}
.asc-val{font-size:22px;font-weight:800;font-family:'JetBrains Mono',monospace}
.asc-lbl{font-size:9px;color:var(--muted);margin-top:2px;font-weight:500}

/* Filters */
.admin-filters{display:flex;gap:8px;margin-bottom:14px;align-items:center;flex-wrap:wrap}
.admin-filter-group{position:relative;flex:1;min-width:180px}
.admin-filter-icon{position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--muted);font-size:11px}
.admin-filter-input{width:100%;padding:8px 10px 8px 30px;background:var(--card);border:1px solid var(--border);border-radius:var(--rs);color:var(--fg);font-family:'JetBrains Mono',monospace;font-size:11px;outline:none;transition:border-color .2s}
.admin-filter-input:focus{border-color:var(--accent)}
.admin-filter-input::placeholder{color:var(--muted)}
.admin-filter-select{padding:8px 10px;background:var(--card);border:1px solid var(--border);border-radius:var(--rs);color:var(--fg);font-family:inherit;font-size:10px;outline:none;cursor:pointer;min-width:110px}
.admin-filter-select:focus{border-color:var(--accent)}

/* Table */
.admin-table-wrap{background:var(--card);border:1px solid var(--border);border-radius:var(--r);overflow-x:auto}
.admin-table{width:100%;border-collapse:collapse;font-size:10px}
.admin-table th{text-align:left;padding:10px 12px;background:var(--bg2);color:var(--muted);font-weight:600;font-size:9px;text-transform:uppercase;letter-spacing:.5px;border-bottom:1px solid var(--border);white-space:nowrap}
.admin-table td{padding:10px 12px;border-bottom:1px solid var(--border);vertical-align:middle}
.admin-table tbody tr:hover{background:var(--ad)}
.admin-table tbody tr:last-child td{border-bottom:none}
.admin-td-id{color:var(--muted);font-family:'JetBrains Mono',monospace;font-size:9px;width:40px}
.admin-td-phone{font-family:'JetBrains Mono',monospace;font-weight:600;font-size:11px}
.admin-td-meta{font-size:8px;color:var(--muted);margin-top:1px}
.admin-td-type{font-size:9px;color:var(--fg2);background:var(--ad);padding:2px 6px;border-radius:4px;white-space:nowrap}
.asb{font-size:8px;font-weight:700;padding:2px 6px;border-radius:4px;white-space:nowrap}
.admin-td-score{font-family:'JetBrains Mono',monospace;font-weight:700;font-size:11px;color:var(--accent)}
.admin-td-score.score-warn{color:var(--warn)}
.admin-td-score.score-danger{color:var(--danger)}
.admin-td-reports{font-family:'JetBrains Mono',monospace;font-weight:600}
.admin-td-recent{display:block;font-size:8px;color:var(--warn);margin-top:1px}
.admin-status{font-size:8px;font-weight:600;display:flex;align-items:center;gap:4px;white-space:nowrap}
.admin-status.verified{color:var(--accent)}
.admin-status.unverified{color:var(--warn)}
.admin-td-date{color:var(--muted);font-size:9px;white-space:nowrap}
.admin-actions{display:flex;gap:3px}
.admin-action-btn{width:28px;height:28px;border-radius:5px;border:1px solid var(--border);background:var(--bg2);color:var(--fg2);display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:10px;transition:all .2s}
.admin-action-btn:hover{border-color:var(--accent);color:var(--accent);background:var(--ad)}
.admin-action-btn.danger:hover{border-color:var(--danger);color:var(--danger);background:var(--dd)}

/* Loading / Empty */
.admin-loading,.admin-empty{text-align:center;padding:40px 20px;color:var(--muted);font-size:12px}

/* Error */
.admin-error{background:var(--dd);border:1px solid rgba(255,61,61,.2);border-radius:var(--rs);padding:10px 14px;color:var(--danger);font-size:10px;display:flex;align-items:center;gap:6px;margin-bottom:14px}

/* Pagination */
.admin-pagination{display:flex;align-items:center;justify-content:center;gap:12px;margin-top:14px}
.admin-pagination-info{font-size:10px;color:var(--muted);font-family:'JetBrains Mono',monospace}

/* Toast */
.admin-toast{position:fixed;bottom:30px;left:50%;transform:translateX(-50%);z-index:9999;padding:10px 20px;background:var(--card);border:1px solid var(--border);border-left:3px solid var(--accent);border-radius:var(--rs);font-size:11px;font-weight:500;display:flex;align-items:center;gap:7px;box-shadow:0 6px 24px rgba(0,0,0,.5);animation:ti .35s ease}
@keyframes ti{from{opacity:0;transform:translateX(-50%) translateY(16px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
.admin-toast i{color:var(--accent)}

/* Modals */
.admin-modal{position:fixed;inset:0;background:rgba(0,0,0,.6);backdrop-filter:blur(4px);z-index:9000;display:flex;align-items:center;justify-content:center;padding:20px}
.admin-modal-card{background:var(--card);border:1px solid var(--border);border-radius:var(--r);padding:24px;max-width:420px;width:100%}
.admin-modal-card h2{font-size:14px;margin-bottom:6px}
.admin-modal-phone{font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--fg2);margin-bottom:14px;padding:6px 10px;background:var(--bg2);border-radius:6px}
.admin-modal-card label{font-size:10px;color:var(--muted);display:block;margin-bottom:6px}
.admin-modal-input{width:100%;padding:10px 12px;background:var(--bg2);border:1px solid var(--border);border-radius:var(--rs);color:var(--fg);font-family:'JetBrains Mono',monospace;font-size:16px;outline:none;text-align:center;font-weight:700;margin-bottom:8px}
.admin-modal-input:focus{border-color:var(--accent)}
.admin-modal-range{display:flex;align-items:center;gap:10px;margin-bottom:16px}
.admin-modal-slider{flex:1;accent-color:var(--accent)}
.admin-modal-score{font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:700;min-width:50px;text-align:right}
.admin-modal-warn{font-size:10px;color:var(--danger);margin:10px 0 16px;line-height:1.6}
.admin-modal-actions{display:flex;gap:8px;justify-content:flex-end}
`;
