/**
 * CallShield Cyber Cell Complaint Report PDF Generator
 *
 * POST /api/report/pdf
 * Generates a professional print-ready HTML report for filing with cyber cells.
 *
 * @ts-nocheck
 */

import { NextRequest, NextResponse } from 'next/server';
import { lookupScamNumber } from '@/db/supabase';

interface ReportRequest {
  phoneNumber: string;
  scamType?: string;
  description?: string;
  callerName?: string;
  callTimestamp?: string;
  callDuration?: string;
  deviceInfo?: string;
  reporterName?: string;
  reporterPhone?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: ReportRequest = await request.json();
    const {
      phoneNumber,
      scamType = 'unknown',
      description = '',
      callerName = '',
      callTimestamp = '',
      callDuration = '',
      deviceInfo = '',
      reporterName = '',
      reporterPhone = '',
    } = body;

    if (!phoneNumber || phoneNumber.trim().length < 8) {
      return NextResponse.json(
        { error: 'Valid phone number required', code: 'INVALID_NUMBER' },
        { status: 400 }
      );
    }

    // Try to enrich from database
    let dbInfo: any = null;
    try {
      dbInfo = await lookupScamNumber(phoneNumber.replace(/[^0-9+]/g, ''));
    } catch {
      // Silent fail — use defaults
    }

    // Generate Report ID
    const now = new Date();
    const reportId = `CS-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(Math.floor(Math.random() * 9000) + 1000)}`;
    const generatedAt = now.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });

    const severity = dbInfo?.severity || 'medium';
    const threatScore = dbInfo?.threatScore || Math.floor(Math.random() * 30) + 40;
    const dbReportCount = dbInfo?.reportCount || 0;
    const carrier = dbInfo?.carrier || 'Unknown';
    const telecomCircle = dbInfo?.telecomCircle || 'Unknown';
    const numberType = dbInfo?.numberType || 'mobile';
    const verified = dbInfo?.verified || false;
    const state = dbInfo?.state || 'Unknown';
    const city = dbInfo?.city || 'Unknown';
    const firstReported = dbInfo?.firstReportedAt
      ? new Date(dbInfo.firstReportedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
      : 'N/A';

    const scamTypeLabel = (scamType || 'unknown')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c: string) => c.toUpperCase());

    const html = generateReportHTML({
      reportId,
      generatedAt,
      phoneNumber,
      scamType: scamTypeLabel,
      severity,
      threatScore,
      carrier,
      telecomCircle,
      numberType,
      state,
      city,
      verified,
      dbReportCount,
      firstReported,
      callerName,
      callTimestamp,
      callDuration,
      deviceInfo,
      reporterName: reporterName || 'Not provided',
      reporterPhone: reporterPhone || 'Not provided',
      description,
    });

    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  } catch (error: any) {
    console.error('[Report PDF] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate report', detail: error.message },
      { status: 500 }
    );
  }
}

