import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function readRoute(relativePath: string): Promise<string> {
  return readFile(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

function assertBefore(source: string, earlier: string | RegExp, later: string | RegExp): void {
  const earlierMatch = typeof earlier === 'string' ? source.indexOf(earlier) : source.search(earlier);
  const laterMatch = typeof later === 'string' ? source.indexOf(later) : source.search(later);
  assert.notEqual(earlierMatch, -1, `missing earlier marker: ${String(earlier)}`);
  assert.notEqual(laterMatch, -1, `missing later marker: ${String(later)}`);
  assert.ok(earlierMatch < laterMatch, `${String(earlier)} must appear before ${String(later)}`);
}

function assertNoOldUpgradePath(source: string): void {
  assert.doesNotMatch(source, /coreui\.upsell\.reason\.limitReached/);
  assert.doesNotMatch(source, /status:\s*403/);
}

async function testCreateGateBeforeWork(): Promise<void> {
  const source = await readRoute('app/api/account/instances/route.ts');
  const gateBranch = 'if (widgetInstanceIds.value.instanceIds.length >= widgetInstancesLimit)';
  assert.match(source, /action: 'create_instance'/);
  assert.match(source, /status: 402/);
  assert.match(source, /policyContractFailure\('widgets\.instances\.max'\)/);
  assert.match(source, /listAccountWidgetInstanceIds\(\{/);
  assert.match(source, /if \(widgetInstanceIds\.value\.instanceIds\.length >= widgetInstancesLimit\) \{\s+return withSession\(\s+request,\s+upgradeRequired\(\{/);
  assertNoOldUpgradePath(source);
  assertBefore(source, gateBranch, 'listTokyoWidgetDefinitions({');
  assertBefore(source, gateBranch, 'createCompactInstanceId()');
  assertBefore(source, gateBranch, 'readWidgetForInstancePackage(');
  assertBefore(source, gateBranch, 'materializeAccountInstancePublicPackage({');
  assertBefore(source, gateBranch, 'createAccountInstanceInTokyo({');
}

async function testDuplicateGateBeforeWorkAfterSourceProof(): Promise<void> {
  const source = await readRoute('app/api/account/instances/[instanceId]/duplicate/route.ts');
  const gateBranch = 'if (widgetInstanceIds.value.instanceIds.length >= widgetInstancesLimit)';
  assert.match(source, /action: 'duplicate_instance'/);
  assert.match(source, /status: 402/);
  assert.match(source, /policyContractFailure\('widgets\.instances\.max'\)/);
  assert.match(source, /listAccountWidgetInstanceIds\(\{/);
  assert.match(source, /if \(widgetInstanceIds\.value\.instanceIds\.length >= widgetInstancesLimit\) \{\s+return withSession\(\s+request,\s+upgradeRequired\(\{/);
  assertNoOldUpgradePath(source);
  assertBefore(source, 'loadTokyoAccountInstanceDocument({', 'listAccountWidgetInstanceIds({');
  assertBefore(source, gateBranch, 'createCompactInstanceId()');
  assertBefore(source, gateBranch, 'readWidgetForInstancePackage(');
  assertBefore(source, gateBranch, 'materializeAccountInstancePublicPackage({');
  assertBefore(source, gateBranch, 'createAccountInstanceInTokyo({');
}

async function testPublishGateBeforeTransition(): Promise<void> {
  const source = await readRoute('app/api/account/instances/[instanceId]/publish/route.ts');
  const gateBranch = 'if (!alreadyPublished && publishedTotal >= publishedLimit)';
  assert.match(source, /loadAccountWidgetInstanceFacts\(\{/);
  assert.match(source, /action: 'publish_instance'/);
  assert.match(source, /status: 402/);
  assert.match(source, /policyContractFailure\('instances\.published\.max'\)/);
  assert.match(source, /const publishedTotal = instances\.value\.instances\.filter/);
  assert.match(source, /if \(!alreadyPublished && publishedTotal >= publishedLimit\) \{\s+return withSession\(\s+request,\s+upgradeRequired\(\{/);
  assertNoOldUpgradePath(source);
  assert.doesNotMatch(source, /listAccountInstancesInTokyo/);
  assert.doesNotMatch(source, /\/instances\/facts/);
  assertBefore(source, gateBranch, 'publishAccountInstanceInTokyo({');
}

async function testBuilderHandlesBobUpsell(): Promise<void> {
  const builderSource = await readRoute('components/builder-domain.tsx');
  const bobDocs = await readFile(new URL('../../documentation/services/bob.md', import.meta.url), 'utf8');
  const upsellPopup = await readFile(new URL('../../bob/components/UpsellPopup.tsx', import.meta.url), 'utf8');
  assert.match(builderSource, /type BobUpsellMessage = \{\s+type: 'bob:upsell'/);
  assert.match(builderSource, /if \(data\.type === 'bob:upsell'\) \{\s+if \(data\.cta === 'upgrade'\) setUpsellReason/);
  assert.match(builderSource, /<RomaUpsellDialog/);
  assert.doesNotMatch(builderSource, /confirmDiscardBuilderEdits/);
  assert.doesNotMatch(builderSource, /router\.push\('\/billing'\)/);
  assert.match(bobDocs, /"type": "bob:upsell"/);
  assert.match(bobDocs, /"payload": "\[commandPayload\]"/);
  assert.doesNotMatch(bobDocs, /"result": "\[commandResult\]"/);
  assert.match(upsellPopup, /className="diet-popup"/);
  assert.match(upsellPopup, /className="diet-popup__header"/);
  assert.match(upsellPopup, /className="diet-popup__body"/);
  assert.match(upsellPopup, /className="diet-popup__footer"/);
  assert.doesNotMatch(upsellPopup, /ck-upsellModal/);
}

async function testBuilderUsesBobTopDrawerAsItsOnlyEditorChrome(): Promise<void> {
  const builderSource = await readRoute('components/builder-domain.tsx');
  const builderRoute = await readRoute('app/(authed)/builder/[instanceId]/page.tsx');
  const builderLandingRoute = await readRoute('app/(authed)/builder/page.tsx');
  const romaCss = await readRoute('app/roma.css');
  const bobCss = await readFile(new URL('../../bob/app/bob_app.css', import.meta.url), 'utf8');
  const topDrawer = await readFile(new URL('../../bob/components/TopDrawer.tsx', import.meta.url), 'utf8');
  const builderApp = await readFile(new URL('../../bob/components/BuilderApp.tsx', import.meta.url), 'utf8');
  const bobBoot = await readFile(new URL('../../bob/lib/session/useSessionBoot.ts', import.meta.url), 'utf8');

  assert.doesNotMatch(builderRoute, /showHeader/);
  assert.match(builderRoute, /fullCanvas/);
  assert.doesNotMatch(builderRoute, /RomaShellDefaultActions/);
  assert.doesNotMatch(builderLandingRoute, /fullCanvas/);
  assert.doesNotMatch(builderLandingRoute, /rd-canvas--builder/);
  assert.match(builderLandingRoute, /RomaShellDefaultActions/);
  assert.match(romaCss, /\.main-container > \.page\.roma-builder-page \{\s+padding: 0;/);
  assert.match(romaCss, /\.roma-builder-page > \.page__content \{\s+max-inline-size: none;/);
  assert.match(romaCss, /html,\s+body \{[^}]*background: var\(--role-surface-muted\);/);
  assert.doesNotMatch(romaCss, /--color-system-gray-6-step3/);
  assert.match(bobCss, /\.builder-app \{[^}]*background: var\(--role-surface-muted\);/);
  assert.match(bobCss, /\.workspace \{[^}]*background: var\(--role-surface-muted\);/);
  assert.doesNotMatch(bobCss, /--color-system-gray-6-step3/);

  assert.match(builderSource, /publicActions: publicUrl/);
  assert.match(builderSource, /iframeSnippet: buildWidgetIframeSnippet\(publicUrl\)/);
  assert.match(builderSource, /scriptSnippet: buildWidgetScriptSnippet\(publicUrl\)/);
  assert.match(builderSource, /data\.type === 'bob:host-action'/);
  assert.doesNotMatch(builderSource, />Copy URL</);
  assert.doesNotMatch(builderSource, />Copy embed</);
  assert.doesNotMatch(builderSource, />Copy script</);
  assert.doesNotMatch(builderSource, />Open public widget</);

  assert.match(topDrawer, /className="topdrawer"/);
  assert.match(builderApp, /className="editor-content"/);
  assert.doesNotMatch(builderApp, /builder-app__content/);
  assert.match(topDrawer, />Open public widget</);
  assert.match(topDrawer, />More</);
  assert.match(topDrawer, />Copy URL</);
  assert.match(topDrawer, />Copy embed</);
  assert.match(topDrawer, />Copy script</);
  assert.match(topDrawer, /className="topdrawer-more diet-popover-host"/);
  assert.doesNotMatch(bobCss, /\.topdrawer-more\[data-state='open'\]/);
  assert.match(topDrawer, /requestHostAction\('open-navigation'\)/);
  assert.match(topDrawer, /requestHostAction\('return'\)/);
  assert.equal((topDrawer.match(/data-variant="primary"/g) ?? []).length, 1);
  assert.match(bobBoot, /message\.publishStatus === 'published'/);
  assert.match(bobBoot, /coreui\.errors\.builder\.publicActions\.invalid/);

  const workspace = await readFile(new URL('../../bob/components/Workspace.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(
    workspace,
    /if \(previewDependenciesReady\) return;\s*setIframeHasState\(false\)/,
  );
  assert.equal((workspace.match(/setIframeHasState\(false\)/g) ?? []).length, 1);
  assert.doesNotMatch(workspace, /setIframeLoadError\('Failed to resolve preview account assets'\)/);
  assert.doesNotMatch(workspace, /setIframeHasState\(true\);\s*\};\s*iframe\.addEventListener\('load'/);
  assert.match(workspace, /iframeHasState && !savedTranslationPreviewBlocked && !previewError && switcherNotice/);
}

async function testDieterLayoutTableAndPopupConsumption(): Promise<void> {
  const shell = await readRoute('components/roma-shell.tsx');
  const layout = await readRoute('app/layout.tsx');
  const romaCss = await readRoute('app/roma.css');

  assert.match(layout, /dieter\/layouts\/main-container\/main-container\.css/);
  assert.match(shell, /className="main-container"/);
  assert.match(shell, /className="left-nav"/);
  assert.match(shell, /className=\{`page/);
  assert.match(shell, /className="page__header"/);
  assert.match(shell, /className="page__actions"/);
  assert.match(shell, /className=\{`page__content/);
  assert.match(shell, /matchMedia\('\(min-width: 600px\) and \(min-height: 600px\)'\)/);
  assert.match(shell, /data-navigation-open=\{navigationOpen \? 'true' : undefined\}/);
  assert.match(shell, /data-navigation-scrim/);
  assert.doesNotMatch(shell, /roma-layout|rd-domain|rd-header/);
  assert.doesNotMatch(shell, /Unsupported workspace|Rotate your device|roma-portrait-boundary/);
  assert.doesNotMatch(
    romaCss,
    /\.roma-layout|\.roma-modal|\.rd-header|\.rd-domain|\.roma-portrait-boundary/,
  );
  assert.doesNotMatch(romaCss, /pointer:\s*coarse|orientation:\s*portrait/);

  for (const relativePath of [
    'components/pages-domain.tsx',
    'components/assets-domain.tsx',
    'components/widgets-domain.tsx',
    'components/team-domain.tsx',
  ]) {
    const source = await readRoute(relativePath);
    assert.match(source, /className="diet-table"/, `${relativePath} must consume Dieter Table`);
    assert.match(source, /className="diet-table__table"/, `${relativePath} must use the semantic Dieter Table`);
    assert.doesNotMatch(source, /diet-operational-table/, `${relativePath} must not retain operational-table`);
  }

  for (const relativePath of [
    'components/roma-account-notice-modal.tsx',
    'components/roma-unsaved-changes-dialog.tsx',
    'components/roma-upsell-dialog.tsx',
    'components/pages-domain.tsx',
    'components/assets-domain.tsx',
    'components/widgets-domain.tsx',
  ]) {
    const source = await readRoute(relativePath);
    assert.match(source, /className="diet-popup"/, `${relativePath} must consume Dieter Popup`);
    assert.match(source, /className="diet-popup__header"/, `${relativePath} must use the Popup header`);
    assert.match(source, /className="diet-popup__body"/, `${relativePath} must use the Popup body`);
    assert.match(source, /className="diet-popup__footer"/, `${relativePath} must use the Popup footer`);
    assert.doesNotMatch(source, /roma-modal/, `${relativePath} must not retain the Roma modal base`);
  }
}

async function run(): Promise<void> {
  await testCreateGateBeforeWork();
  console.log('PASS create gate runs before id/package/Tokyo write work');
  await testDuplicateGateBeforeWorkAfterSourceProof();
  console.log('PASS duplicate gate runs after source proof and before id/package/Tokyo write work');
  await testPublishGateBeforeTransition();
  console.log('PASS publish gate uses list-facts and runs before Tokyo publish transition');
  await testBuilderHandlesBobUpsell();
  console.log('PASS Bob upsell CTA opens the Roma scaffold without discarding Builder work');
  await testBuilderUsesBobTopDrawerAsItsOnlyEditorChrome();
  console.log('PASS active Builder owns full-canvas chrome and preserves initial-only preview readiness');
  await testDieterLayoutTableAndPopupConsumption();
  console.log('PASS Roma and Bob consume the final Dieter Layout, Table, and Popup contracts');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
