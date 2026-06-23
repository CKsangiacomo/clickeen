import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import { chromium } from '@playwright/test';

const DEFAULT_ROMA_URL = 'https://roma.dev.clickeen.com';
const DEFAULT_AUTH_STATE = 'e2e/.auth/roma-dev.json';

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

async function loadFirstInstance(romaBase, cookies) {
  const response = await fetch(new URL('/api/account/widgets', romaBase), {
    headers: {
      accept: 'application/json',
      cookie: cookies,
    },
  });
  const payload = await readJson(response);
  if (!response.ok || !Array.isArray(payload?.instances) || !payload.instances[0]?.instanceId) {
    throw new Error(`Could not load Roma widgets for Copilot smoke: HTTP ${response.status}`);
  }
  return payload.instances[0];
}

async function runRouteSmoke(romaBase, cookies, instance) {
  const sessionId = `smoke-${crypto.randomUUID()}`;
  const body = {
    instanceId: instance.instanceId,
    sessionId,
    userMessage: 'In one short sentence, tell me what widget I am editing.',
    context: {
      version: 'product-copilot.context.v1',
      instanceId: instance.instanceId,
      widgetType: instance.widgetType,
      displayName: instance.displayName || 'Widget',
      activeLocale: 'en',
      draftSignature: `smoke-${instance.instanceId}`,
      traceRequestId: sessionId,
      controls: [],
      availableActions: [],
      unavailableCapabilities: [],
    },
  };

  const response = await fetch(new URL(`/api/account/instances/${encodeURIComponent(instance.instanceId)}/copilot`, romaBase), {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      cookie: cookies,
    },
    body: JSON.stringify(body),
  });
  const payload = await readJson(response);
  const requestId = payload?.meta?.requestId;
  if (!response.ok || payload?.kind !== 'answer' || typeof requestId !== 'string' || !requestId) {
    throw new Error(`Copilot route smoke failed: HTTP ${response.status}`);
  }
  return { requestId, kind: payload.kind };
}

async function runNoFallbackSmoke(romaBase, cookies, instance) {
  const sessionId = `negative-${crypto.randomUUID()}`;
  const body = {
    instanceId: instance.instanceId,
    sessionId,
    userMessage: 'Tell me what widget this is.',
    selectedModel: { provider: 'openai', model: 'not-a-managed-model' },
    context: {
      version: 'product-copilot.context.v1',
      instanceId: instance.instanceId,
      widgetType: instance.widgetType,
      displayName: instance.displayName || 'Widget',
      activeLocale: 'en',
      draftSignature: `negative-${instance.instanceId}`,
      traceRequestId: sessionId,
      controls: [],
      availableActions: [],
      unavailableCapabilities: [],
    },
  };

  const response = await fetch(new URL(`/api/account/instances/${encodeURIComponent(instance.instanceId)}/copilot`, romaBase), {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      cookie: cookies,
    },
    body: JSON.stringify(body),
  });
  const payload = await readJson(response);
  const issue = Array.isArray(payload?.issues) ? payload.issues[0] : null;
  if (response.status !== 422 || issue?.path !== 'selectedModel') {
    throw new Error(`Copilot no-fallback smoke failed: HTTP ${response.status}`);
  }
  return { status: response.status, issue: issue.message };
}

async function runBobDraftEditUndoSmoke(romaBase, authStatePath) {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ storageState: authStatePath });
    const page = await context.newPage();
    await page.goto(new URL('/widgets', romaBase).toString(), { waitUntil: 'domcontentloaded' });
    await page.getByRole('link', { name: 'Edit' }).first().click();
    await page.waitForURL(/\/builder\/[A-Z0-9]+/, { timeout: 30_000 });

    const frame = page.frameLocator('iframe[title="Bob Builder"]');
    await frame.getByRole('button', { name: /Manual/i }).waitFor({ timeout: 30_000 });
    await frame.getByText('BigBang Test').waitFor({ timeout: 30_000 });
    await frame.getByRole('button', { name: /^Title:/ }).waitFor({ timeout: 30_000 });
    await frame.locator('input[name="assist-mode"][value="copilot"]').click({ force: true });
    const prompt = frame.getByLabel('Copilot prompt');
    await prompt.waitFor({ timeout: 30_000 });
    await prompt.fill('Change the header title to Runtime Smoke Title');
    await frame.getByRole('button', { name: 'Send' }).click();
    const undoButton = frame.getByRole('button', { name: 'Undo' });
    await undoButton.waitFor({ timeout: 90_000 });
    await undoButton.click();
    await frame.getByText('Undone.').waitFor({ timeout: 20_000 });
    return { builderUrl: page.url() };
  } finally {
    await browser.close();
  }
}

async function main() {
  const romaBase = (process.env.E2E_ROMA_URL || process.env.E2E_BASE_URL || DEFAULT_ROMA_URL).replace(/\/+$/, '');
  const authStatePath = process.env.E2E_AUTH_STATE || DEFAULT_AUTH_STATE;
  const state = await loadAuthState(authStatePath);
  const cookies = cookieHeader(state);
  const instance = await loadFirstInstance(romaBase, cookies);
  const route = await runRouteSmoke(romaBase, cookies, instance);
  const noFallback = await runNoFallbackSmoke(romaBase, cookies, instance);
  const bob = await runBobDraftEditUndoSmoke(romaBase, authStatePath);
  console.log(JSON.stringify({
    ok: true,
    account: 'CLICKEEN',
    instance: {
      instanceId: instance.instanceId,
      widgetType: instance.widgetType,
      displayName: instance.displayName,
    },
    route,
    noFallback,
    bob,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
