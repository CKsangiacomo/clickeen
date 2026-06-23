import fs from 'node:fs/promises';
import { chromium } from '@playwright/test';

const DEFAULT_ROMA_URL = 'https://roma.dev.clickeen.com';
const DEFAULT_AUTH_STATE = 'e2e/.auth/roma-dev.json';
const DEFAULT_INSTANCE_ID = 'QD1G068MX7';

async function loadAuthState(path) {
  const raw = await fs.readFile(path, 'utf8');
  const state = JSON.parse(raw);
  if (!Array.isArray(state.cookies) || state.cookies.length === 0) {
    throw new Error(`No cookies found in ${path}`);
  }
  return state;
}

function cookieHeader(state) {
  return state.cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join('; ');
}

async function readJson(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function assertStringArray(value, label) {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string' || !entry.trim())) {
    throw new Error(`${label} is not a string array`);
  }
  return value;
}

function sameStringSet(left, right) {
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  if (leftSet.size !== left.length || rightSet.size !== right.length) return false;
  if (leftSet.size !== rightSet.size) return false;
  return Array.from(leftSet).every((value) => rightSet.has(value));
}

async function fetchRomaJson(romaBase, cookies, path, init = {}) {
  const response = await fetch(new URL(path, romaBase), {
    ...init,
    headers: {
      accept: 'application/json',
      ...(init.body ? { 'content-type': 'application/json' } : {}),
      cookie: cookies,
      ...init.headers,
    },
  });
  const payload = await readJson(response);
  return { response, payload };
}

async function loadInstance(romaBase, cookies) {
  const { response, payload } = await fetchRomaJson(romaBase, cookies, '/api/account/widgets');
  if (!response.ok || !Array.isArray(payload?.instances)) {
    throw new Error(`Could not load Roma widgets: HTTP ${response.status}`);
  }
  const configured = process.env.E2E_TRANSLATION_INSTANCE_ID || DEFAULT_INSTANCE_ID;
  const instance =
    payload.instances.find((entry) => entry?.instanceId === configured) ??
    payload.instances.find((entry) => entry?.widgetType === 'big-bang') ??
    payload.instances[0];
  if (!instance?.instanceId) {
    throw new Error('Roma widgets response did not include an instance id');
  }
  return instance;
}

async function loadActiveLocaleState(romaBase, cookies) {
  const { response, payload } = await fetchRomaJson(romaBase, cookies, '/api/account/locales');
  if (!response.ok) {
    throw new Error(`Could not load Roma active locales: HTTP ${response.status}`);
  }
  const activeLocales = assertStringArray(payload?.activeLocales, 'activeLocales');
  const baseLocale =
    typeof payload?.localePolicy?.baseLocale === 'string' && payload.localePolicy.baseLocale.trim()
      ? payload.localePolicy.baseLocale.trim()
      : null;
  if (!baseLocale) throw new Error('Roma active locale state did not include localePolicy.baseLocale');
  const translationLocales = activeLocales.filter((locale) => locale !== baseLocale);
  if (translationLocales.length === 0) {
    throw new Error('Roma active locale state has no active locale beyond base locale');
  }
  return { baseLocale, activeLocales, translationLocales };
}

function assertGenerationPayload(status, payload, expected) {
  const translation = payload?.translation;
  const activeLocales = assertStringArray(translation?.activeLocales, 'translation.activeLocales');
  const skippedLocales = assertStringArray(translation?.skippedLocales, 'translation.skippedLocales');
  if (
    status < 200 ||
    status >= 300 ||
    payload?.ok !== true ||
    translation?.ok !== true ||
    translation?.accepted !== true ||
    translation?.baseLocale !== expected.baseLocale ||
    !sameStringSet(activeLocales, expected.translationLocales) ||
    skippedLocales.length !== 0
  ) {
    throw new Error(`Translation Agent generation failed exact shape: HTTP ${status}`);
  }
  return activeLocales;
}

async function readTranslationInventory(romaBase, cookies, instanceId, expected) {
  const { response, payload } = await fetchRomaJson(
    romaBase,
    cookies,
    `/api/account/instances/${encodeURIComponent(instanceId)}/translations`,
  );
  if (!response.ok || payload?.baseLocale !== expected.baseLocale) {
    throw new Error(`Translation inventory read failed: HTTP ${response.status}`);
  }
  const translatedLocales = assertStringArray(
    Array.isArray(payload?.translations) ? payload.translations.map((entry) => entry?.locale) : null,
    'translations.locale',
  );
  if (!sameStringSet(translatedLocales, expected.translationLocales)) {
    throw new Error('Translation inventory does not match Roma active locales without base locale');
  }
  return translatedLocales;
}

