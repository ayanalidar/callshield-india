'use client';

/**
 * AlertBell — Real-time scam alert notification bell
 *
 * Features:
 * - Polls /api/alerts every 30 seconds
 * - Red badge with unread alert count
 * - Dropdown shows recent scam alerts
 * - Clicking an alert navigates to the number's reputation page
 * - Animations for new alerts
 */

import { useState, useEffect, useRef, useCallback } from 'react';

// ============================================================
// TYPES
// ============================================================

interface ScamAlert {
  id: string;
  phoneNumber: string;
  scamType: string;
  scamLabel: string;
  city: string;
  state: string;
  reportCount: number;
  time: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

// ============================================================
// ALERT SEVERITY CONFIG
// ============================================================

const SEVERITY_CONFIG: Record<string, { color: string; bg: string; icon: string; label: string }> = {
  critical: { color: '#ff3d3d', bg: 'rgba(255,61,61,.1)', icon: 'fa-skull', label: 'CRITICAL' },
  high: { color: '#ff9100', bg: 'rgba(255,145,0,.1)', icon: 'fa-triangle-exclamation', label: 'HIGH' },
  medium: { color: '#ffab40', bg: 'rgba(255,171,64,.1)', icon: 'fa-circle-exclamation', label: 'MEDIUM' },
  low: { color: '#40c4ff', bg: 'rgba(64,196,255,.1)', icon: 'fa-circle-info', label: 'LOW' },
};

const SCAM_EMOJIS: Record<string, string> = {
  upi_fraud: '💸',
  bank_otp_scam: '🏦',
  fedex_customs: '📦',
  loan_app: '💰',
  aadhaar_kyc: '🪪',
  it_department: '📋',
  job_scam: '💼',
  crypto: '🪙',
  police_fake: '👮',
  insurance: '📄',
  electricity: '⚡',
  sextortion: '🎥',
  wangiri: '📞',
  sms_phishing: '💬',
  lottery: '🎰',
  ecommerce: '🛒',
  other: '📌',
};

// ============================================================
// COMPONENT
// ============================================================

export function AlertBell() {
  const [alerts, setAlerts] = useState<ScamAlert[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [lastSeenId, setLastSeenId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasNew, setHasNew] = useState(false);

  const bellRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval>>();

  // ============================================================
  // POLLING
  // ============================================================

  const fetchAlerts = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/alerts');
      if (!res.ok) return;
      const data: ScamAlert[] = await res.json();

      if (data.length > 0) {
        // Count new alerts
        const newAlerts = lastSeenId
          ? data.filter(a => a.id > (lastSeenId || ''))
          : data;

        setAlerts(data);

        if (newAlerts.length > 0) {
          setUnreadCount(prev => prev + newAlerts.length);
          setHasNew(true);
          // Auto-dismiss "new" animation after 3s
          setTimeout(() => setHasNew(false), 3000);
        }
      }
    } catch {
      // Silently fail — alerts are non-critical
    } finally {
      setLoading(false);
    }
  }, [lastSeenId]);

  useEffect(() => {
    fetchAlerts();
    pollRef.current = setInterval(fetchAlerts, 30_000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchAlerts]);

  // ============================================================
  // CLICK OUTSIDE HANDLER
  // ============================================================

  useEffect(() => {
    if (!isOpen) return;
    const onClick = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [isOpen]);

  // ============================================================
  // HANDLERS
  // ============================================================

  const handleBellClick = () => {
    setIsOpen(prev => !prev);
    if (!isOpen) {
      // Mark as read when opening
      if (alerts.length > 0) {
        setLastSeenId(alerts[0].id);
      }
      setUnreadCount(0);
      setHasNew(false);
    }
  };

  const handleAlertClick = (alert: ScamAlert) => {
    setIsOpen(false);
    // Navigate to reputation page
    const clean = alert.phoneNumber.replace(/[^0-9+]/g, '');
    window.location.href = `/number/${encodeURIComponent(clean)}`;
  };

  const handleDismissAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    setUnreadCount(0);
    setHasNew(false);
    if (alerts.length > 0) setLastSeenId(alerts[0].id);
  };

  const handleRefresh = (e: React.MouseEvent) => {
    e.stopPropagation();
    fetchAlerts();
  };

  // ============================================================
  // FORMAT HELPERS
  // ============================================================

  const formatTime = (iso: string): string => {
    try {
      const d = new Date(iso);
      const now = new Date();
      const diff = now.getTime() - d.getTime();
      const mins = Math.floor(diff / 60000);

      if (mins < 1) return 'Just now';
      if (mins < 60) return `${mins}m ago`;
      const hours = Math.floor(mins / 60);
      if (hours < 24) return `${hours}h ago`;
      return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    } catch {
      return '';
    }
  };

  const formatPhone = (raw: string): string => {
    const digits = raw.replace(/[^0-9]/g, '');
    if (digits.length === 10) return `+91 ${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
    if (digits.length >= 10) return '+' + digits.slice(0, 2) + ' ' + digits.slice(2, 5) + ' ' + digits.slice(5, 8) + ' ' + digits.slice(8);
    return raw;
  };

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: ALERT_BELL_STYLES }} />

      <div className={`ab-root ${isOpen ? 'open' : ''}`} ref={bellRef}>
        {/* Bell Icon */}
        <button
          className={`ab-bell ${hasNew ? 'pulse' : ''} ${unreadCount > 0 ? 'unread' : ''}`}
          onClick={handleBellClick}
          aria-label={`Alerts${unreadCount > 0 ? ` — ${unreadCount} unread` : ''}`}
        >
          <i className={`fas fa-bell ${hasNew ? 'fa-shake' : ''}`} />
          {unreadCount > 0 && (
            <span className="ab-badge">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>

        {/* Dropdown */}
        {isOpen && (
          <div className="ab-dropdown">
            {/* Header */}
            <div className="ab-header">
              <h3 className="ab-title">
                <i className="fas fa-shield-halved" /> Scam Alerts
              </h3>
              <div className="ab-header-actions">
                <button
                  className="ab-action-btn"
                  onClick={handleRefresh}
                  title="Refresh"
                  disabled={loading}
                >
                  <i className={`fas fa-sync-alt ${loading ? 'fa-spin' : ''}`} />
                </button>
                {unreadCount > 0 && (
                  <button
                    className="ab-action-btn"
                    onClick={handleDismissAll}
                    title="Mark all read"
                  >
                    <i className="fas fa-check-double" />
                  </button>
                )}
              </div>
            </div>

            {/* Alert List */}
            <div className="ab-list">
              {alerts.length === 0 ? (
                <div className="ab-empty">
                  <i className="fas fa-bell-slash" />
                  <p>No recent alerts</p>
                  <span>You&apos;ll be notified when new scam reports are detected</span>
                </div>
              ) : (
                alerts.slice(0, 20).map((alert) => {
                  const severity = SEVERITY_CONFIG[alert.severity] || SEVERITY_CONFIG.medium;
                  const emoji = SCAM_EMOJIS[alert.scamType] || '⚠️';
                  const isNew = lastSeenId ? alert.id > lastSeenId : false;

                  return (
                    <button
                      key={alert.id}
                      className={`ab-alert ${isNew ? 'new' : ''}`}
                      onClick={() => handleAlertClick(alert)}
                    >
                      {/* Severity indicator */}
                      <div
                        className="ab-severity"
                        style={{
                          background: severity.bg,
                          color: severity.color,
                        }}
                      >
                        <i className={`fas ${severity.icon}`} />
                      </div>

                      {/* Alert content */}
                      <div className="ab-alert-content">
                        <div className="ab-alert-header">
                          <span className="ab-alert-type">
                            {emoji} {alert.scamLabel}
                          </span>
                          {alert.reportCount > 20 && (
                            <span className="ab-wave-badge" title="Scam wave detected">
                              🌊 Wave
                            </span>
                          )}
                        </div>
                        <div className="ab-alert-number">
                          {formatPhone(alert.phoneNumber)}
                        </div>
                        <div className="ab-alert-meta">
                          <span>
                            <i className="fas fa-map-marker-alt" />
                            {alert.city}, {alert.state}
                          </span>
                          <span>
                            <i className="fas fa-users" />
                            {alert.reportCount} reports
                          </span>
                          <span className="ab-alert-time">
                            {formatTime(alert.time)}
                          </span>
                        </div>
                      </div>

                      {/* Arrow */}
                      <div className="ab-arrow">
                        <i className="fas fa-chevron-right" />
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* Footer */}
            {alerts.length > 0 && (
              <div className="ab-footer">
                <a href="/trends" className="ab-footer-link">
                  <i className="fas fa-chart-line" /> View All Trends
                </a>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

// ============================================================
// STYLES
// ============================================================

const ALERT_BELL_STYLES = `
.ab-root {
  position: relative;
  display: inline-flex;
  z-index: 500;
}

/* Bell Button */
.ab-bell {
  position: relative;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--card, #0d1c14);
  border: 1px solid var(--border, #1a3326);
  border-radius: var(--rs, 8px);
  color: var(--fg2, #a5c4b5);
  font-size: 16px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.ab-bell:hover {
  border-color: var(--accent, #00e676);
  color: var(--accent, #00e676);
  background: var(--ad, rgba(0,230,118,.1));
}

.ab-bell.unread {
  border-color: rgba(255, 145, 0, 0.4);
}

/* Pulse animation for new alerts */
.ab-bell.pulse {
  animation: ab-pulse 0.6s ease 3;
}

@keyframes ab-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(255, 145, 0, 0.4); }
  50% { box-shadow: 0 0 0 6px rgba(255, 145, 0, 0); }
}

/* Badge */
.ab-badge {
  position: absolute;
  top: -5px;
  right: -5px;
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--danger, #ff3d3d);
  color: #fff;
  font-size: 9px;
  font-weight: 700;
  font-family: 'JetBrains Mono', monospace;
  border-radius: 9px;
  border: 2px solid var(--bg, #050c07);
  animation: ab-badge-in 0.3s ease;
}

@keyframes ab-badge-in {
  from { transform: scale(0); }
  to { transform: scale(1); }
}

/* Dropdown */
.ab-dropdown {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  width: 380px;
  max-height: 480px;
  background: var(--card, #0d1c14);
  border: 1px solid var(--border, #1a3326);
  border-radius: var(--r, 14px);
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(0, 230, 118, 0.05);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  animation: ab-drop-in 0.2s ease;
}

@keyframes ab-drop-in {
  from { opacity: 0; transform: translateY(-8px); }
  to { opacity: 1; transform: translateY(0); }
}

@media (max-width: 420px) {
  .ab-dropdown {
    position: fixed;
    top: 60px;
    right: 8px;
    left: 8px;
    width: auto;
    max-height: calc(100vh - 80px);
  }
}

/* Header */
.ab-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid var(--border, #1a3326);
  flex-shrink: 0;
}

.ab-title {
  font-size: 12px;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 7px;
  color: var(--fg, #e0f2e9);
}

.ab-title i {
  color: var(--accent, #00e676);
  font-size: 12px;
}

.ab-header-actions {
  display: flex;
  gap: 4px;
}

.ab-action-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px solid var(--border, #1a3326);
  border-radius: 6px;
  color: var(--muted, #4a6b58);
  font-size: 10px;
  cursor: pointer;
  transition: all 0.15s;
}

.ab-action-btn:hover:not(:disabled) {
  border-color: var(--accent, #00e676);
  color: var(--accent, #00e676);
  background: var(--ad, rgba(0,230,118,.1));
}

.ab-action-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* Alert List */
.ab-list {
  overflow-y: auto;
  flex: 1;
  padding: 6px 0;
}

.ab-list::-webkit-scrollbar { width: 3px; }
.ab-list::-webkit-scrollbar-track { background: transparent; }
.ab-list::-webkit-scrollbar-thumb { background: var(--border, #1a3326); border-radius: 2px; }

/* Empty State */
.ab-empty {
  padding: 32px 20px;
  text-align: center;
}

.ab-empty i {
  font-size: 32px;
  color: var(--muted, #4a6b58);
  margin-bottom: 10px;
  display: block;
}

.ab-empty p {
  font-size: 12px;
  font-weight: 600;
  color: var(--fg2, #a5c4b5);
  margin-bottom: 4px;
}

.ab-empty span {
  font-size: 9px;
  color: var(--muted, #4a6b58);
  line-height: 1.4;
}

/* Alert Item */
.ab-alert {
  width: 100%;
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 16px;
  background: transparent;
  border: none;
  text-align: left;
  cursor: pointer;
  transition: background 0.15s;
  color: inherit;
  font-family: inherit;
}

.ab-alert:hover {
  background: rgba(0, 230, 118, 0.03);
}

.ab-alert.new {
  background: rgba(255, 145, 0, 0.04);
  border-left: 2px solid #ff9100;
}

/* Severity Indicator */
.ab-severity {
  width: 28px;
  height: 28px;
  min-width: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 7px;
  font-size: 11px;
  margin-top: 1px;
}

/* Alert Content */
.ab-alert-content {
  flex: 1;
  min-width: 0;
}

.ab-alert-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 3px;
}

.ab-alert-type {
  font-size: 10px;
  font-weight: 600;
  color: var(--fg, #e0f2e9);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ab-wave-badge {
  font-size: 8px;
  padding: 1px 6px;
  background: rgba(255, 145, 0, 0.15);
  border-radius: 3px;
  color: #ff9100;
  font-weight: 700;
  white-space: nowrap;
}

.ab-alert-number {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  color: var(--fg2, #a5c4b5);
  margin-bottom: 3px;
}

.ab-alert-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.ab-alert-meta span {
  font-size: 8px;
  color: var(--muted, #4a6b58);
  display: flex;
  align-items: center;
  gap: 3px;
}

.ab-alert-meta i {
  font-size: 7px;
}

.ab-alert-time {
  margin-left: auto;
}

/* Arrow */
.ab-arrow {
  display: flex;
  align-items: center;
  padding-top: 4px;
  font-size: 8px;
  color: var(--muted, #4a6b58);
  transition: color 0.15s;
}

.ab-alert:hover .ab-arrow {
  color: var(--accent, #00e676);
}

/* Footer */
.ab-footer {
  padding: 10px 16px;
  border-top: 1px solid var(--border, #1a3326);
  flex-shrink: 0;
  text-align: center;
}

.ab-footer-link {
  font-size: 10px;
  font-weight: 600;
  color: var(--accent, #00e676);
  text-decoration: none;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition: opacity 0.15s;
}

.ab-footer-link:hover {
  opacity: 0.8;
}
`;
