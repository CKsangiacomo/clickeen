import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { chromium, type Page } from '@playwright/test';
import { build } from 'esbuild';

const bobRoot = fileURLToPath(new URL('..', import.meta.url));

type HostCommand = {
  type: 'bob:account-command';
  requestId: string;
  command: string;
  instanceId?: string;
  body?: any;
};

async function buildHarness(): Promise<string> {
  const bundle = await build({
    stdin: {
      contents: `
        import React, { useEffect, useRef, useState } from 'react';
        import { createRoot } from 'react-dom/client';
        import { ToolDrawer } from './components/ToolDrawer';
        import {
          WidgetSessionProvider,
          useWidgetSession,
          useWidgetSessionCopilot,
        } from './lib/session/useWidgetSession';

        const hostCommands = [];
        const hostMessages = [];

        window.addEventListener('message', (event) => {
          const message = event.data;
          if (!message || typeof message !== 'object') return;
          if (message.type === 'bob:account-command') hostCommands.push(structuredClone(message));
          if (typeof message.type === 'string' && message.type.startsWith('bob:')) {
            hostMessages.push(structuredClone(message));
          }
        });

        function SessionProbe() {
          const session = useWidgetSession();
          const copilot = useWidgetSessionCopilot();
          return (
            <output
              data-session-probe
              data-instance-data={JSON.stringify(session.instanceData)}
              data-active-turn-key={copilot.activeTurnKey ?? ''}
              data-undo-count={String(Object.keys(copilot.copilotUndoByThread).length)}
            />
          );
        }

        function Harness() {
          const [drawerMounted, setDrawerMounted] = useState(true);
          const closeButtonRef = useRef(null);

          useEffect(() => {
            window.__bobCopilotHarness.setDrawerMounted = setDrawerMounted;
            window.__bobCopilotHarness.ready = true;
          }, []);

          return (
            <WidgetSessionProvider>
              <SessionProbe />
              {drawerMounted ? (
                <ToolDrawer
                  id="test-tool-drawer"
                  compactOpen={true}
                  closeButtonRef={closeButtonRef}
                  onCompactClose={() => {}}
                  translationPreviewLocale=""
                  onTranslationPreviewLocaleChange={() => {}}
                  onRequestTranslationsRefresh={() => {}}
                  onPreviewModeChange={() => {}}
                  translationSetup={null}
                  translatedLocales={null}
                  savedTranslationsLoading={false}
                  savedTranslationsError={null}
                />
              ) : null}
            </WidgetSessionProvider>
          );
        }

        const compiled = {
          widgetname: 'behavior-test',
          displayName: 'Behavior test',
          defaults: { title: 'Before' },
          toolDrawerLabels: { components: { 'agent-activity': { title: 'Agent activity' } } },
          panels: [{ id: 'content', label: 'Content', html: '<div></div>' }],
          controls: [{
            panelId: 'content',
            type: 'text',
            path: 'title',
            label: 'Title',
            kind: 'string',
          }],
          limits: { limits: [] },
          upsell: { widgetType: 'behavior-test', locale: 'en', messages: {} },
          editableFields: { version: 1, fields: [] },
          widgetSoftware: {},
        };

        const postHostMessage = (message) => {
          window.postMessage(message, window.location.origin);
        };

        window.__bobCopilotHarness = {
          ready: false,
          setDrawerMounted: () => {},
          open() {
            postHostMessage({
              type: 'ck:open-editor',
              requestId: 'open-1',
              widgetname: 'behavior-test',
              baseLocale: 'en',
              compiled,
              instanceData: { title: 'Before' },
              fontLibrary: { version: 1, fonts: {} },
              policy: { profile: 'free', role: 'owner', flags: {}, limits: {} },
              accountPublicId: 'ACCOUNT',
              instanceId: 'instance-1',
              label: 'Behavior test instance',
              copilot: {
                allowModelPicker: false,
                defaultModel: { provider: 'openai', model: 'test-model' },
                modelOptions: [{ provider: 'openai', model: 'test-model', label: 'Test model' }],
                maxTurnsPerThread: 8,
              },
              translationSetup: { baseLocale: 'en', planTranslationsMax: null, activeLocales: [] },
            });
          },
          commands() {
            return structuredClone(hostCommands);
          },
          messages() {
            return structuredClone(hostMessages);
          },
          emit(requestId, event) {
            postHostMessage({
              type: 'host:copilot-event',
              requestId,
              instanceId: 'instance-1',
              event,
            });
          },
          complete(requestId, ok = true) {
            postHostMessage({
              type: 'host:account-command-result',
              requestId,
              command: 'run-copilot',
              instanceId: 'instance-1',
              ok,
              status: ok ? 200 : 500,
              payload: ok ? { ok: true } : { error: true },
            });
          },
        };

        createRoot(document.getElementById('root')).render(<Harness />);
      `,
      loader: 'tsx',
      resolveDir: bobRoot,
      sourcefile: 'bob-copilot-behavior-harness.tsx',
    },
    bundle: true,
    format: 'iife',
    jsx: 'automatic',
    platform: 'browser',
    write: false,
  });
  const script = bundle.outputFiles[0]?.text;
  assert.ok(script, 'Bob Copilot behavior harness must bundle');
  return script;
}

