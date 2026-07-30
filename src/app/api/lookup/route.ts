/**
 * CallShield Unified Lookup API
 * 
 * POST /api/lookup
 * 
 * The main API endpoint — everything calls this.
 * Returns complete threat assessment for any phone number.
 * 
 * Used by:
 * - Mobile app (real-time caller ID check)
 * - Web dashboard
 * - Browser extension
 * - WhatsApp bot
 */

import { NextRequest, NextResponse } from 'next/server';
import { analyzeNumber } from '@/engines/number-intel';
import { detectScam, shouldBlock } from '@/engines/scam-detector';
import { scoreThreat } from '@/engines/threat-scorer';
import { 
  lookupScamNumber, 
  checkWhitelist,
  checkIntlScamPattern 
} from '@/db/supabase';

// Cache for recent lookups (reduce DB hits for rapid repeat checks)
const lookupCache = new Map<string, { result: LookupResponse; expiresAt: number }>();
const CACHE_TTL = 30_000; // 30 seconds

interface LookupRequest {
  phoneNumber: string;
  protectionLevel?: 'off' | 'standard' | 'strict';
  callerDescription?: string;
  includeDbDetails?: boolean;
  userId?: string;
}

interface LookupResponse {
  phoneNumber: string;
  normalized: string;

  // Numbers information
  carrier?: string;
  telecomCircle?: string;
  state?: string;
  city?: string;
  numberType: string;
  isIndian: boolean;
  countryName?: string;
  isVoip: boolean;

  // Threat assessment
  isScam: boolean;
  verdict: 'safe' | 'suspicious' | 'scam' | 'critical';
  threatScore: number;
  confidence: number;

  // Classification
  scamType?: string;
  scamTypes: string[];
  severity: string;

  // Actions
  shouldBlock: boolean;
  blockReason?: string;

  // Details (for full view)
  evidence: string[];
  warnings: string[];
  recommendations: string[];

  // Database match
  dbMatch: {
    found: boolean;
    reportCount: number;
    recentReportCount: number;
    verified: boolean;
    source?: string;
  };

  // Whitelist
  whitelisted?: boolean;

  // Meta
  responseTime: number;
  cached: boolean;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body: LookupRequest = await request.json();
    const { phoneNumber, protectionLevel = 'standard', callerDescription, includeDbDetails, userId } = body;

    if (!phoneNumber || phoneNumber.trim().length < 4) {
      return NextResponse.json(
        { error: 'Valid phone number required', code: 'INVALID_NUMBER' },
        { status: 400 }
      );
    }

