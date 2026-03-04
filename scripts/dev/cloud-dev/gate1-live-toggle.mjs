import fs from 'node:fs';
import path from 'node:path';

function loadDotenv(filepath) {
  try {
    const text = fs.readFileSync(filepath, 'utf8');
    const out = {};
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx === -1) continue;
      const key = trimmed.slice(0, idx).trim();
      let value = trimmed.slice(idx + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      out[key] = value;
    }
    return out;
  } catch {
    return {};
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson(url, init) {
  const res = await fetch(url, init);
  const text = await res.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    data = null;
  }
  return { res, data, text };
}

async function waitForStatus(args) {
  const { label, url, wanted, timeoutMs = 120_000 } = args;
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const res = await fetch(url, { cache: 'no-store' });
    if (res.status === wanted) return true;
    await sleep(1500);
  }
  console.error(`[gate1] Timeout waiting for ${label} to return HTTP ${wanted}`);
  return false;
}

function assertHex64(value) {
  return typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value.trim());
}

function assertString(value, label) {
  const out = typeof value === 'string' ? value.trim() : '';
  if (!out) throw new Error(`[gate1] Missing ${label}`);
  return out;
}

const localEnv = loadDotenv(path.join(process.cwd(), '.env.local'));

const CK_ADMIN_EMAIL = process.env.CK_ADMIN_EMAIL || localEnv.CK_ADMIN_EMAIL || '';
const CK_ADMIN_PASSWORD = process.env.CK_ADMIN_PASSWORD || localEnv.CK_ADMIN_PASSWORD || '';

const BASE = {
  berlin:
    process.env.CK_CLOUD_BERLIN_BASE_URL ||
    localEnv.CK_CLOUD_BERLIN_BASE_URL ||
    'https://berlin-dev.clickeen.workers.dev',
  paris:
    process.env.CK_CLOUD_PARIS_BASE_URL ||
    localEnv.CK_CLOUD_PARIS_BASE_URL ||
    'https://paris.dev.clickeen.com',
  venice:
    process.env.CK_CLOUD_VENICE_BASE_URL ||
    localEnv.CK_CLOUD_VENICE_BASE_URL ||
    'https://venice.dev.clickeen.com',
  tokyo:
    process.env.CK_CLOUD_TOKYO_BASE_URL ||
    localEnv.CK_CLOUD_TOKYO_BASE_URL ||
    'https://tokyo.dev.clickeen.com',
};

async function loginPassword() {
  if (!CK_ADMIN_EMAIL || !CK_ADMIN_PASSWORD) {
    throw new Error('Missing CK_ADMIN_EMAIL / CK_ADMIN_PASSWORD (env var or .env.local).');
  }

  const { res, data, text } = await fetchJson(`${BASE.berlin.replace(/\/+$/, '')}/auth/login/password`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ email: CK_ADMIN_EMAIL, password: CK_ADMIN_PASSWORD }),
  });
  if (!res.ok) {
    const reasonKey = data?.error?.reasonKey || data?.error || null;
    throw new Error(
      `Berlin password login failed (${res.status}) reasonKey=${reasonKey || 'unknown'} ${text.slice(0, 140)}`,
    );
  }
  const accessToken = typeof data?.accessToken === 'string' ? data.accessToken.trim() : '';
  if (!accessToken) throw new Error('Berlin login missing accessToken.');
  return accessToken;
}

async function createAccount(accessToken) {
  const { res, data, text } = await fetchJson(`${BASE.paris.replace(/\/+$/, '')}/api/accounts`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
      accept: 'application/json',
      'content-type': 'application/json',
      'Idempotency-Key': crypto.randomUUID(),
    },
    body: JSON.stringify({ name: 'Gate 1 Test' }),
  });
  if (!res.ok) throw new Error(`Account create failed (${res.status}) ${text.slice(0, 200)}`);
  return assertString(data?.accountId, 'accountId');
}

async function duplicateFaq(accessToken, accountId) {
  const { res, data, text } = await fetchJson(`${BASE.paris.replace(/\/+$/, '')}/api/roma/widgets/duplicate`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
      accept: 'application/json',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ accountId, sourcePublicId: 'wgt_main_faq' }),
  });
  if (!res.ok) throw new Error(`Duplicate failed (${res.status}) ${text.slice(0, 200)}`);
  return assertString(data?.publicId, 'publicId');
}

async function setLive(accessToken, accountId, publicId, live) {
  const payload = live
    ? {
        status: 'published',
        localePolicy: {
          baseLocale: 'en',
          availableLocales: ['en'],
          ip: { enabled: false, countryToLocale: {} },
          switcher: { enabled: false },
        },
        seoGeo: false,
      }
    : {
        status: 'unpublished',
        localePolicy: {
          baseLocale: 'en',
          availableLocales: ['en'],
          ip: { enabled: false, countryToLocale: {} },
          switcher: { enabled: false },
        },
        seoGeo: false,
      };

  const { res, text } = await fetchJson(
    `${BASE.paris.replace(/\/+$/, '')}/api/accounts/${encodeURIComponent(accountId)}/instance/${encodeURIComponent(publicId)}?subject=account`,
    {
      method: 'PUT',
      headers: {
        authorization: `Bearer ${accessToken}`,
        accept: 'application/json',
        'content-type': 'application/json',
      },
      body: JSON.stringify(payload),
    },
  );
  if (!res.ok) throw new Error(`[gate1] Instance update failed (${res.status}) ${text.slice(0, 200)}`);
}

