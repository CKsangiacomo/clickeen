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

async function headStatus(url) {
  const res = await fetch(url, { method: 'HEAD', cache: 'no-store' });
  return res.status;
}

async function waitForStatus(args) {
  const { label, url, wanted, timeoutMs = 90_000 } = args;
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const res = await fetch(url, { cache: 'no-store' });
    if (res.status === wanted) return true;
    await sleep(1500);
  }
  console.error(`[gate6] Timeout waiting for ${label} to return HTTP ${wanted}`);
  return false;
}

const localEnv = loadDotenv(path.join(process.cwd(), '.env.local'));

const CK_ADMIN_EMAIL = process.env.CK_ADMIN_EMAIL || localEnv.CK_ADMIN_EMAIL || '';
const CK_ADMIN_PASSWORD = process.env.CK_ADMIN_PASSWORD || localEnv.CK_ADMIN_PASSWORD || '';
const CK_ADMIN_ACCOUNT_ID =
  process.env.CK_ADMIN_ACCOUNT_ID || localEnv.CK_ADMIN_ACCOUNT_ID || '00000000-0000-0000-0000-000000000100';
const TOKYO_DEV_JWT =
  process.env.TOKYO_DEV_JWT ||
  localEnv.TOKYO_DEV_JWT ||
  process.env.PARIS_DEV_JWT ||
  localEnv.PARIS_DEV_JWT ||
  '';

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

async function createAccount(accessToken) {
  void accessToken;
  return assertString(CK_ADMIN_ACCOUNT_ID, 'CK_ADMIN_ACCOUNT_ID');
}

async function planChange(accessToken, accountId, nextTier, keepLivePublicIds = null) {
  const body = { nextTier };
  if (Array.isArray(keepLivePublicIds)) body.keepLivePublicIds = keepLivePublicIds;

  const { res, data, text } = await fetchJson(
    `${BASE.paris.replace(/\/+$/, '')}/api/accounts/${encodeURIComponent(accountId)}/lifecycle/plan-change?confirm=1`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        accept: 'application/json',
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) throw new Error(`Plan change failed (${res.status}) ${text.slice(0, 200)}`);
  return data;
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
  const publicId = typeof data?.publicId === 'string' ? data.publicId.trim() : '';
  if (!publicId) throw new Error('Duplicate missing publicId.');
  return publicId;
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

async function publishInstance(accessToken, accountId, publicId) {
  const payload = {
    status: 'published',
    localePolicy: {
      baseLocale: 'en',
      availableLocales: ['en'],
      ip: { enabled: false, countryToLocale: {} },
      switcher: { enabled: false },
    },
    seoGeo: false,
  };

  const { res, text } = await fetchJson(
    `${BASE.paris.replace(/\/+$/, '')}/api/accounts/${encodeURIComponent(accountId)}/instance/${encodeURIComponent(
      publicId,
    )}?subject=account`,
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
  if (!res.ok) throw new Error(`Publish ${publicId} failed (${res.status}) ${text.slice(0, 200)}`);
}

async function enableSeoGeo(accessToken, accountId, publicId) {
  const instance = await getInstance(accessToken, accountId, publicId);
  const config = instance?.config;
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    throw new Error('Instance config is missing or invalid');
  }
  const nextConfig = { ...config, seoGeo: { ...(config.seoGeo || {}), enabled: true } };

  const payload = {
    config: nextConfig,
    status: 'published',
    localePolicy: {
      baseLocale: 'en',
      availableLocales: ['en'],
      ip: { enabled: false, countryToLocale: {} },
      switcher: { enabled: false },
    },
    seoGeo: true,
  };

  const { res, text } = await fetchJson(
    `${BASE.paris.replace(/\/+$/, '')}/api/accounts/${encodeURIComponent(accountId)}/instance/${encodeURIComponent(
      publicId,
    )}?subject=account`,
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
  if (!res.ok) throw new Error(`Enable SEO/GEO failed (${res.status}) ${text.slice(0, 200)}`);
}

async function uploadAsset(accessToken, accountId) {
  const body = Buffer.from(`gate6-asset-${Date.now()}`, 'utf8');
  const url = `${BASE.tokyo.replace(/\/+$/, '')}/assets/upload?_t=${Date.now()}`;

  const attemptUpload = async (token) => {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        accept: 'application/json',
        'x-account-id': accountId,
        'x-source': 'api',
        'x-filename': 'gate6.txt',
        'content-type': 'text/plain; charset=utf-8',
      },
      body,
    });
    const text = await res.text();
    let data = null;
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
    return { res, text, data };
  };

  const primary = await attemptUpload(accessToken);
  if (primary.res.ok) {
    const assetUrl = typeof primary.data?.url === 'string' ? primary.data.url.trim() : '';
    if (!assetUrl) throw new Error('Asset upload missing url.');
    return { assetUrl, authMode: 'berlin' };
  }

  const primaryReason = primary.data?.error?.reasonKey || null;
  const shouldFallback =
    primary.res.status === 502 &&
    primaryReason === 'AUTH_PROVIDER_UNAVAILABLE' &&
    Boolean(TOKYO_DEV_JWT);
  if (!shouldFallback) {
    throw new Error(`Asset upload failed (${primary.res.status}) ${primary.text.slice(0, 200)}`);
  }

  const fallback = await attemptUpload(TOKYO_DEV_JWT);
  if (!fallback.res.ok) {
    throw new Error(`Asset upload fallback failed (${fallback.res.status}) ${fallback.text.slice(0, 200)}`);
  }
  const assetUrl = typeof fallback.data?.url === 'string' ? fallback.data.url.trim() : '';
  if (!assetUrl) throw new Error('Asset upload fallback missing url.');
  return { assetUrl, authMode: 'tokyo-dev-jwt' };
}

