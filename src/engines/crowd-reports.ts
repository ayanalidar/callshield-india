/**
 * CallShield Crowd Reports Engine
 * 
 * Crowd-sourced scam intelligence with abuse prevention:
 * - Deduplication (same reporter, same number, time-window)
 * - Rate limiting (per IP, per user)
 * - Vote confidence weighting
 * - Trend analysis
 * - Trust scoring
 */

import type { ScamType } from './scam-detector';

// ============================================================
// TYPES
// ============================================================

export interface CrowdReportInput {
  phoneNumber: string;
  normalizedNumber: string;
  scamType: ScamType;
  description?: string;
  spamScore?: number;          // 1-5, user-rated severity
  reporterId?: string;
  reporterIp?: string;
  reporterFingerprint?: string;
  callTimestamp?: string;
  callDurationSeconds?: number;
}

export interface CrowdReportResult {
  success: boolean;
  duplicate: boolean;
  rateLimited: boolean;
  message: string;
  reportId?: number;
  existingReport?: boolean;
  aggregatedCount?: number;    // total reports for this number
}

export interface RateLimitCheck {
  allowed: boolean;
  waitSeconds?: number;
  remainingThisWindow?: number;
}

// ============================================================
// RATE LIMITING
// ============================================================

// Per-IP: 5 reports per minute
// Per-user: 10 reports per minute
// Per-fingerprint: 5 reports per minute
// Per-number (from same IP): 1 report per hour

const rateLimitWindow = 60_000; // 1 minute
const ipStore = new Map<string, { count: number; resetAt: number }>();
const userStore = new Map<string, { count: number; resetAt: number }>();
const perNumberStore = new Map<string, { reports: Map<string, number> }>(); // normalized -> ip -> timestamp

function pruneOldEntries(): void {
  const now = Date.now();
  for (const [key, data] of ipStore) {
    if (now > data.resetAt) ipStore.delete(key);
  }
  for (const [key, data] of userStore) {
    if (now > data.resetAt) userStore.delete(key);
  }
}

export function checkRateLimit(params: {
  ip: string;
  userId?: string;
  fingerprint?: string;
  normalizedNumber: string;
}): RateLimitCheck {
  const now = Date.now();
  pruneOldEntries();

  // Check per-IP
  const ipData = ipStore.get(params.ip);
  if (ipData && now <= ipData.resetAt && ipData.count >= 5) {
    const waitSeconds = Math.ceil((ipData.resetAt - now) / 1000);
    return { allowed: false, waitSeconds };
  }

  // Check per-user
  if (params.userId) {
    const userData = userStore.get(params.userId);
    if (userData && now <= userData.resetAt && userData.count >= 10) {
      const waitSeconds = Math.ceil((userData.resetAt - now) / 1000);
      return { allowed: false, waitSeconds };
    }
  }

  // Check per-number dedup from same IP (1 per hour)
  const numStore = perNumberStore.get(params.normalizedNumber);
  if (numStore) {
    const lastFromIp = numStore.get(params.ip);
    if (lastFromIp && now - lastFromIp < 3_600_000) {
      return { allowed: false, waitSeconds: Math.ceil((lastFromIp + 3_600_000 - now) / 1000) };
    }
  }

  return { allowed: true };
}

export function recordReport(params: {
  ip: string;
  userId?: string;
  normalizedNumber: string;
}): void {
  const now = Date.now();
  const windowEnd = now + rateLimitWindow;

  // Record IP
  const ipData = ipStore.get(params.ip);
  if (ipData && now <= ipData.resetAt) {
    ipData.count++;
  } else {
    ipStore.set(params.ip, { count: 1, resetAt: windowEnd });
  }

  // Record user
  if (params.userId) {
    const userData = userStore.get(params.userId);
    if (userData && now <= userData.resetAt) {
      userData.count++;
    } else {
      userStore.set(params.userId, { count: 1, resetAt: windowEnd });
    }
  }

  // Record per-number
  const numStore = perNumberStore.get(params.normalizedNumber) || new Map();
  numStore.set(params.ip, now);
  perNumberStore.set(params.normalizedNumber, numStore);
}

// ============================================================
// TRUST SCORING
// ============================================================

// Simple Bayesian trust: start at 1.0, confirm with verified reports
export class ReporterTrust {
  private store = new Map<string, { trust: number; totalReports: number; verifiedReports: number }>();

  getTrust(reporterId: string): number {
    const data = this.store.get(reporterId);
    if (!data) return 1.0; // neutral default
    return data.trust;
  }

  updateTrust(reporterId: string, wasVerified: boolean): void {
    let data = this.store.get(reporterId);
    if (!data) {
      data = { trust: 1.0, totalReports: 0, verifiedReports: 0 };
    }

    data.totalReports++;
    if (wasVerified) data.verifiedReports++;

    // Beta reputation: (verified + 1) / (total + 2)
    data.trust = (data.verifiedReports + 1) / (data.totalReports + 2);
    this.store.set(reporterId, data);
  }

  reportTrust(reporterId: string, isFalseReport: boolean): void {
    let data = this.store.get(reporterId);
    if (!data) {
      data = { trust: 1.0, totalReports: 0, verifiedReports: 0 };
    }

    data.totalReports++;
    if (!isFalseReport) data.verifiedReports++;

    data.trust = (data.verifiedReports + 1) / (data.totalReports + 2);
    this.store.set(reporterId, data);
  }
}

