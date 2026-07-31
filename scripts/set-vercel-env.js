require('dotenv').config({path:'.env.local'});
const { execSync } = require('child_process');

const vars = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  NEXT_PUBLIC_APP_URL: 'https://callshield-india-olive.vercel.app',
  NEXT_PUBLIC_APP_NAME: 'CallShield India',
};

console.log('Setting env vars on Vercel...');

for (const [key, value] of Object.entries(vars)) {
  if (!value || value.length < 10) {
    console.log(`SKIP ${key}: value too short or missing (${value ? value.length : 0} chars)`);
    continue;
  }
  console.log(`${key}: ${value.substring(0, 30)}... (${value.length} chars)`);
}

// Print the commands for manual execution
console.log('\nRun these commands:');
for (const [key, value] of Object.entries(vars)) {
  if (!value || value.length < 10) continue;
  if (key.includes('ANON_KEY') || key.includes('SERVICE_ROLE')) {
    console.log(`npx vercel env add ${key} production <<< "${value}"`);
  } else {
    console.log(`npx vercel env add ${key} production --value "${value}"`);
  }
}