async function readLocaleOverlay(romaBase, cookies, instanceId, locale) {
  const { response, payload } = await fetchRomaJson(
    romaBase,
    cookies,
    `/api/account/instances/${encodeURIComponent(instanceId)}/translations/${encodeURIComponent(locale)}`,
  );
  if (!response.ok || payload?.locale !== locale || !payload?.values) {
    throw new Error(`Translation overlay read failed for ${locale}: HTTP ${response.status}`);
  }
  const values = payload.values;
  if (
    typeof values !== 'object' ||
    Array.isArray(values) ||
    Object.keys(values).length === 0 ||
    Object.entries(values).some(([path, value]) => !path || typeof value !== 'string' || !value.trim())
  ) {
    throw new Error(`Translation overlay values are invalid for ${locale}`);
  }
  return values;
}

async function runBobGenerationSmoke(romaBase, authStatePath, instanceId, expected) {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ storageState: authStatePath });
    const page = await context.newPage();
    await page.goto(new URL(`/builder/${encodeURIComponent(instanceId)}`, romaBase).toString(), {
      waitUntil: 'domcontentloaded',
    });
    const frame = page.frameLocator('iframe[title="Bob Builder"]');
    await frame.getByRole('button', { name: /Manual/i }).waitFor({ timeout: 30_000 });
    await frame.getByRole('tab', { name: 'Translations' }).click();
    const generateButton = frame.getByRole('button', { name: 'Generate translations' });
    await generateButton.waitFor({ timeout: 30_000 });
    const responsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        response.url().includes(`/api/account/instances/${encodeURIComponent(instanceId)}/translations/generate`),
      { timeout: 180_000 },
    );
    await generateButton.click();
    await frame.getByRole('button', { name: 'Generating translations...' }).waitFor({ timeout: 10_000 });
    const response = await responsePromise;
    const payload = await response.json().catch(() => null);
    const generatedLocales = assertGenerationPayload(response.status(), payload, expected);
    const successText =
      generatedLocales.length === 1
        ? 'Generated 1 active locale.'
        : `Generated ${generatedLocales.length} active locales.`;
    await frame.getByText(successText).waitFor({ timeout: 30_000 });
    return { builderUrl: page.url(), generatedLocales };
  } finally {
    await browser.close();
  }
}

async function runBobOverlaySmoke(romaBase, authStatePath, instanceId, locale) {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ storageState: authStatePath });
    const page = await context.newPage();
    await page.goto(new URL(`/builder/${encodeURIComponent(instanceId)}`, romaBase).toString(), {
      waitUntil: 'domcontentloaded',
    });
    const frame = page.frameLocator('iframe[title="Bob Builder"]');
    await frame.getByRole('button', { name: /Manual/i }).waitFor({ timeout: 30_000 });
    await frame.getByRole('tab', { name: 'Translations' }).click();
    await frame.getByRole('button', { name: 'Generate translations' }).waitFor({ timeout: 30_000 });
    await frame.getByLabel('Preview locale').selectOption(locale);
    const rows = frame.getByTestId('translation-overlay-rows');
    await rows.waitFor({ timeout: 30_000 });
    const rowText = (await rows.textContent({ timeout: 30_000 }))?.trim() || '';
    if (!rowText) throw new Error('Bob translation overlay rows rendered empty text');
    return { builderUrl: page.url(), rowTextLength: rowText.length };
  } finally {
    await browser.close();
  }
}

async function main() {
  const romaBase = (process.env.E2E_ROMA_URL || process.env.E2E_BASE_URL || DEFAULT_ROMA_URL).replace(/\/+$/, '');
  const authStatePath = process.env.E2E_AUTH_STATE || DEFAULT_AUTH_STATE;
  const state = await loadAuthState(authStatePath);
  const cookies = cookieHeader(state);
  const instance = await loadInstance(romaBase, cookies);
  const localeState = await loadActiveLocaleState(romaBase, cookies);
  const generation = await runBobGenerationSmoke(romaBase, authStatePath, instance.instanceId, localeState);
  const inventoryLocales = await readTranslationInventory(romaBase, cookies, instance.instanceId, localeState);
  const sampledLocale =
    inventoryLocales.includes('ja') ? 'ja' : inventoryLocales.includes('fr') ? 'fr' : inventoryLocales[0];
  const values = await readLocaleOverlay(romaBase, cookies, instance.instanceId, sampledLocale);
  const bob = await runBobOverlaySmoke(romaBase, authStatePath, instance.instanceId, sampledLocale);

  console.log(JSON.stringify({
    ok: true,
    account: 'CLICKEEN',
    instance: {
      instanceId: instance.instanceId,
      widgetType: instance.widgetType,
      displayName: instance.displayName,
    },
    baseLocale: localeState.baseLocale,
    activeLocaleCount: localeState.activeLocales.length,
    generatedLocaleCount: generation.generatedLocales.length,
    generatedLocales: generation.generatedLocales,
    sampledLocale,
    sampledOverlayValueCount: Object.keys(values).length,
    bob: {
      generation: {
        builderUrl: generation.builderUrl,
      },
      overlay: bob,
    },
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
