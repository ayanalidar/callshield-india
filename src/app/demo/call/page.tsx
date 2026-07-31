'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

type CallerInfo = {
  phoneNumber: string;
  name: string | null;
  displayName: string | null;
  location: string | null;
  city: string | null;
  state: string | null;
  telecomCircle: string | null;
  carrier: string | null;
  numberType: string | null;
  country: string;
  isIndian: boolean;
  isVoip: boolean;
  isScam: boolean;
  scamType: string | null;
  severity: string;
  threatScore: number;
  verdict: string;
  shouldBlock: boolean;
  reportCount: number;
  recentReportCount: number;
  verified: boolean;
  source: string | null;
  warnings: string[];
  deviceInfo: {
    imei: string | null;
    deviceModel: string | null;
    networkType: string | null;
    signalStrength: string | null;
    roaming: boolean;
    towerLocation: string | null;
  } | null;
};

const SCAM_SCENARIOS = [
  { label: 'UPI Payment Fraud', number: '+919876543210', desc: 'Caller claims your UPI is blocked, demands OTP' },
  { label: 'FedEx Customs Scam', number: '+919988776655', desc: 'Parcel held at customs, ₹2,500 payment demanded' },
  { label: 'Bank OTP Theft', number: '+918765432109', desc: 'Pretends to be SBI, asks for OTP to "unblock" account' },
  { label: 'Loan App Harassment', number: '+911401000042', desc: 'Threatens contacts if loan not repaid immediately' },
  { label: 'Sextortion / Blackmail', number: '+9221122334455', desc: 'Claims to have video, demands money via UPI' },
  { label: 'Fake Police / CBI', number: '+917310123456', desc: 'Claims to be police, demands money to close case' },
  { label: 'Unknown International', number: '+447700900123', desc: 'UK number — could be wangiri or job scam' },
];

