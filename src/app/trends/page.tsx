'use client';

import { useState, useEffect, useCallback } from 'react';

// ============================================================
// TYPES
// ============================================================

interface ScamTypeItem {
  type: string;
  label: string;
  count: number;
  trend: number; // 1 for up, -1 for down, 0 for flat
  percentChange: number;
}

interface CircleBreakdown {
  circle: string;
  count: number;
  topType: string;
  changePercent: number;
}

interface WaveAlert {
  circle: string;
  scamType: string;
  label: string;
  percentIncrease: number;
  count: number;
}

interface TopNumber {
  phoneNumber: string;
  scamType: string;
  label: string;
  reportCount: number;
  circle: string;
  lastReported: string;
}

interface TimeSeriesPoint {
  date: string;
  count: number;
}

interface TrendsData {
  topScamTypes7d: ScamTypeItem[];
  topScamTypes30d: { type: string; label: string; count: number }[];
  circleBreakdown: CircleBreakdown[];
  waveAlerts: WaveAlert[];
  topReportedNumbers: TopNumber[];
  timeSeries30d: TimeSeriesPoint[];
  totalReports: number;
  totalReports7d: number;
  generatedAt: string;
}

// ============================================================
// CIRCLE COORDINATES (for SVG map — rough positioning)
// ============================================================

const CIRCLE_POSITIONS: Record<string, { x: number; y: number }> = {
  'Delhi': { x: 400, y: 165 },
  'Mumbai': { x: 200, y: 320 },
  'Kolkata': { x: 590, y: 290 },
  'Chennai': { x: 395, y: 480 },
  'Andhra Pradesh': { x: 370, y: 415 },
  'Bihar': { x: 500, y: 230 },
  'Gujarat': { x: 145, y: 290 },
  'Haryana': { x: 350, y: 155 },
  'Himachal Pradesh': { x: 340, y: 110 },
  'Jammu & Kashmir': { x: 310, y: 52 },
  'Karnataka': { x: 240, y: 395 },
  'Kerala': { x: 240, y: 480 },
  'Madhya Pradesh': { x: 320, y: 260 },
  'Maharashtra': { x: 230, y: 310 },
  'North East': { x: 650, y: 200 },
  'Odisha': { x: 500, y: 310 },
  'Punjab': { x: 320, y: 120 },
  'Rajasthan': { x: 250, y: 170 },
  'Tamil Nadu': { x: 340, y: 475 },
  'UP East': { x: 480, y: 215 },
  'UP West': { x: 380, y: 175 },
  'West Bengal': { x: 580, y: 265 },
};

function getHeatColor(percent: number): string {
  if (percent > 75) return '#ff3d3d';
  if (percent > 50) return '#ff6d00';
  if (percent > 30) return '#ffab40';
  return '#00e676';
}

// ============================================================
// COMPONENTS
// ============================================================

function TrendArrow({ trend, percent }: { trend: number; percent: number }) {
  const isUp = trend > 0;
  const isFlat = trend === 0;
  return (
    <span className={`ttrend ${isUp ? 'up' : isFlat ? 'flat' : 'down'}`}>
      <i className={`fas fa-arrow-${isUp ? 'up' : isFlat ? 'minus' : 'down'}`} />
      {Math.abs(percent)}%
    </span>
  );
}

