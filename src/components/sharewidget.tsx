'use client';

/**
 * ShareWidget — Social sharing for scam alerts
 *
 * Provides share buttons for WhatsApp, Telegram, Twitter/X, and Copy Link.
 * Pre-fills scam warning information for maximum community impact.
 */

import { useState } from 'react';

// ============================================================
// TYPES
// ============================================================

interface ShareWidgetProps {
  phoneNumber: string;
  scamType?: string;
  verdict?: string;
  threatScore?: number;
}

// ============================================================
// COMPONENT
// ============================================================

export function ShareWidget({ phoneNumber, scamType, verdict, threatScore }: ShareWidgetProps) {
  const [copied, setCopied] = useState(false);
  const [showTooltip, setShowTooltip] = useState<string | null>(null);

  const cleanNumber = phoneNumber.replace(/[^0-9+]/g, '');
  const displayNumber = formatPhone(cleanNumber);
  const scamLabel = scamType || 'scam';
  const verdictLabel = verdict || 'suspicious';

  const shareText = encodeURIComponent(
    [
      `🚨 SCAM ALERT from CallShield India!`,
      `📞 ${displayNumber} — ${verdictLabel}`,
      '',
      `Check before you pick up: https://callshield.vercel.app/number/${encodeURIComponent(cleanNumber)}`,
      '',
      `🛡️ Powered by CallShield India #ScamAlert #CallShield`,
    ].join('\n')
  );

  const shareUrl = `https://callshield.vercel.app/number/${encodeURIComponent(cleanNumber)}`;

  // ============================================================
  // SHARE HANDLERS
  // ============================================================

  const handleWhatsApp = () => {
    window.open(`https://wa.me/?text=${shareText}`, '_blank', 'noopener,noreferrer');
  };

  const handleTelegram = () => {
    window.open(
      `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${shareText}`,
      '_blank',
      'noopener,noreferrer'
    );
  };

  const handleTwitter = () => {
    window.open(
      `https://twitter.com/intent/tweet?text=${shareText}`,
      '_blank',
      'noopener,noreferrer'
    );
  };

  const handleCopyLink = async () => {
    try {
      const text = [
        `🚨 SCAM ALERT: ${displayNumber} — ${verdictLabel}`,
        `Check details: ${shareUrl}`,
      ].join('\n');
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = shareUrl;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: SHARE_STYLES }} />

      <div className="sw-root">
        <div className="sw-label">
          <i className="fas fa-share-nodes" /> Share Alert
        </div>

        <div className="sw-buttons">
          {/* WhatsApp */}
          <button
            className="sw-btn sw-whatsapp"
            onClick={handleWhatsApp}
            onMouseEnter={() => setShowTooltip('whatsapp')}
            onMouseLeave={() => setShowTooltip(null)}
            aria-label="Share on WhatsApp"
          >
            <i className="fab fa-whatsapp" />
            <span className="sw-btn-label">WhatsApp</span>
            {showTooltip === 'whatsapp' && <span className="sw-tooltip">Share on WhatsApp</span>}
          </button>

          {/* Telegram */}
          <button
            className="sw-btn sw-telegram"
            onClick={handleTelegram}
            onMouseEnter={() => setShowTooltip('telegram')}
            onMouseLeave={() => setShowTooltip(null)}
            aria-label="Share on Telegram"
          >
            <i className="fab fa-telegram-plane" />
            <span className="sw-btn-label">Telegram</span>
            {showTooltip === 'telegram' && <span className="sw-tooltip">Share on Telegram</span>}
          </button>

          {/* Twitter/X */}
          <button
            className="sw-btn sw-twitter"
            onClick={handleTwitter}
            onMouseEnter={() => setShowTooltip('twitter')}
            onMouseLeave={() => setShowTooltip(null)}
            aria-label="Share on X (Twitter)"
          >
            <i className="fab fa-x-twitter" />
            <span className="sw-btn-label">X</span>
            {showTooltip === 'twitter' && <span className="sw-tooltip">Share on X</span>}
          </button>

          {/* Copy Link */}
          <button
            className={`sw-btn sw-copy ${copied ? 'copied' : ''}`}
            onClick={handleCopyLink}
            onMouseEnter={() => setShowTooltip('copy')}
            onMouseLeave={() => setShowTooltip(null)}
            aria-label="Copy link"
          >
            <i className={`fas ${copied ? 'fa-check' : 'fa-link'}`} />
            <span className="sw-btn-label">{copied ? 'Copied!' : 'Copy'}</span>
            {showTooltip === 'copy' && (
              <span className="sw-tooltip">{copied ? 'Copied!' : 'Copy link'}</span>
            )}
          </button>
        </div>
      </div>
    </>
  );
}

