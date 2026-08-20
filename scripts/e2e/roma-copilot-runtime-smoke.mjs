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

function deferred() {
  let resolve;
  const promise = new Promise((next) => {
    resolve = next;
  });
  return { promise, resolve };
}

async function within(promise, timeoutMs, label) {
  let timeout;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timeout = setTimeout(() => reject(new Error(`Timed out waiting for ${label}`)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

async function waitForEnabled(locator, timeoutMs, label) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await locator.isEnabled().catch(() => false)) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for ${label}`);
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
  const userTurnId = crypto.randomUUID();
  const userMessage = 'In one short sentence, tell me what widget I am editing.';
  const body = {
    version: 1,
    kind: 'initial',
    sessionId,
    userTurnId,
    userMessage,
    conversationHistory: [{ role: 'user', text: userMessage }],
    currentDraftContext: {
      instanceId: instance.instanceId,
      widgetType: instance.widgetType,
      displayName: instance.displayName || 'Widget',
      activeLocale: 'en',
      draftSignature: `smoke-${instance.instanceId}`,
      controls: [],
      availableActions: [],
      unavailableCapabilities: [],
    },
  };

  const response = await fetch(new URL(`/api/account/instances/${encodeURIComponent(instance.instanceId)}/copilot`, romaBase), {
    method: 'POST',
    headers: {
      accept: 'text/event-stream',
      'content-type': 'application/json',
      cookie: cookies,
    },
    body: JSON.stringify(body),
  });
  const stream = await response.text();
  const contentType = response.headers.get('content-type') || '';
  if (!response.ok || !contentType.includes('text/event-stream') || !stream.includes('event: agent_turn_finished')) {
    throw new Error(`Copilot route smoke failed: HTTP ${response.status}`);
  }
  return { status: response.status, terminalEvent: 'agent_turn_finished' };
}

async function runNoFallbackSmoke(romaBase, cookies, instance) {
  const sessionId = `negative-${crypto.randomUUID()}`;
  const userTurnId = crypto.randomUUID();
  const userMessage = 'Tell me what widget this is.';
  const body = {
    version: 1,
    kind: 'initial',
    sessionId,
    userTurnId,
    userMessage,
    selectedModel: { provider: 'openai', model: 'not-a-managed-model' },
    conversationHistory: [{ role: 'user', text: userMessage }],
    currentDraftContext: {
      instanceId: instance.instanceId,
      widgetType: instance.widgetType,
      displayName: instance.displayName || 'Widget',
      activeLocale: 'en',
      draftSignature: `negative-${instance.instanceId}`,
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
  const error = payload?.error;
  if (
    response.status !== 422
    || error?.reasonKey !== 'coreui.errors.copilot.invalidRequest'
    || !String(error?.detail || '').includes('not managed')
  ) {
    throw new Error(`Copilot no-fallback smoke failed: HTTP ${response.status}`);
  }
  return { status: response.status, reasonKey: error.reasonKey };
}

async function runBobDraftEditUndoSmoke(romaBase, authStatePath) {
  const browser = await chromium.launch({ headless: true });
  let releaseInitialRequest;
  let releaseContinuationRequest;
  try {
    const context = await browser.newContext({ storageState: authStatePath });
    const page = await context.newPage();
    const initialRequest = deferred();
    releaseInitialRequest = deferred();
    const continuationRequest = deferred();
    releaseContinuationRequest = deferred();
    const stoppedRequest = deferred();
    const stoppedRequestFailure = deferred();
    let initialCount = 0;
    let continuationSeen = false;
    let stoppedNetworkRequest = null;

    page.on('requestfailed', (request) => {
      if (request !== stoppedNetworkRequest) return;
      stoppedRequestFailure.resolve(request.failure()?.errorText || 'request failed');
    });

    await page.route('**/api/account/instances/*/copilot', async (route) => {
      const request = route.request();
      if (request.method() !== 'POST') {
        await route.continue();
        return;
      }
      let body;
      try {
        body = request.postDataJSON();
      } catch {
        await route.continue();
        return;
      }
      if (body?.kind === 'initial') {
        initialCount += 1;
        if (initialCount === 1) {
          initialRequest.resolve(body);
          await releaseInitialRequest.promise;
          await route.continue();
          return;
        }
        if (initialCount === 2) {
          stoppedNetworkRequest = request;
          stoppedRequest.resolve(body);
          await route.continue().catch(() => {});
          return;
        }
      }
      if (body?.kind === 'continuation' && !continuationSeen) {
        continuationSeen = true;
        continuationRequest.resolve(body);
        await releaseContinuationRequest.promise;
        await route.continue();
        return;
      }
      await route.continue();
    });

    await page.goto(new URL('/widgets', romaBase).toString(), { waitUntil: 'domcontentloaded' });
    await page.getByRole('link', { name: 'Edit' }).first().click();
    await page.waitForURL(/\/builder\/[A-Z0-9]+/, { timeout: 30_000 });

    const frame = page.frameLocator('iframe[title="Bob Builder"]');
    const manualMode = frame.getByRole('radio', { name: 'Manual' });
    const copilotMode = frame.getByRole('radio', { name: 'Copilot' });
    await manualMode.waitFor({ timeout: 30_000 });
    await frame.locator('section.workspace[data-widget-ready="true"]').waitFor({ timeout: 30_000 });
    await copilotMode.click();
    const prompt = frame.getByLabel('Copilot message');
    await prompt.waitFor({ timeout: 30_000 });
    const editPrompt = 'Use apply_widget_ops now to set the visible Header Title control to Runtime Smoke Title. Do not answer without applying the edit.';
    await prompt.fill(editPrompt);
    await frame.getByRole('button', { name: 'Send to Copilot' }).click();
    await within(initialRequest.promise, 30_000, 'the initial Builder Copilot request');
    if (!(await manualMode.isDisabled())) {
      throw new Error('Manual mode remained available while the Copilot request was unresolved');
    }
    releaseInitialRequest.resolve();

    const continuationBody = await within(
      continuationRequest.promise,
      90_000,
      'the post-apply Builder Copilot continuation',
    );
    const changedPaths = continuationBody?.toolResult?.changedPaths;
    const postApplySignature = continuationBody?.toolResult?.postApplySignature;
    const continuationContext = continuationBody?.currentDraftContext;
    if (
      continuationBody?.kind !== 'continuation'
      || !Array.isArray(changedPaths)
      || changedPaths.length === 0
      || typeof postApplySignature !== 'string'
      || continuationContext?.draftSignature !== postApplySignature
    ) {
      throw new Error('Copilot continuation did not carry the exact successful apply result');
    }
    const changedControl = continuationContext.controls?.find(
      (control) => changedPaths.includes(control.path),
    );
    if (!changedControl || changedControl.currentValue !== 'Runtime Smoke Title') {
      throw new Error('Copilot continuation did not carry the exact post-apply control value');
    }

    const undoButton = frame.getByRole('button', { name: 'Undo' });
    await undoButton.waitFor({ timeout: 30_000 });
    if (!(await undoButton.isDisabled()) || !(await manualMode.isDisabled())) {
      throw new Error('Manual or Undo became available before the Copilot continuation terminated');
    }
    releaseContinuationRequest.resolve();
    await frame.getByRole('button', { name: 'Undo' }).waitFor({ timeout: 90_000 });
    await waitForEnabled(manualMode, 90_000, 'the Copilot continuation to terminate').catch(async (error) => {
      const conversation = await frame.getByLabel('Copilot conversation').innerText().catch(() => '');
      throw new Error(`Copilot continuation did not terminate. Conversation: ${conversation || '[empty]'}`, { cause: error });
    });

    await manualMode.click();
    await copilotMode.click();
    await frame.getByText(editPrompt, { exact: true }).waitFor();
    if (!(await undoButton.isEnabled())) {
      throw new Error('Copilot Undo did not survive an idle Manual/Copilot switch');
    }
    await undoButton.click();
    await frame.getByText('Undone.').waitFor({ timeout: 20_000 });

    await prompt.fill('Wait while I stop this turn.');
    await frame.getByRole('button', { name: 'Send to Copilot' }).click();
    await within(stoppedRequest.promise, 30_000, 'the controlled Stop request');
    if (!(await manualMode.isDisabled())) {
      throw new Error('Manual mode remained available before Stop');
    }
    await frame.getByRole('button', { name: 'Stop Copilot' }).click();
    await frame.getByText('Stopped', { exact: true }).last().waitFor({ timeout: 20_000 });
    if (!(await manualMode.isEnabled())) {
      throw new Error('Stop did not release Manual mode');
    }
    const stoppedFailure = await within(
      stoppedRequestFailure.promise,
      20_000,
      'Roma to abort the targeted Copilot request',
    );
    if (!/abort|cancel/i.test(stoppedFailure)) {
      throw new Error(`Stop ended the Copilot request with an unexpected network result: ${stoppedFailure}`);
    }

    return {
      builderUrl: page.url(),
      activeEditLane: 'verified',
      continuationTruth: 'verified',
      idleThreadAndUndo: 'verified',
      stopRelease: 'verified',
    };
  } finally {
    releaseInitialRequest?.resolve();
    releaseContinuationRequest?.resolve();
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