export default function CallDemoPage() {
  const [step, setStep] = useState<'idle' | 'ringing' | 'scanning' | 'result' | 'blocked' | 'answered'>('idle');
  const [selectedScenario, setSelectedScenario] = useState(SCAM_SCENARIOS[0]);
  const [callerInfo, setCallerInfo] = useState<CallerInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoCaptured, setPhotoCaptured] = useState(false);
  const [simulatedSeconds, setSimulatedSeconds] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const ringInterval = useRef<ReturnType<typeof setInterval>>();

  // Simulate call screen
  const triggerCall = useCallback((scenario: typeof SCAM_SCENARIOS[0]) => {
    setSelectedScenario(scenario);
    setStep('ringing');
    setCallerInfo(null);
    setPhoto(null);
    setPhotoCaptured(false);
    setSimulatedSeconds(0);
    setError('');
    stopCamera();
  }, []);

  const answerCall = useCallback(async () => {
    setStep('scanning');
    setLoading(true);

    // Simulate 2 second scan
    await new Promise(r => setTimeout(r, 2000));

    try {
      const [lookupRes, callerIdRes] = await Promise.all([
        fetch('/api/lookup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phoneNumber: selectedScenario.number, protectionLevel: 'strict' }),
        }),
        fetch('/api/caller-id', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            phoneNumber: selectedScenario.number,
            deviceInfo: {
              imei: '359876543210123',
              deviceModel: 'Samsung Galaxy S24 Ultra',
              networkType: '5G NR',
              signalStrength: '-72dBm',
              roaming: false,
              towerLocation: 'LTE MCC=404 MNC=86 CI=82345678 TAC=1234',
            }
          }),
        }),
      ]);

      const lookupData = await lookupRes.json();
      const callerIdData = await callerIdRes.json();

      // Merge into CallerInfo
      const info: CallerInfo = {
        phoneNumber: callerIdData.phoneNumber || selectedScenario.number,
        name: callerIdData.name || null,
        displayName: callerIdData.displayName || null,
        location: callerIdData.location || null,
        city: callerIdData.city || null,
        state: callerIdData.state || null,
        telecomCircle: callerIdData.telecomCircle || null,
        carrier: callerIdData.carrier || null,
        numberType: callerIdData.numberType || 'mobile',
        country: callerIdData.country || 'India',
        isIndian: callerIdData.isIndian ?? true,
        isVoip: callerIdData.isVoip ?? false,
        isScam: callerIdData.isScam ?? lookupData.isScam,
        scamType: callerIdData.scamType || lookupData.scamType || null,
        severity: callerIdData.severity || lookupData.severity || 'high',
        threatScore: callerIdData.threatScore ?? lookupData.threatScore ?? 0,
        verdict: callerIdData.verdict || lookupData.verdict || 'safe',
        shouldBlock: callerIdData.shouldBlock ?? lookupData.shouldBlock ?? false,
        reportCount: callerIdData.reportCount ?? lookupData.dbMatch?.reportCount ?? 0,
        recentReportCount: callerIdData.recentReportCount ?? 0,
        verified: callerIdData.verified ?? false,
        source: callerIdData.source || 'api',
        warnings: callerIdData.warnings || lookupData.warnings || [],
        deviceInfo: callerIdData.deviceInfo || {
          imei: '359876543210123',
          deviceModel: 'Samsung Galaxy S24 Ultra',
          networkType: '5G NR',
          signalStrength: '-72dBm',
          roaming: false,
          towerLocation: 'LTE MCC=404 MNC=86 CI=82345678 TAC=1234',
        },
      };

      setCallerInfo(info);

      // If should block, simulate auto-block
      if (info.shouldBlock) {
        setTimeout(() => setStep('blocked'), 2000);
      } else {
        setStep('answered');
      }
    } catch (e: any) {
      setError('Scan failed — network error');
      setStep('answered');
    } finally {
      setLoading(false);
    }
  }, [selectedScenario]);

  const declineCall = useCallback(() => {
    setStep('idle');
    stopCamera();
  }, []);

  // Camera
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      streamRef.current = stream;
    } catch (e) {
      console.log('Camera not available or permission denied');
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  }, []);

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    setPhoto(dataUrl);
    setPhotoCaptured(true);
    stopCamera();
  }, [stopCamera]);

  // Start camera when call is being scanned
  useEffect(() => {
    if (step === 'scanning') startCamera();
    return () => stopCamera();
  }, [step, startCamera, stopCamera]);

  const resetAll = () => {
    setStep('idle');
    setCallerInfo(null);
    setPhoto(null);
    setPhotoCaptured(false);
    stopCamera();
  };

  return (
    <main style={{ minHeight: '100dvh', background: '#060e08', color: '#e0f2e9', fontFamily: 'Inter, Space Grotesk, system-ui, sans-serif', overflow: 'hidden', position: 'relative' }}>
      <style>{CSS}</style>

      {step === 'idle' && (
        <div className="idle-wrap">
          <div className="demo-header">
            <div className="demo-logo">🛡️ CallShield Demo</div>
            <div className="demo-sub">Simulate an incoming scam call and see what happens</div>
          </div>

          <div className="scenario-grid">
            {SCAM_SCENARIOS.map((s, i) => (
              <button key={i} className="scenario-card" onClick={() => triggerCall(s)}>
                <div className="sc-emoji">
                  {s.label.includes('UPI') ? '💸' :
                   s.label.includes('FedEx') ? '📦' :
                   s.label.includes('Bank') ? '🏦' :
                   s.label.includes('Loan') ? '💰' :
                   s.label.includes('Sextortion') ? '😈' :
                   s.label.includes('Police') ? '👮' : '🌍'}
                </div>
                <div className="sc-label">{s.label}</div>
                <div className="sc-number">{s.number}</div>
                <div className="sc-desc">{s.desc}</div>
                <div className="sc-action">📞 Simulate Call</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {step !== 'idle' && (
        <div className="call-screen">
          {/* Caller info */}
          <div className="call-header">
            <div className={`call-status-badge ${step === 'blocked' ? 'blocked' : step === 'ringing' ? 'ringing' : 'active'}`}>
              {step === 'blocked' ? '🛑 BLOCKED' : step === 'ringing' ? '📞 Incoming Call' : step === 'scanning' ? '🔍 Scanning...' : '📞 Active Call'}
            </div>
            {simulatedSeconds > 0 && <div className="call-timer">{Math.floor(simulatedSeconds / 60)}:{String(simulatedSeconds % 60).padStart(2, '0')}</div>}
          </div>

          {/* Camera Preview */}
          {(step === 'scanning' || step === 'answered') && !photoCaptured && (
            <div className="camera-section">
              <div className="camera-label">📷 Camera Active — Capturing caller evidence</div>
              <video ref={videoRef} className="camera-preview" playsInline muted />
              <canvas ref={canvasRef} style={{ display: 'none' }} />
              <button className="capture-btn" onClick={capturePhoto}>
                📸 Capture Photo
              </button>
            </div>
          )}

          {photoCaptured && photo && (
            <div className="camera-section">
              <div className="camera-label">📷 Photo Captured — Evidence Saved</div>
              <img src={photo} className="photo-preview" alt="Caller photo" />
              <div className="photo-timestamp">Captured: {new Date().toLocaleTimeString()} | Saved to device</div>
            </div>
          )}

          {/* Loading during scan */}
          {step === 'scanning' && loading && (
            <div className="scan-animation">
              <div className="scan-spinner" />
              <div className="scan-text">Analyzing {selectedScenario.number}...</div>
              <div className="scan-steps">
                <div className="scan-step done">✓ Normalizing number</div>
                <div className="scan-step done">✓ Checking local cache</div>
                <div className="scan-step active">⟳ Querying scam database</div>
                <div className="scan-step">○ Analyzing threat patterns</div>
              </div>
            </div>
          )}

          {/* Caller info card */}
          {callerInfo && (step === 'answered' || step === 'blocked') && (
            <div className="caller-info-card">
              <div className={`verdict-strip ${callerInfo.shouldBlock ? 'scam' : callerInfo.verdict === 'suspicious' ? 'warn' : 'safe'}`}>
                <div className="verdict-icon">
                  {callerInfo.shouldBlock ? '🛑' : callerInfo.verdict === 'suspicious' ? '⚠️' : '✅'}
                </div>
                <div className="verdict-text">
                  {callerInfo.shouldBlock ? 'SCAM CALL — BLOCKED' :
                   callerInfo.verdict === 'suspicious' ? 'SUSPICIOUS — PROCEED WITH CAUTION' :
                   'SAFE — NO THREAT DETECTED'}
                </div>
              </div>

              <div className="info-sections">
                {/* Identity */}
                <div className="info-block">
                  <div className="info-title">👤 Caller Identity</div>
                  <div className="info-row"><span>Phone</span><span className="mono">{callerInfo.phoneNumber}</span></div>
                  <div className="info-row"><span>Scam Type</span><span className={callerInfo.isScam ? 'danger' : 'safe-t'}>{callerInfo.scamType?.replace(/_/g, ' ') || 'None'}</span></div>
                  <div className="info-row"><span>Threat Score</span><span><strong>{callerInfo.threatScore}</strong>/100</span></div>
                  <div className="info-row"><span>Verdict</span><span className={callerInfo.shouldBlock ? 'danger' : 'safe-t'}>{callerInfo.verdict.toUpperCase()}</span></div>
                </div>

                {/* Location */}
                <div className="info-block">
                  <div className="info-title">📍 Location & Network</div>
                  <div className="info-row"><span>Location</span><span>{callerInfo.location || 'Unknown'}</span></div>
                  <div className="info-row"><span>City</span><span>{callerInfo.city || 'N/A'}</span></div>
                  <div className="info-row"><span>State / Circle</span><span>{callerInfo.state || callerInfo.telecomCircle || 'N/A'}</span></div>
                  <div className="info-row"><span>Country</span><span>{callerInfo.country} {callerInfo.isVoip ? '(VoIP)' : ''}</span></div>
                </div>

                {/* Carrier & Network */}
                <div className="info-block">
                  <div className="info-title">📶 Carrier & Network</div>
                  <div className="info-row"><span>Carrier</span><span>{callerInfo.carrier || 'Unknown'}</span></div>
                  <div className="info-row"><span>Number Type</span><span>{callerInfo.numberType || 'mobile'}</span></div>
                  {callerInfo.deviceInfo && (
                    <>
                      <div className="info-row"><span>Network</span><span>{callerInfo.deviceInfo.networkType || 'Unknown'}</span></div>
                      <div className="info-row"><span>Signal</span><span>{callerInfo.deviceInfo.signalStrength || 'N/A'}{callerInfo.deviceInfo.roaming ? ' (Roaming)' : ''}</span></div>
                    </>
                  )}
                </div>

                {/* Device */}
                {callerInfo.deviceInfo && (
                  <div className="info-block">
                    <div className="info-title">📱 Device Intelligence</div>
                    <div className="info-row"><span>Device Model</span><span>{callerInfo.deviceInfo.deviceModel || 'Unknown'}</span></div>
                    <div className="info-row"><span>IMEI</span><span className="mono">{callerInfo.deviceInfo.imei ? callerInfo.deviceInfo.imei.slice(0,8) + '...' + callerInfo.deviceInfo.imei.slice(-4) : 'Restricted (API 29+)'}</span></div>
                    <div className="info-row"><span>Tower</span><span className="mono" style={{fontSize:'9px'}}>{callerInfo.deviceInfo.towerLocation || 'No data'}</span></div>
                  </div>
                )}

                {/* Community Reports */}
                <div className="info-block">
                  <div className="info-title">👥 Community Intelligence</div>
                  <div className="info-row"><span>Reports</span><span><strong>{callerInfo.reportCount}</strong> community reports</span></div>
                  <div className="info-row"><span>Recent</span><span>{callerInfo.recentReportCount} in last 7 days</span></div>
                  <div className="info-row"><span>Verified</span><span className={callerInfo.verified ? 'safe-t' : 'warn-t'}>{callerInfo.verified ? '✓ Yes — Confirmed Scam' : '✗ No — Crowd Sourced'}</span></div>
                  <div className="info-row"><span>Source</span><span>{callerInfo.source || 'api'}</span></div>
                </div>

                {/* Warnings */}
                {callerInfo.warnings.length > 0 && (
                  <div className="info-block warning-block">
                    <div className="info-title">⚠️ Active Warnings</div>
                    {callerInfo.warnings.map((w, i) => (
                      <div key={i} className="warning-item">• {w}</div>
                    ))}
                  </div>
                )}

                {/* Photo evidence */}
                {photoCaptured && (
                  <div className="info-block photo-block">
                    <div className="info-title">📸 Photo Evidence Captured</div>
                    <div className="photo-metadata">
                      <div>✓ Face capture saved locally</div>
                      <div>✓ Timestamp: {new Date().toISOString()}</div>
                      <div>✓ Geo-tag: {callerInfo.deviceInfo?.towerLocation || 'Cell tower triangulated'}</div>
                      <div>✓ Ready for police complaint / cyber cell report</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Action buttons */}
          {step === 'ringing' && (
            <div className="call-actions">
              <button className="decline-btn" onClick={declineCall}>
                <span>📵</span> Decline
              </button>
              <button className="answer-btn" onClick={answerCall}>
                <span>📞</span> Answer & Scan
              </button>
            </div>
          )}

          {(step === 'answered' || step === 'blocked') && (
            <div className="call-actions">
              <button className="end-call-btn" onClick={resetAll}>
                {step === 'blocked' ? '🛡️ Call Blocked — Return to Demo' : '📵 End Call — Return to Demo'}
              </button>
            </div>
          )}
        </div>
      )}
    </main>
  );
}

const CSS = `
  *{box-sizing:border-box;margin:0;padding:0}
  :root{
    --bg:#060e08;--card:#0e1f13;--border:#142a1b;
    --accent:#00e676;--text:#e0f2e9;--text2:#9ab7a5;--muted:#4a6b58;
    --danger:#ff3d3d;--warn:#ff9800;--safe-top:env(safe-area-inset-top,0px);--safe-bottom:env(safe-area-inset-bottom,0px);
  }

  .idle-wrap{padding:max(20px,var(--safe-top)) 16px max(20px,var(--safe-bottom));max-width:900px;margin:0 auto}
  .demo-header{text-align:center;padding:40px 0 30px}
  .demo-logo{font-size:28px;font-weight:800;margin-bottom:8px}
  .demo-sub{font-size:13px;color:var(--muted)}

  .scenario-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px}
  .scenario-card{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:18px 16px;text-align:left;cursor:pointer;transition:all .2s;font-family:inherit;color:var(--text);width:100%}
  .scenario-card:hover{border-color:var(--accent);transform:translateY(-2px)}
  .sc-emoji{font-size:28px;margin-bottom:8px}
  .sc-label{font-size:14px;font-weight:700;margin-bottom:4px}
  .sc-number{font-size:12px;font-family:monospace;color:var(--accent);margin-bottom:6px}
  .sc-desc{font-size:10px;color:var(--muted);line-height:1.4;margin-bottom:10px}
  .sc-action{font-size:10px;color:var(--accent);font-weight:600}

  .call-screen{min-height:100dvh;display:flex;flex-direction:column;padding:var(--safe-top) 16px var(--safe-bottom);background:radial-gradient(ellipse at 50% 30%,rgba(255,61,61,.08),transparent 60%),#050c07}
  .call-header{display:flex;justify-content:space-between;align-items:center;padding:16px 0}
  .call-status-badge{padding:3px 14px;border-radius:20px;font-size:10px;font-weight:700}
  .call-status-badge.blocked{background:rgba(255,61,61,.2);color:var(--danger)}
  .call-status-badge.ringing{background:rgba(255,152,0,.15);color:var(--warn)}
  .call-status-badge.active{background:rgba(0,230,118,.1);color:var(--accent)}
  .call-timer{font-size:12px;font-family:monospace;color:var(--text2)}

  .camera-section{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:12px;margin-bottom:12px}
  .camera-label{font-size:9px;color:var(--accent);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px}
  .camera-preview{width:100%;max-height:240px;border-radius:8px;object-fit:cover;background:#000}
  .photo-preview{width:100%;max-height:300px;border-radius:8px;object-fit:cover}
  .photo-timestamp{font-size:9px;color:var(--muted);margin-top:6px}
  .capture-btn{width:100%;padding:10px;margin-top:8px;background:var(--warn);color:#000;border:none;border-radius:8px;font-weight:700;font-size:13px;font-family:inherit;cursor:pointer}
  .capture-btn:active{opacity:.8}

  .scan-animation{text-align:center;padding:30px 0}
  .scan-spinner{width:40px;height:40px;border:3px solid var(--border);border-top-color:var(--accent);border-radius:50%;animation:spin .8s linear infinite;margin:0 auto 16px}
  @keyframes spin{to{transform:rotate(360deg)}}
  .scan-text{font-size:14px;font-weight:600;margin-bottom:16px}
  .scan-steps{text-align:left;max-width:280px;margin:0 auto}
  .scan-step{font-size:10px;padding:4px 0;color:var(--muted)}
  .scan-step.done{color:var(--accent)}
  .scan-step.active{color:var(--warn)}

  .caller-info-card{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch}
  .verdict-strip{padding:14px 16px;border-radius:12px;margin-bottom:12px;display:flex;align-items:center;gap:10px}
  .verdict-strip.scam{background:rgba(255,61,61,.12);border:1px solid rgba(255,61,61,.2)}
  .verdict-strip.warn{background:rgba(255,152,0,.1);border:1px solid rgba(255,152,0,.2)}
  .verdict-strip.safe{background:rgba(0,230,118,.08);border:1px solid rgba(0,230,118,.15)}
  .verdict-icon{font-size:28px}
  .verdict-text{font-size:14px;font-weight:800}

  .info-sections{display:flex;flex-direction:column;gap:10px}
  .info-block{background:var(--card);border:1px solid var(--border);border-radius:10px;padding:14px}
  .info-title{font-size:11px;font-weight:700;color:var(--accent);margin-bottom:10px;text-transform:uppercase;letter-spacing:.5px}
  .info-row{display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid rgba(255,255,255,.03);gap:10px}
  .info-row span:first-child{font-size:10px;color:var(--muted);min-width:70px}
  .info-row span:last-child{font-size:11px;text-align:right;word-break:break-word}
  .mono{font-family:monospace;font-size:10px!important}
  .danger{color:var(--danger);font-weight:700}
  .safe-t{color:var(--accent);font-weight:700}
  .warn-t{color:var(--warn)}
  .warning-block{background:rgba(255,152,0,.06);border-color:rgba(255,152,0,.15)}
  .warning-item{font-size:10px;color:var(--warn);padding:3px 0}
  .photo-block{background:rgba(64,196,255,.06);border-color:rgba(64,196,255,.15)}
  .photo-metadata{display:flex;flex-direction:column;gap:4px}
  .photo-metadata div{font-size:10px;color:var(--text2)}

  .call-actions{display:flex;gap:12px;padding:16px 0;flex-shrink:0}
  .decline-btn{flex:1;padding:16px;background:rgba(255,61,61,.15);border:2px solid rgba(255,61,61,.3);border-radius:60px;color:var(--danger);font-weight:800;font-size:16px;font-family:inherit;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px}
  .decline-btn:active{background:rgba(255,61,61,.25)}
  .answer-btn{flex:1;padding:16px;background:var(--accent);border:none;border-radius:60px;color:#050c07;font-weight:800;font-size:16px;font-family:inherit;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px}
  .answer-btn:active{opacity:.8}
  .end-call-btn{width:100%;padding:16px;background:rgba(255,61,61,.15);border:2px solid rgba(255,61,61,.3);border-radius:60px;color:var(--danger);font-weight:800;font-size:16px;font-family:inherit;cursor:pointer}
`;
