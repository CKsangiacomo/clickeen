// E2E smoke test: site → atlas → embed
// node:18, ESM only

const SITE_URL = 'https://c-keen-site.vercel.app';
const EMBED_URL = 'https://c-keen-embed.vercel.app';

async function postJson(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  let data;
  try { data = await res.json(); } catch { data = null; }
  return { res, data };
}

async function getWithBody(url) {
  const res = await fetch(url, { method: 'GET' });
  const text = await res.text();
  return { res, text };
}

function fail(reason) {
  console.log(`[E2E] FAIL ${reason}`);
  process.exit(1);
}

function normalizePublicKey(obj) {
  if (!obj || typeof obj !== 'object') return undefined;
  return obj.publicKey || obj.public_key || obj.public_id || obj.publicId;
}

function isPositiveIntegerString(value) {
  if (typeof value !== 'string' || value.trim() === '') return false;
  const n = Number(value);
  return Number.isInteger(n) && n > 0;
}

async function run() {
  try {
    // 1) Create real widget on site anonymous API
    const createPayload = {
      email: 'test+cicd@clickeen.com',
      type: 'contact-form',
      config: {
        title: 'E2E',
        successText: 'OK',
        theme: 'light',
        fields: { name: true, email: true, message: true },
      },
    };
    const { res: createRes, data: createData } = await postJson(
      `${SITE_URL}/api/widgets/anonymous`,
      createPayload
    );
    if (createRes.status !== 200) fail(`create status ${createRes.status}`);
    const publicKey = normalizePublicKey(createData);
    if (!publicKey || typeof publicKey !== 'string') fail('missing publicKey from create response');
    console.log(`[E2E] created publicKey=${publicKey}`);

    // 2) Hit embed endpoint for that key
    const { res: embedRes, text: js } = await getWithBody(
      `${EMBED_URL}/api/e/${encodeURIComponent(publicKey)}?v=1`
    );
    if (embedRes.status !== 200) fail(`embed status ${embedRes.status}`);

    const headers = embedRes.headers;
    const cacheControl = headers.get('cache-control') || '';
    const ttl = headers.get('x-cache-ttl');
    const fresh = headers.get('x-cache-fresh');
    const tmplVer = headers.get('x-template-version');
    const contentType = headers.get('content-type') || '';

    if (!contentType.includes('application/javascript')) fail('content-type not application/javascript');
    if (!cacheControl.includes('public')) fail('cache-control missing public');
    if (!isPositiveIntegerString(ttl)) fail('x-cache-ttl missing or not positive integer');
    if (!(fresh === 'true' || fresh === 'false')) fail('x-cache-fresh not true/false');
    if (!tmplVer) fail('x-template-version missing');
    if (!(typeof js === 'string' && js.length > 200 && js.includes('document'))) fail('embed js payload too small/invalid');

    // 3) Log concise summary
    console.log(
      `[E2E] embed status=${embedRes.status} ttl=${ttl} fresh=${fresh} tmplVer=${tmplVer} jsBytes=${js.length}`
    );
    console.log('[E2E] PASS');
  } catch (e) {
    fail(e && e.message ? e.message : String(e));
  }
}

run();


