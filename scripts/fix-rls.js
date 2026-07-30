const { Pool } = require('pg');
const ref = 'ioyuimwsoaozmlviirme';
const pw = 'Ayanalidar@110';

async function fix() {
  const pool = new Pool({
    host: 'aws-0-ap-south-1.pooler.supabase.com',
    port: 6543,
    database: 'postgres',
    user: 'postgres.' + ref,
    password: pw,
    max: 1,
    connectionTimeoutMillis: 10000,
    ssl: { rejectUnauthorized: false },
  });

  try {
    const c = await pool.connect();
    console.log('Connected! Fixing permissions...');

    await c.query('GRANT SELECT ON scam_numbers TO anon, authenticated, service_role');
    await c.query('GRANT SELECT ON indian_prefixes TO anon, authenticated, service_role');
    await c.query('GRANT SELECT ON intl_scam_patterns TO anon, authenticated, service_role');
    await c.query('GRANT SELECT ON scam_reports TO anon, authenticated, service_role');
    console.log('GRANT SELECT done');

    await c.query("DROP POLICY IF EXISTS \"Public can read scam DB\" ON scam_numbers");
    await c.query("CREATE POLICY \"Public can read scam DB\" ON scam_numbers FOR SELECT USING (true)");

    const { rows } = await c.query('SELECT count(*) as c FROM scam_numbers');
    console.log('scam_numbers:', rows[0].c, 'rows');

    c.release();
  } catch (e) {
    console.log('Failed:', e.message.substring(0, 200));
  }
  await pool.end().catch(() => {});
}
fix();