function TimeChart({ data }: { data: TimeSeriesPoint[] }) {
  if (!data || data.length === 0) return null;
  const maxVal = Math.max(...data.map(d => d.count), 1);
  const w = 600;
  const h = 140;
  const pad = { top: 10, right: 10, bottom: 20, left: 40 };
  const cw = w - pad.left - pad.right;
  const ch = h - pad.top - pad.bottom;

  const points = data.map((d, i) => ({
    x: pad.left + (i / Math.max(1, data.length - 1)) * cw,
    y: pad.top + ch - (d.count / maxVal) * ch,
    ...d,
  }));

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');

  // Y-axis labels
  const yLabels = [0, Math.round(maxVal * 0.5), maxVal];

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="tchart-svg">
      {/* Grid lines */}
      {yLabels.map((v, i) => {
        const y = pad.top + ch - (v / maxVal) * ch;
        return (
          <g key={`yl-${i}`}>
            <line x1={pad.left} y1={y} x2={w - pad.right} y2={y} stroke="#1a3326" strokeWidth="1" />
            <text x={pad.left - 6} y={y + 3} textAnchor="end" fill="#4a6b58" fontSize="8">{v}</text>
          </g>
        );
      })}
      {/* Area fill */}
      <path
        d={`${pathD} L${points[points.length - 1].x},${pad.top + ch} L${points[0].x},${pad.top + ch} Z`}
        fill="rgba(0,230,118,0.08)"
      />
      {/* Line */}
      <path d={pathD} fill="none" stroke="#00e676" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {/* Dots */}
      {points.filter((_, i) => i % 5 === 0 || i === points.length - 1).map((p, i) => (
        <circle key={`dot-${i}`} cx={p.x} cy={p.y} r="3" fill="#00e676" />
      ))}
      {/* X-axis labels */}
      {points.filter((_, i) => i % 7 === 0 || i === points.length - 1).map((p, i) => (
        <text key={`xl-${i}`} x={p.x} y={h - 4} textAnchor="middle" fill="#4a6b58" fontSize="7">
          {p.date.slice(5)}
        </text>
      ))}
    </svg>
  );
}

