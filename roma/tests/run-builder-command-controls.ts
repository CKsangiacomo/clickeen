import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function readSource(path: string): Promise<string> {
  return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

function assertBefore(source: string, first: RegExp, second: RegExp, message: string): void {
  const firstIndex = source.search(first);
  const secondIndex = source.search(second);
  assert.notEqual(firstIndex, -1, `missing first pattern: ${first}`);
  assert.notEqual(secondIndex, -1, `missing second pattern: ${second}`);
  assert.ok(firstIndex < secondIndex, message);
}

async function run(): Promise<void> {
  const [builder, publication, bobSessionTypes, copySource] = await Promise.all([
    readSource('components/builder-domain.tsx'),
    readSource('components/widget-publication-controls.tsx'),
    readFile(new URL('../../bob/lib/session/sessionTypes.ts', import.meta.url), 'utf8'),
    readSource('l10n/en.json'),
  ]);
  const copy = JSON.parse(copySource) as {
    commands: Record<string, string>;
  };

  assert.deepEqual(copy.commands, {
    save: 'Save',
    saving: 'Saving…',
    saved: 'Saved',
    republish: 'Republish',
    republishing: 'Republishing…',
    liveWidgetUpdated: 'Live widget updated',
  });

  const saveControl = builder.slice(
    builder.indexOf("bobSaveControlPhase === 'save'"),
    builder.indexOf('</>', builder.indexOf("bobSaveControlPhase === 'save'")),
  );
  assert.equal((saveControl.match(/data-tone="save"/g) ?? []).length, 3);
  assert.match(saveControl, /ROMA_UI_COPY\.commands\.save/);
  assert.match(saveControl, /ROMA_UI_COPY\.commands\.saving/);
  assert.match(saveControl, /ROMA_UI_COPY\.commands\.saved/);
  assert.match(saveControl, /bobSaveControlPhase === 'saving'[\s\S]*?aria-busy="true"[\s\S]*?disabled/);
  assert.match(saveControl, /bobSaveControlPhase === 'saved'[\s\S]*?data-state="success"[\s\S]*?<span className="diet-spinner" aria-hidden="true" \/>/);
  assert.doesNotMatch(
    saveControl.slice(saveControl.indexOf("bobSaveControlPhase === 'saved'")),
    /aria-busy|checkmark\.svg/,
  );

  assert.match(publication, /const isRepublish = nextStatus === 'published' && savedChangesNotLive/);
  assert.match(publication, /current\?\.instanceId === instance\.instanceId \? current : null/);
  assert.match(publication, /publicationReceipt\?\.instanceId === instance\.instanceId[\s\S]*?publicationReceipt\.sourceUpdatedAt === instance\.updatedAt[\s\S]*?&& published/);
  assertBefore(
    publication,
    /if \(!response\.ok\)/,
    /if \(isRepublish\) \{[\s\S]*?setPublicationReceipt/,
    'Republish may expose its receipt only after the route confirms success',
  );
  assert.match(publication, /status\.liveWidgetUpdated \? \(/);
  assert.match(publication, /data-tone="republish"/);
  assert.match(publication, /ROMA_UI_COPY\.commands\.republishing/);
  assert.match(publication, /ROMA_UI_COPY\.commands\.liveWidgetUpdated/);
  assert.match(publication, /liveWidgetUpdated[\s\S]*?data-state="success"[\s\S]*?checkmark\.svg/);
  assert.doesNotMatch(
    publication.slice(
      publication.indexOf('{status.liveWidgetUpdated ? ('),
      publication.indexOf(') : status.savedChangesNotLive ? ('),
    ),
    /aria-busy/,
  );
  assert.doesNotMatch(publication, /setTimeout|receiptElapsed|receipt-elapsed/);

  assert.match(builder, /label: string \| null/);
  assert.match(builder, /const label = builderOpen\.displayName;/);
  assert.doesNotMatch(builder, /builderOpen\.displayName \?\? ''/);
  assert.equal((bobSessionTypes.match(/label: string \| null;/g) ?? []).length, 2);

  console.log('PASS Roma Save and Republish command-control contracts');
}

run().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
