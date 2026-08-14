import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildWidgetPublicActions } from '../lib/public-widget-actions';

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

async function testDeleteDoesNotDependOnRetiredPages(): Promise<void> {
  const source = await readRoute('app/api/account/instances/[instanceId]/route.ts');
  assert.match(source, /deleteAccountInstanceFromTokyo\(\{/);
  assert.doesNotMatch(source, /account-page|PageSources|pageIdsPlacingInstance|placedOnPage|pageIds/);
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
  const topDrawer = await readFile(new URL('../../bob/components/TopDrawer.tsx', import.meta.url), 'utf8');
  const bobBoot = await readFile(new URL('../../bob/lib/session/useSessionBoot.ts', import.meta.url), 'utf8');
  const bobCss = await readFile(new URL('../../bob/app/bob_app.css', import.meta.url), 'utf8');
  const copyDialog = await readRoute('components/widget-copy-code-dialog.tsx');
  const clipboard = await readRoute('lib/copy-to-clipboard.ts');

  assert.doesNotMatch(builderRoute, /showHeader/);
  assert.match(builderRoute, /fullCanvas/);
  assert.doesNotMatch(builderRoute, /RomaShellDefaultActions/);
  assert.doesNotMatch(builderLandingRoute, /fullCanvas/);
  assert.doesNotMatch(builderLandingRoute, /rd-canvas--builder/);
  assert.match(builderLandingRoute, /RomaShellDefaultActions/);

  assert.match(builderSource, /buildWidgetPublicActions\(\{/);
  assert.match(builderSource, /publicActions: nextPublicActions/);
  assert.match(builderSource, /data\.type === 'bob:host-action'/);
  assert.match(builderSource, /data\.action === 'copy-code'/);
  assert.doesNotMatch(builderSource, /returnTo|returnLabel|data\.action === 'return'/);
  assert.match(builderSource, /<WidgetCopyCodeDialog/);
  assert.doesNotMatch(builderSource, />Copy URL</);
  assert.doesNotMatch(builderSource, />Copy embed</);
  assert.doesNotMatch(builderSource, />Copy script</);
  assert.doesNotMatch(builderSource, />Open public widget</);

  assert.match(topDrawer, /className="topdrawer"/);
  assert.match(topDrawer, />Open public widget</);
  assert.match(topDrawer, />More</);
  assert.match(topDrawer, />Copy code</);
  assert.match(topDrawer, /requestHostAction\('copy-code'\)/);
  assert.doesNotMatch(topDrawer, />Copy URL</);
  assert.doesNotMatch(topDrawer, />Copy embed</);
  assert.doesNotMatch(topDrawer, />Copy script</);
  assert.doesNotMatch(topDrawer, /navigator\.clipboard|document\.execCommand/);
  assert.match(topDrawer, /className="topdrawer-more diet-popover-host"/);
  assert.match(topDrawer, /requestHostAction\('open-navigation'\)/);
  assert.doesNotMatch(topDrawer, /requestHostAction\('return'\)|returnLabel|topdrawer-return/);
  assert.equal((topDrawer.match(/data-type="primary"/g) ?? []).length, 1);
  assert.match(bobBoot, /message\.publishStatus === 'published'/);
  assert.match(bobBoot, /coreui\.errors\.builder\.publicActions\.invalid/);
  assert.doesNotMatch(bobBoot, /returnLabel/);
  assert.doesNotMatch(bobCss, /topdrawer-action-status/);
  assert.match(copyDialog, /aria-label=\{`Copy \$\{option\.label\}`\}/);
  assert.doesNotMatch(copyDialog, /data-size="large"/);
  assert.match(copyDialog, /request !== copyRequestRef\.current/);
  assert.match(clipboard, /finally \{\s+element\?\.remove\(\);/);
}

function testRomaOwnsExactPublicWidgetActions(): void {
  const actions = buildWidgetPublicActions({
    accountPublicId: 'CLICKEEN',
    instanceId: 'ABC123',
    baseUrl: 'https://dev.clk.live/',
  });
  assert.equal(actions.publicUrl, 'https://dev.clk.live/CLICKEEN/ABC123');
  assert.match(actions.iframeSnippet, /src="https:\/\/dev\.clk\.live\/CLICKEEN\/ABC123"/);
  assert.equal(actions.scriptSnippet, '<script src="https://dev.clk.live/CLICKEEN/ABC123/runtime.js" async></script>');
  assert.throws(
    () => buildWidgetPublicActions({ accountPublicId: '', instanceId: 'ABC123', baseUrl: 'https://dev.clk.live' }),
    /coreui\.errors\.payload\.invalid/,
  );
}

async function testWidgetsListComposition(): Promise<void> {
  const source = await readRoute('components/widgets-domain.tsx');
  const route = await readRoute('app/(authed)/widgets/page.tsx');
  const catalogRoute = await readRoute('app/(authed)/widgets/catalog/page.tsx');
  const nav = await readRoute('components/roma-nav.tsx');
  const domains = await readRoute('lib/domains.ts');
  const romaCss = await readRoute('app/roma.css');

  assert.match(route, /<WidgetsPage view="your-widgets" \/>/);
  assert.match(catalogRoute, /<WidgetsPage view="catalog" \/>/);
  assert.doesNotMatch(route, /DomainPageShell|RomaShellDefaultActions/);
  assert.doesNotMatch(source, /useState<WidgetsView>|activeView|onViewChange|diet-tabs|role="tab"/);
  assert.match(nav, /label="Widgets" domains=\{ROMA_WIDGETS_DOMAINS\}/);
  assert.match(nav, /label="Settings" domains=\{ROMA_SETTINGS_DOMAINS\}/);
  assert.match(nav, /className="roma-nav__group"/);
  assert.match(nav, /domains\.some\(\(domain\) => domain\.key === activeDomain\)/);
  assert.match(nav, /<details className="roma-nav__group" open=\{active\}>/);
  assert.match(domains, /label: 'Widget catalog', href: '\/widgets\/catalog'/);
  assert.match(domains, /label: 'Your widgets'/);
  assert.doesNotMatch(domains, /key: 'pages'|href: '\/pages'/);
  assertBefore(domains, "'widgets',", "'widgetCatalog',");
  assert.match(source, /headerControls=\{view === 'your-widgets' \? \(/);
  assert.doesNotMatch(nav, /roma-nav__settings/);
  assert.doesNotMatch(romaCss, /roma-nav__settings/);
  assert.match(source, /<DieterDropdownActions/);
  assert.match(source, /\{ value: 'all', label: 'Show all' \}/);
  assert.match(source, /\{ value: 'published', label: 'Show published' \}/);
  assert.match(source, /\{ value: 'unpublished', label: 'Show unpublished' \}/);
  assert.doesNotMatch(source, /WidgetSortHeader|roma-widget-sort/);
  assert.doesNotMatch(romaCss, /roma-widget-sort/);
  assert.match(source, /type WidgetSortKey = 'widget' \| 'name' \| 'status'/);
  assert.match(source, /<span>Widget<\/span>\{' '\}[\s\S]*?className="diet-button"[\s\S]*?data-size="small"[\s\S]*?aria-label="Sort by widget"[\s\S]*?changeSort\('widget'\)/);
  assert.match(source, /<span>Instance name<\/span>\{' '\}[\s\S]*?className="diet-button"[\s\S]*?data-size="small"[\s\S]*?aria-label="Sort by instance name"[\s\S]*?changeSort\('name'\)/);
  assert.match(source, /<span>Published<\/span>\{' '\}[\s\S]*?className="diet-button"[\s\S]*?data-size="small"[\s\S]*?aria-label="Sort by published status"[\s\S]*?changeSort\('status'\)/);
  assert.match(source, /aria-sort=\{sort\.key === 'widget' \? sort\.direction : 'none'\}/);
  assert.match(source, /aria-sort=\{sort\.key === 'name' \? sort\.direction : 'none'\}/);
  assert.match(source, /aria-sort=\{sort\.key === 'status' \? sort\.direction : 'none'\}/);
  assert.match(source, /const displayedInstances = useMemo\(\(\) => \{\s+if \(!canRenderWidgetData\) return \[\];/);
  assert.match(source, /catalogByWidgetType\.get\(left\.widgetType\)!\.displayName\.localeCompare/);
  assertBefore(source, /<span>Widget<\/span>/, /<span>Instance name<\/span>/);
  assertBefore(source, /<span>Instance name<\/span>/, /<span>Published<\/span>/);
  assert.match(source, /displayedInstances\.map\(\(instance\)/);
  assert.match(source, /displayedCatalog\.map\(\(option\)/);
  assert.match(source, /handleCreateInstance\(option\.widgetType\)/);
  assert.match(source, /checked=\{instance\.status === 'published'\}/);
  assert.match(source, /handleStatusChange\(instance, event\.target\.checked \? 'published' : 'unpublished'\)/);
  assert.match(source, /className="roma-widget-publish-actions"/);
  assert.match(source, /instance\.status === 'published' \? \(/);
  assert.match(source, />Copy code<\/span>/);
  assert.match(source, /<WidgetCopyCodeDialog/);
  assert.match(source, /<span className="body-xs roma-widget-instance-id">\{instance\.instanceId\}<\/span>/);
  assert.match(romaCss, /\.roma-widget-publish-actions \{[\s\S]*justify-content: flex-start;/);
  assert.match(source, /className="diet-popover roma-widget-actions-popover"/);
  assert.match(source, /instanceId: string;\s+position:/);
  assert.match(source, /instance\.instanceId === openWidgetActions\.instanceId/);
  assert.doesNotMatch(source, /instance: WidgetInstance;\s+position:/);
  assert.match(source, /\['ArrowDown', 'ArrowUp', 'Home', 'End'\]/);
  assert.match(source, />Rename<\/span>/);
  assert.match(source, />Duplicate<\/span>/);
  assert.match(source, />Delete<\/span>/);
  assert.match(source, /No \{statusFilter\} widgets\./);
  assert.doesNotMatch(source, /groupedInstances|displayedGroups|groupSorts|changeGroupSort/);
  assert.doesNotMatch(romaCss, /roma-widget-group/);
  assert.doesNotMatch(source, /menuWidth|menuHeight/);
  assert.doesNotMatch(source, /Unpublishing\.\.\.|Publishing\.\.\.|>Unpublish<|>Publish</);
}

async function testDieterLayoutTableAndPopupConsumption(): Promise<void> {
  const shell = await readRoute('components/roma-shell.tsx');
  const layout = await readRoute('app/layout.tsx');
  const romaCss = await readRoute('app/roma.css');
  const tableCss = await readFile(new URL('../../dieter/components/table/table.css', import.meta.url), 'utf8');
  const assets = await readRoute('components/assets-domain.tsx');
  const widgets = await readRoute('components/widgets-domain.tsx');
  const dropdownActions = await readRoute('components/dieter-dropdown-actions.tsx');
  const textfield = await readRoute('components/dieter-textfield.tsx');
  const assetsPage = assets.slice(assets.indexOf('export function AssetsPage'), assets.indexOf('export function AssetsDomain'));

  assert.match(layout, /dieter\/layouts\/main-container\/main-container\.css/);
  assert.match(shell, /className="main-container"/);
  assert.match(shell, /className="left-nav"/);
  assert.match(shell, /className=\{`page/);
  assert.match(shell, /className="page__header"/);
  assert.match(shell, /headerControls\?: ReactNode/);
  assert.match(shell, /<h1 className="heading-2">\{title\}<\/h1>\s+\{headerControls\}/);
  assert.match(shell, /className="page__actions"/);
  assert.match(shell, /className="page__content"/);
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
  assert.match(tableCss, /border-radius: var\(--control-radius-lg\);/);
  assert.doesNotMatch(tableCss, /box-shadow:/);
  assert.match(tableCss, /padding: var\(--space-3\) var\(--space-4\);/);
  assert.match(tableCss, /border-block-end: 1px solid var\(--color-system-gray-step5\);/);
  assert.match(tableCss, /border-block-end-color: var\(--color-system-gray-step3\);/);
  assert.match(tableCss, /th\[aria-sort\] > \.diet-button \{\s+--button-color: var\(--color-system-gray-3\);/);
  assert.match(tableCss, /th\[aria-sort='ascending'\] > \.diet-button,[\s\S]*?th\[aria-sort='descending'\] > \.diet-button \{\s+--button-color: var\(--color-system-gray-2\);/);

  assert.match(assetsPage, /<AssetsDomain assetFilter=\{assetFilter\} onHeaderActions=\{setHeaderActions\} \/>/);
  assert.doesNotMatch(assetsPage, /useRomaAccountContext|useRomaAccountApi|refreshToken|onLoadingChange/);

  assert.match(dropdownActions, /className=\{`diet-dropdown-actions diet-popover-host/);
  assert.match(dropdownActions, /triggerStyle === 'button' \? 'diet-button' : 'diet-dropdown-header diet-dropdown-actions__control'/);
  assert.match(dropdownActions, /className="diet-popover diet-dropdown-actions__popover" role="listbox"/);
  assert.match(dropdownActions, /triggerStyle === 'field' \? \(/);
  assert.match(dropdownActions, /const labelClass = size === 'sm' \? 'label-xs' : size === 'lg' \? 'label-m' : 'label-s'/);
  assert.match(dropdownActions, /const bodyClass = size === 'sm' \? 'body-xs' : size === 'lg' \? 'body-m' : 'body-s'/);
  assert.match(dropdownActions, /className=\{`diet-btn-menuactions diet-dropdown-actions__menuaction/);
  assert.doesNotMatch(dropdownActions, /data-variant="neutral"/);
  assert.match(dropdownActions, /className="diet-btn-menuactions__label"/);
  assert.match(dropdownActions, /className="diet-dropdown-actions__check diet-icon diet-icon-mask"/);
  assert.match(dropdownActions, /removeEventListener\('pointerdown', closeOnPointerDown, true\)/);
  assert.match(dropdownActions, /removeEventListener\('keydown', closeOnEscape\)/);
  assert.doesNotMatch(dropdownActions, /chevron\.compact/);
  assert.match(textfield, /className="diet-textfield__control"/);
  assert.match(textfield, /className=\{`diet-textfield__field/);

  assert.match(widgets, /ariaLabel="Filter your widgets by publish status"/);
  assert.match(widgets, /triggerStyle="button"/);
  assert.match(widgets, /\{ value: 'published', label: 'Show published' \}/);
  assert.match(assetsPage, /ariaLabel="Filter assets by type"/);
  assert.match(assetsPage, /triggerStyle="button"/);
  assert.match(assetsPage, /headerControls=\{\(\s+<DieterDropdownActions/);
  assert.match(assetsPage, /headerRight=\{headerActions \? \(/);
  for (const [value, label] of [
    ['all', 'Show all'],
    ['font', 'Fonts'],
    ['vector', 'SVGs'],
    ['image', 'Photo'],
    ['video', 'Video'],
  ] as const) {
    assert.match(assetsPage, new RegExp(`\\{ value: '${value}', label: '${label}' \\}`));
  }
  assert.match(assets, /filter\(\(asset\) => assetFilter === 'all' \|\| asset\.assetType === assetFilter\)/);
  assertBefore(assets, /filter\(\(asset\) => assetFilter/, /\.sort\(\(left, right\) =>/);

  for (const [domain, source] of [['Assets', assets], ['Widgets', widgets]] as const) {
    const sortableHeaders = source.match(/<th[^>]*aria-sort=[\s\S]*?<\/th>/g) ?? [];
    assert.ok(sortableHeaders.length > 0, `${domain} must have sortable headers`);
    for (const header of sortableHeaders) {
      assert.match(header, /className="diet-button"[\s\S]*?data-size="small"/);
      assert.match(header, /className="diet-icon diet-icon-mask"/);
    }
    assert.match(source, /'chevron\.up\.2\.svg'/, `${domain} ascending sort must use chevron.up.2`);
    assert.match(source, /'chevron\.down\.2\.svg'/, `${domain} descending sort must use chevron.down.2`);
    assert.match(source, /'chevron\.down\.dotted\.2\.svg'/, `${domain} inactive sort must use chevron.down.dotted.2`);
    assert.doesNotMatch(source, /'arrow\.up\.svg'|'arrow\.down\.svg'|'arrow\.up\.arrow\.down\.svg'/);
  }

  for (const [label, key] of [
    ['Asset', 'filename'],
    ['Type', 'assetType'],
    ['Size', 'sizeBytes'],
  ] as const) {
    assert.match(
      assets,
      new RegExp(`<span>${label}<\\/span>\\{' '\\}[\\s\\S]*?className="diet-button"[\\s\\S]*?data-size="small"[\\s\\S]*?changeSort\\('${key}'\\)`),
    );
    assert.match(assets, new RegExp(`aria-sort=\\{sort\\.key === '${key}' \\? sort\\.direction : 'none'\\}`));
  }

  for (const relativePath of [
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
    'components/assets-domain.tsx',
    'components/widgets-domain.tsx',
    'components/widget-copy-code-dialog.tsx',
  ]) {
    const source = await readRoute(relativePath);
    assert.match(source, /className="diet-popup"/, `${relativePath} must consume Dieter Popup`);
    assert.match(source, /className="diet-popup__header"/, `${relativePath} must use the Popup header`);
    assert.match(source, /className="diet-popup__body"/, `${relativePath} must use the Popup body`);
    assert.match(source, /className="diet-popup__footer"/, `${relativePath} must use the Popup footer`);
    assert.doesNotMatch(source, /roma-modal/, `${relativePath} must not retain the Roma modal base`);
  }

  for (const relativePath of [
    'components/assets-domain.tsx',
    'components/widgets-domain.tsx',
    'components/widget-copy-code-dialog.tsx',
    'components/roma-upsell-dialog.tsx',
  ]) {
    const source = await readRoute(relativePath);
    assert.match(source, /diet-popup__dismiss/, `${relativePath} must compose the optional Popup dismiss action`);
    assert.match(source, /data-icon="multiply"/, `${relativePath} must use the Dieter multiply Icon`);
  }

  for (const relativePath of [
    'components/roma-account-notice-modal.tsx',
    'components/roma-unsaved-changes-dialog.tsx',
  ]) {
    const source = await readRoute(relativePath);
    assert.doesNotMatch(source, /diet-popup__dismiss/, `${relativePath} must retain its required-decision dismissal policy`);
  }
}

async function run(): Promise<void> {
  await testCreateGateBeforeWork();
  console.log('PASS create gate runs before id/package/Tokyo write work');
  await testDuplicateGateBeforeWorkAfterSourceProof();
  console.log('PASS duplicate gate runs after source proof and before id/package/Tokyo write work');
  await testPublishGateBeforeTransition();
  console.log('PASS publish gate uses list-facts and runs before Tokyo publish transition');
  await testDeleteDoesNotDependOnRetiredPages();
  console.log('PASS instance deletion has no retired Pages dependency');
  await testBuilderHandlesBobUpsell();
  console.log('PASS Bob upsell CTA opens the Roma scaffold without discarding Builder work');
  await testBuilderUsesBobTopDrawerAsItsOnlyEditorChrome();
  console.log('PASS active Builder owns full-canvas chrome and preserves initial-only preview readiness');
  testRomaOwnsExactPublicWidgetActions();
  console.log('PASS Roma owns exact public widget actions for Widgets and Builder');
  await testWidgetsListComposition();
  console.log('PASS Widgets separates the catalog from the account-instance inventory');
  await testDieterLayoutTableAndPopupConsumption();
  console.log('PASS Roma and Bob consume the final Dieter Layout, Table, and Popup contracts');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
