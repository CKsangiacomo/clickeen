import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import {
  acceptsHostSaveRequest,
  createInitialSessionState,
  resolveSaveControlPhase,
  type SaveControlPhase,
} from '../lib/session/sessionTypes';

function transition(
  phase: SaveControlPhase,
  event: Parameters<typeof resolveSaveControlPhase>[1],
): SaveControlPhase {
  return resolveSaveControlPhase(phase, event);
}

function testExactSaveSequence(): void {
  let phase = transition('hidden', { type: 'editor-opened', isDirty: true });
  assert.equal(phase, 'save');
  phase = transition(phase, { type: 'save-started' });
  assert.equal(phase, 'saving');
  phase = transition(phase, {
    type: 'save-succeeded',
    currentDraftMatchesSubmitted: true,
  });
  assert.equal(phase, 'saved');
  phase = transition(phase, { type: 'receipt-elapsed', isDirty: false });
  assert.equal(phase, 'hidden');
}

function testFailureAndNewerDraftTruth(): void {
  assert.equal(
    transition('saving', { type: 'draft-changed', isDirty: true }),
    'saving',
    'an edit during an active Save must keep the pending command visible',
  );
  assert.equal(transition('saving', { type: 'save-failed', isDirty: true }), 'save');
  assert.equal(
    transition('saving', { type: 'save-failed', isDirty: false }),
    'hidden',
    'a failed submitted Save must not expose a dead Save control after the draft becomes clean',
  );
  assert.equal(
    transition('saving', {
      type: 'save-succeeded',
      currentDraftMatchesSubmitted: false,
    }),
    'save',
  );
  assert.equal(transition('saved', { type: 'draft-changed', isDirty: true }), 'save');
  assert.equal(transition('saved', { type: 'draft-changed', isDirty: false }), 'hidden');
  assert.equal(transition('saved', { type: 'editor-opened', isDirty: false }), 'hidden');
  assert.equal(transition('saved', { type: 'editor-opened', isDirty: true }), 'save');
  assert.equal(transition('saved', { type: 'receipt-elapsed', isDirty: true }), 'save');
}

function testHostSaveAdmission(): void {
  const parentWindow = {} as Window;
  const otherWindow = {} as Window;
  const base = {
    data: { type: 'host:save-request' },
    eventOrigin: 'https://roma.dev.clickeen.com',
    hostOrigin: 'https://roma.dev.clickeen.com',
    eventSource: parentWindow,
    parentWindow,
    phase: 'save' as const,
    isDirty: true,
    isSaving: false,
  };
  assert.equal(acceptsHostSaveRequest(base), true);
  assert.equal(acceptsHostSaveRequest({ ...base, eventOrigin: 'https://example.com' }), false);
  assert.equal(acceptsHostSaveRequest({ ...base, eventSource: otherWindow }), false);
  assert.equal(acceptsHostSaveRequest({ ...base, data: { type: 'unknown' } }), false);
  assert.equal(acceptsHostSaveRequest({ ...base, phase: 'saving' }), false);
  assert.equal(acceptsHostSaveRequest({ ...base, isDirty: false }), false);
  assert.equal(acceptsHostSaveRequest({ ...base, isSaving: true }), false);
}

async function testProductionWiring(): Promise<void> {
  const provider = await readFile(new URL('../lib/session/WidgetDocumentSession.tsx', import.meta.url), 'utf8');
  const saving = await readFile(new URL('../lib/session/useSessionSaving.ts', import.meta.url), 'utf8');
  const boot = await readFile(new URL('../lib/session/useSessionBoot.ts', import.meta.url), 'utf8');
  const builder = await readFile(new URL('../components/BuilderApp.tsx', import.meta.url), 'utf8');
  const css = await readFile(new URL('../app/bob_app.css', import.meta.url), 'utf8');

  assert.equal(createInitialSessionState().saveControlPhase, 'hidden');
  assert.match(provider, /type: 'bob:save-control-state'/);
  assert.match(provider, /window\.setTimeout\([\s\S]*1_000/);
  assert.match(provider, /acceptsHostSaveRequest\(/);
  assert.match(provider, /void save\(\)/);
  assert.match(saving, /currentDraftMatchesSubmitted: !hasEditsAfterSubmittedSave/);
  assert.match(boot, /type: 'editor-opened'/);
  assert.match(boot, /hostOriginRef\.current = targetOrigin/);
  assert.doesNotMatch(builder, /TopDrawer/);
  assert.match(builder, /className="tooldrawer-open diet-button"/);
  assert.doesNotMatch(css, /topdrawer|host-navigation-open/);
  await assert.rejects(access(new URL('../components/TopDrawer.tsx', import.meta.url)));
}

async function main(): Promise<void> {
  testExactSaveSequence();
  testFailureAndNewerDraftTruth();
  testHostSaveAdmission();
  await testProductionWiring();
  console.log('PASS Bob Save control lifecycle and host admission');
}

void main();