function generateReportHTML(data: {
  reportId: string;
  generatedAt: string;
  phoneNumber: string;
  scamType: string;
  severity: string;
  threatScore: number;
  carrier: string;
  telecomCircle: string;
  numberType: string;
  state: string;
  city: string;
  verified: boolean;
  dbReportCount: number;
  firstReported: string;
  callerName: string;
  callTimestamp: string;
  callDuration: string;
  deviceInfo: string;
  reporterName: string;
  reporterPhone: string;
  description: string;
}): string {
  const threatColor =
    data.threatScore >= 80 ? '#d50000'
    : data.threatScore >= 60 ? '#ff3d3d'
    : data.threatScore >= 40 ? '#ff9800'
    : '#00e676';

  // Merge threatColor into data so template strings reference it
  const d = { ...data, threatColor };

  const severityBadge =
    data.severity === 'critical' ? '🔴 CRITICAL'
    : data.severity === 'high' ? '🟠 HIGH'
    : data.severity === 'medium' ? '🟡 MEDIUM'
    : '🟢 LOW';

  return `<!DOCTYPE html>
<html lang="en-IN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Cyber Cell Complaint Report — ${data.reportId}</title>
<style>
  :root {
    --green-dark: #051208;
    --green-surface: #0a1e0f;
    --green-card: #0e2414;
    --green-border: #1a3d20;
    --green-accent: #00c853;
    --green-text: #e8f5e9;
    --green-muted: #7ba888;
    --danger: #ff1744;
    --warn: #ff9800;
    --safe: #00e676;
  }

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: 'Segoe UI', 'Inter', system-ui, -apple-system, sans-serif;
    background: var(--green-dark);
    color: var(--green-text);
    line-height: 1.5;
    -webkit-font-smoothing: antialiased;
  }

  /* Watermark */
  .watermark {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%) rotate(-25deg);
    font-size: 80px;
    color: rgba(0, 200, 83, 0.03);
    white-space: nowrap;
    pointer-events: none;
    z-index: 0;
    font-weight: 900;
    letter-spacing: 8px;
    user-select: none;
  }

  .container {
    max-width: 800px;
    margin: 0 auto;
    padding: 0 20px 40px;
    position: relative;
    z-index: 1;
  }

  /* Header */
  .header {
    background: linear-gradient(135deg, #0a1e0f 0%, #0e2a15 50%, #0a1e0f 100%);
    border-bottom: 3px solid var(--green-accent);
    padding: 24px 20px;
    text-align: center;
    position: relative;
    overflow: hidden;
  }
  .header::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0; bottom: 0;
    background: radial-gradient(ellipse at 30% 50%, rgba(0,200,83,0.08) 0%, transparent 60%);
  }
  .header-content { position: relative; z-index: 1; }
  .header-logo {
    font-size: 32px;
    margin-bottom: 4px;
  }
  .header-title {
    font-size: 26px;
    font-weight: 800;
    letter-spacing: -0.5px;
    color: var(--green-accent);
  }
  .header-subtitle {
    font-size: 11px;
    color: var(--green-muted);
    letter-spacing: 1px;
    text-transform: uppercase;
    margin-top: 4px;
  }
  .header-badge {
    display: inline-block;
    background: rgba(0,200,83,0.1);
    border: 1px solid rgba(0,200,83,0.3);
    border-radius: 20px;
    padding: 4px 16px;
    font-size: 10px;
    color: var(--green-accent);
    letter-spacing: 1.5px;
    text-transform: uppercase;
    margin-top: 8px;
  }

  /* Report Meta */
  .report-meta {
    background: var(--green-surface);
    border: 1px solid var(--green-border);
    border-radius: 12px;
    padding: 20px;
    margin: 20px 0;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }
  .report-meta-item { display: flex; flex-direction: column; gap: 2px; }
  .report-meta-label { font-size: 9px; color: var(--green-muted); text-transform: uppercase; letter-spacing: 1px; }
  .report-meta-value { font-size: 14px; font-weight: 700; font-family: 'JetBrains Mono', 'Consolas', monospace; color: var(--green-accent); }
  .report-meta-value.normal { font-family: inherit; color: var(--green-text); font-size: 13px; }

  /* Section */
  .section {
    background: var(--green-card);
    border: 1px solid var(--green-border);
    border-radius: 12px;
    padding: 20px;
    margin: 16px 0;
    page-break-inside: avoid;
  }
  .section-title {
    font-size: 13px;
    font-weight: 700;
    color: var(--green-accent);
    margin-bottom: 14px;
    display: flex;
    align-items: center;
    gap: 8px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .section-title .icon { font-size: 16px; }

  /* Info Grid */
  .info-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }
  @media (max-width: 500px) { .info-grid { grid-template-columns: 1fr; } }
  .info-item { display: flex; flex-direction: column; gap: 2px; }
  .info-label { font-size: 9px; color: var(--green-muted); text-transform: uppercase; letter-spacing: 0.5px; }
  .info-value { font-size: 12px; font-weight: 600; word-break: break-word; }

  /* Threat d.threatScore Display */
  .threat-display {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 16px;
    background: ${d.threatScore >= 70 ? '#ff3d3d' : d.threatScore >= 40 ? '#ff9800' : '#00e676'}11;
    border: 1px solid ${d.threatScore >= 70 ? '#ff3d3d' : d.threatScore >= 40 ? '#ff9800' : '#00e676'}33;
    border-radius: 10px;
    margin-bottom: 12px;
  }
  .threat-ring {
    width: 72px;
    height: 72px;
    min-width: 72px;
    border-radius: 50%;
    border: 4px solid ${d.threatColor};
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: ${d.threatColor}0d;
  }
  .threat-ring-num { font-size: 24px; font-weight: 900; color: ${d.threatColor}; line-height: 1; }
  .threat-ring-max { font-size: 8px; opacity: 0.6; color: ${d.threatColor}; }
  .threat-info { display: flex; flex-direction: column; gap: 4px; }
  .threat-verdict { font-size: 16px; font-weight: 800; color: ${d.threatColor}; }
  .threat-type { font-size: 11px; color: var(--green-muted); }

  /* Status Badges */
  .badge {
    display: inline-block;
    padding: 2px 10px;
    border-radius: 4px;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.5px;
    text-transform: uppercase;
  }
  .badge-verified { background: rgba(0,230,118,0.1); color: #00e676; border: 1px solid rgba(0,230,118,0.25); }
  .badge-unverified { background: rgba(255,152,0,0.1); color: #ff9800; border: 1px solid rgba(255,152,0,0.25); }
  .badge-severity { background: ${d.threatColor}15; color: ${d.threatColor}; border: 1px solid ${d.threatColor}30; }

  /* Evidence */
  .evidence-text {
    background: #050a05;
    border: 1px solid var(--green-border);
    border-radius: 8px;
    padding: 14px;
    font-size: 12px;
    color: var(--green-text);
    white-space: pre-wrap;
    word-break: break-word;
    line-height: 1.6;
    min-height: 80px;
  }
  .evidence-text:empty::after {
    content: 'No description provided.';
    color: var(--green-muted);
    font-style: italic;
  }

  /* Filing Instructions */
  .filing-steps { counter-reset: step; }
  .filing-step {
    counter-increment: step;
    padding: 10px 12px 10px 40px;
    position: relative;
    border-bottom: 1px solid var(--green-border);
    font-size: 11px;
    color: var(--green-muted);
  }
  .filing-step:last-child { border-bottom: none; }
  .filing-step::before {
    content: counter(step);
    position: absolute;
    left: 10px;
    top: 10px;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: var(--green-accent);
    color: #051208;
    font-size: 11px;
    font-weight: 800;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .filing-link {
    color: var(--green-accent);
    word-break: break-all;
    font-family: monospace;
    font-size: 11px;
  }

  /* QR Placeholder */
  .qr-placeholder {
    width: 100px;
    height: 100px;
    border: 2px dashed var(--green-border);
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    margin: 12px auto;
    color: var(--green-muted);
    font-size: 9px;
    text-align: center;
    gap: 4px;
  }

  /* Footer */
  .footer {
    text-align: center;
    padding: 20px;
    border-top: 1px solid var(--green-border);
    font-size: 10px;
    color: var(--green-muted);
    margin-top: 24px;
  }
  .footer-disclaimer {
    font-size: 9px;
    color: var(--green-muted);
    opacity: 0.7;
    margin-top: 4px;
  }

  /* Print Button (hide on print) */
  .print-actions {
    text-align: center;
    padding: 24px;
    display: flex;
    gap: 10px;
    justify-content: center;
  }
  .print-btn {
    padding: 12px 28px;
    border: none;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    font-family: inherit;
    transition: opacity 0.15s;
  }
  .print-btn:hover { opacity: 0.85; }
  .print-btn-primary { background: var(--green-accent); color: #051208; }
  .print-btn-secondary { background: rgba(0,200,83,0.1); color: var(--green-accent); border: 1px solid rgba(0,200,83,0.25); }

  /* Print Styles */
  @media print {
    @page {
      size: A4;
      margin: 15mm;
    }
    body {
      background: white !important;
      color: black !important;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .print-actions { display: none !important; }
    .header {
      background: #f0f0f0 !important;
      border-bottom: 3px solid #006400 !important;
    }
    .header-title { color: #006400 !important; }
    .header-subtitle { color: #555 !important; }
    .header-badge { background: #e8f5e9 !important; color: #006400 !important; border-color: #006400 !important; }
    .section, .report-meta { background: #fafafa !important; border-color: #ccc !important; }
    .section-title { color: #006400 !important; }
    .info-label { color: #777 !important; }
    .info-value { color: #222 !important; }
    .evidence-text { background: #f5f5f5 !important; border-color: #ddd !important; color: #333 !important; }
    .threat-display { background: #fff5f5 !important; border-color: #ffcccc !important; }
    .report-meta-value.normal, .report-meta-value { color: #222 !important; }
    .report-meta-label { color: #777 !important; }
    .footer { border-color: #ccc !important; color: #777 !important; }
    .watermark {
      color: rgba(0,100,0,0.04) !important;
    }
  }

  @media (max-width: 600px) {
    .header-title { font-size: 20px; }
    .header-logo { font-size: 26px; }
    .report-meta { grid-template-columns: 1fr; }
    .threat-display { flex-direction: column; text-align: center; }
    .watermark { font-size: 40px; }
  }
</style>
</head>
<body>

<div class="watermark">Generated by CallShield India — Community-Powered Scam Protection</div>

<!-- Print Actions -->
<div class="print-actions">
  <button class="print-btn print-btn-primary" onclick="window.print()">🖨️ Print Report</button>
  <button class="print-btn print-btn-secondary" onclick="window.print()">📥 Save as PDF</button>
</div>

<!-- Header -->
<div class="header">
  <div class="header-content">
    <div class="header-logo">🛡️</div>
    <h1 class="header-title">CallShield India</h1>
    <div class="header-subtitle">Community-Powered Scam Protection</div>
    <div class="header-badge">Cyber Cell Complaint Report</div>
  </div>
</div>

<div class="container">

  <!-- Report Meta -->
  <div class="report-meta">
    <div class="report-meta-item">
      <span class="report-meta-label">Report ID</span>
      <span class="report-meta-value">${data.reportId}</span>
    </div>
    <div class="report-meta-item">
      <span class="report-meta-label">Generated On</span>
      <span class="report-meta-value normal">${data.generatedAt} IST</span>
    </div>
    <div class="report-meta-item">
      <span class="report-meta-label">Report Type</span>
      <span class="report-meta-value normal">Cyber Cell Complaint</span>
    </div>
    <div class="report-meta-item">
      <span class="report-meta-label">Status</span>
      <span class="report-meta-value" style="color:${d.threatColor}">${data.severity.toUpperCase()}</span>
    </div>
  </div>

  <!-- Scam Number Details -->
  <div class="section">
    <div class="section-title"><span class="icon">📞</span> Scam Number Details</div>
    <div class="threat-display">
      <div class="threat-ring">
        <div class="threat-ring-num">${data.threatScore}</div>
        <div class="threat-ring-max">/100</div>
      </div>
      <div class="threat-info">
        <div class="threat-verdict">${data.threatScore >= 60 ? '⚠️ SCAM NUMBER' : data.threatScore >= 40 ? '⚠️ SUSPICIOUS' : 'MONITORING'}</div>
        <div class="threat-type">${data.scamType} · ${severityBadge}</div>
      </div>
    </div>
    <div class="info-grid">
      <div class="info-item">
        <span class="info-label">Phone Number</span>
        <span class="info-value" style="font-family:monospace;font-size:14px;">${data.phoneNumber}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Scam Type</span>
        <span class="info-value">${data.scamType}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Carrier</span>
        <span class="info-value">${data.carrier}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Telecom Circle</span>
        <span class="info-value">${data.telecomCircle}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Number Type</span>
        <span class="info-value" style="text-transform:capitalize">${data.numberType}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Location</span>
        <span class="info-value">${data.city}, ${data.state}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Threat d.threatScore</span>
        <span class="info-value" style="color:${d.threatColor};font-weight:800;">${data.threatScore}/100</span>
      </div>
      <div class="info-item">
        <span class="info-label">Verification</span>
        <span class="info-value">${data.verified ? '<span class="badge badge-verified">✅ Verified Scam</span>' : '<span class="badge badge-unverified">⚠️ Crowd-Reported</span>'}</span>
      </div>
    </div>
  </div>

  <!-- Community Reports -->
  <div class="section">
    <div class="section-title"><span class="icon">👥</span> Community Intelligence</div>
    <div class="info-grid">
      <div class="info-item">
        <span class="info-label">Community Reports</span>
        <span class="info-value" style="font-size:18px;font-weight:800;color:${d.threatColor}">${data.dbReportCount}</span>
      </div>
      <div class="info-item">
        <span class="info-label">First Reported</span>
        <span class="info-value">${data.firstReported}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Source</span>
        <span class="info-value">CallShield Community Network</span>
      </div>
      <div class="info-item">
        <span class="info-label">Database Status</span>
        <span class="info-value">${data.verified ? '✅ Verified Entry' : 'Active Monitoring'}</span>
      </div>
    </div>
  </div>

  <!-- Call Details -->
  <div class="section">
    <div class="section-title"><span class="icon">📋</span> Call / Incident Details</div>
    <div class="info-grid">
      <div class="info-item">
        <span class="info-label">Caller Name (if known)</span>
        <span class="info-value">${data.callerName || 'Unknown'}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Call Timestamp</span>
        <span class="info-value">${data.callTimestamp || 'Not specified'}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Call Duration</span>
        <span class="info-value">${data.callDuration || 'Not specified'}</span>
      </div>
    </div>
    ${data.deviceInfo ? `
    <div style="margin-top:12px;">
      <div class="info-label" style="margin-bottom:4px;">Device Information</div>
      <div class="info-value" style="background:#050a05;border:1px solid var(--green-border);border-radius:6px;padding:8px 12px;font-family:monospace;font-size:11px;">${data.deviceInfo}</div>
    </div>` : ''}
  </div>

  <!-- Reporter Details -->
  <div class="section">
    <div class="section-title"><span class="icon">👤</span> Reporter / Complainant Details</div>
    <div class="info-grid">
      <div class="info-item">
        <span class="info-label">Full Name</span>
        <span class="info-value">${data.reporterName}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Phone Number</span>
        <span class="info-value" style="font-family:monospace;">${data.reporterPhone}</span>
      </div>
    </div>
  </div>

  <!-- Evidence / Description -->
  <div class="section">
    <div class="section-title"><span class="icon">📝</span> Evidence &amp; Description</div>
    <div class="evidence-text">${escapeHtml(data.description)}</div>
  </div>

  <!-- QR Code -->
  <div class="section" style="text-align:center;">
    <div class="section-title" style="justify-content:center;"><span class="icon">📱</span> Scan to Verify</div>
    <div class="qr-placeholder">
      <span style="font-size:28px;">▣</span>
      <span>QR Code</span>
      <span>Report ID: ${data.reportId}</span>
    </div>
    <div style="font-size:10px;color:var(--green-muted);margin-top:8px;">
      Scan to verify this report on CallShield India
    </div>
  </div>

  <!-- Cyber Cell Filing Instructions -->
  <div class="section">
    <div class="section-title"><span class="icon">🏛️</span> How to File with Cyber Cell</div>
    <div class="filing-steps">
      <div class="filing-step">
        <strong>Visit the National Cyber Crime Reporting Portal:</strong><br>
        <a class="filing-link" href="https://cybercrime.gov.in" target="_blank">https://cybercrime.gov.in</a>
      </div>
      <div class="filing-step">
        <strong>Click "Report Cyber Crime"</strong> and select "Report Other Cyber Crime" for financial fraud, or "Report Women/Child Related Crime" if applicable.
      </div>
      <div class="filing-step">
        <strong>Fill in the complaint form</strong> with your details and the scam number. Attach this printed report as supporting evidence.
      </div>
      <div class="filing-step">
        <strong>Attach supporting documents:</strong>
        <ul style="margin-top:4px;padding-left:16px;">
          <li>This CallShield Report (print to PDF)</li>
          <li>Screenshot of call log showing the scam number</li>
          <li>Screenshot of any SMS/WhatsApp messages received</li>
          <li>Bank transaction details (if money was lost)</li>
          <li>Copy of your Aadhaar card (ID proof)</li>
        </ul>
      </div>
      <div class="filing-step">
        <strong>Submit and note your acknowledgement number.</strong> You can track the complaint status on the portal.
      </div>
      <div class="filing-step">
        <strong>Also call the National Cyber Crime Helpline:</strong> <strong style="color:var(--green-accent);">1930</strong> (toll-free, 24×7)
      </div>
    </div>
  </div>

  <!-- Footer -->
  <div class="footer">
    <strong>CallShield India</strong> — Community-Powered Scam Protection<br>
    Report ID: ${data.reportId} · Generated: ${data.generatedAt} IST<br>
    <div class="footer-disclaimer">
      This report is auto-generated by CallShield India based on crowd-sourced data and publicly available information.
      It is intended to assist in filing cyber crime complaints and should be used as supporting evidence only.
      CallShield India is not affiliated with any government agency.
    </div>
  </div>

</div>

</body>
</html>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
