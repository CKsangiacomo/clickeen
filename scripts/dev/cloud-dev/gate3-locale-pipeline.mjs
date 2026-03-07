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
  throw new Error(`[gate3] Timeout waiting for ${label}.${suffix}`);
}

function assertHex64(value) {
  return typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value.trim());
}

function assertString(value, label) {
  const out = typeof value === 'string' ? value.trim() : '';
  if (!out) throw new Error(`[gate3] Missing ${label}`);
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
    throw new Error(
      `Berlin password login failed (${res.status}) reasonKey=${reasonKey || 'unknown'} ${text.slice(0, 140)}`,
    );
  }
  const accessToken = typeof data?.accessToken === 'string' ? data.accessToken.trim() : '';
  if (!accessToken) throw new Error('Berlin login missing accessToken.');
  return accessToken;
}

async function createAccount(accessToken) {
  void accessToken;
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
  if (!res.ok) throw new Error(`[gate3] Publish failed (${res.status}) ${text.slice(0, 200)}`);
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
  if (!res.ok) throw new Error(`[gate3] Unpublish failed (${res.status}) ${text.slice(0, 200)}`);
}

async function readVenicePointer(publicId) {
  const url = `${BASE.venice.replace(/\/+$/, '')}/r/${encodeURIComponent(publicId)}`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) return null;
  const json = await res.json().catch(() => null);
  if (!json || typeof json !== 'object') return null;
  return json;
}

async function readTextFp(publicId, locale) {
  const url = `${BASE.tokyo.replace(/\/+$/, '')}/l10n/instances/${encodeURIComponent(publicId)}/live/${encodeURIComponent(locale)}.json`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) return null;
  const json = await res.json().catch(() => null);
  const textFp = typeof json?.textFp === 'string' ? json.textFp.trim() : '';
  return assertHex64(textFp) ? textFp : null;
}

async function enableAccountLocale(accessToken, accountId, locale, policy) {
  const { res, text } = await fetchJson(
    `${BASE.paris.replace(/\/+$/, '')}/api/accounts/${encodeURIComponent(accountId)}/locales?subject=account`,
    {
      method: 'PUT',
      headers: {
        authorization: `Bearer ${accessToken}`,
        accept: 'application/json',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ locales: [locale], policy }),
    },
  );
  if (!res.ok) throw new Error(`[gate3] Account locales PUT failed (${res.status}) ${text.slice(0, 200)}`);
}

async function enqueueSelectedLocales(accessToken, accountId, publicId) {
  const { res, data, text } = await fetchJson(
    `${BASE.paris.replace(/\/+$/, '')}/api/accounts/${encodeURIComponent(accountId)}/instances/${encodeURIComponent(publicId)}/l10n/enqueue-selected?subject=account`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        accept: 'application/json',
        'content-type': 'application/json',
      },
      body: JSON.stringify({}),
    },
  );
  if (!res.ok) throw new Error(`[gate3] l10n enqueue-selected failed (${res.status}) ${text.slice(0, 200)}`);
  if (data?.ok !== true) throw new Error('[gate3] l10n enqueue-selected returned non-ok response');
  return data;
}

async function readL10nStatus(accessToken, accountId, publicId) {
  const { res, data, text } = await fetchJson(
    `${BASE.paris.replace(/\/+$/, '')}/api/accounts/${encodeURIComponent(accountId)}/instances/${encodeURIComponent(publicId)}/l10n/status?subject=account`,
    {
      headers: { authorization: `Bearer ${accessToken}`, accept: 'application/json' },
      cache: 'no-store',
    },
  );
  if (!res.ok) throw new Error(`[gate3] l10n status failed (${res.status}) ${text.slice(0, 200)}`);
  return data;
}

async function writeUserOverride(accessToken, accountId, publicId, locale, baseFingerprint, baseUpdatedAt) {
  const { res, text } = await fetchJson(
    `${BASE.paris.replace(/\/+$/, '')}/api/accounts/${encodeURIComponent(accountId)}/instances/${encodeURIComponent(publicId)}/layers/user/${encodeURIComponent(locale)}?subject=account`,
    {
      method: 'PUT',
      headers: {
        authorization: `Bearer ${accessToken}`,
        accept: 'application/json',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        source: 'manual',
        baseFingerprint,
        baseUpdatedAt,
        ops: [{ op: 'set', path: 'cta.label', value: 'Kontakt (manual override)' }],
      }),
    },
  );
  if (!res.ok) throw new Error(`[gate3] layer upsert failed (${res.status}) ${text.slice(0, 200)}`);
}

