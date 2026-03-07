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
  throw new Error(`[gate5] Timeout waiting for ${label} to return HTTP ${wanted}`);
}

function assertHex64(value) {
  return typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value.trim());
}

function assertString(value, label) {
  const out = typeof value === 'string' ? value.trim() : '';
  if (!out) throw new Error(`[gate5] Missing ${label}`);
  return out;
}

const localEnv = loadDotenv(path.join(process.cwd(), '.env.local'));

const CK_ADMIN_EMAIL = process.env.CK_ADMIN_EMAIL || localEnv.CK_ADMIN_EMAIL || '';
const CK_ADMIN_PASSWORD = process.env.CK_ADMIN_PASSWORD || localEnv.CK_ADMIN_PASSWORD || '';
const CK_ADMIN_ACCOUNT_ID =
  process.env.CK_ADMIN_ACCOUNT_ID || localEnv.CK_ADMIN_ACCOUNT_ID || '00000000-0000-0000-0000-000000000100';

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
    throw new Error(`Berlin password login failed (${res.status}) reasonKey=${reasonKey || 'unknown'} ${text.slice(0, 140)}`);
  }
  const accessToken = typeof data?.accessToken === 'string' ? data.accessToken.trim() : '';
  if (!accessToken) throw new Error('Berlin login missing accessToken.');
  return accessToken;
}

async function createAccount(accessToken, name) {
  void accessToken;
  void name;
  return assertString(CK_ADMIN_ACCOUNT_ID, 'CK_ADMIN_ACCOUNT_ID');
}

async function planChange(accessToken, accountId, nextTier) {
  const { res, text } = await fetchJson(
    `${BASE.paris.replace(/\/+$/, '')}/api/accounts/${encodeURIComponent(accountId)}/lifecycle/plan-change?confirm=1`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        accept: 'application/json',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ nextTier }),
    },
  );
  if (!res.ok) throw new Error(`Plan change failed (${res.status}) ${text.slice(0, 200)}`);
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

async function getInstance(accessToken, accountId, publicId) {
  const { res, data, text } = await fetchJson(
    `${BASE.paris.replace(/\/+$/, '')}/api/accounts/${encodeURIComponent(accountId)}/instance/${encodeURIComponent(publicId)}?subject=account`,
    {
      headers: {
        authorization: `Bearer ${accessToken}`,
        accept: 'application/json',
      },
      cache: 'no-store',
    },
  );
  if (!res.ok) throw new Error(`Instance get failed (${res.status}) ${text.slice(0, 200)}`);
  return data;
}

async function setSeoGeoEnabledInConfig(accessToken, accountId, publicId, enabled) {
  const instance = await getInstance(accessToken, accountId, publicId);
  const config = instance?.config;
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    throw new Error('Instance config is missing or invalid');
  }
  const nextConfig = { ...config, seoGeo: { ...(config.seoGeo || {}), enabled: Boolean(enabled) } };
  return nextConfig;
}

async function setLive(accessToken, accountId, publicId, payload) {
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
  if (!res.ok) throw new Error(`Instance update failed (${res.status}) ${text.slice(0, 200)}`);
}

function publishPayload(config, seoGeoRequested) {
  return {
    config,
    status: 'published',
    localePolicy: {
      baseLocale: 'en',
      availableLocales: ['en'],
      ip: { enabled: false, countryToLocale: {} },
      switcher: { enabled: false },
    },
    seoGeo: Boolean(seoGeoRequested),
  };
}

function unpublishPayload(config) {
  return {
    config,
    status: 'unpublished',
    localePolicy: {
      baseLocale: 'en',
      availableLocales: ['en'],
      ip: { enabled: false, countryToLocale: {} },
      switcher: { enabled: false },
    },
    seoGeo: false,
  };
}

async function expectMetaUnavailable(publicId) {
  const metaUrl = `${BASE.venice.replace(/\/+$/, '')}/r/${encodeURIComponent(publicId)}?meta=1&locale=en`;
  const res = await fetch(metaUrl, { cache: 'no-store' });
  if (res.status !== 404) {
    const body = await res.text().catch(() => '');
    throw new Error(`[gate5] Expected /r?meta=1 404 for non-entitled tier, got ${res.status} ${body.slice(0, 140)}`);
  }
  const tokyoMetaPointer = `${BASE.tokyo.replace(/\/+$/, '')}/renders/instances/${encodeURIComponent(publicId)}/live/meta/en.json`;
  const tokyoRes = await fetch(tokyoMetaPointer, { cache: 'no-store' });
  if (tokyoRes.status !== 404) {
    throw new Error(`[gate5] Expected Tokyo meta pointer 404 for non-entitled tier, got ${tokyoRes.status}`);
  }
}

