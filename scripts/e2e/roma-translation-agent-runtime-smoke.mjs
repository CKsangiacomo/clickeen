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

function sameStringArray(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

async function readGenerationResponse(response) {
  const contentType = response.headers()['content-type'] || '';
  if (!contentType.includes('text/event-stream')) {
    return {
      status: response.status(),
      payload: await response.json().catch(() => null),
    };
  }

  const text = await response.text();
  for (const rawEvent of text.split(/\r?\n\r?\n/)) {
    const lines = rawEvent.split(/\r?\n/);
    const eventName = lines
      .find((line) => line.startsWith('event:'))
      ?.slice('event:'.length)
      .trim();
    if (eventName !== 'result') continue;
    const data = lines
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice('data:'.length).trimStart())
      .join('\n');
    if (!data) break;
    const result = JSON.parse(data);
    if (
      result &&
      typeof result === 'object' &&
      Number.isFinite(result.status) &&
      Object.prototype.hasOwnProperty.call(result, 'payload')
    ) {
      return { status: result.status, payload: result.payload };
    }
    break;
  }
  throw new Error('Translation generation stream did not include a valid result event');
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
  const requestedLocales = assertStringArray(translation?.requestedLocales, 'translation.requestedLocales');
  const translatedLocales = assertStringArray(translation?.translatedLocales, 'translation.translatedLocales');
  const failedLocales = Array.isArray(translation?.failedLocales) ? translation.failedLocales : null;
  if (
    status < 200 ||
    status >= 300 ||
    payload?.ok !== true ||
    translation?.ok !== true ||
    translation?.accepted !== true ||
    translation?.baseLocale !== expected.baseLocale ||
    !sameStringArray(requestedLocales, expected.translationLocales) ||
    !sameStringArray(translatedLocales, expected.translationLocales) ||
    !failedLocales ||
    failedLocales.length !== 0
  ) {
    throw new Error(`Translation Agent generation failed exact shape: HTTP ${status}`);
  }
  return translatedLocales;
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
    const openTools = frame.getByRole('button', { name: 'Open tools' });
    await openTools.waitFor({ timeout: 30_000 });
    await page.waitForTimeout(1_500);
    await openTools.click();
    await frame.getByRole('tab', { name: 'Translations' }).click();
    const generateButton = frame.getByRole('button', { name: 'Generate translations' });
    await generateButton.waitFor({ timeout: 30_000 });
    const responsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        response.url().includes('/api/account/translations/generate'),
      { timeout: 180_000 },
    );
    await generateButton.click();
    await frame.getByRole('button', { name: 'Generating translations...' }).waitFor({ timeout: 10_000 });
    await frame.getByText('Translation Agent').waitFor({ timeout: 30_000 });
    await frame.getByText(/Writing (translations|[A-Z][A-Za-z ]+)/).first().waitFor({ timeout: 30_000 });
    const response = await responsePromise;
    const result = await readGenerationResponse(response);
    const generatedLocales = assertGenerationPayload(result.status, result.payload, expected);
    await frame.getByRole('button', { name: 'Generate translations' }).waitFor({ timeout: 30_000 });
    return { builderUrl: page.url(), generatedLocales };
  } finally {
    await browser.close();
  }
}

async function runBobOverlaySmoke(romaBase, authStatePath, instanceId, locale, values) {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ storageState: authStatePath });
    const page = await context.newPage();
    await page.goto(new URL(`/builder/${encodeURIComponent(instanceId)}`, romaBase).toString(), {
      waitUntil: 'domcontentloaded',
    });
    const frame = page.frameLocator('iframe[title="Bob Builder"]');
    const openTools = frame.getByRole('button', { name: 'Open tools' });
    await openTools.waitFor({ timeout: 30_000 });
    await page.waitForTimeout(1_500);
    await openTools.click();
    await frame.getByRole('tab', { name: 'Translations' }).click();
    await frame.getByRole('button', { name: 'Generate translations' }).waitFor({ timeout: 30_000 });
    const previewLocale = frame.getByLabel('Preview locale');
    await previewLocale.locator(`option[value="${locale}"]`).waitFor({
      state: 'attached',
      timeout: 30_000,
    });
    await previewLocale.selectOption(locale);
    if ((await previewLocale.inputValue()) !== locale) {
      throw new Error(`Bob did not select the ${locale} translation preview`);
    }
    const primaryValue = Object.values(values)[0];
    if (typeof primaryValue !== 'string' || !primaryValue.trim()) {
      throw new Error(`Translation overlay for ${locale} has no previewable value`);
    }
    const preview = frame.frameLocator('iframe[title="Widget preview"]');
    await preview.getByText(primaryValue, { exact: false }).first().waitFor({ timeout: 30_000 });
    return { builderUrl: page.url(), renderedValue: primaryValue };
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
  const bob = await runBobOverlaySmoke(
    romaBase,
    authStatePath,
    instance.instanceId,
    sampledLocale,
    values,
  );

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
