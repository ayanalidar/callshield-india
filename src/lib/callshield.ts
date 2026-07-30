/**
 * CallShield India — Main Dashboard Page
 * Connects to real API endpoints for scam lookups, stats, and call history.
 */
import { analyzeNumber, normalizeIndianNumber } from '@/engines/number-intel';
import { detectScam, shouldBlock, SCAM_TYPE_LABELS, type ScamType } from '@/engines/scam-detector';

// Re-export for use in components
export { analyzeNumber, normalizeIndianNumber, detectScam, shouldBlock, SCAM_TYPE_LABELS };
export type { ScamType };
