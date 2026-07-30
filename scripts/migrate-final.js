const { Pool } = require('pg');
const fs = require('fs');

const sql = fs.readFileSync(
  'C:\\Users\\ayana\\.openclaw-autoclaw\\agents\\callshield\\workspace\\callshield\\supabase\\migrations\\00001_initial_schema.sql',
  'utf-8'
);

// URL-encode the password
const encodedPw = encodeURIComponent('Ayanalidar@110');
const ref = 'ioyuimwsoaozmlviirme';

async function tryPool(host, port, label) {
  const pool = new Pool({
    host, port,
    database: 'postgres',
    user: 'postgres.' + ref,
    password: 'Ayanalidar@110',
    max: 1,
    connectionTimeoutMillis: 15000,
    ssl: { rejectUnauthorized: false },
  });
  try {
    console.log('Trying: ' + label);
    const client = await pool.connect();
    console.log('  Connected! Running migration...');
    
    await client.query(sql);
    console.log('  Migration complete!');

    const { rows: tables } = await client.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name"
    );
    console.log('  ' + tables.length + ' tables: ' + tables.map(function(t){return t.table_name;}).join(', '));

    const { rows: c } = await client.query('SELECT count(*) FROM scam_numbers');
    console.log('  Scam numbers: ' + c[0].count);

    const { rows: p } = await client.query('SELECT count(*) FROM indian_prefixes');
    console.log('  Prefixes: ' + p[0].count);

    client.release();
    return true;
  } catch(e) {
    console.log('  Failed: ' + e.message.substring(0, 200));
    return false;
  } finally {
    await pool.end().catch(function(){});
  }
}

async function main() {
  // Connection string approach with URL-encoded password
  const cs = 'postgresql://postgres.' + ref + ':' + encodedPw + '@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?sslmode=no-verify';
  console.log('Trying connection string...');
  const pool = new Pool({ connectionString: cs, max: 1, connectionTimeoutMillis: 15000 });
  try {
    const client = await pool.connect();
    console.log('  Connected! Running migration...');
    await client.query(sql);
    console.log('  Migration complete!');
    const { rows: tables } = await client.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name"
    );
    console.log('  ' + tables.length + ' tables');
    client.release();
    await pool.end();
    return;
  } catch(e) {
    console.log('  CS failed: ' + e.message.substring(0, 200));
    await pool.end().catch(function(){});
  }

  // Fallback: try each pooler port
  if (await tryPool('aws-0-ap-south-1.pooler.supabase.com', 6543, 'Pooler 6543')) return;
  if (await tryPool('aws-0-ap-south-1.pooler.supabase.com', 5432, 'Pooler 5432')) return;

  console.log('\nAll connection attempts failed.');
  console.log('This usually means the pooler needs a restart. Try:');
  console.log('1. Go to https://supabase.com/dashboard/project/' + ref + '/settings/database');
  console.log('2. Toggle pooling OFF -> save -> ON -> save');
  console.log('OR just paste the SQL file in the SQL Editor.');
}

main().catch(function(e){ console.error(e.message); });
