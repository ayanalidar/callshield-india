const { Pool } = require('pg');
const fs = require('fs');

const sql = fs.readFileSync(
  'C:\\Users\\ayana\\.openclaw-autoclaw\\agents\\callshield\\workspace\\callshield\\supabase\\migrations\\00001_initial_schema.sql',
  'utf-8'
);

async function main() {
  // Try all connection formats
  const pw = 'Ayanalidar@110';
  const ref = 'ioyuimwsoaozmlviirme';

  const configs = [
    { host: 'aws-0-ap-south-1.pooler.supabase.com', port: 6543, db: 'postgres', user: 'postgres.' + ref, label: 'Transaction pooler' },
    { host: 'aws-0-ap-south-1.pooler.supabase.com', port: 5432, db: 'postgres', user: 'postgres.' + ref, label: 'Session pooler' },
    { host: 'aws-0-ap-south-1.pooler.supabase.com', port: 6543, db: 'postgres', user: 'postgres', label: 'Pooler (bare user)' },
  ];

  for (const cfg of configs) {
    const pool = new Pool({
      host: cfg.host, port: cfg.port, database: cfg.db,
      user: cfg.user, password: pw, max: 1,
      connectionTimeoutMillis: 15000,
      ssl: { rejectUnauthorized: false },
    });
    try {
      console.log('Trying:', cfg.label);
      const client = await pool.connect();
      console.log('  Connected!');
      const { rows } = await client.query("SELECT current_database() db, current_user usr");
      console.log('  DB=' + rows[0].db + ' User=' + rows[0].usr);

      console.log('  Running migration (' + sql.length + ' chars)...');
      await client.query(sql);
      console.log('  Migration complete!');

      const { rows: tables } = await client.query(
        "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name"
      );
      console.log('  ' + tables.length + ' tables: ' + tables.map(function(t){return t.table_name;}).join(', '));

      const { rows: c } = await client.query('SELECT count(*) as cnt FROM scam_numbers');
      console.log('  Scam numbers: ' + c[0].cnt);

      client.release();
      await pool.end();
      return;
    } catch(e) {
      console.log('  Failed: ' + e.message.substring(0, 150));
      await pool.end().catch(function(){});
    }
  }
  console.log('\nAll connection attempts failed.');
  console.log('Manual route: https://supabase.com/dashboard/project/' + ref + '/sql/new');
  console.log('Paste the SQL file: supabase/migrations/00001_initial_schema.sql');
}

main().catch(function(e) { console.error('Fatal:', e.message); });
