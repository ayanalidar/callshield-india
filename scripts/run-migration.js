require('dotenv').config({path: '.env.local'});
const fs = require('fs');
const path = require('path');

// Read the SQL migration
const sql = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'migrations', '00003_fix_rls_lookups.sql'), 'utf8');

// Use Supabase Management API to run SQL
const projectRef = 'ioyuimwsoaozmlviirme';
const accessToken = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Try management API first
async function runViaManagement() {
  // Supabase Platform API
  const url = `https://api.supabase.com/v1/projects/${projectRef}/database/query`;
  
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql })
  });
  const text = await res.text();
  console.log('Management API:', res.status, text.substring(0, 300));
  return res.ok;
}

// Try direct SQL via pg REST
async function runViaPgRest() {
  const {createClient} = require('@supabase/supabase-js');
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  
  // Try to execute via a direct call
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/`;
  console.log('Base URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
  
  // Try execute SQL via supabase SQL endpoint
  const sqlUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/sql`;
  try {
    const res = await fetch(sqlUrl, {
      method: 'POST',
      headers: {
        'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/sql',
        'Prefer': 'params=single-object',
      },
      body: sql
    });
    const text = await res.text();
    console.log('SQL endpoint:', res.status, text.substring(0, 300));
  } catch(e) {
    console.log('SQL endpoint error:', e.message);
  }
}

runViaPgRest().catch(e => console.error(e));
