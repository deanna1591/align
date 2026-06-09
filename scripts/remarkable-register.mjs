// scripts/remarkable-register.mjs
//
// One-time setup. Connects this app to your reMarkable account.
//
//   1. Go to https://my.remarkable.com/device/desktop/connect
//   2. Copy the 8-character one-time code it shows.
//   3. Run:  node scripts/remarkable-register.mjs <code>
//   4. Copy the long token it prints and set it as REMARKABLE_TOKEN
//      in Vercel (Project → Settings → Environment Variables) and in
//      your local .env.local. The token is long-lived — you only do this once.
//
import { register } from 'rmapi-js';

const code = (process.argv[2] || '').trim();
if (code.length < 6) {
  console.error('\nUsage: node scripts/remarkable-register.mjs <one-time-code>');
  console.error('Get a code at https://my.remarkable.com/device/desktop/connect\n');
  process.exit(1);
}

try {
  const token = await register(code);
  console.log('\n✅ Connected. Set this as REMARKABLE_TOKEN (Vercel env + .env.local):\n');
  console.log(token + '\n');
} catch (e) {
  console.error('\n❌ Registration failed:', e?.message || e);
  console.error('Codes expire fast — generate a fresh one and try again.\n');
  process.exit(1);
}
