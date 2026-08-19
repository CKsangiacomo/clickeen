import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  createHostSaveRequestMessage,
  readBobSaveControlPhase,
} from '../lib/builder-host-protocol';

function testBobPhaseAdmission(): void {
  const iframeWindow = {} as Window;
  const otherWindow = {} as Window;
  const base = {
    data: { type: 'bob:save-control-state', phase: 'save' },
    eventOrigin: 'https://bob.dev.clickeen.com',
    bobOrigin: 'https://bob.dev.clickeen.com',
    eventSource: iframeWindow,
    iframeWindow,
  };
  assert.equal(readBobSaveControlPhase(base), 'save');
  for (const phase of ['hidden', 'save', 'saving', 'saved'] as const) {
    assert.equal(readBobSaveControlPhase({ ...base, data: { ...base.data, phase } }), phase);
  }
  assert.equal(readBobSaveControlPhase({ ...base, eventOrigin: 'https://example.com' }), null);
  assert.equal(readBobSaveControlPhase({ ...base, eventSource: otherWindow }), null);
  assert.equal(readBobSaveControlPhase({ ...base, data: { ...base.data, phase: 'done' } }), null);
  assert.equal(readBobSaveControlPhase({ ...base, data: { type: 'bob:dirty-state-changed' } }), null);
  assert.deepEqual(createHostSaveRequestMessage(), { type: 'host:save-request' });
}

async function testRomaHeaderWiring(): Promise<void> {
  const source = await readFile(new URL('../components/builder-domain.tsx', import.meta.url), 'utf8');
  assert.match(source, /readBobSaveControlPhase\(\{/);
  assert.match(source, /setBobSaveControlPhase\('hidden'\)/);
  assert.match(source, /publicationInstance \|\| bobSaveControlPhase !== 'hidden'/);
  assert.match(source, /bobSaveControlPhase === 'save'/);
  assert.match(source, /createHostSaveRequestMessage\(\)/);
  assert.match(
    source,
    /suppressNextOpenInstanceIdRef\.current === activeInstanceId[\s\S]*?suppressNextOpenInstanceIdRef\.current = '';[\s\S]*?return;[\s\S]*?setBobSaveControlPhase\('hidden'\)/,
    'first-Save in-place target adoption must preserve Bob\'s current receipt phase',
  );
  assert.match(source, /bobSaveControlPhase === 'saving'/);
  assert.match(source, /data-loading="true"/);
  assert.match(source, /bobSaveControlPhase === 'saved'/);
  assert.match(source, /data-state="success"/);
  assert.match(source, />Saved</);
  assert.match(source, /className="roma-nav-trigger diet-button"/);
  assert.match(source, /openNavigation\(navigationButtonRef\.current\)/);
  assert.doesNotMatch(source, /bob:host-action|openNavigation\(iframeRef\.current\)/);
}

async function main(): Promise<void> {
  testBobPhaseAdmission();
  await testRomaHeaderWiring();
  console.log('PASS Roma borrowed Save slot and exact Bob-frame admission');
}

void main();
