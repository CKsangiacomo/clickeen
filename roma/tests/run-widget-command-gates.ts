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
  assert.doesNotMatch(shell, /roma-layout|rd-domain|rd-header/);
  assert.doesNotMatch(romaCss, /\.roma-layout|\.roma-modal|\.rd-header|\.rd-domain/);

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
  await testDieterLayoutTableAndPopupConsumption();
  console.log('PASS Roma and Bob consume the final Dieter Layout, Table, and Popup contracts');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