function IndiaHeatmap({ circleData, onCircleClick }: {
  circleData: CircleBreakdown[];
  onCircleClick: (c: CircleBreakdown) => void;
}) {
  const maxChange = Math.max(...circleData.map(c => Math.abs(c.changePercent)), 1);

  return (
    <div className="theatmap-wrap">
      <svg viewBox="0 0 720 560" className="theatmap-svg">
        {/* India outline — simplified SVG path */}
        <path
          d="M390 40 L420 40 L440 55 L460 55 L470 70 L485 75 L495 90 L510 95 L530 100 L545 110 L560 110 L575 120 L590 120 L600 130 L610 140 L620 150 L625 160 L630 175 L635 190 L640 200 L645 215 L650 225 L648 240 L645 255 L640 265 L635 275 L630 285 L625 295 L618 305 L610 315 L600 325 L590 335 L585 345 L580 355 L575 365 L568 375 L560 385 L550 395 L540 405 L530 415 L520 425 L510 435 L500 445 L490 455 L475 465 L460 475 L445 485 L430 490 L415 495 L400 500 L385 502 L370 500 L355 495 L340 490 L325 485 L310 480 L295 475 L280 470 L265 460 L255 450 L245 440 L235 430 L225 420 L215 410 L205 400 L195 390 L185 380 L175 370 L165 360 L158 350 L152 340 L148 330 L145 320 L143 310 L145 300 L150 290 L158 280 L165 270 L175 260 L185 250 L195 240 L205 230 L215 220 L225 210 L235 200 L245 190 L255 180 L265 170 L275 160 L285 150 L295 140 L310 130 L325 120 L340 110 L355 100 L370 90 L380 80 L390 70 L395 60 L390 40 Z"
          fill="#0d1f14"
          stroke="#1a3326"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        {/* Circle markers */}
        {circleData.map((c) => {
          const pos = CIRCLE_POSITIONS[c.circle];
          if (!pos) return null;
          const intensity = Math.min(1, Math.abs(c.changePercent) / maxChange);
          const color = getHeatColor(c.changePercent > 0 ? c.changePercent : 0);
          const radius = 6 + intensity * 10;

          return (
            <g key={c.circle} className="tcircle-marker" onClick={() => onCircleClick(c)} style={{ cursor: 'pointer' }}>
              {/* Pulse ring */}
              <circle cx={pos.x} cy={pos.y} r={radius + 4} fill={color} opacity="0.15">
                <animate attributeName="r" from={radius + 2} to={radius + 10} dur="2s" repeatCount="indefinite" />
                <animate attributeName="opacity" from="0.2" to="0" dur="2s" repeatCount="indefinite" />
              </circle>
              {/* Main dot */}
              <circle cx={pos.x} cy={pos.y} r={radius} fill={color} opacity="0.8" stroke="#0d1f14" strokeWidth="1" />
              {/* Label */}
              <text x={pos.x} y={pos.y + radius + 11} textAnchor="middle" fill="#a5c4b5" fontSize="7" fontWeight="600">
                {c.circle}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function CircleDetailModal({ circle, onClose }: { circle: CircleBreakdown; onClose: () => void }) {
  return (
    <div className="tmodal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="tmodal-card">
        <div className="tmodal-header">
          <h3><i className="fas fa-map-marker-alt" style={{ color: 'var(--accent)' }} /> {circle.circle}</h3>
          <button onClick={onClose} className="tmodal-close"><i className="fas fa-times" /></button>
        </div>
        <div className="tmodal-body">
          <div className="tmodal-stat">
            <span className="tmodal-stat-label">Total Scams</span>
            <span className="tmodal-stat-value">{circle.count}</span>
          </div>
          <div className="tmodal-stat">
            <span className="tmodal-stat-label">Top Scam Type</span>
            <span className="tmodal-stat-value">{circle.topType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</span>
          </div>
          <div className="tmodal-stat">
            <span className="tmodal-stat-label">Change</span>
            <span className="tmodal-stat-value" style={{ color: circle.changePercent > 0 ? 'var(--danger)' : 'var(--accent)' }}>
              <TrendArrow trend={circle.changePercent > 0 ? 1 : circle.changePercent < 0 ? -1 : 0} percent={circle.changePercent} />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// PAGE
// ============================================================

export default function TrendsPage() {
  const [data, setData] = useState<TrendsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedCircle, setSelectedCircle] = useState<CircleBreakdown | null>(null);
  const [timeRange, setTimeRange] = useState<'7d' | '30d'>('7d');
  const [activeTab, setActiveTab] = useState<'overview' | 'heatmap' | 'numbers'>('overview');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/trends');
      if (!res.ok) throw new Error('Failed to fetch trends');
      const json = await res.json();
      setData(json);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Auto-refresh every 2 minutes
  useEffect(() => {
    const interval = setInterval(fetchData, 120000);
    return () => clearInterval(interval);
  }, [fetchData]);

  if (loading) {
    return (
      <>
        <style dangerouslySetInnerHTML={{ __html: TRENDS_STYLES }} />
        <div className="twrap">
          <div className="tloading">
            <i className="fas fa-spinner fa-spin" />
            <span>Loading scam intelligence...</span>
          </div>
        </div>
      </>
    );
  }

  if (error || !data) {
    return (
      <>
        <style dangerouslySetInnerHTML={{ __html: TRENDS_STYLES }} />
        <div className="twrap">
          <div className="terror">
            <i className="fas fa-exclamation-triangle" />
            <span>{error || 'Failed to load data'}</span>
            <button onClick={fetchData} className="tbtn tbtn-outline">Retry</button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: TRENDS_STYLES }} />

      <div className="twrap">
        {/* Header */}
        <header className="theader">
          <div className="theader-left">
            <a href="/" className="tback-btn">
              <i className="fas fa-arrow-left" /> Dashboard
            </a>
            <div>
              <h1><i className="fas fa-chart-line" style={{ color: 'var(--accent)', marginRight: 8 }} />Scam Trends</h1>
              <span className="theader-sub">Live scam intelligence across India</span>
            </div>
          </div>
          <div className="theader-right">
            <span className="theader-updated">
              <i className="fas fa-sync-alt" /> Updated {new Date(data.generatedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
            </span>
            <button onClick={fetchData} className="tbtn tbtn-icon">
              <i className="fas fa-redo-alt" />
            </button>
          </div>
        </header>

        {/* Stats Row */}
        <div className="tstats-row">
          <div className="tstat-card">
            <div className="tstat-icon" style={{ color: 'var(--accent)' }}>
              <i className="fas fa-phone-slash" />
            </div>
            <div className="tstat-value">{data.totalReports.toLocaleString('en-IN')}</div>
            <div className="tstat-label">Total Reports</div>
          </div>
          <div className="tstat-card">
            <div className="tstat-icon" style={{ color: 'var(--warn)' }}>
              <i className="fas fa-fire" />
            </div>
            <div className="tstat-value">{data.totalReports7d.toLocaleString('en-IN')}</div>
            <div className="tstat-label">Last 7 Days</div>
          </div>
          <div className="tstat-card">
            <div className="tstat-icon" style={{ color: 'var(--danger)' }}>
              <i className="fas fa-exclamation-circle" />
            </div>
            <div className="tstat-value">{data.waveAlerts.length}</div>
            <div className="tstat-label">Active Wave Alerts</div>
          </div>
          <div className="tstat-card">
            <div className="tstat-icon" style={{ color: 'var(--info)' }}>
              <i className="fas fa-map-marker-alt" />
            </div>
            <div className="tstat-value">{data.circleBreakdown.filter(c => c.count > 0).length}</div>
            <div className="tstat-label">Circles Affected</div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="ttabs">
          <button className={`ttab ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>
            <i className="fas fa-fire" /> Trending Now
          </button>
          <button className={`ttab ${activeTab === 'heatmap' ? 'active' : ''}`} onClick={() => setActiveTab('heatmap')}>
            <i className="fas fa-map" /> Live Heatmap
          </button>
          <button className={`ttab ${activeTab === 'numbers' ? 'active' : ''}`} onClick={() => setActiveTab('numbers')}>
            <i className="fas fa-phone" /> Top Numbers
          </button>
        </div>

        {/* Tab: Overview / Trending Now */}
        {activeTab === 'overview' && (
          <>
            {/* Wave Alerts */}
            {data.waveAlerts.length > 0 && (
              <section className="tsection">
                <h2 className="tsection-title">
                  <i className="fas fa-exclamation-triangle" style={{ color: 'var(--danger)' }} /> Wave Alerts
                </h2>
                <div className="twave-list">
                  {data.waveAlerts.map((alert, i) => (
                    <div key={i} className="twave-card">
                      <div className="twave-circle">{alert.circle}</div>
                      <div className="twave-body">
                        <div className="twave-type">{alert.label}</div>
                        <div className="twave-stats">
                          <span className="twave-surge">+{alert.percentIncrease}% surge</span>
                          <span className="twave-count">{alert.count} reports</span>
                        </div>
                      </div>
                      <div className="twave-arrow">
                        <TrendArrow trend={1} percent={alert.percentIncrease} />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Time Range Toggle + Time Chart */}
            <section className="tsection">
              <div className="tsection-header">
                <h2 className="tsection-title">
                  <i className="fas fa-chart-area" style={{ color: 'var(--accent)' }} /> Scam Report Trend
                </h2>
                <div className="ttime-toggle">
                  <button className={timeRange === '7d' ? 'active' : ''} onClick={() => setTimeRange('7d')}>7D</button>
                  <button className={timeRange === '30d' ? 'active' : ''} onClick={() => setTimeRange('30d')}>30D</button>
                </div>
              </div>
              <div className="tchart-wrap">
                <TimeChart data={timeRange === '7d' ? data.timeSeries30d.slice(-7) : data.timeSeries30d} />
              </div>
            </section>

            {/* Hot Scam Types */}
            <section className="tsection">
              <h2 className="tsection-title">
                <i className="fas fa-fire" style={{ color: 'var(--warn)' }} /> Hot Scam Types — Last 7 Days
              </h2>
              <div className="ttype-grid">
                {data.topScamTypes7d.map((item, i) => (
                  <div key={item.type} className="ttype-card">
                    <div className="ttype-rank">#{i + 1}</div>
                    <div className="ttype-info">
                      <div className="ttype-name">{item.label}</div>
                      <div className="ttype-count">{item.count.toLocaleString('en-IN')} reports</div>
                    </div>
                    <TrendArrow trend={item.trend} percent={item.percentChange} />
                  </div>
                ))}
              </div>
            </section>

            {/* Circle Breakdown — Bar Chart-style List */}
            <section className="tsection">
              <h2 className="tsection-title">
                <i className="fas fa-globe-asia" style={{ color: 'var(--info)' }} /> Scam Volume by Telecom Circle
              </h2>
              <div className="tcircle-list">
                {data.circleBreakdown.filter(c => c.count > 0).map(c => {
                  const maxCount = Math.max(...data.circleBreakdown.map(x => x.count));
                  const barWidth = Math.max(2, (c.count / maxCount) * 100);
                  return (
                    <div key={c.circle} className="tcircle-row">
                      <div className="tcircle-name">{c.circle}</div>
                      <div className="tcircle-bar-wrap">
                        <div className="tcircle-bar" style={{ width: `${barWidth}%` }}>
                          <span className="tcircle-bar-label">{c.count}</span>
                        </div>
                      </div>
                      {c.changePercent !== 0 && (
                        <span className={`tcircle-change ${c.changePercent > 0 ? 'up' : 'down'}`}>
                          {c.changePercent > 0 ? '+' : ''}{c.changePercent}%
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          </>
        )}

        {/* Tab: Heatmap */}
        {activeTab === 'heatmap' && (
          <section className="tsection">
            <h2 className="tsection-title">
              <i className="fas fa-map" style={{ color: 'var(--accent)' }} /> Live Scam Heatmap — India
            </h2>
            <p className="theatmap-legend">
              <span><span className="tlegend-dot" style={{ background: '#00e676' }} /> Quiet</span>
              <span><span className="tlegend-dot" style={{ background: '#ffab40' }} /> Moderate</span>
              <span><span className="tlegend-dot" style={{ background: '#ff6d00' }} /> Active</span>
              <span><span className="tlegend-dot" style={{ background: '#ff3d3d' }} /> Wave</span>
            </p>
            <IndiaHeatmap circleData={data.circleBreakdown} onCircleClick={setSelectedCircle} />
          </section>
        )}

        {/* Tab: Top Numbers */}
        {activeTab === 'numbers' && (
          <section className="tsection">
            <h2 className="tsection-title">
              <i className="fas fa-trophy" style={{ color: 'var(--warn)' }} /> Most Reported Numbers — This Week
            </h2>
            <div className="tnumber-table-wrap">
              <table className="tnumber-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Phone Number</th>
                    <th>Scam Type</th>
                    <th>Reports</th>
                    <th>Circle</th>
                    <th>Last Reported</th>
                  </tr>
                </thead>
                <tbody>
                  {data.topReportedNumbers.map((num, i) => (
                    <tr key={i}>
                      <td className="tnum-rank">#{i + 1}</td>
                      <td className="tnum-phone">{num.phoneNumber}</td>
                      <td><span className="tnum-type">{num.label}</span></td>
                      <td className="tnum-reports">{num.reportCount}</td>
                      <td>{num.circle}</td>
                      <td className="tnum-date">{new Date(num.lastReported).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>

      {/* Circle Detail Modal */}
      {selectedCircle && (
        <CircleDetailModal circle={selectedCircle} onClose={() => setSelectedCircle(null)} />
      )}
    </>
  );
}

// ============================================================
// STYLES
// ============================================================

const TRENDS_STYLES = `
:root{--bg:#050c07;--bg2:#091410;--card:#0d1c14;--border:#1a3326;--accent:#00e676;--ad:rgba(0,230,118,.1);--ag:rgba(0,230,118,.25);--danger:#ff3d3d;--dd:rgba(255,61,61,.1);--warn:#ffab40;--wd:rgba(255,171,64,.1);--info:#40c4ff;--id:rgba(64,196,255,.1);--fg:#e0f2e9;--fg2:#a5c4b5;--muted:#4a6b58;--r:14px;--rs:8px}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Space Grotesk',sans-serif;background:var(--bg);color:var(--fg);min-height:100vh}
::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:var(--bg2)}::-webkit-scrollbar-thumb{background:var(--border);border-radius:2px}

.twrap{max-width:1100px;margin:0 auto;padding:16px 16px 40px}

/* Loading / Error */
.tloading{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:60vh;gap:12px;color:var(--muted);font-size:13px}
.tloading i{font-size:24px;color:var(--accent)}
.terror{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:60vh;gap:10px;color:var(--danger);font-size:13px}
.terror i{font-size:28px}

/* Header */
.theader{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:var(--card);border:1px solid var(--border);border-radius:var(--r);margin-bottom:16px;flex-wrap:wrap;gap:10px}
.theader-left{display:flex;align-items:center;gap:12px}
.tback-btn{font-size:10px;color:var(--muted);text-decoration:none;display:flex;align-items:center;gap:5px;transition:color .2s}
.tback-btn:hover{color:var(--accent)}
.theader-left h1{font-size:18px;font-weight:800;display:flex;align-items:center}
.theader-sub{font-size:9px;color:var(--muted);display:block;margin-top:2px}
.theader-right{display:flex;align-items:center;gap:10px}
.theader-updated{font-size:9px;color:var(--muted);display:flex;align-items:center;gap:4px}

/* Buttons */
.tbtn{padding:7px 14px;border-radius:var(--rs);font-family:inherit;font-size:10px;font-weight:600;cursor:pointer;transition:all .2s;display:flex;align-items:center;gap:5px;border:1px solid transparent}
.tbtn-outline{background:transparent;border:1px solid var(--border);color:var(--fg2)}
.tbtn-outline:hover{border-color:var(--accent);color:var(--accent)}
.tbtn-icon{background:transparent;border:1px solid var(--border);color:var(--muted);width:32px;height:32px;justify-content:center;padding:0}
.tbtn-icon:hover{color:var(--accent);border-color:var(--accent)}

/* Stats Row */
.tstats-row{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px}
@media(max-width:640px){.tstats-row{grid-template-columns:repeat(2,1fr)}}
.tstat-card{background:var(--card);border:1px solid var(--border);border-radius:var(--r);padding:16px;text-align:center}
.tstat-icon{font-size:18px;margin-bottom:6px}
.tstat-value{font-size:22px;font-weight:800;font-family:'JetBrains Mono',monospace}
.tstat-label{font-size:9px;color:var(--muted);margin-top:2px;font-weight:500}

/* Tabs */
.ttabs{display:flex;gap:0;margin-bottom:16px;background:var(--card);border:1px solid var(--border);border-radius:var(--r);overflow:hidden}
.ttab{flex:1;padding:10px 16px;background:transparent;border:none;border-bottom:2px solid transparent;color:var(--muted);font-family:inherit;font-size:11px;font-weight:600;cursor:pointer;transition:all .2s;display:flex;align-items:center;justify-content:center;gap:6px}
.ttab:hover{color:var(--fg2)}
.ttab.active{color:var(--accent);border-bottom-color:var(--accent);background:var(--ad)}

/* Sections */
.tsection{margin-bottom:20px}
.tsection-header{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:12px}
.tsection-title{font-size:14px;font-weight:700;margin-bottom:12px;display:flex;align-items:center;gap:8px}

/* Time Toggle */
.ttime-toggle{display:flex;gap:0;border-radius:20px;background:var(--bg2);border:1px solid var(--border);overflow:hidden}
.ttime-toggle button{padding:5px 14px;background:transparent;border:none;color:var(--muted);font-family:'JetBrains Mono',monospace;font-size:10px;cursor:pointer;transition:all .2s}
.ttime-toggle button.active{background:var(--accent);color:var(--bg);font-weight:700}

/* Wave Alerts */
.twave-list{display:flex;flex-direction:column;gap:8px}
.twave-card{display:flex;align-items:center;gap:12px;padding:12px 16px;background:var(--card);border:1px solid var(--border);border-radius:var(--rs);border-left:3px solid var(--danger);transition:border-color .3s}
.twave-card:hover{border-left-color:var(--accent)}
.twave-circle{font-weight:700;font-size:11px;color:var(--fg);min-width:80px}
.twave-body{flex:1}
.twave-type{font-size:11px;color:var(--fg2)}
.twave-stats{display:flex;gap:10px;margin-top:2px}
.twave-surge{font-size:10px;color:var(--danger);font-weight:600}
.twave-count{font-size:9px;color:var(--muted)}

/* Trend Arrow */
.ttrend{font-size:10px;font-weight:700;display:flex;align-items:center;gap:3px;white-space:nowrap}
.ttrend.up{color:var(--danger)}
.ttrend.down{color:var(--accent)}
.ttrend.flat{color:var(--muted)}

/* Type Grid */
.ttype-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:8px}
.ttype-card{display:flex;align-items:center;gap:12px;padding:12px 14px;background:var(--card);border:1px solid var(--border);border-radius:var(--rs);transition:border-color .2s}
.ttype-card:hover{border-color:rgba(0,230,118,.15)}
.ttype-rank{font-family:'JetBrains Mono',monospace;font-size:14px;font-weight:800;color:var(--accent);min-width:30px}
.ttype-info{flex:1}
.ttype-name{font-size:12px;font-weight:600;color:var(--fg)}
.ttype-count{font-size:9px;color:var(--muted)}

/* Circle Bar List */
.tcircle-list{display:flex;flex-direction:column;gap:6px}
.tcircle-row{display:flex;align-items:center;gap:10px}
.tcircle-name{font-size:9px;font-weight:600;color:var(--fg2);min-width:80px;text-align:right}
.tcircle-bar-wrap{flex:1;height:22px;background:var(--bg2);border-radius:3px;overflow:hidden}
.tcircle-bar{height:100%;background:linear-gradient(90deg,rgba(0,230,118,.2),rgba(0,230,118,.5));border-radius:3px;display:flex;align-items:center;justify-content:flex-end;padding-right:6px;min-width:22px;transition:width .6s ease}
.tcircle-bar-label{font-size:8px;font-weight:600;color:var(--fg);white-space:nowrap}
.tcircle-change{font-size:9px;font-weight:600;min-width:50px}
.tcircle-change.up{color:var(--danger)}
.tcircle-change.down{color:var(--accent)}

/* Chart */
.tchart-wrap{padding:10px;background:var(--card);border:1px solid var(--border);border-radius:var(--r);overflow:hidden}
.tchart-svg{width:100%;height:auto}

/* Heatmap */
.theatmap-wrap{padding:10px;background:var(--card);border:1px solid var(--border);border-radius:var(--r)}
.theatmap-svg{width:100%;height:auto;max-height:500px}
.tcircle-marker{transition:transform .2s}
.tcircle-marker:hover{transform:scale(1.2)}

.theatmap-legend{display:flex;gap:16px;margin-bottom:10px;font-size:10px;color:var(--muted);flex-wrap:wrap}
.tlegend-dot{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:4px}

/* Number Table */
.tnumber-table-wrap{background:var(--card);border:1px solid var(--border);border-radius:var(--r);overflow-x:auto}
.tnumber-table{width:100%;border-collapse:collapse;font-size:10px}
.tnumber-table th{text-align:left;padding:10px 12px;background:var(--bg2);color:var(--muted);font-weight:600;font-size:9px;text-transform:uppercase;letter-spacing:.5px;border-bottom:1px solid var(--border)}
.tnumber-table td{padding:10px 12px;border-bottom:1px solid var(--border);vertical-align:middle}
.tnumber-table tbody tr:hover{background:var(--ad)}
.tnumber-table tbody tr:last-child td{border-bottom:none}
.tnum-rank{font-family:'JetBrains Mono',monospace;color:var(--warn);font-weight:700;width:40px}
.tnum-phone{font-family:'JetBrains Mono',monospace;font-weight:600;font-size:11px}
.tnum-type{font-size:9px;color:var(--fg2);background:var(--ad);padding:2px 6px;border-radius:4px;white-space:nowrap}
.tnum-reports{font-family:'JetBrains Mono',monospace;font-weight:600;color:var(--warn)}
.tnum-date{color:var(--muted);font-size:9px}

/* Modal */
.tmodal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.6);backdrop-filter:blur(4px);z-index:9000;display:flex;align-items:center;justify-content:center;padding:20px}
.tmodal-card{background:var(--card);border:1px solid var(--border);border-radius:var(--r);padding:20px;max-width:340px;width:100%}
.tmodal-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}
.tmodal-header h3{font-size:14px;font-weight:700;display:flex;align-items:center;gap:6px}
.tmodal-close{background:none;border:none;color:var(--muted);cursor:pointer;font-size:16px;transition:color .2s}
.tmodal-close:hover{color:var(--danger)}
.tmodal-body{display:flex;flex-direction:column;gap:12px}
.tmodal-stat{display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border)}
.tmodal-stat:last-child{border-bottom:none}
.tmodal-stat-label{font-size:10px;color:var(--muted)}
.tmodal-stat-value{font-size:11px;font-weight:600;color:var(--fg)}
`;