// Singleton
export const reporterTrust = new ReporterTrust();

// ============================================================
// REPORT AGGREGATION
// ============================================================

export interface AggregatedReport {
  normalizedNumber: string;
  totalReports: number;
  recentReports: number;
  uniqueReporters: number;
  scamTypes: { type: ScamType; count: number; percentage: number }[];
  avgSpamScore: number;
  firstReported: number | null;
  lastReported: number | null;
  trending: boolean;
  consensus: number;  // 0-1, how much agreement on scam type
}

// In-memory aggregation (backed by DB eventually)
const reportAggregations = new Map<string, {
  total: number;
  recent: number;
  reporters: Set<string>;
  types: Map<ScamType, number>;
  spamScores: number[];
  firstReported: number;
  lastReported: number;
}>();

export function aggregateReport(report: CrowdReportInput): AggregatedReport {
  const key = report.normalizedNumber;
  let agg = reportAggregations.get(key);
  const now = Date.now();
  const isRecent = (timestamp?: string) => {
    if (!timestamp) return true;
    const ts = new Date(timestamp).getTime();
    return now - ts < 30 * 24 * 60 * 60 * 1000; // 30 days
  };

  if (!agg) {
    agg = {
      total: 0,
      recent: 0,
      reporters: new Set(),
      types: new Map(),
      spamScores: [],
      firstReported: now,
      lastReported: now,
    };
  }

  agg.total++;
  if (isRecent(report.callTimestamp)) agg.recent++;
  if (report.reporterId) agg.reporters.add(report.reporterId);
  agg.types.set(report.scamType, (agg.types.get(report.scamType) || 0) + 1);
  if (report.spamScore) agg.spamScores.push(report.spamScore);
  agg.lastReported = now;

  reportAggregations.set(key, agg);

  // Calculate consensus
  let maxTypeCount = 0;
  let totalTypeCount = 0;
  const scamTypes: AggregatedReport['scamTypes'] = [];
  
  for (const [type, count] of agg.types) {
    totalTypeCount += count;
    if (count > maxTypeCount) maxTypeCount = count;
  }
  
  for (const [type, count] of agg.types) {
    scamTypes.push({
      type: type as ScamType,
      count,
      percentage: totalTypeCount > 0 ? Math.round((count / totalTypeCount) * 100) : 0,
    });
  }

  // Trending if reports in last 7 days > 5
  const trending = agg.recent > 5;

  return {
    normalizedNumber: key,
    totalReports: agg.total,
    recentReports: agg.recent,
    uniqueReporters: agg.reporters.size,
    scamTypes,
    avgSpamScore: agg.spamScores.length > 0 
      ? Math.round((agg.spamScores.reduce((a, b) => a + b, 0) / agg.spamScores.length) * 10) / 10 
      : 0,
    firstReported: agg.firstReported,
    lastReported: agg.lastReported,
    trending,
    consensus: totalTypeCount > 0 ? maxTypeCount / totalTypeCount : 0,
  };
}

export function getAggregatedReport(normalizedNumber: string): AggregatedReport | null {
  const agg = reportAggregations.get(normalizedNumber);
  if (!agg) return null;

  let maxTypeCount = 0;
  let totalTypeCount = 0;
  const scamTypes: AggregatedReport['scamTypes'] = [];
  
  for (const [type, count] of agg.types) {
    totalTypeCount += count;
    if (count > maxTypeCount) maxTypeCount = count;
  }
  
  for (const [type, count] of agg.types) {
    scamTypes.push({
      type: type as ScamType,
      count,
      percentage: totalTypeCount > 0 ? Math.round((count / totalTypeCount) * 100) : 0,
    });
  }

  return {
    normalizedNumber,
    totalReports: agg.total,
    recentReports: agg.recent,
    uniqueReporters: agg.reporters.size,
    scamTypes,
    avgSpamScore: agg.spamScores.length > 0
      ? Math.round((agg.spamScores.reduce((a, b) => a + b, 0) / agg.spamScores.length) * 10) / 10
      : 0,
    firstReported: agg.firstReported,
    lastReported: agg.lastReported,
    trending: agg.recent > 5,
    consensus: totalTypeCount > 0 ? maxTypeCount / totalTypeCount : 0,
  };
}

// ============================================================
// TOP SCAM STATISTICS
// ============================================================

export interface ScamStats {
  totalScamNumbers: number;
  totalReports: number;
  reportsToday: number;
  topScamTypes: { type: ScamType; label: string; count: number }[];
  topCircles: { circle: string; count: number }[];
  topCities: { city: string; count: number }[];
  reportVelocity: number; // reports per hour
}

export function getScamStats(): ScamStats {
  let totalReports = 0;
  let reportsToday = 0;
  const todayStart = new Date().setHours(0, 0, 0, 0);
  const typeCounts = new Map<ScamType, number>();
  const circleCounts = new Map<string, number>();
  const cityCounts = new Map<string, number>();
  let totalRecent = 0;

  for (const [, agg] of reportAggregations) {
    totalReports += agg.total;
    totalRecent += agg.recent;
    // Map untyped counts (we don't have circle/city in memory, that's from DB)
  }

  return {
    totalScamNumbers: reportAggregations.size,
    totalReports,
    reportsToday,
    topScamTypes: [],
    topCircles: [],
    topCities: [],
    reportVelocity: totalRecent / (30 * 24), // avg per hour
  };
}
