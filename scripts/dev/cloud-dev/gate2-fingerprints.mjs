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
  const { label, timeoutMs = 120_000, intervalMs = 1500, fn } = args;
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
  throw new Error(`[gate2] Timeout waiting for ${label}.${suffix}`);
}

function assertHex64(value) {
  return typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value.trim());
}

function assertString(value, label) {
  const out = typeof value === 'string' ? value.trim() : '';
  if (!out) throw new Error(`[gate2] Missing ${label}`);
  return out;
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function applyStyleOnlyTweak(config) {
  const next = structuredClone(config);
  if (!isRecord(next)) throw new Error('[gate2] config must be an object');

  const pod = isRecord(next.pod) ? next.pod : null;
  if (pod && typeof pod.contentWidth === 'number' && Number.isFinite(pod.contentWidth)) {
    pod.contentWidth += 1;
    return next;
  }
  const geo = isRecord(next.geo) ? next.geo : null;
  if (geo && typeof geo.enableDeepLinks === 'boolean') {
    geo.enableDeepLinks = !geo.enableDeepLinks;
    return next;
  }
  throw new Error('[gate2] Could not find a safe style-only tweak path in config (expected config.pod.contentWidth or config.geo.enableDeepLinks).');
}

function applyCopyOnlyTweak(config) {
  const next = structuredClone(config);
  if (!isRecord(next)) throw new Error('[gate2] config must be an object');

  const header = isRecord(next.header) ? next.header : null;
  if (header && typeof header.title === 'string' && header.title.trim()) {
    header.title = `${header.title} (Gate2)`;
    return next;
  }

  const sections = Array.isArray(next.sections) ? next.sections : null;
  const firstSection = sections && sections.length ? sections[0] : null;
  const faqs = firstSection && isRecord(firstSection) && Array.isArray(firstSection.faqs) ? firstSection.faqs : null;
  const firstFaq = faqs && faqs.length ? faqs[0] : null;
  if (firstFaq && isRecord(firstFaq) && typeof firstFaq.question === 'string' && firstFaq.question.trim()) {
    firstFaq.question = `${firstFaq.question} (Gate2)`;
    return next;
  }

  throw new Error('[gate2] Could not find a safe copy-only tweak path in config (expected header.title or sections[0].faqs[0].question).');
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
  if (!res.ok) throw new Error(`[gate2] Publish failed (${res.status}) ${text.slice(0, 200)}`);
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
      body: JSON.stringify({
        ...livePayload(),
        status: 'unpublished',
      }),
    },
  );
  if (!res.ok) throw new Error(`[gate2] Unpublish failed (${res.status}) ${text.slice(0, 200)}`);
}

async function getInstance(accessToken, accountId, publicId) {
  const { res, data, text } = await fetchJson(
    `${BASE.paris.replace(/\/+$/, '')}/api/accounts/${encodeURIComponent(accountId)}/instance/${encodeURIComponent(publicId)}?subject=account`,
    {
      headers: { authorization: `Bearer ${accessToken}`, accept: 'application/json' },
      cache: 'no-store',
    },
  );
  if (!res.ok) throw new Error(`[gate2] Instance GET failed (${res.status}) ${text.slice(0, 200)}`);
  return data;
}

async function updateInstanceConfig(accessToken, accountId, publicId, config) {
  const payload = livePayload({ config });
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
  if (!res.ok) throw new Error(`[gate2] Instance PUT failed (${res.status}) ${text.slice(0, 200)}`);
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

async function ensureTokyoConfigPack(publicId, configFp) {
  const url = `${BASE.tokyo.replace(/\/+$/, '')}/renders/instances/${encodeURIComponent(publicId)}/config/${encodeURIComponent(configFp)}/config.json`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`[gate2] Tokyo config pack missing for configFp=${configFp} (HTTP ${res.status})`);
}

async function ensureTokyoTextPack(publicId, locale, textFp) {
  const url = `${BASE.tokyo.replace(/\/+$/, '')}/l10n/instances/${encodeURIComponent(publicId)}/packs/${encodeURIComponent(locale)}/${encodeURIComponent(textFp)}.json`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`[gate2] Tokyo text pack missing for ${locale} textFp=${textFp} (HTTP ${res.status})`);
}

