'use client';

/**
 * ReportModal — Quick Report Widget for scam numbers
 * Displays as a modal overlay with scam type selection, optional description, and submission.
 */

import { useState, useEffect, useRef } from 'react';

// ============================================================
// TYPES
// ============================================================

export interface ReportState {
  open: boolean;
  phoneNumber: string;
  scamType?: string;
}

interface ReportModalProps {
  isOpen: boolean;
  phoneNumber: string;
  initialScamType?: string;
  onClose: () => void;
  onReported: (phoneNumber: string) => void;
}

interface CommunityStats {
  reportCount: number;
  message: string;
}

// ============================================================
// SCAM TYPES
// ============================================================

const SCAM_TYPES = [
  { value: 'upi_fraud', label: 'UPI Payment Fraud', icon: 'fa-money-bill-transfer' },
  { value: 'bank_otp_scam', label: 'Bank OTP Scam', icon: 'fa-building-columns' },
  { value: 'it_department', label: 'IT Dept Impersonation', icon: 'fa-file-invoice' },
  { value: 'insurance', label: 'Insurance Scam', icon: 'fa-file-shield' },
  { value: 'loan_app', label: 'Loan App Harassment', icon: 'fa-hand-holding-dollar' },
  { value: 'fedex_customs', label: 'FedEx/Customs Scam', icon: 'fa-truck' },
  { value: 'crypto', label: 'Crypto Investment Scam', icon: 'fa-bitcoin-sign' },
  { value: 'lottery', label: 'Lottery/Win Scam', icon: 'fa-gift' },
  { value: 'ecommerce', label: 'E-commerce Fraud', icon: 'fa-cart-shopping' },
  { value: 'police_fake', label: 'Fake Police Call', icon: 'fa-handcuffs' },
  { value: 'aadhaar_kyc', label: 'Aadhaar KYC Scam', icon: 'fa-id-card' },
  { value: 'electricity', label: 'Electricity Bill Scam', icon: 'fa-bolt' },
  { value: 'sextortion', label: 'Sextortion/Blackmail', icon: 'fa-video' },
  { value: 'wangiri', label: 'Wangiri Missed Call', icon: 'fa-phone-slash' },
  { value: 'sms_phishing', label: 'SMS Phishing', icon: 'fa-comment-sms' },
  { value: 'job_scam', label: 'Fake Job Offer', icon: 'fa-briefcase' },
  { value: 'other', label: 'Other Scam', icon: 'fa-ellipsis' },
];

// ============================================================
// COMPONENT
// ============================================================

