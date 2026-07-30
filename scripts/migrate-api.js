/**
 * Run this script to migrate the Supabase database using the REST API.
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env.local
 */
const https = require('https');
const fs = require('fs');

const SUPABASE_URL = 'ioyuimwsoaozmlviirme.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlveXVpbXdzb2Fvem1sdmlpcm1lIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTM3ODExNiwiZXhwIjoyMTAwOTU0MTE2fQ.4ned0lR3Wp1qG6E83T6w8pSnx4T2_ljHcdMz7kP6rw4';

const sqlPath = 'C:\\Users\\ayana\\.openclaw-autoclaw\\agents\\callshield\\workspace\\callshield\\supabase\\migrations\\00001_initial_schema.sql';
const sql = fs.readFileSync(sqlPath, 'utf-8');
const lines = sql.split('\n').filter(l => l.trim() && !l.trim().startsWith('--')).join('\n');
const statements = lines.split(';').filter(s => s.trim().length > 0);

function apiPost(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = https.request({
      hostname: SUPABASE_URL,
      path: path,
      method: 'POST',
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': '***' + SERVICE_KEY,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
      timeout: 30000,
    }, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(body) }); }
        catch { resolve({ status: res.statusCode, body: body }); }
      });
    });
    req.on('error', reject);
    req.end(data);
  });
}

async function createTableViaAPI(name, createSQL) {
  // Try to insert a dummy row to test if table exists
  const test = await apiPost('/rest/v1/' + name, [{ phone_number: 'test' }]);
  if (test.status !== 404) {
    console.log('  ' + name + ': already exists (' + test.status + ')');
    return true;
  }
  
  // Table doesn't exist - try using the SQL endpoint
  const result = await apiPost('/rest/v1/rpc/exec_sql', { query: createSQL });
  if (result.status < 400) {
    console.log('  ' + name + ': created via RPC');
    return true;
  }
  
  console.log('  ' + name + ': RPC failed (' + result.status + ')');
  return false;
}

async function main() {
  console.log('Supabase Project: ' + SUPABASE_URL);
  console.log('SQL file: ' + sql.length + ' chars, ' + statements.length + ' statements\n');

  // Test connection
  const test = await apiPost('/rest/v1/', {});
  console.log('Connection test: ' + test.status + '\n');

  // Check if we have the exec_sql function
  const execTest = await apiPost('/rest/v1/rpc/exec_sql', { query: 'SELECT 1' });
  console.log('exec_sql RPC: ' + execTest.status);
  
  if (execTest.status === 404) {
    console.log('\nNo SQL execution endpoint available via REST.');
    console.log('This is expected - Supabase blocks DDL via PostgREST.');
    console.log('\nYou need to run the migration via one of these paths:');
    console.log('1. Pooler restart: https://supabase.com/dashboard/project/' + SUPABASE_URL.split('.')[0] + '/settings/database');
    console.log('   Toggle connection pooling OFF -> Save -> ON -> Save');
    console.log('2. SQL Editor: https://supabase.com/dashboard/project/' + SUPABASE_URL.split('.')[0] + '/sql/new');
    console.log('   Paste the entire SQL file and run');
    return;
  }
  
  // Try running the full migration
  console.log('\nRunning full migration...');
  const fullResult = await apiPost('/rest/v1/rpc/exec_sql', { query: sql });
  console.log('Full migration:', fullResult.status);
}

main().catch(e => console.error(e));
