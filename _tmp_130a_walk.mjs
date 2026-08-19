import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const ROMA = 'https://roma.dev.clickeen.com';
const auth = path.join('/Users/piero_macpro/code/VS/clickeen/e2e/.auth/roma-dev.json');
const out = [];

function log(row) {
  out.push(row);
  console.log(JSON.stringify(row));
}

async function threeFacts(page, journey, click, startMs) {
  const elapsed = Date.now() - startMs;
  const busy = await page.locator('[aria-busy="true"], [data-loading], .diet-spinner').count();
  const disabled = await page.locator('button:disabled, [aria-disabled="true"]').evaluateAll((els) =>
    els.slice(0, 20).map((el) => (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 80))
  );
  const url = page.url();
  const title = await page.locator('h1, .heading-2, .heading-4').first().textContent().catch(() => '');
  return {
    journey,
    click,
    immediateMs: elapsed,
    url,
    title: (title || '').trim().slice(0, 120),
    busyCount: busy,
    disabledLabels: disabled.filter(Boolean),
  };
}

async function gotoRoma(page, journey, pathName) {
  const start = Date.now();
  const response = await page.goto(`${ROMA}${pathName}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(300);
  const facts = await threeFacts(page, journey, `open ${pathName}`, start);
  facts.status = response?.status() ?? null;
  log(facts);
  return facts;
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  storageState: auth,
  viewport: { width: 1440, height: 900 },
});
const page = await context.newPage();
page.setDefaultTimeout(25000);

try {
  await gotoRoma(page, 'sign-in land', '/home');
  await gotoRoma(page, 'widgets', '/widgets');
  await page.waitForTimeout(1500);
  log(await threeFacts(page, 'widgets', 'after list settle', Date.now() - 1500));

  const instanceRows = await page.locator('table tbody tr').count().catch(() => 0);
  const editLinks = page.getByRole('link', { name: 'Edit' });
  const editCount = await editLinks.count();
  log({ journey: 'widgets', click: 'inventory', instanceRows, editCount });

  const publicButtons = await page.getByRole('button', { name: /Copy code|Open public/i }).count();
  log({ journey: 'widgets', click: 'public actions visible', publicButtons });

  await gotoRoma(page, 'widgets', '/widgets/catalog');
  await page.waitForTimeout(800);

  const catalogCards = await page.locator('a, button').filter({ hasText: /FAQ|Cards|Countdown|Big Bang|Logo/i }).count();
  log({ journey: 'widgets catalog', click: 'cards present', catalogCards });

  const faqCard = page.getByRole('link', { name: /FAQ/i }).first();
  if (await faqCard.count()) {
    const start = Date.now();
    await faqCard.click();
    await page.waitForURL(/\/builder/, { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(500);
    log(await threeFacts(page, 'new', 'catalog FAQ -> builder', start));
    const bob = page.frameLocator('iframe[title="Bob Builder"]');
    const bootStart = Date.now();
    const workspaceReady = await bob.locator('section.workspace[data-widget-ready="true"]').waitFor({ timeout: 30000 }).then(() => Date.now() - bootStart).catch(() => null);
    const noInstance = await page.getByText(/No instance selected/i).count();
    const save = bob.getByRole('button', { name: /^Save$/ });
    const saveDisabled = await save.isDisabled().catch(() => null);
    log({
      journey: 'new',
      click: 'builder boot',
      workspaceReadyMs: workspaceReady,
      noInstanceSelectedCount: noInstance,
      saveDisabled,
      copilotHint: await bob.getByText(/Save this widget before/i).count(),
      translationsHint: await bob.getByText(/Save this widget before generating translations/i).count(),
    });
  }

  await gotoRoma(page, 'open existing', '/widgets');
  await page.waitForTimeout(1500);
  if (await editLinks.count()) {
    const start = Date.now();
    await editLinks.first().click();
    await page.waitForURL(/\/builder\/[A-Z0-9]+/, { timeout: 20000 });
    const navMs = Date.now() - start;
    const bob = page.frameLocator('iframe[title="Bob Builder"]');
    const bootStart = Date.now();
    const workspaceReady = await bob.locator('section.workspace[data-widget-ready="true"]').waitFor({ timeout: 30000 }).then(() => Date.now() - bootStart).catch(() => null);
    const headerText = await page.locator('.roma-builder-header').innerText().catch(() => '');
    const publishBtn = page.locator('.roma-builder-header').getByRole('button').filter({ hasText: /Publish|Republish|Unpublish/ });
    const publishLabels = await publishBtn.evaluateAll((els) => els.map((el) => ({
      text: (el.textContent || '').trim(),
      disabled: el.disabled || el.getAttribute('aria-disabled') === 'true',
      busy: el.getAttribute('aria-busy'),
    })));
    const save = bob.getByRole('button', { name: /^Save$|^Saving/ });
    const saveDisabled = await save.isDisabled().catch(() => null);
    const saveText = await save.textContent().catch(() => '');
    log({
      journey: 'open existing',
      click: 'Edit first row',
      navMs,
      workspaceReadyMs: workspaceReady,
      headerText: headerText.slice(0, 300),
      publishLabels,
      saveDisabled,
      saveText: (saveText || '').trim(),
      url: page.url(),
    });

    const appearance = bob.getByRole('tab', { name: 'Appearance' });
    if (await appearance.count()) {
      const t = Date.now();
      await appearance.click();
      await page.waitForTimeout(200);
      log(await threeFacts(page, 'edit', 'Appearance tab', t));
    }

    const translations = bob.getByRole('tab', { name: /Translations/i });
    if (await translations.count()) {
      const t = Date.now();
      await translations.click();
      await page.waitForTimeout(400);
      const generate = bob.getByRole('button', { name: /Generate translations/i });
      log({
        journey: 'translations',
        click: 'open Translations panel',
        immediateMs: Date.now() - t,
        generateDisabled: await generate.isDisabled().catch(() => null),
        generateText: ((await generate.textContent().catch(() => '')) || '').trim(),
        body: ((await bob.locator('.tooldrawer, .tdmenucontent').innerText().catch(() => '')) || '').slice(0, 500),
      });
    }

    const copilot = bob.getByRole('tab', { name: /Copilot/i });
    if (await copilot.count()) {
      const t = Date.now();
      await copilot.click();
      await page.waitForTimeout(400);
      log({
        journey: 'copilot',
        click: 'open Copilot pane',
        immediateMs: Date.now() - t,
        paneText: ((await bob.locator('.copilot, [class*="Copilot"]').innerText().catch(() => '')) || '').slice(0, 500),
        sendDisabled: await bob.getByRole('button', { name: /Send|Stop/i }).first().isDisabled().catch(() => null),
      });
    }

    if (await save.count()) {
      const t = Date.now();
      const beforeDisabled = await save.isDisabled();
      if (!beforeDisabled) {
        await save.click();
        await page.waitForTimeout(800);
      }
      log({
        journey: 'save',
        click: beforeDisabled ? 'Save observed disabled (clean draft)' : 'Save clicked',
        immediateMs: Date.now() - t,
        saveDisabled: await save.isDisabled().catch(() => null),
        saveText: ((await save.textContent().catch(() => '')) || '').trim(),
      });
    }

    const instanceId = page.url().split('/builder/')[1]?.split('?')[0];
    if (instanceId) {
      const pub = await context.request.get(`https://dev.clk.live/CLICKEEN/${instanceId}`);
      const html = await pub.text();
      log({
        journey: 'public widget',
        click: `GET /CLICKEEN/${instanceId}`,
        status: pub.status(),
        bytes: html.length,
        hasMarkup: html.includes('<'),
      });
      const loc = await context.request.get(`https://dev.clk.live/CLICKEEN/${instanceId}?locale=fr`);
      log({
        journey: 'public widget locale',
        click: 'GET ?locale=fr',
        status: loc.status(),
        bytes: (await loc.text()).length,
      });
    }
  }

  await gotoRoma(page, 'assets', '/assets');
  await page.waitForTimeout(1200);
  const upload = page.getByRole('button', { name: /Upload/i });
  log({
    journey: 'assets',
    click: 'upload controls',
    uploadCount: await upload.count(),
    labels: await upload.evaluateAll((els) => els.map((el) => ({ text: (el.textContent || '').trim(), disabled: el.disabled }))),
  });

  for (const p of ['/team', '/settings', '/billing', '/usage', '/ai', '/profile']) {
    await gotoRoma(page, 'account settings', p);
    await page.waitForTimeout(600);
  }

  for (const url of [
    'https://tokyo.dev.clickeen.com/healthz',
    'https://sanfrancisco.dev.clickeen.com/healthz',
    'https://product-copilot-dev.clickeen.workers.dev/healthz',
    'https://berlin.dev.clickeen.com/internal/healthz',
  ]) {
    const start = Date.now();
    const res = await context.request.get(url);
    log({ journey: 'service health', click: url, status: res.status(), immediateMs: Date.now() - start, body: (await res.text()).slice(0, 200) });
  }

  const prague = await context.request.get('https://prague.dev.clickeen.com/us/en/');
  log({ journey: 'prague', click: 'GET /us/en/', status: prague.status(), bytes: (await prague.text()).length });

  const ds = await page.goto('https://devstudio.clickeen.com', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  log({
    journey: 'devstudio',
    click: 'open',
    status: ds?.status() ?? null,
    url: page.url(),
    title: await page.title(),
    text: ((await page.locator('body').innerText().catch(() => '')) || '').slice(0, 400),
  });
} catch (error) {
  log({ journey: 'walk-error', click: 'exception', message: error instanceof Error ? error.message : String(error), url: page.url() });
} finally {
  fs.writeFileSync('/Users/piero_macpro/code/VS/clickeen/_tmp_130a_walk.json', JSON.stringify(out, null, 2));
  await browser.close();
}
