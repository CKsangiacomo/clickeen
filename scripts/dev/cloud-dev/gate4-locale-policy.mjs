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

async function waitFor(args) {
  const { label, timeoutMs = 180_000, intervalMs = 1500, fn } = args;
  const started = Date.now();
  let lastError = null;
  while (Date.now() - started < timeoutMs) {
    try {
      const value = await fn();
      if (value) return value;
    } catch (error) {
      lastError = error;
    }
    await sleep(intervalMs);
  }
  const suffix = lastError ? ` lastError=${lastError instanceof Error ? lastError.message : String(lastError)}` : '';
  throw new Error(`[gate4] Timeout waiting for ${label}.${suffix}`);
}

function normalizeLocaleToken(raw) {
  const value = typeof raw === 'string' ? raw.trim().toLowerCase().replace(/_/g, '-') : '';
  return value || '';
}

function selectLocale(args) {
  const policy = args.policy || {};
  const fixedLocale = normalizeLocaleToken(args.fixedLocale);
  const baseLocale = normalizeLocaleToken(policy.baseLocale) || 'en';
  const availableLocales = Array.isArray(policy.availableLocales)
    ? Array.from(new Set(policy.availableLocales.map(normalizeLocaleToken).filter(Boolean)))
    : [baseLocale];
  const ipEnabled = Boolean(policy?.ip?.enabled === true);
  const mapping = policy?.ip?.countryToLocale && typeof policy.ip.countryToLocale === 'object' ? policy.ip.countryToLocale : {};
  const geoCountry = typeof args.geoCountry === 'string' ? args.geoCountry.trim().toUpperCase() : 'ZZ';

  let locale = baseLocale;
  if (fixedLocale && availableLocales.includes(fixedLocale)) {
    locale = fixedLocale;
  } else if (ipEnabled) {
    const mappedRaw = typeof mapping[geoCountry] === 'string' ? mapping[geoCountry] : '';
    const mapped = normalizeLocaleToken(mappedRaw);
    if (mapped && availableLocales.includes(mapped)) locale = mapped;
  }
  return locale;
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

async function createAccount(accessToken, name) {
  const { res, data, text } = await fetchJson(`${BASE.paris.replace(/\/+$/, '')}/api/accounts`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
      accept: 'application/json',
      'content-type': 'application/json',
      'Idempotency-Key': crypto.randomUUID(),
    },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error(`Account create failed (${res.status}) ${text.slice(0, 200)}`);
  const accountId = typeof data?.accountId === 'string' ? data.accountId.trim() : '';
  if (!accountId) throw new Error('Account create missing accountId.');
  return accountId;
}

async function putAccountLocales(accessToken, accountId, locales, policy) {
  return fetchJson(`${BASE.paris.replace(/\/+$/, '')}/api/accounts/${encodeURIComponent(accountId)}/locales?subject=account`, {
    method: 'PUT',
    headers: {
      authorization: `Bearer ${accessToken}`,
      accept: 'application/json',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ locales, policy }),
  });
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
  const publicId = typeof data?.publicId === 'string' ? data.publicId.trim() : '';
  if (!publicId) throw new Error('Duplicate missing publicId.');
  return publicId;
}

function livePayload(overrides = {}) {
  return {
    status: 'published',
    localePolicy: {
      baseLocale: 'en',
      availableLocales: ['en'],
      ip: { enabled: false, countryToLocale: {} },
      switcher: { enabled: false },
    },
    seoGeo: false,
    ...overrides,
  };
}

async function publishInstance(accessToken, accountId, publicId) {
  const { res, text } = await fetchJson(
    `${BASE.paris.replace(/\/+$/, '')}/api/accounts/${encodeURIComponent(accountId)}/instance/${encodeURIComponent(publicId)}?subject=account`,
    {
      method: 'PUT',
      headers: {
        authorization: `Bearer ${accessToken}`,
        accept: 'application/json',
        'content-type': 'application/json',
      },
      body: JSON.stringify(livePayload()),
    },
  );
  if (!res.ok) throw new Error(`[gate4] Publish failed (${res.status}) ${text.slice(0, 200)}`);
}