    // Check cache
    const cacheKey = `${phoneNumber}|${protectionLevel}|${userId || 'anon'}`;
    const cached = lookupCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return NextResponse.json({ ...cached.result, responseTime: Date.now() - startTime, cached: true });
    }

    // ---- PHASE 1: Edge analysis (no DB) ----
    const edgeResult = detectScam(phoneNumber, { protectionLevel, callerDescription });
    const { block, reason } = shouldBlock(edgeResult, protectionLevel);

    // Build base response
    const response: LookupResponse = {
      phoneNumber,
      normalized: edgeResult.normalized,
      carrier: edgeResult.numberIntel.carrier,
      telecomCircle: edgeResult.numberIntel.telecomCircle,
      state: edgeResult.numberIntel.state,
      numberType: edgeResult.numberIntel.numberType,
      isIndian: edgeResult.numberIntel.isIndian,
      countryName: edgeResult.numberIntel.countryName,
      isVoip: edgeResult.numberIntel.isVoip,

      isScam: edgeResult.isScam,
      verdict: edgeResult.verdict,
      threatScore: edgeResult.threatScore,
      confidence: edgeResult.confidence,

      scamType: edgeResult.primaryScamType,
      scamTypes: edgeResult.scamTypes,
      severity: edgeResult.severity,

      shouldBlock: block,
      blockReason: reason,

      evidence: edgeResult.evidence,
      warnings: edgeResult.warnings,
      recommendations: edgeResult.warnings.map(w => 
        w.includes('VoIP') ? 'VoIP — impossible to trace' :
        w.includes('International') ? 'International number — exercise extreme caution' :
        w.includes('scam prefix') ? 'Number from known scam range' :
        'Exercise caution'
      ),

      dbMatch: {
        found: false,
        reportCount: 0,
        recentReportCount: 0,
        verified: false,
      },

      responseTime: Date.now() - startTime,
      cached: false,
    };

    // ---- PHASE 2: DB enrichment ----
    if (edgeResult.normalized) {
      try {
        // Check whitelist first (instant safe bypass)
        if (userId) {
          const whitelisted = await checkWhitelist(userId, edgeResult.normalized);
          if (whitelisted) {
            response.whitelisted = true;
            response.verdict = 'safe';
            response.isScam = false;
            response.shouldBlock = false;
            response.threatScore = 0;
            response.confidence = 1.0;
            response.warnings = [];
            response.evidence = ['Whitelisted by user'];
            response.recommendations = [];
            
            // Cache and return
            lookupCache.set(cacheKey, { result: response, expiresAt: Date.now() + CACHE_TTL });
            return NextResponse.json({ ...response, responseTime: Date.now() - startTime });
          }
        }

        // Check known scam DB
        const dbScam = await lookupScamNumber(edgeResult.normalized);
        console.log('[lookup] DB check for', edgeResult.normalized, ':', dbScam ? 'FOUND' : 'NOT FOUND');
        
        if (dbScam) {
          response.dbMatch = {
            found: true,
            reportCount: dbScam.reportCount,
            recentReportCount: dbScam.recentReportCount,
            verified: dbScam.verified,
            source: dbScam.source,
          };

          // Merge DB data with edge analysis
          response.city = dbScam.city || response.telecomCircle;
          response.severity = dbScam.severity;
          response.scamType = dbScam.scamType;
          if (dbScam.scamType && !response.scamTypes.includes(dbScam.scamType)) {
            response.scamTypes = [dbScam.scamType, ...response.scamTypes];
          }

          // Merge DB threat score with edge score (weighted: DB gets 70% weight, edge 30%)
          const dbScore = dbScam.threatScore || 50;
          response.threatScore = Math.min(100, Math.round(dbScore * 0.7 + response.threatScore * 0.3));

          // Re-calculate verdict with DB data
          if (response.threatScore >= 80) response.verdict = 'critical';
          else if (response.threatScore >= 60) response.verdict = 'scam';
          else if (response.threatScore >= 40 && response.dbMatch.reportCount > 5) response.verdict = 'scam';
          else if (response.threatScore >= 35) response.verdict = 'suspicious';

          response.confidence = Math.min(1, response.confidence + 0.2);
          response.isScam = response.threatScore >= 
            (protectionLevel === 'strict' ? 50 : protectionLevel === 'standard' ? 70 : 999);
          
          const newBlockDec = shouldBlock({ ...edgeResult, threatScore: response.threatScore }, protectionLevel);
          response.shouldBlock = newBlockDec.block;
          response.blockReason = newBlockDec.reason;

          // Add DB evidence
          response.evidence = [
            `Found in scam database: ${dbScam.reportCount} reports, ${dbScam.recentReportCount} recent`,
            dbScam.verified ? 'Number verified as scam' : 'Unverified (crowd-sourced)',
            `Source: ${dbScam.source}`,
            ...response.evidence,
          ].slice(0, 8);

          if (dbScam.severity === 'critical') {
            response.warnings = ['CRITICAL: Highly reported scam number', ...response.warnings];
          }
        }

        // Check international scam patterns
        if (!edgeResult.numberIntel.isIndian && edgeResult.numberIntel.countryCode) {
          const intlPatterns = await checkIntlScamPattern(edgeResult.numberIntel.countryCode);
          if (intlPatterns.matched) {
            response.evidence.push(`International scam pattern: ${intlPatterns.patterns.map(p => p.description).join(', ')}`);
            response.warnings = [
              `⚠️ Known scam country: ${edgeResult.numberIntel.countryName}`,
              ...response.warnings,
            ];
            response.threatScore = Math.min(100, response.threatScore + 10);
            if (response.verdict === 'safe' || response.verdict === 'suspicious') {
              response.verdict = 'scam';
            }
          }
        }

      } catch (dbError) {
        // DB enrichment failed — use edge results only
        // This is fine; the edge engine works standalone
        response.evidence.push('(Database lookup unavailable — edge analysis only)');
      }
    }

    // Compute final recommendation
    response.recommendations = computeRecommendations(response);

    // Cache result
    lookupCache.set(cacheKey, { result: response, expiresAt: Date.now() + CACHE_TTL });

    // Clean old cache entries
    if (lookupCache.size > 10000) {
      const now = Date.now();
      for (const [k, v] of lookupCache) {
        if (v.expiresAt <= now) lookupCache.delete(k);
      }
    }

    return NextResponse.json({ ...response, responseTime: Date.now() - startTime });

  } catch (error: any) {
    console.error('Lookup error:', error);
    return NextResponse.json(
      { error: 'Failed to process lookup', code: 'LOOKUP_FAILED', detail: error.message },
      { status: 500 }
    );
  }
}

function computeRecommendations(response: LookupResponse): string[] {
  const recs: string[] = [];

  if (response.verdict === 'critical') {
    recs.push('🚨 BLOCK IMMEDIATELY — this is a critical threat');
    recs.push('Report to cybercrime.gov.in');
    recs.push('Warn family members');
  } else if (response.verdict === 'scam') {
    recs.push('🛑 Block this number');
    recs.push('Report via the app');
    recs.push('Check if elderly family members received similar calls');
  } else if (response.verdict === 'suspicious') {
    recs.push('⚠️ Exercise caution');
    recs.push('Do not share personal information');
    recs.push('Report if confirmed scam');
  } else {
    recs.push('✅ Standard caution advised');
  }

  if (response.isVoip) {
    recs.push('VoIP numbers are untraceable — never trust them');
  }

  if (response.dbMatch.found && !response.dbMatch.verified) {
    recs.push('This number is crowd-reported but not yet verified');
  }

  return recs;
}
