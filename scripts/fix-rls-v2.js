require('dotenv').config({path: '.env.local'});
const {createClient} = require('@supabase/supabase-js');

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

(async()=>{
  // Approach: Use raw SQL query via the client's internal methods
  // The supabase-js library doesn't expose raw SQL, but we can use the REST API directly
  
  const statements = [
    'ALTER TABLE indian_prefixes DISABLE ROW LEVEL SECURITY',
    'ALTER TABLE intl_scam_patterns DISABLE ROW LEVEL SECURITY',
  ];
  
  for (const stmt of statements) {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/pg_exec`,
      {
        method: 'POST',
        headers: {
          'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({stmt: stmt})
      }
    );
    console.log(stmt.substring(0,60), res.status, (await res.text()).substring(0,100));
  }
  
  // Verify
  const anonClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const {data, error} = await anonClient.from('indian_prefixes').select('prefix').limit(3);
  console.log('\nVERIFY anon→indian_prefixes:', error?.message || `✓ ${data.length} rows`);
  const {data:d2, error:e2} = await anonClient.from('intl_scam_patterns').select('country').limit(3);
  console.log('VERIFY anon→intl_scam_patterns:', e2?.message || `✓ ${d2.length} rows`);
})().catch(e=>console.error(e));
