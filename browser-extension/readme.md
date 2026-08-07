# CallShield India — Browser Extension

Scam number protection on every webpage. Highlights Indian phone numbers and shows real-time threat scores.

## Features

- **Auto-scan** every page for Indian phone numbers (+91 / 10-digit patterns)
- **Color-coded highlights**: 🟢 Safe · 🟠 Suspicious · 🔴 Scam · ⛔ Critical
- **Hover tooltip**: Threat score, scam type, community reports
- **Popup search**: Quick manual number lookup
- **Caches results** for 5 minutes to minimize API calls
- **Debounced scanning** (500ms) to stay performant

---

## Install — Google Chrome / Brave / Edge

1. Clone or download this repository
2. Open `chrome://extensions/` in your browser
3. Enable **Developer mode** (toggle top-right)
4. Click **Load unpacked**
5. Select the `browser-extension/` folder
6. ✅ The CallShield icon should appear in your toolbar

---

## Install — Mozilla Firefox

1. Open `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on…**
3. Select `browser-extension/manifest.json`
4. ✅ Extension loads for the current session

> For permanent install in Firefox, submit to [addons.mozilla.org](https://addons.mozilla.org).

---

## How It Works

1. **Content script** scans visible text on every page
2. Detects Indian phone numbers using regex: `+91` prefix or 10-digit numbers starting with 6-9
3. Calls the CallShield `/api/lookup` endpoint for each unique number
4. Wraps numbers in color-coded `<span>` tags with hover tooltips
5. Re-scans on scroll and DOM mutations (dynamic content)

---

## Files

| File | Purpose |
|------|---------|
| `manifest.json` | Extension manifest (V3) |
| `content.js` | Page scanner and highlighter |
| `popup.html` | Toolbar popup UI |
| `popup.js` | Search handler |

---

## API

The extension calls `POST https://callshield-india-olive.vercel.app/api/lookup` with `{ phoneNumber }`.

Returns: verdict, threatScore, scamType, dbMatch, carrier, telecomCircle, and more.

---

Built for **CallShield India** 🛡️
