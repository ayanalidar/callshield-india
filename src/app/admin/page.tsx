'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

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
  activeThreats: number;
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

function formatDate(s: string | null) {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ============================================================
// SUB-COMPONENTS
// ============================================================

function SeverityBadge({ severity }: { severity: string }) {
  const map: Record<string, { bg: string; fg: string }> = {
    low:      { bg: 'var(--ad)',   fg: 'var(--accent)' },
    medium:   { bg: 'var(--yd)',   fg: 'var(--warn)' },
    high:     { bg: 'var(--od)',   fg: 'var(--orange)' },
    critical: { bg: 'var(--dd)',   fg: 'var(--danger)' },
  };
  const s = map[severity] || { bg: 'var(--ad)', fg: 'var(--fg2)' };
  return (
    <span className="cs-sev" style={{ background: s.bg, color: s.fg }}>
      {severity.toUpperCase()}
    </span>
  );
}

function StatCard({ value, label, icon, color }: {
  value: string | number; label: string; icon: string; color: string;
}) {
  return (
    <div className="cs-stat" style={{ borderTop: `2px solid var(--${color})` }}>
      <div className="cs-stat-icon" style={{ color: `var(--${color})` }}>
        <i className={`fas ${icon}`} />
      </div>
      <div className="cs-stat-val">{value}</div>
      <div className="cs-stat-lbl">{label}</div>
    </div>
  );
}

function Spinner() {
  return <div className="cs-spinner"><i className="fas fa-spinner fa-spin" /></div>;
}

// ============================================================
// PAGE
// ============================================================

export default function AdminDashboard() {
  // Auth state
  const [authed, setAuthed] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [loginSubmitting, setLoginSubmitting] = useState(false);

  // Data
  const [data, setData] = useState<FetchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Filters
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [scamTypeFilter, setScamTypeFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [verifiedFilter, setVerifiedFilter] = useState('');

  // Add form
  const [showAdd, setShowAdd] = useState(false);
  const [newPhone, setNewPhone] = useState('');
  const [newType, setNewType] = useState('other');
  const [newSeverity, setNewSeverity] = useState('medium');
  const [newScore, setNewScore] = useState(50);
  const [newCarrier, setNewCarrier] = useState('');
  const [newCircle, setNewCircle] = useState('');
  const [addSubmitting, setAddSubmitting] = useState(false);

  // Edit modal
  const [editEntry, setEditEntry] = useState<ScamEntry | null>(null);
  const [editForm, setEditForm] = useState<Partial<ScamEntry>>({});
  const [editSubmitting, setEditSubmitting] = useState(false);

  // Delete confirmation
  const [deleteEntry, setDeleteEntry] = useState<ScamEntry | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  // Bulk import
  const [showBulk, setShowBulk] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [bulkResults, setBulkResults] = useState<{ ok: number; fail: number; errors: string[] } | null>(null);

  // Toast
  const [toast, setToast] = useState('');
  const toastTimer = useRef<ReturnType<typeof setTimeout>>();

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 3500);
  }, []);

  // ============================================================
  // AUTH LOGIC
  // ============================================================

  // Check existing session on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/admin/auth-check');
        if (res.ok) {
          setAuthed(true);
        }
      } catch {
        // not authed
      } finally {
        setAuthLoading(false);
      }
    })();
  }, []);

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      setAuthError('Please enter both username and password');
      return;
    }
    setLoginSubmitting(true);
    setAuthError('');
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const json = await res.json();
      if (json.success) {
        setAuthed(true);
        setUsername('');
        setPassword('');
      } else {
        setAuthError(json.error || 'Authentication failed');
      }
    } catch {
      setAuthError('Network error — please try again');
    } finally {
      setLoginSubmitting(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/admin/logout', { method: 'POST' });
    } catch {
      // best-effort
    }
    setAuthed(false);
  };

  // ============================================================
  // DATA FETCHING
  // ============================================================

  const fetchData = useCallback(async () => {
    if (!authed) return;
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', '15');
      if (search) params.set('search', search);
      if (scamTypeFilter) params.set('scam_type', scamTypeFilter);
      if (severityFilter) params.set('severity', severityFilter);
      if (verifiedFilter) params.set('verified', verifiedFilter);
      const res = await fetch(`/api/admin/scam-numbers?${params.toString()}`);
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
  }, [authed, page, search, scamTypeFilter, severityFilter, verifiedFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filter handlers — reset page on filter change
  const doSearch = () => {
    setPage(1);
    // fetchData called via useEffect on page/search change
  };

  // ============================================================
  // CRUD OPERATIONS
  // ============================================================

  const handleAdd = async () => {
    if (!newPhone.trim()) {
      showToast('Phone number is required');
      return;
    }
    setAddSubmitting(true);
    try {
      const res = await fetch('/api/admin/scam-numbers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: newPhone.trim(),
          scamType: newType,
          severity: newSeverity,
          threatScore: newScore,
          carrier: newCarrier || null,
          telecomCircle: newCircle || null,
        }),
      });
      const json = await res.json();
      if (json.success) {
        showToast(`Added ${json.item.phoneNumber}`);
        setShowAdd(false);
        setNewPhone('');
        setNewType('other');
        setNewSeverity('medium');
        setNewScore(50);
        setNewCarrier('');
        setNewCircle('');
        fetchData();
      } else {
        showToast(`Error: ${json.error}`);
      }
    } catch (e: any) {
      showToast(`Failed: ${e.message}`);
    } finally {
      setAddSubmitting(false);
    }
  };

  const openEdit = (entry: ScamEntry) => {
    setEditEntry(entry);
    setEditForm({
      phoneNumber: entry.phoneNumber,
      scamType: entry.scamType,
      severity: entry.severity,
      threatScore: entry.threatScore,
      carrier: entry.carrier || '',
      telecomCircle: entry.telecomCircle || '',
      verified: entry.verified,
    });
  };

  const handleEditSubmit = async () => {
    if (!editEntry) return;
    setEditSubmitting(true);
    try {
      const res = await fetch('/api/admin/scam-numbers', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editEntry.id, ...editForm }),
      });
      const json = await res.json();
      if (json.success) {
        showToast(`Updated ${json.item.phoneNumber}`);
        setEditEntry(null);
        fetchData();
      } else {
        showToast(`Error: ${json.error}`);
      }
    } catch (e: any) {
      showToast(`Failed: ${e.message}`);
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleToggleVerify = async (entry: ScamEntry) => {
    try {
      const res = await fetch('/api/admin/scam-numbers', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: entry.id, verified: !entry.verified }),
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

  const handleDelete = async () => {
    if (!deleteEntry) return;
    setDeleteSubmitting(true);
    try {
      const res = await fetch(`/api/admin/scam-numbers?id=${deleteEntry.id}`, { method: 'DELETE' });
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
    } finally {
      setDeleteSubmitting(false);
    }
  };

  // ============================================================
  // EXPORT CSV
  // ============================================================

  const handleExportCSV = () => {
    if (!data?.items.length) {
      showToast('No data to export');
      return;
    }
    const header = ['Phone Number', 'Scam Type', 'Severity', 'Threat Score', 'Carrier', 'Circle', 'Reports', 'Verified', 'Last Reported'];
    const rows = data.items.map(e => [
      e.phoneNumber,
      formatLabel(e.scamType),
      e.severity,
      String(e.threatScore),
      e.carrier || '',
      e.telecomCircle || '',
      String(e.reportCount),
      e.verified ? 'Yes' : 'No',
      e.lastReportedAt || '',
    ]);
    const csv = [header.join(','), ...rows.map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `callshield-scam-numbers-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('CSV exported');
  };

  // ============================================================
  // BULK IMPORT
  // ============================================================

  const handleBulkImport = async () => {
    const lines = bulkText.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
    if (!lines.length) {
      showToast('Paste at least one phone number');
      return;
    }
    setBulkSubmitting(true);
    setBulkResults(null);
    let ok = 0; let fail = 0;
    const errors: string[] = [];
    for (const phone of lines) {
      try {
        const res = await fetch('/api/admin/scam-numbers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phoneNumber: phone,
            scamType: 'other',
            severity: 'medium',
            threatScore: 50,
          }),
        });
        const json = await res.json();
        if (json.success) ok++;
        else { fail++; errors.push(`${phone}: ${json.error}`); }
      } catch {
        fail++;
        errors.push(`${phone}: network error`);
      }
    }
    setBulkResults({ ok, fail, errors });
    if (ok > 0) fetchData();
    setBulkSubmitting(false);
  };

  // ============================================================
  // LOADING STATE
  // ============================================================

  if (authLoading) {
    return (
      <>
        <style dangerouslySetInnerHTML={{ __html: ADMIN_STYLES }} />
        <div className="cs-auth"><Spinner /></div>
      </>
    );
  }

  // ============================================================
  // LOGIN SCREEN
  // ============================================================

  if (!authed) {
    return (
      <>
        <style dangerouslySetInnerHTML={{ __html: ADMIN_STYLES }} />
        <div className="cs-auth">
          <div className="cs-auth-card">
            <div className="cs-auth-icon">
              <i className="fas fa-shield-halved" />
            </div>
            <h1>CallShield Admin</h1>
            <p>Sign in to manage the scam number database</p>

            <div className="cs-auth-field">
              <label>Username</label>
              <input
                type="text"
                placeholder="Enter admin username"
                value={username}
                onChange={e => { setUsername(e.target.value); setAuthError(''); }}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                autoFocus
                autoComplete="username"
              />
            </div>

            <div className="cs-auth-field">
              <label>Password</label>
              <input
                type="password"
                placeholder="Enter admin password"
                value={password}
                onChange={e => { setPassword(e.target.value); setAuthError(''); }}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                autoComplete="current-password"
              />
            </div>

            {authError && <div className="cs-auth-err">{authError}</div>}

            <button className="cs-btn cs-btn-prim cs-btn-full" onClick={handleLogin} disabled={loginSubmitting}>
              {loginSubmitting ? <Spinner /> : <><i className="fas fa-lock-open" /> Sign In</>}
            </button>
          </div>
        </div>
      </>
    );
  }

  // ============================================================
  // DASHBOARD
  // ============================================================

  const stats = data?.stats || { totalScams: 0, verifiedCount: 0, verifiedPercent: 0, reportsToday: 0, activeThreats: 0 };
  const items = data?.items || [];

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: ADMIN_STYLES }} />

      <div className="cs-wrap">
        {/* ── Header ── */}
        <header className="cs-hdr">
          <div className="cs-hdr-l">
            <h1>
              <i className="fas fa-shield-halved cs-hdr-icon" />
              CallShield Admin
            </h1>
            <span className="cs-hdr-sub">Scam Database Management</span>
          </div>
          <div className="cs-hdr-r">
            <button className="cs-btn cs-btn-ghost" onClick={handleExportCSV} title="Export CSV">
              <i className="fas fa-download" /> Export
            </button>
            <button className="cs-btn cs-btn-ghost" onClick={() => setShowBulk(true)} title="Bulk Import">
              <i className="fas fa-file-import" /> Import
            </button>
            <button className="cs-btn cs-btn-ghost" onClick={() => { setShowAdd(true); }}>
              <i className="fas fa-plus" /> Add
            </button>
            <a href="/" className="cs-btn cs-btn-ghost" style={{ textDecoration: 'none' }}>
              <i className="fas fa-home" /> App
            </a>
            <button className="cs-btn cs-btn-ghost cs-btn-logout" onClick={handleLogout}>
              <i className="fas fa-sign-out-alt" />
            </button>
          </div>
        </header>

        {/* ── Stats ── */}
        <div className="cs-stats-row">
          <StatCard value={stats.totalScams.toLocaleString()} label="Total Numbers" icon="fa-database" color="accent" />
          <StatCard value={`${stats.verifiedPercent}%`} label="Verified" icon="fa-check-circle" color="accent" />
          <StatCard value={stats.reportsToday} label="Reports Today" icon="fa-calendar-day" color="warn" />
          <StatCard value={stats.activeThreats} label="Active Threats" icon="fa-skull" color="danger" />
        </div>

        {/* ── Filters ── */}
        <div className="cs-filters">
          <div className="cs-search-wrap">
            <i className="fas fa-search cs-search-icon" />
            <input
              type="text"
              placeholder="Search by phone number..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') doSearch(); }}
              className="cs-search"
            />
          </div>
          <select value={scamTypeFilter} onChange={e => { setScamTypeFilter(e.target.value); setPage(1); }} className="cs-sel">
            <option value="">All Types</option>
            {SCAM_TYPES.slice(1).map(t => <option key={t} value={t}>{formatLabel(t)}</option>)}
          </select>
          <select value={severityFilter} onChange={e => { setSeverityFilter(e.target.value); setPage(1); }} className="cs-sel">
            <option value="">All Severities</option>
            {SEVERITIES.slice(1).map(s => <option key={s} value={s}>{s.toUpperCase()}</option>)}
          </select>
          <select value={verifiedFilter} onChange={e => { setVerifiedFilter(e.target.value); setPage(1); }} className="cs-sel">
            <option value="">All Status</option>
            <option value="true">Verified</option>
            <option value="false">Unverified</option>
          </select>
          <button className="cs-btn cs-btn-ghost" onClick={doSearch}><i className="fas fa-filter" /></button>
        </div>

        {/* ── Error ── */}
        {error && <div className="cs-err"><i className="fas fa-exclamation-triangle" /> {error}</div>}

        {/* ── Table ── */}
        <div className="cs-tbl-wrap">
          {loading ? (
            <div className="cs-empty"><Spinner /></div>
          ) : items.length === 0 ? (
            <div className="cs-empty">
              <i className="fas fa-inbox" style={{ fontSize: 32, display: 'block', marginBottom: 8 }} />
              No scam numbers found
            </div>
          ) : (
            <table className="cs-tbl">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Phone Number</th>
                  <th>Type</th>
                  <th>Severity</th>
                  <th>Score</th>
                  <th>Reports</th>
                  <th>Verified</th>
                  <th>Last Seen</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((entry, idx) => (
                  <tr key={entry.id}>
                    <td className="cs-td-num">{(data!.page - 1) * data!.limit + idx + 1}</td>
                    <td>
                      <div className="cs-td-phone">{entry.phoneNumber}</div>
                      {entry.carrier && <div className="cs-td-meta">{entry.carrier}{entry.telecomCircle ? ` · ${entry.telecomCircle}` : ''}</div>}
                    </td>
                    <td><span className="cs-td-type">{formatLabel(entry.scamType)}</span></td>
                    <td><SeverityBadge severity={entry.severity} /></td>
                    <td>
                      <span className={`cs-td-score ${entry.threatScore >= 80 ? 'cs-score-d' : entry.threatScore >= 50 ? 'cs-score-w' : ''}`}>
                        {entry.threatScore}
                      </span>
                    </td>
                    <td className="cs-td-rep">
                      {entry.reportCount}
                      {entry.recentReportCount > 0 && <span className="cs-td-recent">+{entry.recentReportCount}</span>}
                    </td>
                    <td>
                      <button className={`cs-tag ${entry.verified ? 'cs-tag-ok' : 'cs-tag-pend'}`} onClick={() => handleToggleVerify(entry)} title="Toggle">
                        <i className={`fas ${entry.verified ? 'fa-check-circle' : 'fa-clock'}`} />
                        {entry.verified ? 'Yes' : 'No'}
                      </button>
                    </td>
                    <td className="cs-td-date">{timeAgo(entry.lastReportedAt)}</td>
                    <td>
                      <div className="cs-actions">
                        <button className="cs-act" title="Edit" onClick={() => openEdit(entry)}><i className="fas fa-pen" /></button>
                        <button className="cs-act cs-act-del" title="Delete" onClick={() => setDeleteEntry(entry)}><i className="fas fa-trash-alt" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* ── Pagination ── */}
        {data && data.totalPages > 1 && (
          <div className="cs-pg">
            <button className="cs-btn cs-btn-ghost" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
              <i className="fas fa-chevron-left" /> Prev
            </button>
            <span className="cs-pg-info">Page {data.page} of {data.totalPages} ({data.total} total)</span>
            <button className="cs-btn cs-btn-ghost" disabled={page >= data.totalPages} onClick={() => setPage(p => p + 1)}>
              Next <i className="fas fa-chevron-right" />
            </button>
          </div>
        )}
      </div>

      {/* ── Toast ── */}
      {toast && <div className="cs-toast"><i className="fas fa-info-circle" /> {toast}</div>}

      {/* ── Add Modal ── */}
      {showAdd && (
        <div className="cs-modal" onClick={e => { if (e.target === e.currentTarget) setShowAdd(false); }}>
          <div className="cs-modal-card">
            <h2><i className="fas fa-plus-circle" /> Add Scam Number</h2>
            <div className="cs-modal-grid">
              <label>Phone Number *</label>
              <input type="text" value={newPhone} onChange={e => setNewPhone(e.target.value)} placeholder="+91 XXXXXXXXXX" className="cs-inp" />
              <label>Scam Type</label>
              <select value={newType} onChange={e => setNewType(e.target.value)} className="cs-sel">
                {SCAM_TYPES.slice(1).map(t => <option key={t} value={t}>{formatLabel(t)}</option>)}
              </select>
              <label>Severity</label>
              <select value={newSeverity} onChange={e => setNewSeverity(e.target.value)} className="cs-sel">
                {SEVERITIES.slice(1).map(s => <option key={s} value={s}>{s.toUpperCase()}</option>)}
              </select>
              <label>Threat Score</label>
              <div className="cs-range-row">
                <input type="range" min={0} max={100} value={newScore} onChange={e => setNewScore(+e.target.value)} className="cs-range" />
                <span className="cs-range-val">{newScore}</span>
              </div>
              <label>Carrier</label>
              <input type="text" value={newCarrier} onChange={e => setNewCarrier(e.target.value)} placeholder="e.g. Jio, Airtel..." className="cs-inp" />
              <label>Telecom Circle</label>
              <input type="text" value={newCircle} onChange={e => setNewCircle(e.target.value)} placeholder="e.g. Mumbai, Delhi..." className="cs-inp" />
            </div>
            <div className="cs-modal-acts">
              <button className="cs-btn cs-btn-ghost" onClick={() => setShowAdd(false)}>Cancel</button>
              <button className="cs-btn cs-btn-prim" onClick={handleAdd} disabled={addSubmitting}>
                {addSubmitting ? <Spinner /> : 'Add Number'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Modal ── */}
      {editEntry && (
        <div className="cs-modal" onClick={e => { if (e.target === e.currentTarget) setEditEntry(null); }}>
          <div className="cs-modal-card">
            <h2><i className="fas fa-pen-to-square" /> Edit Entry</h2>
            <div className="cs-modal-phone">{editEntry.phoneNumber}</div>
            <div className="cs-modal-grid">
              <label>Phone Number</label>
              <input type="text" value={editForm.phoneNumber || ''} onChange={e => setEditForm({ ...editForm, phoneNumber: e.target.value })} className="cs-inp" />
              <label>Scam Type</label>
              <select value={editForm.scamType || ''} onChange={e => setEditForm({ ...editForm, scamType: e.target.value })} className="cs-sel">
                {SCAM_TYPES.slice(1).map(t => <option key={t} value={t}>{formatLabel(t)}</option>)}
              </select>
              <label>Severity</label>
              <select value={editForm.severity || ''} onChange={e => setEditForm({ ...editForm, severity: e.target.value })} className="cs-sel">
                {SEVERITIES.slice(1).map(s => <option key={s} value={s}>{s.toUpperCase()}</option>)}
              </select>
              <label>Threat Score</label>
              <div className="cs-range-row">
                <input type="range" min={0} max={100} value={editForm.threatScore ?? 0} onChange={e => setEditForm({ ...editForm, threatScore: +e.target.value })} className="cs-range" />
                <span className="cs-range-val">{editForm.threatScore}</span>
              </div>
              <label>Carrier</label>
              <input type="text" value={editForm.carrier || ''} onChange={e => setEditForm({ ...editForm, carrier: e.target.value })} className="cs-inp" />
              <label>Telecom Circle</label>
              <input type="text" value={editForm.telecomCircle || ''} onChange={e => setEditForm({ ...editForm, telecomCircle: e.target.value })} className="cs-inp" />
              <label>Verified</label>
              <select value={editForm.verified ? 'true' : 'false'} onChange={e => setEditForm({ ...editForm, verified: e.target.value === 'true' })} className="cs-sel">
                <option value="false">Unverified</option>
                <option value="true">Verified</option>
              </select>
            </div>
            <div className="cs-modal-acts">
              <button className="cs-btn cs-btn-ghost" onClick={() => setEditEntry(null)}>Cancel</button>
              <button className="cs-btn cs-btn-prim" onClick={handleEditSubmit} disabled={editSubmitting}>
                {editSubmitting ? <Spinner /> : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Modal ── */}
      {deleteEntry && (
        <div className="cs-modal" onClick={e => { if (e.target === e.currentTarget) setDeleteEntry(null); }}>
          <div className="cs-modal-card">
            <h2><i className="fas fa-triangle-exclamation" style={{ color: 'var(--danger)' }} /> Confirm Delete</h2>
            <div className="cs-modal-phone">{deleteEntry.phoneNumber}</div>
            <p className="cs-modal-warn">This permanently removes this number from the database. This action cannot be undone.</p>
            <div className="cs-modal-acts">
              <button className="cs-btn cs-btn-ghost" onClick={() => setDeleteEntry(null)}>Cancel</button>
              <button className="cs-btn cs-btn-dang" onClick={handleDelete} disabled={deleteSubmitting}>
                {deleteSubmitting ? <Spinner /> : <><i className="fas fa-trash-alt" /> Delete</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Bulk Import Modal ── */}
      {showBulk && (
        <div className="cs-modal" onClick={e => { if (e.target === e.currentTarget) { setShowBulk(false); setBulkResults(null); } }}>
          <div className="cs-modal-card">
            <h2><i className="fas fa-file-import" /> Bulk Import</h2>
            <p className="cs-modal-desc">Paste phone numbers — one per line, or comma-separated.</p>
            <textarea
              className="cs-bulk"
              rows={8}
              value={bulkText}
              onChange={e => setBulkText(e.target.value)}
              placeholder="+919876543210&#10;+911234567890&#10;+919998887776"
              disabled={bulkSubmitting}
            />
            {bulkResults && (
              <div className={`cs-bulk-res ${bulkResults.fail > 0 ? 'cs-bulk-partial' : 'cs-bulk-ok'}`}>
                Imported {bulkResults.ok} successfully{bulkResults.fail > 0 ? `, ${bulkResults.fail} failed` : ''}.
                {bulkResults.errors.length > 0 && (
                  <ul className="cs-bulk-errs">
                    {bulkResults.errors.slice(0, 5).map((e, i) => <li key={i}>{e}</li>)}
                    {bulkResults.errors.length > 5 && <li>… and {bulkResults.errors.length - 5} more</li>}
                  </ul>
                )}
              </div>
            )}
            <div className="cs-modal-acts">
              <button className="cs-btn cs-btn-ghost" onClick={() => { setShowBulk(false); setBulkResults(null); setBulkText(''); }}>Close</button>
              <button className="cs-btn cs-btn-prim" onClick={handleBulkImport} disabled={bulkSubmitting}>
                {bulkSubmitting ? <Spinner /> : 'Import Numbers'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ============================================================
// STYLES — Dark Green Admin Theme
// ============================================================

const ADMIN_STYLES = `
:root{--bg:#060e08;--bg2:#091410;--card:#0d1c14;--border:#1a3326;--accent:#00e676;--ad:rgba(0,230,118,.1);--ag:rgba(0,230,118,.25);--danger:#ff3d3d;--dd:rgba(255,61,61,.1);--orange:#ff9100;--od:rgba(255,145,0,.1);--warn:#ffab40;--wd:rgba(255,171,64,.1);--yd:rgba(255,171,64,.1);--info:#40c4ff;--id:rgba(64,196,255,.1);--fg:#e0f2e9;--fg2:#a5c4b5;--muted:#4a6b58;--r:14px;--rs:8px}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Space Grotesk',-apple-system,sans-serif;background:var(--bg);color:var(--fg);min-height:100vh;-webkit-font-smoothing:antialiased}
::-webkit-scrollbar{width:4px;height:4px}::-webkit-scrollbar-track{background:var(--bg2)}::-webkit-scrollbar-thumb{background:var(--border);border-radius:2px}

/* ── Auth Gate ── */
.cs-auth{display:flex;align-items:center;justify-content:center;min-height:100vh;min-height:100dvh;padding:env(safe-area-inset-top,20px) 20px env(safe-area-inset-bottom,20px)}
.cs-auth-card{background:var(--card);border:1px solid var(--border);border-radius:var(--r);padding:36px 28px;text-align:center;max-width:400px;width:100%}
.cs-auth-icon{width:56px;height:56px;border-radius:50%;background:var(--ad);display:flex;align-items:center;justify-content:center;margin:0 auto 14px;font-size:22px;color:var(--accent)}
.cs-auth-card h1{font-size:20px;font-weight:800;margin-bottom:4px;color:var(--fg)}
.cs-auth-card p{font-size:11px;color:var(--muted);margin-bottom:22px}
.cs-auth-field{margin-bottom:14px;text-align:left}
.cs-auth-field label{display:block;font-size:10px;font-weight:600;color:var(--fg2);margin-bottom:5px;text-transform:uppercase;letter-spacing:.5px}
.cs-auth-field input{width:100%;padding:11px 14px;background:var(--bg2);border:1px solid var(--border);border-radius:var(--rs);color:var(--fg);font-family:inherit;font-size:13px;outline:none;transition:border-color .2s}
.cs-auth-field input:focus{border-color:var(--accent)}
.cs-auth-field input::placeholder{color:var(--muted)}
.cs-auth-err{color:var(--danger);font-size:10px;margin-bottom:12px;padding:8px 12px;background:var(--dd);border-radius:6px;text-align:center}
.cs-btn-full{width:100%}

/* ── Buttons ── */
.cs-btn{padding:8px 14px;border-radius:var(--rs);font-family:inherit;font-size:10px;font-weight:600;cursor:pointer;transition:all .2s;display:inline-flex;align-items:center;gap:5px;border:1px solid transparent;white-space:nowrap}
.cs-btn:disabled{opacity:.4;cursor:not-allowed}
.cs-btn-prim{background:var(--accent);color:#050c07;border-color:var(--accent)}
.cs-btn-prim:hover:not(:disabled){opacity:.85}
.cs-btn-ghost{background:transparent;border:1px solid var(--border);color:var(--fg2)}
.cs-btn-ghost:hover:not(:disabled){border-color:var(--accent);color:var(--accent)}
.cs-btn-dang{background:var(--danger);color:#fff;border-color:var(--danger)}
.cs-btn-dang:hover:not(:disabled){opacity:.85}
.cs-btn-logout:hover:not(:disabled){border-color:var(--danger);color:var(--danger)}

/* ── Layout ── */
.cs-wrap{max-width:1200px;margin:0 auto;padding:env(safe-area-inset-top,16px) 16px env(safe-area-inset-bottom,32px) 16px}

/* ── Header ── */
.cs-hdr{display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;padding:14px 18px;background:var(--card);border:1px solid var(--border);border-radius:var(--r);flex-wrap:wrap;gap:10px}
.cs-hdr-l h1{font-size:17px;font-weight:800;display:flex;align-items:center;gap:8px;color:var(--fg)}
.cs-hdr-icon{color:var(--accent)}
.cs-hdr-sub{font-size:9px;color:var(--muted);display:block;margin-top:1px}
.cs-hdr-r{display:flex;gap:4px;align-items:center;flex-wrap:wrap}

/* ── Stats ── */
.cs-stats-row{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px}
@media(max-width:768px){.cs-stats-row{grid-template-columns:repeat(2,1fr)}}
.cs-stat{background:var(--card);border:1px solid var(--border);border-radius:var(--r);padding:16px;text-align:center;transition:transform .15s}
.cs-stat:hover{transform:translateY(-1px)}
.cs-stat-icon{font-size:16px;margin-bottom:5px}
.cs-stat-val{font-size:22px;font-weight:800;font-family:'JetBrains Mono',monospace;color:var(--fg)}
.cs-stat-lbl{font-size:9px;color:var(--muted);margin-top:2px;font-weight:500}

/* ── Filters ── */
.cs-filters{display:flex;gap:8px;margin-bottom:14px;align-items:center;flex-wrap:wrap}
.cs-search-wrap{position:relative;flex:1;min-width:180px}
.cs-search-icon{position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--muted);font-size:11px}
.cs-search{width:100%;padding:8px 10px 8px 30px;background:var(--card);border:1px solid var(--border);border-radius:var(--rs);color:var(--fg);font-family:'JetBrains Mono',monospace;font-size:11px;outline:none;transition:border-color .2s}
.cs-search:focus{border-color:var(--accent)}
.cs-search::placeholder{color:var(--muted)}
.cs-sel{padding:8px 10px;background:var(--card);border:1px solid var(--border);border-radius:var(--rs);color:var(--fg);font-family:inherit;font-size:10px;outline:none;cursor:pointer;min-width:110px}
.cs-sel:focus{border-color:var(--accent)}
.cs-inp{width:100%;padding:9px 12px;background:var(--bg2);border:1px solid var(--border);border-radius:var(--rs);color:var(--fg);font-family:'JetBrains Mono',monospace;font-size:12px;outline:none;transition:border-color .2s}
.cs-inp:focus{border-color:var(--accent)}
.cs-inp::placeholder{color:var(--muted)}

/* ── Table ── */
.cs-tbl-wrap{background:var(--card);border:1px solid var(--border);border-radius:var(--r);overflow-x:auto;-webkit-overflow-scrolling:touch}
.cs-tbl{width:100%;border-collapse:collapse;font-size:10px;min-width:700px}
.cs-tbl thead{position:sticky;top:0;z-index:1}
.cs-tbl th{text-align:left;padding:10px 10px;background:var(--bg2);color:var(--muted);font-weight:600;font-size:9px;text-transform:uppercase;letter-spacing:.5px;border-bottom:1px solid var(--border);white-space:nowrap}
.cs-tbl td{padding:9px 10px;border-bottom:1px solid rgba(26,51,38,.5);vertical-align:middle;white-space:nowrap}
.cs-tbl tbody tr:nth-child(even){background:rgba(0,230,118,.02)}
.cs-tbl tbody tr:hover{background:var(--ad)}
.cs-tbl tbody tr:last-child td{border-bottom:none}
.cs-td-num{color:var(--muted);font-family:'JetBrains Mono',monospace;font-size:9px;width:36px}
.cs-td-phone{font-family:'JetBrains Mono',monospace;font-weight:600;font-size:11px;color:var(--fg)}
.cs-td-meta{font-size:8px;color:var(--muted);margin-top:1px}
.cs-td-type{font-size:9px;color:var(--fg2);background:var(--ad);padding:2px 6px;border-radius:4px}
.cs-sev{font-size:8px;font-weight:700;padding:2px 6px;border-radius:4px}
.cs-td-score{font-family:'JetBrains Mono',monospace;font-weight:700;font-size:11px;color:var(--accent)}
.cs-td-score.cs-score-w{color:var(--warn)}
.cs-td-score.cs-score-d{color:var(--danger)}
.cs-td-rep{font-family:'JetBrains Mono',monospace;font-weight:600}
.cs-td-recent{display:block;font-size:8px;color:var(--warn);margin-top:1px}
.cs-tag{font-size:8px;font-weight:600;padding:3px 7px;border-radius:4px;cursor:pointer;border:1px solid transparent;transition:all .15s;display:inline-flex;align-items:center;gap:3px}
.cs-tag-ok{color:var(--accent);background:var(--ad);border-color:rgba(0,230,118,.2)}
.cs-tag-ok:hover{background:rgba(0,230,118,.2)}
.cs-tag-pend{color:var(--warn);background:var(--wd);border-color:rgba(255,171,64,.2)}
.cs-tag-pend:hover{background:rgba(255,171,64,.2)}
.cs-td-date{color:var(--muted);font-size:9px}
.cs-actions{display:flex;gap:3px}
.cs-act{width:28px;height:28px;border-radius:5px;border:1px solid var(--border);background:var(--bg2);color:var(--fg2);display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:10px;transition:all .2s}
.cs-act:hover{border-color:var(--accent);color:var(--accent);background:var(--ad)}
.cs-act-del:hover{border-color:var(--danger);color:var(--danger);background:var(--dd)}

/* ── Empty / Spinner ── */
.cs-empty{text-align:center;padding:48px 20px;color:var(--muted);font-size:12px}
.cs-spinner{display:flex;align-items:center;justify-content:center;gap:6px;font-size:12px;color:var(--muted)}
.cs-spinner i{font-size:14px}

/* ── Error ── */
.cs-err{background:var(--dd);border:1px solid rgba(255,61,61,.2);border-radius:var(--rs);padding:10px 14px;color:var(--danger);font-size:10px;display:flex;align-items:center;gap:6px;margin-bottom:14px}

/* ── Pagination ── */
.cs-pg{display:flex;align-items:center;justify-content:center;gap:12px;margin-top:14px}
.cs-pg-info{font-size:10px;color:var(--muted);font-family:'JetBrains Mono',monospace}

/* ── Toast ── */
.cs-toast{position:fixed;bottom:max(24px,env(safe-area-inset-bottom,24px));left:50%;transform:translateX(-50%);z-index:9999;padding:10px 20px;background:var(--card);border:1px solid var(--border);border-left:3px solid var(--accent);border-radius:var(--rs);font-size:11px;font-weight:500;display:flex;align-items:center;gap:7px;box-shadow:0 6px 24px rgba(0,0,0,.5);animation:cs-fade .35s ease;max-width:90vw}
@keyframes cs-fade{from{opacity:0;transform:translateX(-50%) translateY(12px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
.cs-toast i{color:var(--accent)}

/* ── Modals ── */
.cs-modal{position:fixed;inset:0;background:rgba(0,0,0,.65);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);z-index:9000;display:flex;align-items:center;justify-content:center;padding:env(safe-area-inset-top,16px) 16px env(safe-area-inset-bottom,16px)}
.cs-modal-card{background:var(--card);border:1px solid var(--border);border-radius:var(--r);padding:22px;max-width:480px;width:100%;max-height:90vh;max-height:90dvh;overflow-y:auto}
.cs-modal-card h2{font-size:15px;margin-bottom:10px;display:flex;align-items:center;gap:7px;color:var(--fg)}
.cs-modal-phone{font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--fg2);margin-bottom:14px;padding:8px 12px;background:var(--bg2);border-radius:6px;border:1px solid var(--border)}
.cs-modal-grid{display:grid;grid-template-columns:1fr 2fr;gap:10px 12px;align-items:center;margin-bottom:16px}
@media(max-width:420px){.cs-modal-grid{grid-template-columns:1fr}}
.cs-modal-grid label{font-size:10px;font-weight:600;color:var(--fg2)}
.cs-range-row{display:flex;align-items:center;gap:10px}
.cs-range{flex:1;accent-color:var(--accent);height:4px}
.cs-range-val{font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:700;min-width:32px}
.cs-modal-desc{font-size:10px;color:var(--muted);margin-bottom:10px}
.cs-modal-warn{font-size:10px;color:var(--danger);margin:8px 0 16px;line-height:1.6}
.cs-modal-acts{display:flex;gap:8px;justify-content:flex-end}

/* ── Bulk Import ── */
.cs-bulk{width:100%;padding:12px;background:var(--bg2);border:1px solid var(--border);border-radius:var(--rs);color:var(--fg);font-family:'JetBrains Mono',monospace;font-size:11px;outline:none;resize:vertical;margin-bottom:12px;transition:border-color .2s}
.cs-bulk:focus{border-color:var(--accent)}
.cs-bulk::placeholder{color:var(--muted)}
.cs-bulk-res{padding:10px 14px;border-radius:var(--rs);font-size:10px;margin-bottom:12px}
.cs-bulk-ok{background:var(--ad);color:var(--accent);border:1px solid rgba(0,230,118,.2)}
.cs-bulk-partial{background:var(--wd);color:var(--warn);border:1px solid rgba(255,171,64,.2)}
.cs-bulk-errs{margin-top:6px;padding-left:16px;font-size:9px;color:var(--danger)}
.cs-bulk-errs li{margin-bottom:2px}
`;
