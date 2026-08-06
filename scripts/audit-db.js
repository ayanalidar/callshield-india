require('dotenv').config({path: '.env.local'});
const {createClient} = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  // Try direct SQL to list tables
  const queries = [
    {name:'scam_numbers', q:'scam_numbers'},
    {name:'scam_reports', q:'scam_reports'},
    {name:'users', q:'users'},
    {name:'call_history', q:'call_history'},
    {name:'whitelist', q:'whitelist'},
    {name:'device_info', q:'device_info'},
    {name:'sms_scans', q:'sms_scans'},
    {name:'otp_codes', q:'otp_codes'},
    {name:'blocklist', q:'blocklist'},
    {name:'scam_trends', q:'scam_trends'},
  ];

  for (const t of queries) {
    const {count, error} = await supabase
      .from(t.q)
      .select('*', {count: 'exact', head: true});
    console.log(`${t.name}: ${count ?? 'N/A'} rows${error ? ' ERROR: '+error.message : ''}`);
  }

  // Get sample scam type distribution
  const {data:types, error:te} = await supabase
    .from('scam_numbers')
    .select('scam_type');
  if (types) {
    const dist = {};
    types.forEach(t => { const k = t.scam_type || 'unknown'; dist[k] = (dist[k]||0)+1; });
    console.log('\nScam type distribution:', JSON.stringify(dist));
  }

})().catch(e => console.error('FATAL:', e));