async function waitForMetaAvailable(publicId) {
  const metaUrl = `${BASE.venice.replace(/\/+$/, '')}/r/${encodeURIComponent(publicId)}?meta=1&locale=en`;
  await waitForStatus({ label: 'venice /r?meta=1', url: metaUrl, wanted: 200, timeoutMs: 180_000 });

  const metaPointerUrl = `${BASE.tokyo.replace(/\/+$/, '')}/renders/instances/${encodeURIComponent(publicId)}/live/meta/en.json`;
  await waitForStatus({ label: 'tokyo meta pointer', url: metaPointerUrl, wanted: 200, timeoutMs: 180_000 });

  const metaPointerRes = await fetch(metaPointerUrl, { cache: 'no-store' });
  const metaPointer = await metaPointerRes.json().catch(() => null);
  const metaFp = typeof metaPointer?.metaFp === 'string' ? metaPointer.metaFp.trim() : '';
  if (!assertHex64(metaFp)) throw new Error(`[gate5] Invalid metaFp in pointer: ${metaFp || 'missing'}`);

  const metaPackUrl = `${BASE.tokyo.replace(/\/+$/, '')}/renders/instances/${encodeURIComponent(publicId)}/meta/en/${encodeURIComponent(metaFp)}.json`;
  await waitForStatus({ label: 'tokyo meta pack', url: metaPackUrl, wanted: 200, timeoutMs: 180_000 });
  return { metaFp };
}

async function main() {
  const accessToken = await loginPassword();

  console.log('[gate5] Non-entitled tier (free): meta must NOT exist…');
  {
    const accountId = await createAccount(accessToken, 'Gate 5 Free Account');
    const publicId = await duplicateFaq(accessToken, accountId);
    const config = await setSeoGeoEnabledInConfig(accessToken, accountId, publicId, true);
    await setLive(accessToken, accountId, publicId, publishPayload(config, true));

    // Live pointer should exist, but meta must not.
    await waitForStatus({
      label: 'venice /r',
      url: `${BASE.venice.replace(/\/+$/, '')}/r/${encodeURIComponent(publicId)}`,
      wanted: 200,
      timeoutMs: 180_000,
    });
    await expectMetaUnavailable(publicId);
    console.log('[gate5] free tier meta unavailable ✅');

    await setLive(accessToken, accountId, publicId, unpublishPayload(config));
    await waitForStatus({
      label: 'venice /r',
      url: `${BASE.venice.replace(/\/+$/, '')}/r/${encodeURIComponent(publicId)}`,
      wanted: 404,
      timeoutMs: 90_000,
    });
  }

  console.log('[gate5] Entitled tier (tier2): meta MUST exist…');
  {
    const accountId = await createAccount(accessToken, 'Gate 5 Tier2 Account');
    await planChange(accessToken, accountId, 'tier2');
    const publicId = await duplicateFaq(accessToken, accountId);
    const config = await setSeoGeoEnabledInConfig(accessToken, accountId, publicId, true);
    await setLive(accessToken, accountId, publicId, publishPayload(config, true));

    await waitForStatus({
      label: 'venice /r',
      url: `${BASE.venice.replace(/\/+$/, '')}/r/${encodeURIComponent(publicId)}`,
      wanted: 200,
      timeoutMs: 180_000,
    });

    const meta = await waitForMetaAvailable(publicId);
    console.log(`[gate5] tier2 meta available ✅ metaFp=${meta.metaFp}`);

    await setLive(accessToken, accountId, publicId, unpublishPayload(config));
    await waitForStatus({
      label: 'venice /r',
      url: `${BASE.venice.replace(/\/+$/, '')}/r/${encodeURIComponent(publicId)}`,
      wanted: 404,
      timeoutMs: 90_000,
    });
    await waitForStatus({
      label: 'tokyo meta pointer',
      url: `${BASE.tokyo.replace(/\/+$/, '')}/renders/instances/${encodeURIComponent(publicId)}/live/meta/en.json`,
      wanted: 404,
      timeoutMs: 90_000,
    });
  }

  console.log('[gate5] done');
}

main().catch((error) => {
  console.error(`[gate5] failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
