// Minimal Atlas header smoke test
// - Verifies production headers and preview no-store behavior

const PROD_URL = 'https://c-keen-embed.vercel.app/api/e/DEMO?v=1';
const PREVIEW_URL = 'https://c-keen-embed.vercel.app/api/e/DEMO?v=1&cfg=eyJ0aXRsZSI6IkNPTkZJRyJ9';

async function fetchHeaders(url) {
  const res = await fetch(url, { method: 'GET' });
  return { status: res.status, headers: res.headers };
}

function isIntegerString(value) {
  if (typeof value !== 'string' || value.trim() === '') return false;
  const num = Number(value);
  return Number.isInteger(num);
}

async function run() {
  const failures = [];

  // Production checks
  try {
    const { status, headers } = await fetchHeaders(PROD_URL);
    if (status !== 200) failures.push(`prod status ${status}`);

    const ct = headers.get('content-type') || '';
    if (!ct.includes('application/javascript')) failures.push('prod content-type not application/javascript');

    const cc = headers.get('cache-control') || '';
    if (!cc.includes('public')) failures.push('prod cache-control missing public');

    const ttl = headers.get('x-cache-ttl');
    if (!ttl || !isIntegerString(ttl)) failures.push('prod x-cache-ttl missing or not integer');

    const fresh = headers.get('x-cache-fresh');
    if (fresh !== 'true') failures.push('prod x-cache-fresh not true');

    const tmpl = headers.get('x-template-version');
    if (!tmpl) failures.push('prod x-template-version missing');
  } catch (e) {
    failures.push(`prod fetch error: ${e.message}`);
  }

  // Preview check
  try {
    const { status, headers } = await fetchHeaders(PREVIEW_URL);
    if (status !== 200) failures.push(`preview status ${status}`);
    const cc = headers.get('cache-control');
    if (cc !== 'no-store') failures.push('preview cache-control not no-store');
  } catch (e) {
    failures.push(`preview fetch error: ${e.message}`);
  }

  if (failures.length > 0) {
    console.log(`SMOKE FAIL: ${failures.join('; ')}`);
    process.exit(1);
  } else {
    console.log('SMOKE PASS: Atlas headers OK');
  }
}

run();


