/**
 * CallShield India — Browser Extension Popup
 * Quick scam number lookup from the extension toolbar.
 */

'use strict';

const API_BASE = 'https://callshield-india-olive.vercel.app';

// ─── Elements ──────────────────────────────────────────────
const phoneInput = document.getElementById('phoneInput');
const searchBtn = document.getElementById('searchBtn');
const resultDiv = document.getElementById('result');
const errorMsg = document.getElementById('errorMsg');
const verdictBanner = document.getElementById('verdictBanner');
const verdictLabel = document.getElementById('verdictLabel');
const threatScore = document.getElementById('threatScore');
const detailsDiv = document.getElementById('details');

// ─── Helpers ───────────────────────────────────────────────
function showError(msg) {
  errorMsg.textContent = msg;
  errorMsg.classList.add('show');
  resultDiv.classList.remove('show');
  setTimeout(() => errorMsg.classList.remove('show'), 3000);
}

function renderResult(data) {
  const verdict = data.verdict || 'unknown';
  verdictBanner.className = 'verdict-banner ' + verdict;
  verdictLabel.textContent = verdict;
  threatScore.textContent = data.threatScore ?? '—';

  const scamType = data.scamType || data.scamTypes?.[0] || 'N/A';
  const reports = data.dbMatch?.reportCount || 0;
  const isIndian = data.isIndian ? '🇮🇳 India' : '🌍 International';
  const carrier = data.carrier || 'Unknown';
  const circle = data.telecomCircle || '—';
  const numberType = data.numberType || 'Unknown';

  detailsDiv.innerHTML = `
    <div class="detail-row"><span class="label">Scam Type</span><span class="value">${scamType}</span></div>
    <div class="detail-row"><span class="label">Reports</span><span class="value">${reports}</span></div>
    <div class="detail-row"><span class="label">Carrier</span><span class="value">${carrier}</span></div>
    <div class="detail-row"><span class="label">Circle</span><span class="value">${circle}</span></div>
    <div class="detail-row"><span class="label">Type</span><span class="value">${numberType} · ${isIndian}</span></div>
    <div class="detail-row"><span class="label">VoIP</span><span class="value">${data.isVoip ? '⚠️ Yes' : 'No'}</span></div>
  `;

  resultDiv.classList.add('show');
  errorMsg.classList.remove('show');
}

// ─── Search Handler ────────────────────────────────────────
async function doLookup() {
  const raw = phoneInput.value.trim();
  if (!raw) return showError('Please enter a phone number');

  // Basic validation
  const digits = raw.replace(/[\s\-()]/g, '');
  if (digits.length < 10) return showError('Enter a valid 10-digit or +91 number');

  searchBtn.disabled = true;
  searchBtn.textContent = '⏳ Checking...';
  errorMsg.classList.remove('show');
  resultDiv.classList.remove('show');

  try {
    const res = await fetch(`${API_BASE}/api/lookup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneNumber: raw }),
    });
    if (!res.ok) throw new Error(`Server error: ${res.status}`);
    const data = await res.json();
    renderResult(data);
  } catch (err) {
    showError('Lookup failed. Check your connection.');
  } finally {
    searchBtn.disabled = false;
    searchBtn.textContent = '🔍 Check Number';
  }
}

// ─── Bind Events ───────────────────────────────────────────
searchBtn.addEventListener('click', doLookup);
phoneInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') doLookup();
});

// Focus input on open
phoneInput.focus();