async function readTierDropLifecycleNotice(accessToken, accountId) {
  const { res, data, text } = await fetchJson(`${BASE.paris.replace(/\/+$/, '')}/api/roma/bootstrap`, {
    headers: { authorization: `Bearer ${accessToken}`, accept: 'application/json' },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Bootstrap read failed (${res.status}) ${text.slice(0, 200)}`);
  const accounts = Array.isArray(data?.accounts) ? data.accounts : [];
  const match = accounts.find((row) => row?.accountId === accountId) || null;
  const lifecycleNotice = match?.lifecycleNotice;
  if (!lifecycleNotice || typeof lifecycleNotice !== 'object' || Array.isArray(lifecycleNotice)) return null;
  return lifecycleNotice;
}

async function main() {
  console.log('[gate6] start');

  const accessToken = await loginPassword();
  const accountId = await createAccount(accessToken);

  console.log(`[gate6] created account=${accountId}`);

  const upgraded = await planChange(accessToken, accountId, 'tier3');
  console.log(`[gate6] upgrade → tier3 ok=${upgraded?.ok === true} isTierDrop=${Boolean(upgraded?.isTierDrop)}`);

  const instances = [];
  for (let i = 0; i < 3; i += 1) {
    instances.push(await duplicateFaq(accessToken, accountId));
  }
  console.log(`[gate6] created instances=${instances.join(', ')}`);

  for (const publicId of instances) {
    await publishInstance(accessToken, accountId, publicId);
  }

  for (const publicId of instances) {
    const ok = await waitForStatus({
      label: `venice /r/${publicId}`,
      url: `${BASE.venice.replace(/\/+$/, '')}/r/${encodeURIComponent(publicId)}`,
      wanted: 200,
    });
    if (!ok) process.exit(1);
  }
  console.log('[gate6] all instances live');

  // Gate 5: SEO/GEO is tier-only and mirrored (meta pointer exists only when entitled).
  const seoInstance = instances[0];
  await enableSeoGeo(accessToken, accountId, seoInstance);
  const metaUrl = `${BASE.venice.replace(/\/+$/, '')}/r/${encodeURIComponent(seoInstance)}?meta=1&locale=en`;
  const metaPointerUrl = `${BASE.tokyo.replace(/\/+$/, '')}/renders/instances/${encodeURIComponent(seoInstance)}/live/meta/en.json`;
  const metaOk = await waitForStatus({ label: 'venice /r?meta=1', url: metaUrl, wanted: 200 });
  if (!metaOk) process.exit(1);
  const metaPointerOk = await waitForStatus({ label: 'tokyo meta pointer', url: metaPointerUrl, wanted: 200 });
  if (!metaPointerOk) process.exit(1);
  console.log('[gate6] seo/geo meta present (entitled tier)');

  const uploaded = await uploadAsset(accessToken, accountId);
  const assetUrl = uploaded.assetUrl;
  const assetBefore = await headStatus(assetUrl);
  if (assetBefore !== 200) throw new Error(`Asset HEAD before drop expected 200, got ${assetBefore}`);
  console.log(`[gate6] asset uploaded (auth=${uploaded.authMode})`);

  const keep = [instances[0]];
  const dropped = await planChange(accessToken, accountId, 'free', keep);
  console.log(`[gate6] drop → free ok=${dropped?.ok === true} assetsPurged=${Boolean(dropped?.assetsPurged)}`);

  // Wait for Tokyo delete-instance-mirror jobs to complete.
  for (const publicId of instances.slice(1)) {
    const ok = await waitForStatus({
      label: `venice /r/${publicId}`,
      url: `${BASE.venice.replace(/\/+$/, '')}/r/${encodeURIComponent(publicId)}`,
      wanted: 404,
    });
    if (!ok) process.exit(1);
  }
  console.log('[gate6] unpublished instances are dark');

  const assetAfter = await headStatus(assetUrl);
  if (assetAfter !== 404) throw new Error(`Asset HEAD after drop expected 404, got ${assetAfter}`);
  console.log('[gate6] assets purged');

  const metaGone = await waitForStatus({ label: 'venice /r?meta=1', url: metaUrl, wanted: 404 });
  if (!metaGone) process.exit(1);
  const metaPointerGone = await waitForStatus({ label: 'tokyo meta pointer', url: metaPointerUrl, wanted: 404 });
  if (!metaPointerGone) process.exit(1);
  console.log('[gate6] seo/geo meta removed on tier drop');

  const lifecycleNotice = await readTierDropLifecycleNotice(accessToken, accountId);
  if (!lifecycleNotice) throw new Error('Expected lifecycleNotice on /api/roma/bootstrap account payload, but none found.');
  if (!lifecycleNotice.tierChangedAt) throw new Error('Expected lifecycleNotice.tierChangedAt after tier drop.');
  if (lifecycleNotice.tierChangedFrom !== 'tier3') {
    throw new Error(`Expected lifecycleNotice.tierChangedFrom=tier3, got ${String(lifecycleNotice.tierChangedFrom)}`);
  }
  if (lifecycleNotice.tierChangedTo !== 'free') {
    throw new Error(`Expected lifecycleNotice.tierChangedTo=free, got ${String(lifecycleNotice.tierChangedTo)}`);
  }
  if (lifecycleNotice.tierDropEmailSentAt !== null) {
    throw new Error(
      `Expected lifecycleNotice.tierDropEmailSentAt=null (pending), got ${String(lifecycleNotice.tierDropEmailSentAt)}`,
    );
  }
  console.log('[gate6] lifecycle notice persisted on accounts columns (email pending)');

  console.log('[gate6] done');
}

main().catch((error) => {
  console.error(`[gate6] failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