// ============================================================
// HELPERS
// ============================================================

function formatPhone(raw: string): string {
  const digits = raw.replace(/[^0-9]/g, '');
  if (digits.length === 10) return `+91 ${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+91 ${digits.slice(2, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`;
  return raw;
}

// ============================================================
// STYLES
// ============================================================

const SHARE_STYLES = `
.sw-root {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 16px;
  background: var(--card, #0d1c14);
  border: 1px solid var(--border, #1a3326);
  border-radius: var(--r, 14px);
}

.sw-label {
  font-size: 10px;
  font-weight: 600;
  color: var(--muted, #4a6b58);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.sw-label i {
  color: var(--accent, #00e676);
  font-size: 10px;
}

.sw-buttons {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.sw-btn {
  position: relative;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 16px;
  border-radius: var(--rs, 8px);
  border: 1px solid var(--border, #1a3326);
  background: var(--bg2, #091410);
  color: var(--fg2, #a5c4b5);
  font-family: 'Space Grotesk', sans-serif;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.sw-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.sw-btn:active {
  transform: translateY(0);
}

.sw-btn i {
  font-size: 14px;
}

.sw-btn-label {
  display: inline;
}

@media (max-width: 400px) {
  .sw-btn-label { display: none; }
  .sw-btn { padding: 10px 12px; }
  .sw-btn i { font-size: 16px; }
}

/* WhatsApp */
.sw-whatsapp { border-color: rgba(37, 211, 102, 0.3); }
.sw-whatsapp:hover {
  background: rgba(37, 211, 102, 0.12);
  border-color: #25d366;
  color: #25d366;
}
.sw-whatsapp i { color: #25d366; }

/* Telegram */
.sw-telegram { border-color: rgba(0, 136, 204, 0.3); }
.sw-telegram:hover {
  background: rgba(0, 136, 204, 0.12);
  border-color: #0088cc;
  color: #0088cc;
}
.sw-telegram i { color: #0088cc; }

/* Twitter/X */
.sw-twitter { border-color: rgba(255, 255, 255, 0.15); }
.sw-twitter:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.3);
  color: #fff;
}
.sw-twitter i { color: #fff; }

/* Copy */
.sw-copy { border-color: var(--border, #1a3326); }
.sw-copy:hover {
  background: rgba(0, 230, 118, 0.08);
  border-color: var(--accent, #00e676);
  color: var(--accent, #00e676);
}
.sw-copy.copied {
  background: var(--ad, rgba(0,230,118,.1));
  border-color: var(--accent, #00e676);
  color: var(--accent, #00e676);
}

/* Tooltip */
.sw-tooltip {
  position: absolute;
  bottom: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
  padding: 4px 10px;
  background: var(--fg, #e0f2e9);
  color: var(--bg, #050c07);
  font-size: 9px;
  font-weight: 600;
  border-radius: 4px;
  white-space: nowrap;
  pointer-events: none;
  animation: sw-tooltip-in 0.15s ease;
  z-index: 100;
}

.sw-tooltip::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border: 5px solid transparent;
  border-top-color: var(--fg, #e0f2e9);
}

@keyframes sw-tooltip-in {
  from { opacity: 0; transform: translateX(-50%) translateY(4px); }
  to { opacity: 1; transform: translateX(-50%) translateY(0); }
}
`;
