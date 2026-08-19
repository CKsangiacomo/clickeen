import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { build } from 'esbuild';

const romaRoot = fileURLToPath(new URL('..', import.meta.url));

async function readRomaSource(relativePath: string): Promise<string> {
  return readFile(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

async function testSharedConfirmationBehavior(): Promise<void> {
  const bundle = await build({
    stdin: {
      contents: `
        import React, { useState } from 'react';
        import { createRoot } from 'react-dom/client';
        import { RomaCommandConfirmationDialog } from './components/roma-command-confirmation-dialog';

        const calls = { cancel: 0, confirm: 0 };
        function Harness() {
          const [open, setOpen] = useState(false);
          return (
            <>
              <span data-confirmation-harness-ready hidden />
              <button data-open-confirmation type="button" onClick={() => setOpen(true)}>Open</button>
              <RomaCommandConfirmationDialog
                open={open}
                title="Archive this record?"
                body="This is the exact selected record."
                confirmLabel="Archive record"
                onCancel={() => {
                  calls.cancel += 1;
                  setOpen(false);
                }}
                onConfirm={() => {
                  calls.confirm += 1;
                  setOpen(false);
                }}
              />
            </>
          );
        }

        window.__romaConfirmationHarness = {
          counts: () => ({ ...calls }),
        };

        createRoot(document.getElementById('root')).render(<Harness />);
      `,
      loader: 'tsx',
      resolveDir: romaRoot,
      sourcefile: 'roma-command-confirmation-harness.tsx',
    },
    bundle: true,
    format: 'iife',
    jsx: 'automatic',
    platform: 'browser',
    write: false,
  });
  const script = bundle.outputFiles[0]?.text;
  assert.ok(script, 'confirmation behavior harness must bundle');

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    page.setDefaultTimeout(5_000);
    await page.setContent('<main><div id="root"></div></main>');
    await page.addScriptTag({ content: script });
    await page.locator('[data-confirmation-harness-ready]').waitFor({ state: 'attached' });

    const counts = () => page.evaluate(() => (
      window as typeof window & {
        __romaConfirmationHarness: { counts: () => { cancel: number; confirm: number } };
      }
    ).__romaConfirmationHarness.counts());
    const open = () => page.locator('[data-open-confirmation]').click();

    assert.equal(await page.locator('dialog').count(), 0, 'closed confirmation must not mount');
    assert.deepEqual(await counts(), { cancel: 0, confirm: 0 });

    await open();
    const openedDialog = page.locator('dialog');
    await openedDialog.waitFor({ state: 'attached' });
    assert.equal(await openedDialog.count(), 1, `opening must mount the dialog: ${pageErrors.join('; ')}`);
    assert.equal(await openedDialog.evaluate((dialog) => (dialog as HTMLDialogElement).open), true);
    await page.getByRole('heading', { name: 'Archive this record?' }).waitFor();
    await page.getByText('This is the exact selected record.').waitFor();
    assert.deepEqual(await counts(), { cancel: 0, confirm: 0 }, 'opening must invoke no decision');

    await page.getByRole('button', { name: 'Cancel' }).click();
    await page.locator('dialog').waitFor({ state: 'detached' });
    assert.deepEqual(await counts(), { cancel: 1, confirm: 0 }, 'Cancel must invoke no command');

    await open();
    const backdropDialog = page.locator('dialog');
    await backdropDialog.waitFor({ state: 'attached' });
    await backdropDialog.evaluate((dialog) => {
      const bounds = dialog.getBoundingClientRect();
      dialog.dispatchEvent(new MouseEvent('click', {
        bubbles: true,
        clientX: bounds.right + 10,
        clientY: bounds.bottom + 10,
      }));
    });
    await page.locator('dialog').waitFor({ state: 'detached' });
    assert.deepEqual(await counts(), { cancel: 2, confirm: 0 }, 'backdrop must invoke no command');

    await open();
    const confirmButton = page.getByRole('button', { name: 'Archive record' });
    await confirmButton.waitFor();
    await confirmButton.evaluate((button) => {
      (button as HTMLButtonElement).click();
      (button as HTMLButtonElement).click();
    });
    await page.locator('dialog').waitFor({ state: 'detached' });
    assert.deepEqual(await counts(), { cancel: 2, confirm: 1 }, 'Confirm must invoke the command exactly once');
    assert.deepEqual(pageErrors, [], 'confirmation behavior must not raise browser errors');
  } finally {
    await browser.close();
  }
}

async function testFiveCommandWiringAndCopy(): Promise<void> {
  const shared = await readRomaSource('components/roma-command-confirmation-dialog.tsx');
  const widgets = await readRomaSource('components/widgets-domain.tsx');
  const assets = await readRomaSource('components/assets-domain.tsx');
  const publication = await readRomaSource('components/widget-publication-controls.tsx');
  const member = await readRomaSource('components/team-member-domain.tsx');
  const settings = await readRomaSource('components/settings-domain.tsx');

  assert.match(shared, /if \(!props\.open\) return null/);
  assert.match(shared, /reason === 'backdrop'/);
  assert.doesNotMatch(shared, /widget|asset|member|ownership|publish/i);

  assert.match(widgets, /title="Delete this widget\?"/);
  assert.match(widgets, /confirmLabel="Delete widget"/);
  assert.match(widgets, /removes its saved source and makes any published version unavailable\. This cannot be undone\./);
  assert.match(widgets, /setDeleteConfirmationInstance\(openWidgetActionsInstance\)/);
  assert.match(widgets, /if \(instance\) void handleDeleteInstance\(instance\)/);
  assert.match(widgets, /\{mutationError \? \(/);

  assert.match(assets, /title="Delete this asset\?"/);
  assert.match(assets, /confirmLabel="Delete asset"/);
  assert.match(assets, /Widgets that use it may stop displaying it\. This cannot be undone\./);
  assert.match(assets, /setDeleteConfirmationAsset\(asset\)/);
  assert.match(assets, /if \(asset\) void deleteAsset\(asset\)/);
  assert.match(assets, /Failed to delete asset: \{deleteError\}/);

  assert.equal((publication.match(/title="Take this widget offline\?"/g) ?? []).length, 2);
  assert.equal((publication.match(/confirmLabel="Unpublish"/g) ?? []).length, 2);
  assert.equal((publication.match(/Its saved source remains, and it can be published again\./g) ?? []).length, 2);
  assert.match(publication, /if \(nextStatus === 'published'\) \{\s+void changeStatus\(nextStatus\);\s+return;/);
  assert.match(publication, /setUnpublishConfirmationOpen\(true\)/);
  assert.match(publication, /void changeStatus\('unpublished'\)/);
  assert.match(publication, /status\.error \? <span className="body-xs" role="alert">/);

  assert.match(member, /title="Remove this team member\?"/);
  assert.match(member, /confirmLabel="Remove member"/);
  assert.match(member, /will lose access to this account\./);
  assert.doesNotMatch(member, /invite/i);
  assert.match(member, /setRemoveConfirmationName\(/);
  assert.match(member, /void removeMember\(\)/);
  assert.match(member, /\{mutationError \? \(/);

  assert.match(settings, /title="Transfer account ownership\?"/);
  assert.match(settings, /confirmLabel="Transfer ownership"/);
  assert.match(settings, /will become Owner of this account, and you will become Admin\./);
  assert.match(settings, /setOwnerTransferConfirmationCandidate\(selectedOwnerCandidate\)/);
  assert.match(settings, /void transferOwner\(candidate\.userId\)/);
  assert.match(settings, /\{ownerTransferError \? <p className="body-m" role="alert">/);
}

async function run(): Promise<void> {
  await testSharedConfirmationBehavior();
  console.log('PASS shared Roma confirmation mounts only when open and resolves one click decision');
  await testFiveCommandWiringAndCopy();
  console.log('PASS five Roma commands retain their owners behind exact confirmation copy');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
