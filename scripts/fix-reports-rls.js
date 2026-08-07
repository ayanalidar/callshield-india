require('dotenv').config({path: '.env.local'});
const {createClient} = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async()=>{
  // Disable RLS on scam_reports — the insert policy requires auth.role()='authenticated'
  // which blocks service_role inserts via the REST API in some configurations
  const {error} = await supabase.from('scam_reports').select('id', {count:'exact',head:true});
  console.log('scam_reports service_role read:', error?.message || 'OK');

  // Try direct insert to test
  const testInsert = await supabase.from('scam_reports').insert({
    phone_number: '+919000000001',
    scam_type: 'test',
    description: 'RLS test'
  }).select('id').single();
  console.log('insert test:', testInsert.error?.message || `OK id=${testInsert.data?.id}`);
})().catch(e=>console.error(e));
