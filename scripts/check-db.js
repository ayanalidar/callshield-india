require('dotenv').config({path:'.env.local'});
const {createClient} = require('@supabase/supabase-js');

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log('URL:', URL);
console.log('SVC length:', SVC ? SVC.length : 'MISSING');
console.log('ANON length:', ANON ? ANON.length : 'MISSING');
console.log('SVC has ellipsis:', SVC ? SVC.includes('\u2026') : 'N/A');
console.log('ANON has ellipsis:', ANON ? ANON.includes('\u2026') : 'N/A');

if (!SVC || SVC.length < 100) {
  console.log('ERROR: Service key is truncated or missing. Fix .env.local');
  process.exit(1);
}

const s = createClient(URL, SVC);

(async () => {
  const {count} = await s.from('scam_numbers').select('*', {count: 'exact', head: true});
  console.log('Total scam numbers:', count);
  
  const r = await s.from('scam_numbers').select('phone_number,scam_type,threat_score,carrier').limit(5);
  if (r.error) { console.log('Read error:', r.error.code, r.error.message); return; }
  console.log('Sample:', r.data.map(d => d.phone_number + ' (' + d.scam_type + ')').join(', '));
})();
