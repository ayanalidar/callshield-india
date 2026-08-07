/**
 * CallShield India — Browser Extension Content Script
 * Scans page text for Indian phone numbers and highlights them with threat info.
 */

(function () {
  'use strict';

  // ─── Configuration ───────────────────────────────────────
  const API_BASE = 'https://callshield-india-olive.vercel.app';
  const DEBOUNCE_MS = 500;
  const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  // ─── Constants ───────────────────────────────────────────
  // Indian phone patterns: +91 prefix or 10-digit starting with 6-9
  const INDIAN_PHONE_RE = /(?:\+91[\s-]?)?[6-9]\d{9}/g;

  const VERDICT_STYLES = {
    safe:       { border: '2px solid #00e676', bg: 'rgba(0,230,118,0.08)', label: '✅ Safe' },
    suspicious: { border: '2px solid #ff9800', bg: 'rgba(255,152,0,0.08)', label: '⚠️ Suspicious' },
    scam:       { border: '2px solid #f44336', bg: 'rgba(244,67,54,0.10)', label: '🚨 Scam' },
    critical:   { border: '2px solid #b71c1c', bg: 'rgba(183,28,28,0.12)', label: '🛑 Critical' },
    unknown:    { border: '2px dashed #9e9e9e', bg: 'rgba(158,158,158,0.06)', label: '❓ Unknown' },
  };

  // ─── State ───────────────────────────────────────────────
  const lookupCache = new Map();
  let scanTimer = null;
  let highlightElements = [];

  // ─── Helpers ─────────────────────────────────────────────
  function normalizePhone(raw) {
    let digits = raw.replace(/[^\d]/g, '');
    if (digits.startsWith('91') && digits.length === 12) digits = digits.slice(2);
    if (digits.startsWith('0') && digits.length === 11) digits = digits.slice(1);
    return digits;
  }

  function debounce(fn, ms) {
    return function (...args) {
      clearTimeout(scanTimer);
      scanTimer = setTimeout(() => fn.apply(this, args), ms);
    };
  }

  // ─── API Lookup ──────────────────────────────────────────
  async function lookupNumber(phoneNumber) {
    const normalized = normalizePhone(phoneNumber);
    const cached = lookupCache.get(normalized);
    if (cached && cached.expiresAt > Date.now()) return cached.data;

    try {
      const res = await fetch(`${API_BASE}/api/lookup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: normalized }),
      });
      const data = await res.json();
      lookupCache.set(normalized, { data, expiresAt: Date.now() + CACHE_TTL_MS });
      return data;
    } catch {
      return { verdict: 'unknown', threatScore: 0, scamType: null, dbMatch: { reportCount: 0 } };
    }
  }

  // ─── Tooltip ─────────────────────────────────────────────
  let tooltipEl = null;

  function createTooltip() {
    if (tooltipEl) return;
    tooltipEl = document.createElement('div');
    tooltipEl.id = 'callshield-tooltip';
    Object.assign(tooltipEl.style, {
      position: 'fixed',
      zIndex: '2147483647',
      background: '#060e08',
      color: '#e0e0e0',
      border: '1px solid #00e676',
      borderRadius: '8px',
      padding: '10px 14px',
      fontSize: '13px',
      fontFamily: "'Space Grotesk', 'Segoe UI', sans-serif",
      maxWidth: '280px',
      boxShadow: '0 4px 24px rgba(0,0,0,0.6)',
      pointerEvents: 'none',
      opacity: '0',
      transition: 'opacity 0.15s',
      lineHeight: '1.5',
    });
    document.body.appendChild(tooltipEl);
  }

  function showTooltip(e, data) {
    createTooltip();
    const verdict = data.verdict || 'unknown';
    const style = VERDICT_STYLES[verdict] || VERDICT_STYLES.unknown;
    const scamType = data.scamType || data.scamTypes?.[0] || 'N/A';
    const reports = data.dbMatch?.reportCount || 0;
    const score = data.threatScore ?? 0;
    const severity = data.severity || 'unknown';

    tooltipEl.innerHTML = `
      <div style="font-weight:700;font-size:14px;margin-bottom:4px;">${style.label}</div>
      <div style="display:flex;gap:12px;font-size:12px;color:#aaa;">
        <span>Score: <b style="color:#00e676;">${score}/100</b></span>
        <span>Reports: <b>${reports}</b></span>
      </div>
      <div style="margin-top:4px;font-size:12px;">
        Type: <span style="color:#ff9800;">${scamType}</span>
        ${severity !== 'unknown' ? ` · ${severity.toUpperCase()}` : ''}
      </div>
    `;
    tooltipEl.style.left = (e.clientX + 12) + 'px';
    tooltipEl.style.top = (e.clientY + 12) + 'px';
    tooltipEl.style.opacity = '1';
  }

  function hideTooltip() {
    if (tooltipEl) tooltipEl.style.opacity = '0';
  }

  // ─── Highlighting ────────────────────────────────────────
  function clearHighlights() {
    highlightElements.forEach(el => {
      el.style.border = el._csOriginalBorder || '';
      el.style.background = el._csOriginalBg || '';
      el.style.borderRadius = el._csOriginalRadius || '';
      el.removeEventListener('mouseenter', el._csHoverIn);
      el.removeEventListener('mouseleave', el._csHoverOut);
    });
    highlightElements = [];
  }

  async function highlightPhoneNumbers() {
    clearHighlights();

    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      { acceptNode: (node) => {
        if (node.parentElement?.tagName === 'SCRIPT') return NodeFilter.FILTER_REJECT;
        if (node.parentElement?.tagName === 'STYLE') return NodeFilter.FILTER_REJECT;
        if (node.parentElement?.id === 'callshield-tooltip') return NodeFilter.FILTER_REJECT;
        return INDIAN_PHONE_RE.test(node.textContent) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }}
    );

    const textNodes = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode);

    // Collect unique phone numbers
    const seen = new Set();
    const phones = [];
    for (const node of textNodes) {
      const matches = node.textContent.matchAll(INDIAN_PHONE_RE);
      for (const m of matches) {
        const raw = m[0];
        const norm = normalizePhone(raw);
        if (!seen.has(norm)) {
          seen.add(norm);
          phones.push({ raw, norm, node, index: m.index });
        }
      }
    }

    if (phones.length === 0) return;

    // Batch lookups
    const results = await Promise.all(phones.map(p => lookupNumber(p.raw)));
    const phoneMap = new Map(phones.map((p, i) => [p.norm, { ...p, data: results[i] }]));

    // Wrap matches in spans and highlight
    for (const node of textNodes) {
      const parent = node.parentElement;
      if (!parent) continue;

      const text = node.textContent;
      INDIAN_PHONE_RE.lastIndex = 0;

      const parts = [];
      let lastIdx = 0;
      for (const m of text.matchAll(INDIAN_PHONE_RE)) {
        const norm = normalizePhone(m[0]);
        const entry = phoneMap.get(norm);
        if (!entry) continue;
        const verdict = entry.data?.verdict || 'unknown';
        const style = VERDICT_STYLES[verdict] || VERDICT_STYLES.unknown;

        if (m.index > lastIdx) {
          parts.push(document.createTextNode(text.slice(lastIdx, m.index)));
        }

        const span = document.createElement('span');
        span.textContent = m[0];
        span._csOriginalBorder = span.style.border;
        span._csOriginalBg = span.style.background;
        span._csOriginalRadius = span.style.borderRadius;

        Object.assign(span.style, {
          border: style.border,
          background: style.bg,
          borderRadius: '4px',
          padding: '1px 3px',
          cursor: 'help',
          transition: 'all 0.15s',
        });

        span._csHoverIn = (e) => showTooltip(e, entry.data);
        span._csHoverOut = () => hideTooltip();
        span.addEventListener('mouseenter', span._csHoverIn);
        span.addEventListener('mouseleave', span._csHoverOut);

        parts.push(span);
        highlightElements.push(span);
        lastIdx = m.index + m[0].length;
      }

      if (lastIdx < text.length) {
        parts.push(document.createTextNode(text.slice(lastIdx)));
      }

      if (parts.length > 0) {
        const frag = document.createDocumentFragment();
        parts.forEach(p => frag.appendChild(p));
        parent.replaceChild(frag, node);
      }
    }
  }

  // ─── Init ────────────────────────────────────────────────
  const debouncedScan = debounce(highlightPhoneNumbers, DEBOUNCE_MS);

  // Initial scan after DOM settles
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(debouncedScan, 300);
  } else {
    document.addEventListener('DOMContentLoaded', () => setTimeout(debouncedScan, 300));
  }

  // Re-scan on scroll end
  let scrollTimer;
  document.addEventListener('scroll', () => {
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(debouncedScan, 400);
  }, { passive: true });

  // MutationObserver for dynamic content
  const observer = new MutationObserver(() => debouncedScan());
  observer.observe(document.body, { childList: true, subtree: true });
})();
