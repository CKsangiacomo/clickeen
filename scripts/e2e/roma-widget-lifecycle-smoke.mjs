#!/usr/bin/env node
/* eslint-disable no-console */
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { chromium } from '@playwright/test';

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const romaBase = process.env.E2E_ROMA_URL || 'https://roma.dev.clickeen.com';
const clkLiveBase = process.env.E2E_CLK_LIVE_URL || 'https://dev.clk.live';
const authStatePath = process.env.E2E_AUTH_STATE || 'e2e/.auth/roma-dev.json';
const r2Bucket = process.env.E2E_TOKYO_R2_BUCKET || 'tokyo-assets-dev';
const accountId = 'CLICKEEN';
const widgetType = 'countdown';
const widgetCode = 'CTD';
const protectedInstanceId = 'VUWUJ7OQ0Y';
const lifecycleMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const cacheControl = 'public, max-age=60, s-maxage=300, must-revalidate';
const token = `${Date.now().toString(36)}-${crypto.randomBytes(4).toString('hex')}`;
const firstMarker = `Days lifecycle ${token}`;
const secondMarker = `Days republished ${token}`;

function phase(name) {
  console.error(`[e2e widget lifecycle] phase=${name}`);
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function isoTime(value, label) {
  assert.equal(typeof value, 'string', `${label} must be a string`);
  const parsed = Date.parse(value);
  assert.ok(Number.isFinite(parsed), `${label} must be an ISO timestamp`);
  return parsed;
}

function exactKeys(value, expected, label) {
  assert.ok(value && typeof value === 'object' && !Array.isArray(value), `${label} must be an object`);
  assert.deepEqual(Object.keys(value).sort(), [...expected].sort(), `${label} has unexpected fields`);
}

function canonicalWidgets(payload) {
  assert.equal(payload?.accountId, accountId, 'Widgets response is not for CLICKEEN');
  assert.ok(Array.isArray(payload.catalog), 'Widgets response catalog is missing');
  assert.ok(Array.isArray(payload.instances), 'Widgets response instances are missing');
  return {
    accountId: payload.accountId,
    catalog: payload.catalog
      .map((entry) => ({
        widgetType: entry.widgetType,
        displayName: entry.displayName,
        description: entry.description,
      }))
      .sort((left, right) => left.widgetType.localeCompare(right.widgetType)),
    instances: payload.instances
      .map((entry) => ({
        instanceId: entry.instanceId,
        widgetType: entry.widgetType,
        displayName: entry.displayName,
        status: entry.status,
        updatedAt: entry.updatedAt,
        publishedAt: entry.publishedAt,
      }))
      .sort((left, right) => left.instanceId.localeCompare(right.instanceId)),
  };
}

async function responseText(response, label) {
  let timer;
  try {
    return await Promise.race([
      response.text(),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} response body timed out`)), 30_000);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function jsonResponse(response, label, expectedStatus = 200) {
  const text = await responseText(response, label);
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`${label} returned non-JSON HTTP ${response.status()}: ${text.slice(0, 240)}`);
  }
  assert.equal(response.status(), expectedStatus, `${label} returned HTTP ${response.status()}`);
  return payload;
}

async function apiJson(api, method, pathname, expectedStatus = 200) {
  const response = await api.fetch(pathname, { method });
  return jsonResponse(response, `${method} ${pathname}`, expectedStatus);
}

async function widgetsSnapshot(api) {
  return canonicalWidgets(await apiJson(api, 'GET', '/api/account/widgets'));
}

async function r2(args, maxBuffer = 16 * 1024 * 1024) {
  const result = await execFileAsync(
    process.execPath,
    [path.join(repoRoot, 'scripts/cloudflare/r2.mjs'), ...args, '--bucket', r2Bucket],
    { cwd: repoRoot, maxBuffer, timeout: 30_000 },
  );
  return result.stdout;
}

async function r2Entries(prefix) {
  const output = await r2(['ls', prefix, '--limit', '1000']);
  const entries = output.split(/\r?\n/).map((entry) => entry.trim()).filter(Boolean).sort();
  assert.ok(entries.length < 1000, `R2 list reached its 1000-object proof bound for ${prefix}`);
  return entries;
}

function sourceAnchorEntries(entries) {
  return entries.filter((entry) => entry.split('\t')[0].endsWith('/instance.source.json'));
}

async function r2Json(key) {
  const raw = await r2(['get', key]);
  return { raw, value: JSON.parse(raw) };
}

async function waitFor(label, read, accept, timeoutMs = 30_000) {
  const startedAt = Date.now();
  let lastValue;
  let lastError;
  while (Date.now() - startedAt < timeoutMs) {
    try {
      lastValue = await read();
      if (accept(lastValue)) return lastValue;
      lastError = undefined;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  if (lastError) throw new Error(`${label} timed out: ${lastError.message}`);
  throw new Error(`${label} timed out; last value was ${JSON.stringify(lastValue)}`);
}

function instanceFrom(snapshot, instanceId) {
  return snapshot.instances.find((entry) => entry.instanceId === instanceId) ?? null;
}

function assertSource(source, {
  instanceId,
  marker,
  updatedAt,
  baseLocale,
  createdAt,
  fieldStatus,
}) {
  exactKeys(
    source,
    [
      'accountId',
      'baseLocale',
      'config',
      'content',
      'createdAt',
      'displayName',
      'id',
      'updatedAt',
      'widgetCode',
      'widgetType',
    ],
    'instance.source.json',
  );
  assert.equal(source.accountId, accountId);
  assert.equal(source.id, instanceId);
  assert.equal(source.widgetCode, widgetCode);
  assert.equal(source.widgetType, widgetType);
  assert.equal(source.displayName, null);
  assert.equal(source.baseLocale, baseLocale);
  assert.equal(source.updatedAt, updatedAt);
  if (createdAt) assert.equal(source.createdAt, createdAt);
  assert.equal(
    source.config?.countdown?.timer?.labels?.days,
    undefined,
    'Editable text must live in source.content rather than source.config',
  );
  exactKeys(source.content, ['accountId', 'fields', 'id', 'updatedAt', 'widgetType'], 'source.content');
  assert.equal(source.content.id, instanceId);
  assert.equal(source.content.accountId, accountId);
  assert.equal(source.content.widgetType, widgetType);
  assert.ok(
    isoTime(source.content.updatedAt, 'source.content.updatedAt') <= isoTime(updatedAt, 'source.updatedAt'),
    'source.content.updatedAt is later than the atomic source record',
  );
  const contentField = source.content?.fields?.['countdown.timer.labels.days'];
  exactKeys(contentField, ['fieldPattern', 'identityKey', 'status', 'value'], 'Days content field');
  assert.equal(contentField?.fieldPattern, 'countdown.timer.labels.days');
  assert.equal(contentField?.identityKey, 'countdown|timer-days-label|countdown.timer.labels.days');
  assert.equal(contentField?.value, marker);
  assert.equal(contentField?.status, fieldStatus);
}

function assertUnpublishedServeState(serve, instanceId) {
  exactKeys(serve, ['accountId', 'instanceId', 'status', 'updatedAt'], 'unpublished serve-state');
  assert.equal(serve.accountId, accountId);
  assert.equal(serve.instanceId, instanceId);
  assert.equal(serve.status, 'unpublished');
  isoTime(serve.updatedAt, 'unpublished serve-state.updatedAt');
}

function assertPublishedServeState(serve, { instanceId, sourceUpdatedAt, priorPublishedAt = null }) {
  exactKeys(
    serve,
    ['accountId', 'instanceId', 'status', 'publishedAt', 'publicPackage', 'updatedAt'],
    'published serve-state',
  );
  assert.equal(serve.accountId, accountId);
  assert.equal(serve.instanceId, instanceId);
  assert.equal(serve.status, 'published');
  assert.equal(serve.updatedAt, serve.publishedAt);
  assert.ok(isoTime(serve.publishedAt, 'serve-state.publishedAt') > isoTime(sourceUpdatedAt, 'source.updatedAt'));
  if (priorPublishedAt) {
    assert.ok(Date.parse(serve.publishedAt) > Date.parse(priorPublishedAt), 'publishedAt did not advance');
  }
  exactKeys(serve.publicPackage, ['indexHtml', 'runtimeJs', 'stylesCss'], 'serve-state.publicPackage');
  for (const [name, value] of Object.entries(serve.publicPackage)) {
    assert.equal(typeof value, 'string', `publicPackage.${name} must be a string`);
    assert.ok(value.length > 0, `publicPackage.${name} must not be empty`);
  }
}

async function publicResponses(instanceId, publicationPhase) {
  const suffix = `ck-e2e=${encodeURIComponent(`${token}-${publicationPhase}`)}`;
  const coordinates = [
    ['indexHtml', `${clkLiveBase}/${accountId}/${instanceId}?${suffix}`],
    ['stylesCss', `${clkLiveBase}/${accountId}/${instanceId}/styles.css?${suffix}`],
    ['runtimeJs', `${clkLiveBase}/${accountId}/${instanceId}/runtime.js?${suffix}`],
  ];
  const results = {};
  for (const [key, url] of coordinates) {
    phase(`public-${publicationPhase}-${key}`);
    const response = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(30_000),
    });
    results[key] = {
      status: response.status,
      body: await response.text(),
      contentType: response.headers.get('content-type'),
      cacheControl: response.headers.get('cache-control'),
      noSniff: response.headers.get('x-content-type-options'),
    };
  }
  return results;
}

async function normalizeIndex(page, html, locale, languages, prepareExpected) {
  return page.evaluate(({ source, resolvedLocale, resolvedLanguages, expected }) => {
    const documentValue = new DOMParser().parseFromString(source, 'text/html');
    if (expected) {
      documentValue.documentElement.setAttribute('lang', resolvedLocale);
      for (const select of documentValue.querySelectorAll('.ck-locale-switcher__select')) {
        select.innerHTML = resolvedLanguages
          .map((language) => `<option value="${language}">${language}</option>`)
          .join('');
      }
    }
    return documentValue.documentElement.outerHTML;
  }, {
    source: html,
    resolvedLocale: locale,
    resolvedLanguages: languages,
    expected: prepareExpected,
  });
}

async function assertPublishedPublic(page, responses, serve, marker, baseLocale) {
  for (const [key, expectedType] of [
    ['indexHtml', 'text/html; charset=utf-8'],
    ['stylesCss', 'text/css; charset=utf-8'],
    ['runtimeJs', 'text/javascript; charset=utf-8'],
  ]) {
    assert.equal(responses[key].status, 200, `${key} was not public`);
    assert.equal(responses[key].contentType, expectedType);
    assert.equal(responses[key].cacheControl, cacheControl);
    assert.equal(responses[key].noSniff, 'nosniff');
  }
  assert.equal(responses.stylesCss.body, serve.publicPackage.stylesCss, 'public CSS differs from serve-state');
  assert.equal(responses.runtimeJs.body, serve.publicPackage.runtimeJs, 'public JS differs from serve-state');
  const expectedIndex = await normalizeIndex(
    page,
    serve.publicPackage.indexHtml,
    baseLocale,
    [baseLocale],
    true,
  );
  const actualIndex = await normalizeIndex(page, responses.indexHtml.body, baseLocale, [baseLocale], false);
  assert.equal(actualIndex, expectedIndex, 'public HTML differs from the exact Edge expression of serve-state');
  assert.ok(responses.indexHtml.body.includes(marker), `public HTML does not include ${marker}`);
}

function publicHashes(responses) {
  return {
    indexHtml: sha256(responses.indexHtml.body),
    stylesCss: sha256(responses.stylesCss.body),
    runtimeJs: sha256(responses.runtimeJs.body),
  };
}

function lifecycleMutation(request) {
  const url = new URL(request.url());
  return url.origin === new URL(romaBase).origin
    && url.pathname.startsWith('/api/account/instances')
    && lifecycleMethods.has(request.method());
}

async function openNewFromCatalog(page) {
  await page.goto(new URL('/widgets/catalog', romaBase).toString(), { waitUntil: 'domcontentloaded' });
  const card = page.locator('article.roma-card').filter({
    has: page.getByRole('heading', { name: 'Countdown', exact: true }),
  });
  await card.waitFor({ timeout: 30_000 });
  const openResponsePromise = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return response.request().method() === 'GET'
      && url.pathname === '/api/builder/new/countdown/open';
  });
  await card.getByRole('button', { name: 'Create instance' }).click();
  await page.waitForURL(/\/builder\/new\/countdown$/);
  const openResponse = await openResponsePromise;
  const openPayload = await jsonResponse(openResponse, 'New Builder open');
  assert.equal(openPayload.instanceId, null);
  assert.equal(openPayload.widgetType, widgetType);
  const frame = page.frameLocator('iframe[title="Bob Builder"]');
  await frame.locator('.tooldrawer').waitFor({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Save', exact: true }).waitFor({ timeout: 30_000 });
  return { frame, openPayload };
}

async function setDaysLabel(frame, marker) {
  await frame.getByRole('tab', { name: 'Content' }).click();
  const input = frame.locator('[data-bob-path="countdown.timer.labels.days"]');
  if (!(await input.isVisible())) {
    const cluster = input.locator('xpath=ancestor::*[contains(concat(" ", normalize-space(@class), " "), " tdmenucontent__cluster ")][1]');
    const toggle = cluster.locator('.tdmenucontent__cluster-toggle');
    await toggle.waitFor({ timeout: 30_000 });
    await toggle.click();
  }
  await input.waitFor({ timeout: 30_000 });
  await input.fill(marker);
  assert.equal(await input.inputValue(), marker);
  const preview = frame.frameLocator('iframe[title="Widget preview"]');
  await preview.locator('[data-unit="days"] [data-role="label"]').getByText(marker, { exact: true })
    .waitFor({ timeout: 30_000 });
}

async function clickPublicationToggle(page, expectedPath) {
  const responsePromise = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return response.request().method() === 'POST' && url.pathname === expectedPath;
  }, { timeout: 120_000 });
  await page.locator('header.page__header .roma-widget-status-toggle').click();
  return responsePromise;
}

async function cleanupDisposable({
  api,
  baseline,
  baselineIds,
  baselineR2Entries,
  baselineSourceAnchors,
  candidateId,
  evidence,
}) {
  let resolvedId = candidateId;
  const current = await widgetsSnapshot(api);
  const additions = current.instances.filter((entry) => !baselineIds.has(entry.instanceId));

  if (!resolvedId) {
    const owned = [];
    for (const addition of additions) {
      if (addition.widgetType !== widgetType) continue;
      const open = await api.fetch(`/api/builder/${encodeURIComponent(addition.instanceId)}/open`);
      if (!open.ok()) continue;
      const payload = await jsonResponse(open, 'Cleanup candidate ownership read');
      const marker = payload?.config?.countdown?.timer?.labels?.days;
      if (marker === firstMarker || marker === secondMarker) owned.push(addition.instanceId);
    }
    assert.ok(owned.length <= 1, 'More than one disposable lifecycle instance matched this run');
    resolvedId = owned[0] ?? null;
  }

  let deleteResult = null;
  const stillPresent = resolvedId
    ? additions.find((entry) => entry.instanceId === resolvedId) ?? null
    : null;
  if (resolvedId && stillPresent) {
    assert.notEqual(resolvedId, protectedInstanceId, 'Cleanup resolved to the protected instance');
    assert.ok(!baselineIds.has(resolvedId), 'Cleanup resolved to a baseline instance');
    const open = await api.fetch(`/api/builder/${encodeURIComponent(resolvedId)}/open`);
    const payload = await jsonResponse(open, 'Cleanup ownership read');
    const marker = payload?.config?.countdown?.timer?.labels?.days;
    assert.ok(marker === firstMarker || marker === secondMarker, 'Cleanup instance marker is not owned by this run');

    const response = await api.delete(`/api/account/instances/${encodeURIComponent(resolvedId)}`);
    assert.ok(
      response.status() >= 200 && response.status() < 300,
      `Roma cleanup DELETE returned HTTP ${response.status()}`,
    );
    deleteResult = { status: response.status() };
    await waitFor(
      'Disposable inventory removal',
      () => widgetsSnapshot(api),
      (snapshot) => !instanceFrom(snapshot, resolvedId),
    );
  }

  const finalWidgets = await waitFor(
    'Final widget baseline equality',
    () => widgetsSnapshot(api),
    (snapshot) => JSON.stringify(snapshot) === JSON.stringify(baseline),
    30_000,
  );
  const finalSourceAnchors = await waitFor(
    'Final R2 source-anchor baseline equality',
    () => r2Entries(`accounts/${accountId}/instances/`),
    (entries) => JSON.stringify(sourceAnchorEntries(entries)) === JSON.stringify(baselineSourceAnchors),
    30_000,
  );
  const finalR2Entries = await r2Entries(`accounts/${accountId}/instances/`);
  const residualPrefixEntries = resolvedId
    ? finalR2Entries.filter((entry) => entry.split('\t')[0].startsWith(`accounts/${accountId}/instances/${resolvedId}/`))
    : [];
  const residualAccountEntryDelta = finalR2Entries.filter((entry) => !baselineR2Entries.includes(entry));
  evidence.cleanup = {
    finallyDeleteStatus: deleteResult?.status ?? null,
    finallyDeleteIssued: Boolean(deleteResult),
    testedDeleteAlreadyRemovedInstance: Boolean(resolvedId && !stillPresent),
    finalInstanceCount: finalWidgets.instances.length,
    finalSourceAnchorCount: sourceAnchorEntries(finalSourceAnchors).length,
    finalR2EntryCount: finalR2Entries.length,
    inventoryBaselineEqual: true,
    sourceAnchorBaselineEqual: true,
    residualPrefixEntries: residualPrefixEntries.map((entry) => entry.split('\t')[0]),
    residualAccountEntryDelta: residualAccountEntryDelta.map((entry) => entry.split('\t')[0]),
    protectedInstanceUntouched: Boolean(instanceFrom(finalWidgets, protectedInstanceId)),
  };
}

async function main() {
  const authPath = path.resolve(repoRoot, authStatePath);
  const authState = JSON.parse(await fs.readFile(authPath, 'utf8'));
  assert.ok(Array.isArray(authState.cookies) && authState.cookies.length > 0, `No cookies found in ${authStatePath}`);

  const evidence = {
    ok: false,
    target: { romaBase, clkLiveBase, accountId, widgetType },
  };
  let api;
  let browser;
  let context;
  let page;
  let baseline;
  let baselineR2Entries;
  let baselineSourceAnchors;
  let baselineIds;
  let disposableId = null;
  let primaryError = null;
  let cleanupError = null;

  try {
    const preflightOutput = await r2([
      'preflight',
      '--prefix',
      `accounts/${accountId}/instances/`,
    ]);
    assert.ok(preflightOutput.includes(`[cf:preflight] bucket=${r2Bucket}`));
    assert.ok(preflightOutput.includes(`list accounts/${accountId}/instances/ ok`));

    browser = await chromium.launch({ headless: true });
    context = await browser.newContext({ storageState: authPath, baseURL: romaBase });
    context.setDefaultTimeout(30_000);
    context.setDefaultNavigationTimeout(30_000);
    api = context.request;
    const bootstrap = await apiJson(api, 'GET', '/api/bootstrap');
    assert.equal(bootstrap?.activeAccount?.accountId, accountId);
    assert.equal(bootstrap?.activeAccount?.accountPublicId, accountId);
    assert.equal(bootstrap?.activeAccount?.status, 'active');
    assert.equal(bootstrap?.activeAccount?.role, 'owner');
    assert.equal(bootstrap?.authz?.accountId, accountId);
    assert.equal(bootstrap?.authz?.accountPublicId, accountId);
    assert.equal(bootstrap?.authz?.role, bootstrap.activeAccount.role);
    const baseLocale = bootstrap?.activeAccount?.localePolicy?.baseLocale;
    assert.equal(typeof baseLocale, 'string');
    assert.ok(baseLocale.length > 0);
    const publishedLimit = bootstrap?.authz?.entitlements?.limits?.['instances.published.max'];
    assert.ok(Number.isInteger(publishedLimit) && publishedLimit > 0);

    baseline = await widgetsSnapshot(api);
    baselineIds = new Set(baseline.instances.map((entry) => entry.instanceId));
    assert.ok(baseline.catalog.some((entry) => entry.widgetType === widgetType), 'Countdown is absent from the catalog');
    assert.ok(baselineIds.has(protectedInstanceId), 'Protected instance is absent from the expected baseline');
    const publishedCount = baseline.instances.filter((entry) => entry.status === 'published').length;
    assert.ok(publishedCount < publishedLimit, 'No publication capacity exists for a disposable instance');

    baselineR2Entries = await r2Entries(`accounts/${accountId}/instances/`);
    baselineSourceAnchors = sourceAnchorEntries(baselineR2Entries);
    const sourceIds = baselineSourceAnchors
      .map((entry) => entry.split('\t')[0])
      .filter((key) => key.endsWith('/instance.source.json'))
      .map((key) => key.split('/').at(-2))
      .sort();
    assert.deepEqual(sourceIds, [...baselineIds].sort(), 'R2 source anchors do not match Roma inventory');
    evidence.preflight = {
      role: bootstrap.activeAccount.role,
      tier: bootstrap.activeAccount.tier,
      baseLocale,
      publishedCount,
      publishedLimit,
      baselineInstanceIds: [...baselineIds].sort(),
      baselineR2EntryCount: baselineR2Entries.length,
      protectedInstanceReadOnly: protectedInstanceId,
    };

    phase('new-exit-without-save');
    const exitPage = await context.newPage();
    const newExitMutations = [];
    exitPage.on('request', (request) => {
      if (lifecycleMutation(request)) {
        newExitMutations.push({ method: request.method(), path: new URL(request.url()).pathname });
      }
    });
    const exitedNew = await openNewFromCatalog(exitPage);
    assert.equal(exitedNew.openPayload.baseLocale, baseLocale);
    assert.equal(newExitMutations.length, 0, 'New issued an account-instance mutation before Save');
    await exitPage.close();
    assert.deepEqual(await widgetsSnapshot(api), baseline, 'Exiting New changed Roma inventory');
    assert.deepEqual(
      await r2Entries(`accounts/${accountId}/instances/`),
      baselineR2Entries,
      'Exiting New changed R2 account-instance storage',
    );
    evidence.newExit = {
      route: '/builder/new/countdown',
      openStatus: 200,
      instanceId: null,
      accountInstanceMutations: newExitMutations,
      inventoryBaselineEqual: true,
      r2BaselineEqual: true,
    };

    phase('first-save');
    page = await context.newPage();
    const builderOpenPaths = [];
    page.on('response', (response) => {
      const url = new URL(response.url());
      if (response.request().method() === 'GET' && /^\/api\/builder\/.*\/open$/.test(url.pathname)) {
        builderOpenPaths.push(url.pathname);
      }
    });
    const opened = await openNewFromCatalog(page);
    const frame = opened.frame;
    assert.equal(opened.openPayload.baseLocale, baseLocale);
    await setDaysLabel(frame, firstMarker);
    const iframe = page.locator('iframe[title="Bob Builder"]');
    await iframe.evaluate((element, marker) => {
      element.dataset.lifecycleMarker = marker;
      window.__ckLifecycleBobLoads = 0;
      element.addEventListener('load', () => {
        window.__ckLifecycleBobLoads += 1;
      });
    }, token);
    const openCountBeforeFirstSave = builderOpenPaths.length;

    const firstSaveResponsePromise = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return response.request().method() === 'POST' && url.pathname === '/api/account/instances';
    });
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    const firstSaveResponse = await firstSaveResponsePromise;
    const firstSaveBody = firstSaveResponse.request().postDataJSON();
    exactKeys(firstSaveBody, ['config', 'widgetType'], 'first Save request');
    assert.equal(firstSaveBody.widgetType, widgetType);
    assert.equal(firstSaveBody.config?.countdown?.timer?.labels?.days, firstMarker);
    assert.equal(firstSaveResponse.status(), 201, 'First Save did not return HTTP 201');
    await page.waitForURL(/\/builder\/[A-Z0-9]{10}$/);
    disposableId = new URL(page.url()).pathname.split('/').at(-1);
    assert.equal(typeof disposableId, 'string', 'First Save did not adopt an instance ID in-place');
    assert.match(disposableId, /^[A-Z0-9]{10}$/);
    assert.notEqual(disposableId, protectedInstanceId);
    assert.ok(!baselineIds.has(disposableId), 'First Save reused a baseline instance id');
    await page.waitForTimeout(1_000);
    assert.equal(builderOpenPaths.length, openCountBeforeFirstSave, 'First Save fetched another Builder open envelope');
    assert.equal(
      await iframe.getAttribute('data-lifecycle-marker'),
      token,
      'First Save replaced the Bob iframe element',
    );
    assert.equal(
      await page.evaluate(() => window.__ckLifecycleBobLoads),
      0,
      'First Save reloaded the Bob iframe',
    );
    await frame.getByRole('tab', { name: 'Translations' }).click();
    const previewLocale = frame.getByLabel('Preview locale');
    await previewLocale.waitFor({ timeout: 30_000 });
    assert.equal(await previewLocale.inputValue(), baseLocale, 'Bob did not adopt the returned baseLocale');

    const sourceKey = `accounts/${accountId}/instances/${disposableId}/instance.source.json`;
    const serveKey = `accounts/${accountId}/instances/${disposableId}/serve-state.json`;
    const firstSavedSnapshot = await waitFor(
      'First Save inventory fact',
      () => widgetsSnapshot(api),
      (snapshot) => instanceFrom(snapshot, disposableId)?.status === 'unpublished',
    );
    const firstSavedRow = instanceFrom(firstSavedSnapshot, disposableId);
    assert.ok(firstSavedRow, 'First Save inventory row is missing');
    isoTime(firstSavedRow.updatedAt, 'first Save updatedAt');
    assert.deepEqual(firstSavedRow, {
      instanceId: disposableId,
      widgetType,
      displayName: 'Untitled widget',
      status: 'unpublished',
      updatedAt: firstSavedRow.updatedAt,
      publishedAt: null,
    });
    const firstSource = await waitFor(
      'First Save source fact',
      () => r2Json(sourceKey),
      (source) => source.value.updatedAt === firstSavedRow.updatedAt,
    );
    assertSource(firstSource.value, {
      instanceId: disposableId,
      marker: firstMarker,
      updatedAt: firstSavedRow.updatedAt,
      baseLocale,
      fieldStatus: 'ok',
    });
    const createdAt = firstSource.value.createdAt;
    assert.equal(createdAt, firstSavedRow.updatedAt);
    const firstServe = await r2Json(serveKey);
    assertUnpublishedServeState(firstServe.value, disposableId);
    assert.equal(firstServe.value.updatedAt, firstSavedRow.updatedAt);
    evidence.firstSave = {
      responseStatus: firstSaveResponse.status(),
      requestKeys: Object.keys(firstSaveBody).sort(),
      instanceId: disposableId,
      updatedAt: firstSavedRow.updatedAt,
      baseLocale: firstSource.value.baseLocale,
      routeAfterSave: new URL(page.url()).pathname,
      savedBuilderOpenRequests: builderOpenPaths.filter((entry) => entry.includes(disposableId)),
      bobIframeReloads: 0,
      sourceSha256: sha256(firstSource.raw),
      serveStateSha256: sha256(firstServe.raw),
    };

    phase('publish');
    const publishPath = `/api/account/instances/${disposableId}/publish`;
    const publishResponse = await clickPublicationToggle(page, publishPath);
    assert.equal(publishResponse.status(), 200, 'Publish did not return HTTP 200');
    const publishedSnapshot = await waitFor(
      'Published inventory fact',
      () => widgetsSnapshot(api),
      (snapshot) => instanceFrom(snapshot, disposableId)?.status === 'published',
    );
    const publishedRow = instanceFrom(publishedSnapshot, disposableId);
    assert.equal(publishedRow.updatedAt, firstSavedRow.updatedAt);
    const publishedServe = await r2Json(serveKey);
    assertPublishedServeState(publishedServe.value, {
      instanceId: disposableId,
      sourceUpdatedAt: firstSavedRow.updatedAt,
    });
    assert.equal(publishedRow.publishedAt, publishedServe.value.publishedAt);
    await page.locator('header.page__header').getByText('Published', { exact: true })
      .waitFor({ timeout: 30_000 });
    assert.equal(await page.getByRole('button', { name: 'Republish', exact: true }).count(), 0);
    assert.equal((await r2Json(sourceKey)).raw, firstSource.raw, 'Publish changed editable source');
    const firstPublic = await publicResponses(disposableId, 'publish');
    await assertPublishedPublic(page, firstPublic, publishedServe.value, firstMarker, baseLocale);
    evidence.publish = {
      responseStatus: publishResponse.status(),
      publishedAt: publishedServe.value.publishedAt,
      sourceUpdatedAt: firstSavedRow.updatedAt,
      publicHashes: publicHashes(firstPublic),
      sourceUnchanged: true,
    };

    phase('save-after-publish');
    await setDaysLabel(frame, secondMarker);
    await page.getByRole('button', { name: 'Save', exact: true }).waitFor({ timeout: 30_000 });
    const laterSaveResponsePromise = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return response.request().method() === 'PUT'
        && url.pathname === `/api/account/instances/${disposableId}`;
    });
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    const laterSaveResponse = await laterSaveResponsePromise;
    const laterSaveBody = laterSaveResponse.request().postDataJSON();
    exactKeys(laterSaveBody, ['config'], 'later Save request');
    assert.equal(laterSaveBody.config?.countdown?.timer?.labels?.days, secondMarker);
    assert.equal(Object.prototype.hasOwnProperty.call(laterSaveBody, 'widgetType'), false);
    assert.equal(laterSaveResponse.status(), 200, 'Later Save did not return HTTP 200');
    const divergentSnapshot = await waitFor(
      'Saved-after-publish inventory fact',
      () => widgetsSnapshot(api),
      (snapshot) => {
        const row = instanceFrom(snapshot, disposableId);
        return row?.status === 'published'
          && Date.parse(row.updatedAt) > Date.parse(firstSavedRow.updatedAt)
          && Date.parse(row.updatedAt) > Date.parse(publishedServe.value.publishedAt);
      },
    );
    const divergentRow = instanceFrom(divergentSnapshot, disposableId);
    const laterSavedAt = divergentRow.updatedAt;
    const laterSource = await waitFor(
      'Saved-after-publish source fact',
      () => r2Json(sourceKey),
      (source) => source.value.updatedAt === laterSavedAt,
    );
    assertSource(laterSource.value, {
      instanceId: disposableId,
      marker: secondMarker,
      updatedAt: laterSavedAt,
      baseLocale,
      createdAt,
      fieldStatus: 'changed',
    });
    assert.ok(
      Date.parse(laterSource.value.content.updatedAt) > Date.parse(firstSource.value.content.updatedAt),
      'Later Save did not advance source.content.updatedAt',
    );
    const serveAfterSave = await r2Json(serveKey);
    assert.equal(serveAfterSave.raw, publishedServe.raw, 'Save changed serve-state');
    assert.equal(divergentRow.status, 'published');
    assert.equal(divergentRow.updatedAt, laterSavedAt);
    assert.equal(divergentRow.publishedAt, publishedServe.value.publishedAt);
    assert.ok(Date.parse(divergentRow.updatedAt) > Date.parse(divergentRow.publishedAt));
    await page.getByText('Published · changes not live', { exact: true }).waitFor({ timeout: 30_000 });
    await page.getByRole('button', { name: 'Republish', exact: true }).waitFor({ timeout: 30_000 });
    const publicAfterSave = await publicResponses(disposableId, 'save-after-publish');
    assert.deepEqual(publicHashes(publicAfterSave), publicHashes(firstPublic));
    assert.ok(publicAfterSave.indexHtml.body.includes(firstMarker));
    assert.ok(!publicAfterSave.indexHtml.body.includes(secondMarker));
    evidence.saveAfterPublish = {
      responseStatus: laterSaveResponse.status(),
      requestKeys: Object.keys(laterSaveBody).sort(),
      updatedAt: laterSavedAt,
      publishedAt: divergentRow.publishedAt,
      divergence: true,
      serveStateUnchanged: true,
      publicHashesUnchanged: true,
    };

    phase('republish');
    const republishResponsePromise = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return response.request().method() === 'POST' && url.pathname === publishPath;
    }, { timeout: 120_000 });
    await page.getByRole('button', { name: 'Republish', exact: true }).click();
    const republishResponse = await republishResponsePromise;
    assert.equal(republishResponse.status(), 200, 'Republish did not return HTTP 200');
    const republishedSnapshot = await waitFor(
      'Republished inventory fact',
      () => widgetsSnapshot(api),
      (snapshot) => {
        const row = instanceFrom(snapshot, disposableId);
        return row?.status === 'published'
          && row.publishedAt !== publishedServe.value.publishedAt;
      },
    );
    const republishedRow = instanceFrom(republishedSnapshot, disposableId);
    const republishedServe = await r2Json(serveKey);
    assertPublishedServeState(republishedServe.value, {
      instanceId: disposableId,
      sourceUpdatedAt: laterSavedAt,
      priorPublishedAt: publishedServe.value.publishedAt,
    });
    assert.equal(republishedRow.updatedAt, laterSavedAt);
    assert.equal(republishedRow.publishedAt, republishedServe.value.publishedAt);
    await page.locator('header.page__header').getByText('Published', { exact: true })
      .waitFor({ timeout: 30_000 });
    assert.equal(await page.getByRole('button', { name: 'Republish', exact: true }).count(), 0);
    assert.equal((await r2Json(sourceKey)).raw, laterSource.raw, 'Republish changed editable source');
    const republishedPublic = await publicResponses(disposableId, 'republish');
    await assertPublishedPublic(page, republishedPublic, republishedServe.value, secondMarker, baseLocale);
    assert.notEqual(publicHashes(republishedPublic).indexHtml, publicHashes(firstPublic).indexHtml);
    evidence.republish = {
      responseStatus: republishResponse.status(),
      publishedAt: republishedServe.value.publishedAt,
      sourceUpdatedAt: laterSavedAt,
      priorPublishedAt: publishedServe.value.publishedAt,
      publicHashes: publicHashes(republishedPublic),
      sourceUnchanged: true,
    };

    phase('unpublish');
    const unpublishPath = `/api/account/instances/${disposableId}/unpublish`;
    const unpublishResponsePromise = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return response.request().method() === 'POST' && url.pathname === unpublishPath;
    });
    await page.locator('header.page__header .roma-widget-status-toggle').click();
    const unpublishDialog = page.getByRole('dialog', { name: 'Take this widget offline?' });
    await unpublishDialog.waitFor({ timeout: 30_000 });
    await unpublishDialog.getByRole('button', { name: 'Unpublish', exact: true }).click();
    const unpublishResponse = await unpublishResponsePromise;
    assert.equal(unpublishResponse.status(), 200, 'Unpublish did not return HTTP 200');
    const unpublishedSnapshot = await waitFor(
      'Unpublished inventory fact',
      () => widgetsSnapshot(api),
      (snapshot) => instanceFrom(snapshot, disposableId)?.status === 'unpublished',
    );
    const unpublishedRow = instanceFrom(unpublishedSnapshot, disposableId);
    assert.equal(unpublishedRow.updatedAt, laterSavedAt);
    assert.equal(unpublishedRow.publishedAt, null);
    await page.locator('header.page__header').getByText('Unpublished', { exact: true })
      .waitFor({ timeout: 30_000 });
    const unpublishedServe = await r2Json(serveKey);
    assertUnpublishedServeState(unpublishedServe.value, disposableId);
    assert.equal((await r2Json(sourceKey)).raw, laterSource.raw, 'Unpublish changed editable source');
    const unpublishedPublic = await publicResponses(disposableId, 'unpublish');
    for (const result of Object.values(unpublishedPublic)) {
      assert.equal(result.status, 404);
      assert.equal(result.body, 'Not found');
      assert.equal(result.cacheControl, 'no-store');
    }
    evidence.unpublish = {
      responseStatus: unpublishResponse.status(),
      status: unpublishedRow.status,
      publishedAt: unpublishedRow.publishedAt,
      serveStateSha256: sha256(unpublishedServe.raw),
      publicStatuses: Object.fromEntries(Object.entries(unpublishedPublic).map(([key, value]) => [key, value.status])),
      sourceUnchanged: true,
    };

    phase('publish-before-live-delete');
    const liveAgainResponse = await clickPublicationToggle(page, publishPath);
    assert.equal(liveAgainResponse.status(), 200, 'Publish before live Delete did not return HTTP 200');
    const liveAgainSnapshot = await waitFor(
      'Live-before-Delete inventory fact',
      () => widgetsSnapshot(api),
      (snapshot) => instanceFrom(snapshot, disposableId)?.status === 'published',
    );
    const liveAgainRow = instanceFrom(liveAgainSnapshot, disposableId);
    const liveAgainServe = await r2Json(serveKey);
    assertPublishedServeState(liveAgainServe.value, {
      instanceId: disposableId,
      sourceUpdatedAt: laterSavedAt,
      priorPublishedAt: republishedServe.value.publishedAt,
    });
    assert.equal(liveAgainRow.publishedAt, liveAgainServe.value.publishedAt);
    assert.deepEqual(liveAgainServe.value.publicPackage, republishedServe.value.publicPackage);
    await page.locator('header.page__header').getByText('Published', { exact: true })
      .waitFor({ timeout: 30_000 });
    const liveAgainPublic = await publicResponses(disposableId, 'live-before-delete');
    await assertPublishedPublic(page, liveAgainPublic, liveAgainServe.value, secondMarker, baseLocale);

    phase('delete-live');
    await page.goto(new URL('/widgets', romaBase).toString(), { waitUntil: 'domcontentloaded' });
    const row = page.locator('tr').filter({ hasText: disposableId });
    await row.waitFor({ timeout: 30_000 });
    await row.getByRole('switch').waitFor();
    assert.equal(await row.getByRole('switch').isChecked(), true, 'Disposable instance was not live before Delete');
    await row.getByRole('button', { name: /^More actions for / }).click();
    await page.getByRole('menuitem', { name: 'Delete', exact: true }).click();
    const deleteDialog = page.getByRole('dialog', { name: 'Delete this widget?' });
    await deleteDialog.waitFor({ timeout: 30_000 });
    const deleteResponsePromise = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return response.request().method() === 'DELETE'
        && url.pathname === `/api/account/instances/${disposableId}`;
    });
    await deleteDialog.getByRole('button', { name: 'Delete widget', exact: true }).click();
    const deleteResponse = await deleteResponsePromise;
    assert.equal(deleteResponse.status(), 200, 'Delete live instance did not return HTTP 200');
    await waitFor(
      'Live Delete inventory removal',
      () => widgetsSnapshot(api),
      (snapshot) => !instanceFrom(snapshot, disposableId),
    );
    await row.waitFor({ state: 'detached', timeout: 30_000 });
    const postDeletePrefixEntries = await r2Entries(`accounts/${accountId}/instances/${disposableId}/`);
    assert.equal(
      postDeletePrefixEntries.some((entry) => entry.split('\t')[0] === sourceKey),
      false,
      'Delete left the instance.source.json visibility anchor present',
    );
    const deletedPublic = await publicResponses(disposableId, 'delete');
    for (const result of Object.values(deletedPublic)) {
      assert.equal(result.status, 404);
      assert.equal(result.body, 'Not found');
      assert.equal(result.cacheControl, 'no-store');
    }
    evidence.deleteLive = {
      responseStatus: deleteResponse.status(),
      statusBeforeDelete: liveAgainRow.status,
      publishedAtBeforeDelete: liveAgainRow.publishedAt,
      routeStatus: 200,
      sourceAnchorRemoved: true,
      residualPrefixEntriesAfterCommit: postDeletePrefixEntries.map((entry) => entry.split('\t')[0]),
      publicStatuses: Object.fromEntries(Object.entries(deletedPublic).map(([key, value]) => [key, value.status])),
    };
  } catch (error) {
    primaryError = error;
  } finally {
    if (api && baseline && baselineIds && baselineR2Entries && baselineSourceAnchors) {
      try {
        phase('finally-reconcile');
        await cleanupDisposable({
          api,
          baseline,
          baselineIds,
          baselineR2Entries,
          baselineSourceAnchors,
          candidateId: disposableId,
          evidence,
        });
      } catch (error) {
        cleanupError = error;
      }
    }
    await page?.close().catch(() => {});
    await context?.close().catch(() => {});
    await browser?.close().catch(() => {});
  }

  if (primaryError || cleanupError) {
    const failures = [primaryError, cleanupError].filter(Boolean);
    throw new AggregateError(failures, failures.map((error) => error.message).join('; '));
  }
  evidence.ok = true;
  console.log(JSON.stringify(evidence, null, 2));
}

main().catch((error) => {
  console.error(`[e2e widget lifecycle] ${error instanceof Error ? error.message : String(error)}`);
  if (error instanceof AggregateError) {
    for (const cause of error.errors) {
      console.error(`[e2e widget lifecycle] cause: ${cause instanceof Error ? cause.stack : String(cause)}`);
    }
  }
  process.exit(1);
});
