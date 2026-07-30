/**
 * CallShield DB Migration Script
 * Runs the schema SQL against Supabase directly via pg.
 */
const { Pool } = require('pg');
const fs = require('fs');

async function migrate() {
  const connectionString = process.env.DATABASE_URL || 
    'postgresql://postgres.xewfzvptpgcmzsyplmyc:[YOUR_DB_PASSWORD]@aws-0-ap-south-1.pooler.supabase.com:5432/postgres';

  if (connectionString.includes('[YOUR_DB_PASSWORD]')) {
    console.error('ERROR: You must provide your Supabase database password in DATABASE_URL');
    console.error('Find it in: Supabase Dashboard → Project Settings → Database → Connection string');
    console.error('Format: DATABASE_URL=postgresql://postgres.xewfzvptpgcmzsyplmyc:PASSWORD@aws-0-ap-south-1.pooler.supabase.com:5432/postgres');
    process.exit(1);
  }

  const pool = new Pool({ 
    connectionString,
    max: 2,
    connectionTimeoutMillis: 10000,
  });

  const sql = fs.readFileSync(
    'C:\\Users\\ayana\\.openclaw-autoclaw\\agents\\callshield\\workspace\\callshield\\supabase\\migrations\\00001_initial_schema.sql',
    'utf-8'
  );

  console.log(`Migrating... SQL file: ${sql.length} chars`);
  console.log('Connecting to Supabase...');

  try {
    const client = await pool.connect();
    console.log('Connected! Executing schema...');
    
    await client.query(sql);
    console.log('✅ Migration complete!');

    // Verify tables
    const { rows } = await client.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    console.log(`\n📊 Tables created (${rows.length}):`);
    rows.forEach(r => console.log(`  - ${r.table_name}`));

    // Check seed data
    const { rows: scams } = await client.query('SELECT count(*) as cnt FROM scam_numbers');
    console.log(`\n🎯 Seed data: ${scams[0].cnt} scam numbers loaded`);

    const { rows: prefixes } = await client.query('SELECT count(*) as cnt FROM indian_prefixes');
    console.log(`📞 Seed data: ${prefixes[0].cnt} Indian prefix records`);

    const { rows: intl } = await client.query('SELECT count(*) as cnt FROM intl_scam_patterns');
    console.log(`🌍 Seed data: ${intl[0].cnt} international patterns`);

    client.release();
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    if (err.message.includes('authentication')) {
      console.error('\n👉 Your database password is likely wrong. Check Supabase Dashboard -> Database.');
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