function agentEvent(type: string, userTurnId: string, data: Record<string, unknown>, modelStepId?: string) {
  return {
    version: 1,
    userTurnId,
    ...(modelStepId ? { modelStepId } : {}),
    type,
    data,
  };
}

async function commands(page: Page): Promise<HostCommand[]> {
  return page.evaluate(() => (window as any).__bobCopilotHarness.commands());
}

async function runCommands(page: Page): Promise<HostCommand[]> {
  return (await commands(page)).filter((command) => command.command === 'run-copilot');
}

async function waitForRunCommandCount(page: Page, count: number): Promise<HostCommand[]> {
  await page.waitForFunction((expected) => (
    (window as any).__bobCopilotHarness.commands()
      .filter((command: HostCommand) => command.command === 'run-copilot').length === expected
  ), count);
  return runCommands(page);
}

async function emit(page: Page, requestId: string, event: unknown): Promise<void> {
  await page.evaluate(({ activeRequestId, activeEvent }) => {
    (window as any).__bobCopilotHarness.emit(activeRequestId, activeEvent);
  }, { activeRequestId: requestId, activeEvent: event });
}

async function complete(page: Page, requestId: string): Promise<void> {
  await page.evaluate((activeRequestId) => {
    (window as any).__bobCopilotHarness.complete(activeRequestId);
  }, requestId);
}

async function sendPrompt(page: Page, prompt: string, expectedRunCount: number): Promise<HostCommand> {
  await page.getByRole('textbox', { name: 'Copilot message' }).fill(prompt);
  await page.getByRole('button', { name: 'Send to Copilot' }).click();
  const activeCommands = await waitForRunCommandCount(page, expectedRunCount);
  return activeCommands[expectedRunCount - 1]!;
}