async function main() {
  const accessToken = await loginPassword();
  const accountId = await createAccount(accessToken);
  const publicId = await duplicateFaq(accessToken, accountId);

  console.log(`[gate2] accountId=${accountId}`);
  console.log(`[gate2] publicId=${publicId}`);

  console.log('[gate2] Publishing…');
  await publishInstance(accessToken, accountId, publicId);

  const baseline = await waitFor({
    label: 'initial live pointer + l10n pointer',
    fn: async () => {
      const pointer = await readVenicePointer(publicId);
      const configFp = typeof pointer?.configFp === 'string' ? pointer.configFp.trim() : '';
      if (!assertHex64(configFp)) return null;
      const textFp = await readTextFp(publicId, 'en');
      if (!textFp) return null;
      await ensureTokyoConfigPack(publicId, configFp);
      await ensureTokyoTextPack(publicId, 'en', textFp);
      return { configFp, textFp };
    },
  });

  console.log(`[gate2] baseline configFp=${baseline.configFp}`);
  console.log(`[gate2] baseline textFp=${baseline.textFp}`);

  console.log('[gate2] Style-only change…');
  const instance1 = await getInstance(accessToken, accountId, publicId);
  const config1 = instance1?.config;
  if (!isRecord(config1)) throw new Error('[gate2] Instance config missing/invalid');
  const styleConfig = applyStyleOnlyTweak(config1);
  await updateInstanceConfig(accessToken, accountId, publicId, styleConfig);

  const afterStyle = await waitFor({
    label: 'configFp to change (style edit)',
    fn: async () => {
      const pointer = await readVenicePointer(publicId);
      const configFp = typeof pointer?.configFp === 'string' ? pointer.configFp.trim() : '';
      if (!assertHex64(configFp)) return null;
      if (configFp === baseline.configFp) return null;
      return { configFp };
    },
  });

  const textAfterStyle = await readTextFp(publicId, 'en');
  if (!textAfterStyle) throw new Error('[gate2] Missing textFp after style edit');
  if (textAfterStyle !== baseline.textFp) {
    throw new Error(`[gate2] Style-only edit must not change textFp (before=${baseline.textFp} after=${textAfterStyle})`);
  }
  await ensureTokyoConfigPack(publicId, afterStyle.configFp);
  await ensureTokyoTextPack(publicId, 'en', textAfterStyle);

  console.log(`[gate2] after style configFp=${afterStyle.configFp}`);
  console.log(`[gate2] after style textFp=${textAfterStyle}`);

  console.log('[gate2] Copy-only change…');
  const instance2 = await getInstance(accessToken, accountId, publicId);
  const config2 = instance2?.config;
  if (!isRecord(config2)) throw new Error('[gate2] Instance config missing/invalid');
  const copyConfig = applyCopyOnlyTweak(config2);
  await updateInstanceConfig(accessToken, accountId, publicId, copyConfig);

  const afterCopy = await waitFor({
    label: 'textFp to change (copy edit)',
    fn: async () => {
      const textFp = await readTextFp(publicId, 'en');
      if (!textFp) return null;
      if (textFp === baseline.textFp) return null;
      return { textFp };
    },
  });

  const pointerAfterCopy = await readVenicePointer(publicId);
  const configFpAfterCopy = typeof pointerAfterCopy?.configFp === 'string' ? pointerAfterCopy.configFp.trim() : '';
  if (!assertHex64(configFpAfterCopy)) throw new Error('[gate2] Missing configFp after copy edit');
  if (configFpAfterCopy !== afterStyle.configFp) {
    throw new Error(
      `[gate2] Copy-only edit must not change configFp (before=${afterStyle.configFp} after=${configFpAfterCopy})`,
    );
  }
  await ensureTokyoConfigPack(publicId, configFpAfterCopy);
  await ensureTokyoTextPack(publicId, 'en', afterCopy.textFp);

  console.log(`[gate2] after copy configFp=${configFpAfterCopy}`);
  console.log(`[gate2] after copy textFp=${afterCopy.textFp}`);
  console.log('[gate2] Fingerprints behave ✅');

  console.log('[gate2] Cleanup: unpublish…');
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

  console.log('[gate2] done');
}

main().catch((error) => {
  console.error(`[gate2] failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
