/**
 * Quick smoke test for CallShield engines
 * Run: npx ts-node src/engines/__test.ts
 */

import { analyzeNumber, normalizeIndianNumber } from './number-intel';
import { detectScam, shouldBlock, SCAM_TYPE_LABELS } from './scam-detector';
import { scoreThreat, quickScore } from './threat-scorer';

const TESTS = [
  { input: '+919876543210', desc: 'Indian mobile (known scam in DB)' },
  { input: '9887766554', desc: 'Indian 10-digit' },
  { input: '+919001122334', desc: 'Indian loan app scam prefix' },
  { input: '+92211223344', desc: 'Pakistani number' },
  { input: '+88011223344', desc: 'Bangladeshi number' },
  { input: '+911800123456', desc: 'Indian toll-free (often spoofed)' },
  { input: '+848888888888', desc: 'Vietnamese VoIP suspected' },
  { input: '09221122334', desc: 'Pakistani with 0-prefix' },
  { input: '+919988776655', desc: 'Indian UP West scam prefix' },
  { input: '+14015551234', desc: 'US VoIP number' },
];

let passed = 0;
let failed = 0;

console.log('=== CallShield Engine Smoke Tests ===\n');

for (const test of TESTS) {
  console.log(`\n--- ${test.desc} (${test.input}) ---`);
  
  // Number Intel
  const intel = analyzeNumber(test.input);
  console.log(`  Intel: ${intel.isValid ? '✓ valid' : '✗ invalid'} | type=${intel.numberType} | ${intel.isIndian ? 'IN' : 'INTL'} ${intel.carrier || intel.countryName || ''} | circle=${intel.telecomCircle || 'N/A'}`);
  console.log(`  Risk flags: ${intel.riskFlags.join(', ') || 'none'}`);
  
  // Scam Detection
  const scam = detectScam(test.input);
  console.log(`  Scam: ${scam.verdict} | score=${scam.threatScore}/100 | ${scam.isScam ? '🚨 SCAM' : '✅ safe'}`);
  
  // Block decision
  const { block, reason } = shouldBlock(scam, 'standard');
  console.log(`  Block: ${block ? '🔴 BLOCK' : '🟢 ALLOW'} — ${reason}`);
  
  // Normalizer
  const norm = normalizeIndianNumber(test.input);
  if (norm) console.log(`  Normalized: ${norm}`);
  
  if (scam.threatScore > 0 || intel.isValid) passed++;
  else failed++;
}

console.log(`\n=== Results: ${passed}/${TESTS.length} passed ===`);