async function testProductionCopilotBehavior(): Promise<void> {
  const script = await buildHarness();
  const server = createServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(`<!doctype html><html><body><main id="root"></main><script>${script}</script></body></html>`);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address === 'object');

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    page.setDefaultTimeout(5_000);
    await page.goto(`http://127.0.0.1:${address.port}/`);
    await page.waitForFunction(() => (window as any).__bobCopilotHarness?.ready === true);
    await page.evaluate(() => (window as any).__bobCopilotHarness.open());
    await page.waitForFunction(() => document.querySelector('[data-session-probe]')?.getAttribute('data-instance-data') === '{"title":"Before"}');

    const manualMode = page.getByRole('radio', { name: 'Manual' });
    const copilotMode = page.getByRole('radio', { name: 'Copilot' });
    await copilotMode.click();
    await page.getByRole('textbox', { name: 'Copilot message' }).waitFor();

    const initial = await sendPrompt(page, 'Change the title', 1);
    const initialBody = initial.body;
    assert.equal(initialBody.kind, 'initial');
    await page.getByText('Working', { exact: true }).waitFor();
    assert.equal(await manualMode.isDisabled(), true, 'Manual mode must be inoperable during an unresolved Copilot turn');
    assert.equal(await copilotMode.isDisabled(), true, 'mode switching must be inoperable during an unresolved Copilot turn');
    assert.equal(await page.locator('.tdmenucontent').count(), 0, 'Manual controls must not coexist with the active Copilot pane');
    assert.equal(await page.getByRole('button', { name: 'Stop Copilot' }).isEnabled(), true, 'Stop remains available');

    const userTurnId = initialBody.userTurnId as string;
    await emit(page, initial.requestId, agentEvent('tool_call', userTurnId, {
      toolCallId: 'call-1',
      toolName: 'apply_widget_ops',
      input: { ops: [{ op: 'set', path: 'title', value: 'After' }] },
    }, 'step-1'));
    await emit(page, initial.requestId, agentEvent('model_step_finished', userTurnId, {
      finishReason: 'tool-calls',
      requestedProvider: 'openai',
      requestedModel: 'test-model',
      reportedModel: 'test-model',
      promptTokens: 1,
      completionTokens: 1,
      latencyMs: 1,
    }, 'step-1'));

    const firstRound = await waitForRunCommandCount(page, 2);
    const continuation = firstRound[1]!;
    assert.equal(continuation.body.kind, 'continuation');
    assert.equal(
      continuation.body.currentDraftContext.draftSignature,
      '{"title":"After"}',
      'continuation signature must come from session.applyOps returned data',
    );
    assert.equal(
      continuation.body.currentDraftContext.controls[0].currentValue,
      'After',
      'continuation visible control values must come from session.applyOps returned data',
    );
    await page.waitForFunction(() => document.querySelector('[data-session-probe]')?.getAttribute('data-instance-data') === '{"title":"After"}');
    await page.getByText('Applied', { exact: true }).waitFor();
    const undoButton = page.getByRole('button', { name: 'Undo' });
    await undoButton.waitFor();
    assert.equal(await undoButton.isDisabled(), true, 'Copilot Undo must be inoperable while the continuation is unresolved');
    assert.equal(await manualMode.isDisabled(), true, 'Manual remains locked across the tool continuation');
    await complete(page, initial.requestId);

    await emit(page, continuation.requestId, agentEvent('model_step_finished', userTurnId, {
      finishReason: 'stop',
      requestedProvider: 'openai',
      requestedModel: 'test-model',
      reportedModel: 'test-model',
      promptTokens: 1,
      completionTokens: 1,
      latencyMs: 1,
    }, 'step-2'));
    await emit(page, continuation.requestId, agentEvent('agent_turn_finished', userTurnId, {}));
    await complete(page, continuation.requestId);
    await page.waitForFunction(() => document.querySelector('[data-session-probe]')?.getAttribute('data-active-turn-key') === '');
    assert.equal(await manualMode.isEnabled(), true, 'terminal completion must release mode switching');
    assert.equal(await undoButton.isEnabled(), true, 'terminal completion must release Copilot Undo');
    assert.equal(await page.getByText('Applied', { exact: true }).count(), 1, 'terminal completion preserves the applied result truth');

    await manualMode.click();
    await page.locator('.tdmenucontent').waitFor();
    await copilotMode.click();
    await undoButton.waitFor();
    await page.getByText('Change the title', { exact: true }).waitFor();
    assert.equal(await undoButton.isEnabled(), true, 'Undo must survive an idle Manual/Copilot panel switch');
    await undoButton.click();
    await page.waitForFunction(() => document.querySelector('[data-session-probe]')?.getAttribute('data-instance-data') === '{"title":"Before"}');

    const textRequest = await sendPrompt(page, 'Answer without editing', 3);
    const textTurnId = textRequest.body.userTurnId as string;
    await emit(page, textRequest.requestId, agentEvent('text_delta', textTurnId, {
      text: 'This is a text-only answer.',
    }, 'text-step'));
    await page.getByText('This is a text-only answer.', { exact: true }).waitFor();
    await page.getByText('Working', { exact: true }).last().waitFor();
    await emit(page, textRequest.requestId, agentEvent('model_step_finished', textTurnId, {
      finishReason: 'stop',
      requestedProvider: 'openai',
      requestedModel: 'test-model',
      reportedModel: 'test-model',
      promptTokens: 1,
      completionTokens: 1,
      latencyMs: 1,
    }, 'text-step'));
    await emit(page, textRequest.requestId, agentEvent('agent_turn_finished', textTurnId, {}));
    await complete(page, textRequest.requestId);
    await page.waitForFunction(() => document.querySelector('[data-session-probe]')?.getAttribute('data-active-turn-key') === '');
    assert.equal(await page.getByText('Working', { exact: true }).count(), 0, 'text-only terminal success must clear Working');
    assert.equal(await page.getByText('Applied', { exact: true }).count(), 1, 'text-only success must not invent a second Applied result');

    const failedRequest = await sendPrompt(page, 'Fail this turn', 4);
    const failedTurnId = failedRequest.body.userTurnId as string;
    await emit(page, failedRequest.requestId, agentEvent('agent_turn_error', failedTurnId, {
      code: 'MODEL_FAILED',
      reasonKey: 'coreui.errors.copilot.failed',
      message: 'Copilot failed unexpectedly. Please try again.',
    }));
    await complete(page, failedRequest.requestId);
    await page.getByText('Not applied', { exact: true }).last().waitFor();
    assert.equal(await manualMode.isEnabled(), true, 'visible failure must release mode switching');

    const stopRequest = await sendPrompt(page, 'Try another change', 5);
    assert.equal(await manualMode.isDisabled(), true);
    await page.getByRole('button', { name: 'Stop Copilot' }).click();
    await page.waitForFunction((targetRequestId) => (
      (window as any).__bobCopilotHarness.commands().some(
        (command: HostCommand) => command.command === 'cancel-copilot' && command.body?.requestId === targetRequestId,
      )
    ), stopRequest.requestId);
    assert.equal(await manualMode.isEnabled(), true, 'Stop must release mode switching immediately');
    await page.getByText('Stopped', { exact: true }).last().waitFor();

    const stopTurnId = stopRequest.body.userTurnId as string;
    await emit(page, stopRequest.requestId, agentEvent('tool_call', stopTurnId, {
      toolCallId: 'late-call-stop',
      toolName: 'apply_widget_ops',
      input: { ops: [{ op: 'set', path: 'title', value: 'Late stop edit' }] },
    }, 'late-step-stop'));
    await emit(page, stopRequest.requestId, agentEvent('model_step_finished', stopTurnId, {
      finishReason: 'tool-calls',
      requestedProvider: 'openai',
      requestedModel: 'test-model',
      reportedModel: 'test-model',
      promptTokens: 1,
      completionTokens: 1,
      latencyMs: 1,
    }, 'late-step-stop'));
    await complete(page, stopRequest.requestId);
    await page.waitForTimeout(50);
    assert.equal(await page.locator('[data-session-probe]').getAttribute('data-instance-data'), '{"title":"Before"}', 'late events after Stop must not apply');
    assert.equal((await runCommands(page)).length, 5, 'late events after Stop must not continue');

    const teardownRequest = await sendPrompt(page, 'Change during teardown', 6);
    await page.getByText('Working', { exact: true }).last().waitFor();
    await page.evaluate(() => (window as any).__bobCopilotHarness.setDrawerMounted(false));
    await page.waitForFunction((targetRequestId) => (
      (window as any).__bobCopilotHarness.commands().some(
        (command: HostCommand) => command.command === 'cancel-copilot' && command.body?.requestId === targetRequestId,
      )
    ), teardownRequest.requestId);
    await page.waitForFunction(() => document.querySelector('[data-session-probe]')?.getAttribute('data-active-turn-key') === '');

    const teardownTurnId = teardownRequest.body.userTurnId as string;
    await emit(page, teardownRequest.requestId, agentEvent('tool_call', teardownTurnId, {
      toolCallId: 'late-call-teardown',
      toolName: 'apply_widget_ops',
      input: { ops: [{ op: 'set', path: 'title', value: 'Late teardown edit' }] },
    }, 'late-step-teardown'));
    await emit(page, teardownRequest.requestId, agentEvent('model_step_finished', teardownTurnId, {
      finishReason: 'tool-calls',
      requestedProvider: 'openai',
      requestedModel: 'test-model',
      reportedModel: 'test-model',
      promptTokens: 1,
      completionTokens: 1,
      latencyMs: 1,
    }, 'late-step-teardown'));
    await complete(page, teardownRequest.requestId);
    await page.waitForTimeout(50);
    assert.equal(await page.locator('[data-session-probe]').getAttribute('data-instance-data'), '{"title":"Before"}', 'late events after teardown must not apply');
    assert.equal((await runCommands(page)).length, 6, 'late events after teardown must not continue');

    await page.evaluate(() => (window as any).__bobCopilotHarness.setDrawerMounted(true));
    await page.getByRole('radio', { name: 'Manual' }).waitFor();
    assert.equal(await page.getByRole('radio', { name: 'Manual' }).isEnabled(), true, 'teardown must release Bob edit authority');
    await page.getByRole('radio', { name: 'Copilot' }).click();
    await page.getByRole('button', { name: 'Send to Copilot' }).waitFor();
    assert.equal(await page.getByText('Working', { exact: true }).count(), 0, 'teardown must not leave session chat Working');
    assert.equal(await page.getByText('Stopped', { exact: true }).count(), 2, 'teardown must settle its unresolved session message as Stopped');
    assert.deepEqual(pageErrors, [], 'production component behavior must raise no browser errors');
  } finally {
    await browser.close();
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

testProductionCopilotBehavior().then(() => {
  console.log('PASS Bob production components enforce one edit authority, exact continuation, persistent Undo, Stop, and teardown cancellation');
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