async function unpublishInstance(accessToken, accountId, publicId) {
  const { res, text } = await fetchJson(
    `${BASE.paris.replace(/\/+$/, '')}/api/accounts/${encodeURIComponent(accountId)}/instance/${encodeURIComponent(publicId)}?subject=account`,
    {
      method: 'PUT',
      headers: {
        authorization: `Bearer ${accessToken}`,
        accept: 'application/json',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ ...livePayload(), status: 'unpublished' }),
    },
  );
  if (!res.ok) throw new Error(`[gate4] Unpublish failed (${res.status}) ${text.slice(0, 200)}`);
}

async function readVenicePointer(publicId) {
  const url = `${BASE.venice.replace(/\/+$/, '')}/r/${encodeURIComponent(publicId)}`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) return null;
  const json = await res.json().catch(() => null);
  if (!json || typeof json !== 'object') return null;
  return json;
}

async function main() {
  const accessToken = await loginPassword();

  console.log('[gate4] Cap check (free tier)…');
  {
    const accountId = await createAccount(accessToken, 'Gate 4 Free Account');
    const { res, text } = await putAccountLocales(accessToken, accountId, ['de', 'es'], {
      v: 1,
      baseLocale: 'en',
      ip: { enabled: false, countryToLocale: {} },
      switcher: { enabled: false },
    });
    if (res.status !== 403) {
      throw new Error(`[gate4] Expected free tier locale cap to deny (403), got ${res.status} ${text.slice(0, 160)}`);
    }
    console.log('[gate4] free tier locale cap enforced ✅');
  }

  console.log('[gate4] Policy toggles (tier3)…');
  const accountId = await createAccount(accessToken, 'Gate 4 Tier3 Account');
  await planChange(accessToken, accountId, 'tier3');
  const publicId = await duplicateFaq(accessToken, accountId);
  await publishInstance(accessToken, accountId, publicId);

  console.log(`[gate4] accountId=${accountId}`);
  console.log(`[gate4] publicId=${publicId}`);

  // Enable one extra locale so we can test mapping + switcher semantics.
  const basePolicy = {
    v: 1,
    baseLocale: 'en',
    ip: { enabled: false, countryToLocale: {} },
    switcher: { enabled: false },
  };
  await putAccountLocales(accessToken, accountId, ['de'], basePolicy);

  const baseline = await waitFor({
    label: 'venice pointer includes en+de',
    fn: async () => {
      const pointer = await readVenicePointer(publicId);
      const policy = pointer?.localePolicy;
      const locales = Array.isArray(policy?.availableLocales) ? policy.availableLocales.map(normalizeLocaleToken) : [];
      if (!locales.includes('en') || !locales.includes('de')) return null;
      return { policy };
    },
  });

  // Toggle IP mode on with mapping.
  const ipPolicy = {
    v: 1,
    baseLocale: 'en',
    ip: { enabled: true, countryToLocale: { DE: 'de' } },
    switcher: { enabled: false },
  };
  await putAccountLocales(accessToken, accountId, ['de'], ipPolicy);

  const ipEnabled = await waitFor({
    label: 'venice pointer shows ip.enabled=true and DE->de',
    fn: async () => {
      const pointer = await readVenicePointer(publicId);
      const policy = pointer?.localePolicy;
      const enabled = policy?.ip?.enabled === true;
      const mapped = policy?.ip?.countryToLocale?.DE;
      if (!enabled) return null;
      if (normalizeLocaleToken(mapped) !== 'de') return null;
      return { policy };
    },
  });

  const selectedDe = selectLocale({ policy: ipEnabled.policy, fixedLocale: '', geoCountry: 'DE' });
  const selectedUs = selectLocale({ policy: ipEnabled.policy, fixedLocale: '', geoCountry: 'US' });
  const selectedFixed = selectLocale({ policy: ipEnabled.policy, fixedLocale: 'en', geoCountry: 'DE' });
  if (selectedDe !== 'de') throw new Error(`[gate4] ip mode expected DE -> de, got ${selectedDe}`);
  if (selectedUs !== 'en') throw new Error(`[gate4] ip mode expected US -> base en, got ${selectedUs}`);
  if (selectedFixed !== 'en') throw new Error(`[gate4] fixed locale must override ip mode, got ${selectedFixed}`);

  // Toggle switcher on.
  const switcherPolicy = {
    ...ipPolicy,
    switcher: { enabled: true },
  };
  await putAccountLocales(accessToken, accountId, ['de'], switcherPolicy);

  await waitFor({
    label: 'venice pointer shows switcher.enabled=true',
    fn: async () => {
      const pointer = await readVenicePointer(publicId);
      const enabled = pointer?.localePolicy?.switcher?.enabled === true;
      return enabled ? true : null;
    },
  });

  // Change base locale to de (and keep en as additional locale).
  const baseDePolicy = {
    v: 1,
    baseLocale: 'de',
    ip: { enabled: false, countryToLocale: {} },
    switcher: { enabled: true },
  };
  await putAccountLocales(accessToken, accountId, ['en'], baseDePolicy);

  const baseDePointer = await waitFor({
    label: 'venice pointer baseLocale=de and locales include de+en',
    fn: async () => {
      const pointer = await readVenicePointer(publicId);
      const policy = pointer?.localePolicy;
      if (normalizeLocaleToken(policy?.baseLocale) !== 'de') return null;
      const locales = Array.isArray(policy?.availableLocales) ? policy.availableLocales.map(normalizeLocaleToken) : [];
      if (!locales.includes('de') || !locales.includes('en')) return null;
      if (policy?.ip?.enabled === true) return null;
      return { policy };
    },
  });

  const selectedBase = selectLocale({ policy: baseDePointer.policy, fixedLocale: '', geoCountry: 'US' });
  if (selectedBase !== 'de') throw new Error(`[gate4] ip off expected baseLocale=de for all IPs, got ${selectedBase}`);

  // Turn ip back on with best-effort mapping (US -> en).
  const baseDeIpPolicy = {
    ...baseDePolicy,
    ip: { enabled: true, countryToLocale: { US: 'en', DE: 'de' } },
  };
  await putAccountLocales(accessToken, accountId, ['en'], baseDeIpPolicy);

  const baseDeIpPointer = await waitFor({
    label: 'venice pointer baseLocale=de ip.enabled=true',
    fn: async () => {
      const pointer = await readVenicePointer(publicId);
      const policy = pointer?.localePolicy;
      if (normalizeLocaleToken(policy?.baseLocale) !== 'de') return null;
      if (policy?.ip?.enabled !== true) return null;
      return { policy };
    },
  });

  const selectedUsMapped = selectLocale({ policy: baseDeIpPointer.policy, fixedLocale: '', geoCountry: 'US' });
  const selectedFrFallback = selectLocale({ policy: baseDeIpPointer.policy, fixedLocale: '', geoCountry: 'FR' });
  if (selectedUsMapped !== 'en') throw new Error(`[gate4] ip on expected US -> en, got ${selectedUsMapped}`);
  if (selectedFrFallback !== 'de') throw new Error(`[gate4] ip on expected FR fallback -> base de, got ${selectedFrFallback}`);

  console.log('[gate4] Locale policy behavior ✅');

  console.log('[gate4] Cleanup: unpublish…');
  await unpublishInstance(accessToken, accountId, publicId);
  await waitFor({
    label: 'venice /r to go 404',
    timeoutMs: 90_000,
    fn: async () => {
      const url = `${BASE.venice.replace(/\/+$/, '')}/r/${encodeURIComponent(publicId)}`;
      const res = await fetch(url, { cache: 'no-store' });
      return res.status === 404 ? true : null;
    },
  });

  console.log('[gate4] done');
}

main().catch((error) => {
  console.error(`[gate4] failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