async function main() {
  const accessToken = await loginPassword();
  const accountId = await createAccount(accessToken);
  const publicId = await duplicateFaq(accessToken, accountId);

  console.log(`[gate1] accountId=${accountId}`);
  console.log(`[gate1] publicId=${publicId}`);

  console.log('[gate1] Turning live ON…');
  await setLive(accessToken, accountId, publicId, true);

  const tokyoRPointer = `${BASE.tokyo.replace(/\/+$/, '')}/renders/instances/${encodeURIComponent(publicId)}/live/r.json`;
  const okPointer = await waitForStatus({ label: 'tokyo live r.json', url: tokyoRPointer, wanted: 200 });
  if (!okPointer) process.exit(1);

  const veniceR = `${BASE.venice.replace(/\/+$/, '')}/r/${encodeURIComponent(publicId)}`;
  const rRes = await fetch(veniceR, { cache: 'no-store' });
  if (!rRes.ok) throw new Error(`[gate1] Venice /r returned ${rRes.status}`);
  const cacheControl = (rRes.headers.get('cache-control') || '').toLowerCase();
  if (!cacheControl.includes('no-store')) {
    throw new Error(`[gate1] Venice /r must be no-store (got "${cacheControl || 'missing'}")`);
  }
  const pointer = await rRes.json().catch(() => null);
  if (!pointer || typeof pointer !== 'object') throw new Error('[gate1] Venice /r returned invalid JSON');
  const widgetType = assertString(pointer.widgetType, 'pointer.widgetType');
  const configFp = assertString(pointer.configFp, 'pointer.configFp');
  if (!assertHex64(configFp)) throw new Error(`[gate1] pointer.configFp must be 64-hex (got "${configFp}")`);

  const tokyoConfigPack = `${BASE.tokyo.replace(/\/+$/, '')}/renders/instances/${encodeURIComponent(
    publicId,
  )}/config/${encodeURIComponent(configFp)}/config.json`;
  const okConfig = await waitForStatus({ label: 'tokyo config pack', url: tokyoConfigPack, wanted: 200 });
  if (!okConfig) process.exit(1);

  const tokyoTextPointer = `${BASE.tokyo.replace(/\/+$/, '')}/l10n/instances/${encodeURIComponent(publicId)}/live/en.json`;
  const okTextPointer = await waitForStatus({ label: 'tokyo l10n pointer', url: tokyoTextPointer, wanted: 200 });
  if (!okTextPointer) process.exit(1);
  const textPointerRes = await fetch(tokyoTextPointer, { cache: 'no-store' });
  const textPointer = await textPointerRes.json().catch(() => null);
  const textFp = typeof textPointer?.textFp === 'string' ? textPointer.textFp.trim() : '';
  if (!assertHex64(textFp)) throw new Error(`[gate1] Missing/invalid textFp in l10n pointer (got "${textFp || 'missing'}")`);

  const tokyoTextPack = `${BASE.tokyo.replace(/\/+$/, '')}/l10n/instances/${encodeURIComponent(
    publicId,
  )}/packs/en/${encodeURIComponent(textFp)}.json`;
  const okTextPack = await waitForStatus({ label: 'tokyo l10n pack', url: tokyoTextPack, wanted: 200 });
  if (!okTextPack) process.exit(1);

  const veniceE = `${BASE.venice.replace(/\/+$/, '')}/e/${encodeURIComponent(publicId)}`;
  const eRes = await fetch(veniceE, { cache: 'no-store' });
  if (!eRes.ok) throw new Error(`[gate1] Venice /e returned ${eRes.status}`);
  const html = await eRes.text();
  if (!html.toLowerCase().includes('clickeen embed')) {
    throw new Error('[gate1] Venice /e did not return the embed shell');
  }

  console.log('[gate1] Live ON verified');
  console.log(`[gate1] widgetType=${widgetType}`);
  console.log(`[gate1] configFp=${configFp}`);
  console.log(`[gate1] textFp=${textFp}`);

  console.log('[gate1] Turning live OFF…');
  await setLive(accessToken, accountId, publicId, false);

  const okR404 = await waitForStatus({
    label: 'venice /r after unpublish',
    url: veniceR,
    wanted: 404,
    timeoutMs: 120_000,
  });
  if (!okR404) process.exit(1);

  const okTokyo404 = await waitForStatus({
    label: 'tokyo r.json after unpublish',
    url: tokyoRPointer,
    wanted: 404,
    timeoutMs: 120_000,
  });
  if (!okTokyo404) process.exit(1);

  const okConfig404 = await waitForStatus({
    label: 'tokyo config pack after unpublish',
    url: tokyoConfigPack,
    wanted: 404,
    timeoutMs: 120_000,
  });
  if (!okConfig404) process.exit(1);

  const okL10n404 = await waitForStatus({
    label: 'tokyo l10n pointer after unpublish',
    url: tokyoTextPointer,
    wanted: 404,
    timeoutMs: 120_000,
  });
  if (!okL10n404) process.exit(1);

  console.log('[gate1] Live OFF verified (Tokyo mirror deleted)');
}

main().catch((error) => {
  console.error(`[gate1] Unexpected error: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
