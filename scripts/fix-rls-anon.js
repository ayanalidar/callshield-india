require('dotenv').config({path: '.env.local'});
const {createClient} = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const anonClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

(async()=>{
  // Disable RLS via REST
  const sql = "ALTER TABLE IF EXISTS indian_prefixes DISABLE ROW LEVEL SECURITY; ALTER TABLE IF EXISTS intl_scam_patterns DISABLE ROW LEVEL SECURITY; ALTER TABLE IF EXISTS scam_reports DISABLE ROW LEVEL SECURITY;";
  
  // Use Supabase management API — try direct SQL via REST
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/exec_sql`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({query: sql})
    });
    const text = await res.text();
    console.log('SQL result:', res.status, text.substring(0,200));
  } catch(e) {
    console.log('SQL via REST:', e.message);
  }

  // Verify with anon key
  const {data, error} = await anonClient.from('indian_prefixes').select('prefix').limit(3);
  console.log('anon → indian_prefixes:', error?.message || `OK (${data.length} rows)`);
  
  const {data: d2, error: e2} = await anonClient.from('intl_scam_patterns').select('country').limit(3);
  console.log('anon → intl_scam_patterns:', e2?.message || `OK (${d2.length} rows)`);
  
  const {data: d3, error: e3} = await anonClient.from('scam_reports').select('id', {count:'exact',head:true});
  console.log('anon → scam_reports:', e3?.message || `OK`);
})().catch(e=>console.error(e));
