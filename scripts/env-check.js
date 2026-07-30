require('dotenv').config({path:'.env.local'});
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8');
const lines = env.split('\n');
for (const line of lines) {
  if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) {
    const key = line.substring(27);
    console.log('File SERVICE_KEY length:', key.length);
    console.log('Has ellipsis:', key.includes(String.fromCharCode(8230)));
    console.log('Env SERVICE_KEY length:', (process.env.SUPABASE_SERVICE_ROLE_KEY || '').length);
  }
  if (line.startsWith('NEXT_PUBLIC_SUPABASE_ANON_KEY=')) {
    const key = line.substring(31);
    console.log('File ANON_KEY length:', key.length);
  }
}