export function ReportModal({ isOpen, phoneNumber, initialScamType, onClose, onReported }: ReportModalProps) {
  const [scamType, setScamType] = useState(initialScamType || '');
  const [description, setDescription] = useState('');
  const [spamScore, setSpamScore] = useState(3);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [communityStats, setCommunityStats] = useState<CommunityStats | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);

  const modalRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setScamType(initialScamType || '');
      setDescription('');
      setSpamScore(3);
      setError('');
      setSubmitted(false);
      setCommunityStats(null);
      setShowDropdown(false);
    }
  }, [isOpen, initialScamType]);

  // Close on ESC
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!showDropdown) return;
    const onClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [showDropdown]);

  const selectedType = SCAM_TYPES.find(t => t.value === scamType);

  const handleSubmit = async () => {
    if (!scamType) {
      setError('Please select a scam type');
      return;
    }
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber,
          scamType,
          description: description.trim() || undefined,
          spamScore,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to submit report');
        return;
      }

      if (data.duplicate) {
        setError('You already reported this number recently');
        setLoading(false);
        return;
      }

      // Fetch community stats
      try {
        const lookupRes = await fetch('/api/lookup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phoneNumber }),
        });
        const lookupData = await lookupRes.json();
        if (lookupData.dbMatch?.found) {
          setCommunityStats({
            reportCount: lookupData.dbMatch.reportCount,
            message: `You and ${lookupData.dbMatch.reportCount - 1} others flagged this number`,
          });
        }
      } catch {
        setCommunityStats({
          reportCount: 1,
          message: 'Thank you for reporting! You were the first to flag this number.',
        });
      }

      setSubmitted(true);
      onReported(phoneNumber);

    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: REPORT_MODAL_STYLES }} />

      {/* Backdrop */}
      <div className="rm-overlay" onClick={onClose} />

      {/* Modal */}
      <div className="rm-modal" ref={modalRef}>
        {/* Header */}
        <div className="rm-header">
          <div className="rm-header-left">
            <div className="rm-header-icon">
              <i className="fas fa-flag" />
            </div>
            <div>
              <h2 className="rm-title">Report a Scam</h2>
              <p className="rm-subtitle">{phoneNumber}</p>
            </div>
          </div>
          <button className="rm-close" onClick={onClose}>
            <i className="fas fa-times" />
          </button>
        </div>

        {/* Submitted State */}
        {submitted ? (
          <div className="rm-success">
            <div className="rm-success-icon">
              <i className="fas fa-check-circle" />
            </div>
            <h3>Report Submitted ✓</h3>
            <p className="rm-success-text">
              Thank you for helping protect the community.
            </p>
            {communityStats && (
              <div className="rm-community">
                <i className="fas fa-users" />
                <span>{communityStats.message}</span>
              </div>
            )}
            <button className="rm-btn rm-btn-primary" onClick={onClose}>
              Done
            </button>
          </div>
        ) : (
          /* Form */
          <>
            {/* Scam Type */}
            <div className="rm-field">
              <label className="rm-label">
                <i className="fas fa-tag" /> Scam Type <span className="rm-required">*</span>
              </label>
              <div className="rm-select-wrap" ref={dropdownRef}>
                <button
                  type="button"
                  className={`rm-select ${scamType ? 'selected' : ''}`}
                  onClick={() => setShowDropdown(!showDropdown)}
                >
                  {selectedType ? (
                    <span className="rm-select-value">
                      <i className={`fas ${selectedType.icon}`} /> {selectedType.label}
                    </span>
                  ) : (
                    <span className="rm-select-placeholder">Select scam type...</span>
                  )}
                  <i className={`fas fa-chevron-down rm-select-arrow ${showDropdown ? 'open' : ''}`} />
                </button>
                {showDropdown && (
                  <div className="rm-dropdown">
                    {SCAM_TYPES.map((type) => (
                      <button
                        key={type.value}
                        type="button"
                        className={`rm-dropdown-item ${scamType === type.value ? 'active' : ''}`}
                        onClick={() => { setScamType(type.value); setShowDropdown(false); }}
                      >
                        <i className={`fas ${type.icon}`} />
                        <span>{type.label}</span>
                        {scamType === type.value && (
                          <i className="fas fa-check rm-dropdown-check" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Spam Score */}
            <div className="rm-field">
              <label className="rm-label">
                <i className="fas fa-gauge-high" /> Severity: {spamScore}/5
              </label>
              <div className="rm-score">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    className={`rm-score-btn ${n <= spamScore ? 'active' : ''}`}
                    onClick={() => setSpamScore(n)}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            {/* Description */}
            <div className="rm-field">
              <label className="rm-label">
                <i className="fas fa-align-left" /> Description <span className="rm-optional">(optional)</span>
              </label>
              <textarea
                className="rm-textarea"
                placeholder="What happened? Share details to help others..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                maxLength={500}
              />
              <div className="rm-charcount">{description.length}/500</div>
            </div>

            {/* Error */}
            {error && (
              <div className="rm-error">
                <i className="fas fa-exclamation-circle" /> {error}
              </div>
            )}

            {/* Actions */}
            <div className="rm-actions">
              <button type="button" className="rm-btn rm-btn-secondary" onClick={onClose} disabled={loading}>
                Cancel
              </button>
              <button
                type="button"
                className="rm-btn rm-btn-primary"
                onClick={handleSubmit}
                disabled={loading || !scamType}
              >
                {loading ? (
                  <>
                    <i className="fas fa-spinner fa-spin" /> Submitting...
                  </>
                ) : (
                  <>
                    <i className="fas fa-paper-plane" /> Submit Report
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}

// ============================================================
// STYLES
// ============================================================

const REPORT_MODAL_STYLES = `
.rm-overlay{position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:1000;backdrop-filter:blur(2px)}
.rm-modal{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:1001;width:90%;max-width:460px;max-height:90vh;overflow-y:auto;background:var(--card);border:1px solid var(--border);border-radius:var(--r);box-shadow:0 20px 60px rgba(0,0,0,.5);animation:rm-in .2s ease}
@keyframes rm-in{from{opacity:0;transform:translate(-50%,-48%)}to{opacity:1;transform:translate(-50%,-50%)}}

.rm-header{display:flex;align-items:flex-start;justify-content:space-between;padding:18px 20px;border-bottom:1px solid var(--border)}
.rm-header-left{display:flex;align-items:center;gap:12px}
.rm-header-icon{width:40px;height:40px;border-radius:10px;background:rgba(255,171,64,.1);display:flex;align-items:center;justify-content:center;font-size:16px;color:#ffab40}
.rm-title{font-size:15px;font-weight:700;margin-bottom:1px}
.rm-subtitle{font-size:10px;color:var(--muted);font-family:'JetBrains Mono',monospace}
.rm-close{width:28px;height:28px;border-radius:6px;background:transparent;border:1px solid var(--border);color:var(--muted);display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:12px;transition:all .2s;flex-shrink:0}
.rm-close:hover{background:var(--dd);border-color:var(--danger);color:var(--danger)}

/* Fields */
.rm-field{padding:0 20px;margin-top:16px}
.rm-label{display:flex;align-items:center;gap:5px;font-size:10px;font-weight:600;color:var(--fg2);margin-bottom:6px}
.rm-label i{color:var(--muted);font-size:9px}
.rm-required{color:var(--danger)}
.rm-optional{color:var(--muted);font-weight:400;font-size:9px}

/* Select */
.rm-select-wrap{position:relative}
.rm-select{width:100%;padding:10px 14px;background:var(--bg2);border:1px solid var(--border);border-radius:var(--rs);color:var(--fg);font-family:inherit;font-size:11px;cursor:pointer;text-align:left;display:flex;align-items:center;justify-content:space-between;transition:border-color .2s}
.rm-select:hover{border-color:rgba(0,230,118,.3)}
.rm-select.selected{border-color:var(--accent)}
.rm-select-value{display:flex;align-items:center;gap:8px}
.rm-select-value i{color:var(--accent);font-size:10px}
.rm-select-placeholder{color:var(--muted)}
.rm-select-arrow{font-size:9px;color:var(--muted);transition:transform .2s}
.rm-select-arrow.open{transform:rotate(180deg)}

.rm-dropdown{position:absolute;top:calc(100% + 4px);left:0;right:0;max-height:200px;overflow-y:auto;background:var(--card);border:1px solid var(--border);border-radius:var(--rs);z-index:10;box-shadow:0 8px 24px rgba(0,0,0,.4)}
.rm-dropdown-item{width:100%;padding:9px 14px;background:transparent;border:none;color:var(--fg2);font-family:inherit;font-size:10px;cursor:pointer;text-align:left;display:flex;align-items:center;gap:8px;transition:background .15s}
.rm-dropdown-item:hover{background:rgba(0,230,118,.05)}
.rm-dropdown-item.active{background:var(--ad);color:var(--accent)}
.rm-dropdown-item i{font-size:10px;width:16px;text-align:center}
.rm-dropdown-check{margin-left:auto;font-size:9px}

/* Spam Score */
.rm-score{display:flex;gap:6px}
.rm-score-btn{width:36px;height:36px;border-radius:8px;background:var(--bg2);border:1px solid var(--border);color:var(--muted);font-family:'JetBrains Mono',monospace;font-size:13px;font-weight:600;cursor:pointer;transition:all .15s}
.rm-score-btn:hover{border-color:rgba(0,230,118,.3);color:var(--fg2)}
.rm-score-btn.active{background:var(--ad);border-color:var(--accent);color:var(--accent)}

/* Textarea */
.rm-textarea{width:100%;padding:10px 14px;background:var(--bg2);border:1px solid var(--border);border-radius:var(--rs);color:var(--fg);font-family:inherit;font-size:11px;resize:vertical;outline:none;line-height:1.5;transition:border-color .2s}
.rm-textarea:focus{border-color:var(--accent)}
.rm-textarea::placeholder{color:var(--muted)}
.rm-charcount{font-size:8px;color:var(--muted);text-align:right;margin-top:2px}

/* Error */
.rm-error{padding:10px 14px;margin:14px 20px 0;background:var(--dd);border-radius:var(--rs);color:var(--danger);font-size:10px;display:flex;align-items:center;gap:6px}

/* Actions */
.rm-actions{display:flex;gap:8px;padding:16px 20px;border-top:1px solid var(--border);margin-top:16px}
.rm-btn{flex:1;padding:11px;border-radius:var(--rs);font-family:inherit;font-size:11px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;transition:all .15s}
.rm-btn-primary{background:var(--accent);color:var(--bg);border:none}
.rm-btn-primary:hover:not(:disabled){opacity:.85}
.rm-btn-secondary{background:transparent;border:1px solid var(--border);color:var(--fg2)}
.rm-btn-secondary:hover:not(:disabled){border-color:rgba(0,230,118,.3);color:var(--fg)}
.rm-btn:disabled{opacity:.4;cursor:not-allowed}

/* Success State */
.rm-success{padding:32px 20px 24px;text-align:center}
.rm-success-icon{width:56px;height:56px;border-radius:50%;background:var(--ad);display:flex;align-items:center;justify-content:center;margin:0 auto 16px;font-size:24px;color:var(--accent)}
.rm-success h3{font-size:18px;font-weight:700;margin-bottom:6px}
.rm-success-text{font-size:11px;color:var(--muted);margin-bottom:14px}
.rm-community{padding:10px 16px;background:var(--bg2);border:1px solid var(--border);border-radius:var(--rs);font-size:10px;color:var(--fg2);display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:16px}
.rm-community i{color:var(--accent)}
.rm-success .rm-btn-primary{max-width:200px;margin:0 auto}
`;
