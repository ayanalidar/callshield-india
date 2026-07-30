/**
 * Quick test for SMS Scanner engine
 * Run: npx tsx scripts/test-scanner.ts
 */
import { scanMessage, scanMessageQuick, isScamMessage } from '../src/engines/sms-scanner';

const tests = [
  {
    name: 'Bank OTP Scam',
    message: 'Dear customer, your SBI bank account has been blocked due to KYC pending. Update immediately: https://sbi-kyc-verify.tk',
  },
  {
    name: 'UPI Blocked (Hindi)',
    message: 'नमस्ते, आपका UPI खाता ब्लॉक हो गया है। कृपया तुरंत वेरिफाई करें: https://upi-verify.xyz',
  },
  {
    name: 'FedEx Customs Scam',
    message: 'Your parcel has been held by customs. ₹2,500 payment required for clearance. Pay now: https://bit.ly/customs-pay',
  },
  {
    name: 'Safe Personal Message',
    message: 'Hey, are we still on for dinner tonight at 8? See you at the restaurant!',
  },
  {
    name: 'Electricity Bill Scam',
    message: 'प्रिय ग्राहक, आपका बिजली बिल का भुगतान नहीं हुआ है। आज रात 9 बजे कनेक्शन काट दिया जाएगा। कॉल करें: 9210012345',
  },
  {
    name: 'Job Scam',
    message: 'URGENT HIRING! Work from home, earn ₹5000/day. Part time job, no experience. Contact WhatsApp: 9876543210',
  },
];

let pass = 0;
let fail = 0;

for (const test of tests) {
  const result = scanMessage(test.message);
  const quick = scanMessageQuick(test.message);
  const expectedScam = test.name.includes('Safe') ? false : true;
  const correct = result.isScam === expectedScam;
  
  if (correct) pass++;
  else fail++;

  console.log(`\n${correct ? '✅' : '❌'} ${test.name}`);
  console.log(`   Verdict: ${result.verdict} | Score: ${result.threatScore}/100 | Confidence: ${(result.confidence * 100).toFixed(0)}%`);
  console.log(`   Quick: ${quick}`);
  console.log(`   Patterns: ${result.matchedPatterns.length} | Links: ${result.detectedLinks.length}`);
  if (result.matchedPatterns.length > 0) {
    result.matchedPatterns.forEach(p => console.log(`     - ${p.severity.toUpperCase()} ${p.description || ''}`));
  }
}

console.log(`\n---\n${pass} passed, ${fail} failed out of ${tests.length}`);