async function fetchVeniceEmbed(publicId, locale) {
  const url = `${BASE.venice.replace(/\/+$/, '')}/e/${encodeURIComponent(publicId)}?locale=${encodeURIComponent(locale)}`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`[gate3] Venice /e returned ${res.status}`);
  const html = await res.text();
  if (!html.toLowerCase().includes('clickeen embed')) {
    throw new Error('[gate3] Venice /e did not return the embed shell');
  }
}

async function main() {
  const accessToken = await loginPassword();
  const accountId = await createAccount(accessToken);
  await planChange(accessToken, accountId, 'tier3');
  const publicId = await duplicateFaq(accessToken, accountId);

  console.log(`[gate3] accountId=${accountId}`);
  console.log(`[gate3] publicId=${publicId}`);

  console.log('[gate3] Publishing…');
  await publishInstance(accessToken, accountId, publicId);

  const baseline = await waitFor({
    label: 'baseline pointers (en)',
    fn: async () => {
      const pointer = await readVenicePointer(publicId);
      const configFp = typeof pointer?.configFp === 'string' ? pointer.configFp.trim() : '';
      if (!assertHex64(configFp)) return null;
      const enTextFp = await readTextFp(publicId, 'en');
      if (!enTextFp) return null;
      return { configFp, enTextFp };
    },
  });

  console.log(`[gate3] baseline configFp=${baseline.configFp}`);
  console.log(`[gate3] baseline en textFp=${baseline.enTextFp}`);

  console.log('[gate3] Enable de locale at account…');
  await enableAccountLocale(accessToken, accountId, 'de', {
    v: 1,
    baseLocale: 'en',
    ip: { enabled: false, countryToLocale: {} },
    switcher: { enabled: false },
  });

  await waitFor({
    label: 'venice /r includes de in localePolicy',
    fn: async () => {
      const pointer = await readVenicePointer(publicId);
      const locales = Array.isArray(pointer?.localePolicy?.availableLocales) ? pointer.localePolicy.availableLocales : [];
      return locales.includes('de') ? true : null;
    },
  });

  const deSeed = await waitFor({
    label: 'tokyo de text pointer exists',
    fn: async () => {
      const deTextFp = await readTextFp(publicId, 'de');
      if (!deTextFp) return null;
      return { deTextFp };
    },
  });
  console.log(`[gate3] de seeded textFp=${deSeed.deTextFp}`);

  console.log('[gate3] Venice /e renders with locale=de…');
  await fetchVeniceEmbed(publicId, 'de');

  console.log('[gate3] Trigger translation enqueue-selected…');
  const enqueue = await enqueueSelectedLocales(accessToken, accountId, publicId);
  console.log(`[gate3] queued=${enqueue.queued} skipped=${enqueue.skipped}`);

  console.log('[gate3] Wait for de translation to land (textFp change)…');
  const deTranslated = await waitFor({
    label: 'de textFp to change (translation)',
    timeoutMs: 480_000,
    intervalMs: 4000,
    fn: async () => {
      const fp = await readTextFp(publicId, 'de');
      if (!fp) return null;
      if (fp === deSeed.deTextFp) return null;
      return { deTextFp: fp };
    },
  });
  console.log(`[gate3] de translated textFp=${deTranslated.deTextFp}`);

  const status = await readL10nStatus(accessToken, accountId, publicId);
  const baseFingerprint = assertString(status?.baseFingerprint, 'l10nStatus.baseFingerprint');
  const baseUpdatedAt = status?.baseUpdatedAt ?? null;

  console.log('[gate3] Manual override (layer=user) for de…');
  await writeUserOverride(accessToken, accountId, publicId, 'de', baseFingerprint, baseUpdatedAt);

  const deManual = await waitFor({
    label: 'de textFp to change (manual override)',
    timeoutMs: 180_000,
    intervalMs: 3000,
    fn: async () => {
      const fp = await readTextFp(publicId, 'de');
      if (!fp) return null;
      if (fp === deTranslated.deTextFp) return null;
      return { deTextFp: fp };
    },
  });

  console.log(`[gate3] de after manual override textFp=${deManual.deTextFp}`);
  console.log('[gate3] Locale pipeline works ✅');

  console.log('[gate3] Cleanup: unpublish…');
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

  console.log('[gate3] done');
}

main().catch((error) => {
  console.error(`[gate3] failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
