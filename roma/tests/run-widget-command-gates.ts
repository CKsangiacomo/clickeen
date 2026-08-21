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

async function testPublishGateBeforeTransition(): Promise<void> {
  const source = await readRoute('app/api/account/instances/[instanceId]/publish/route.ts');
  const unpublishRoute = await readRoute('app/api/account/instances/[instanceId]/unpublish/route.ts');
  const directSource = await readRoute('lib/account-instance-direct.ts');
  const tokyoClientSource = await readRoute('lib/tokyo-client.ts');
  const builderSource = await readRoute('components/builder-domain.tsx');
  const widgetsSource = await readRoute('components/widgets-domain.tsx');
  const publicationControls = await readRoute('components/widget-publication-controls.tsx');
  const tokyoOperations = await readFile(
    new URL('../../tokyo-worker/src/domains/account-instances/operations.ts', import.meta.url),
    'utf8',
  );
  const tokyoCoordinator = await readFile(
    new URL(
      '../../tokyo-worker/src/domains/account-instances/publication-coordinator.ts',
      import.meta.url,
    ),
    'utf8',
  );
  const tokyoRoute = await readFile(
    new URL(
      '../../tokyo-worker/src/routes/internal-instance-routes.ts',
      import.meta.url,
    ),
    'utf8',
  );
  const gateBranch = 'if (!alreadyPublished && publishedTotal >= publishedLimit)';
  assert.match(source, /loadAccountWidgetInstanceFacts\(\{/);
  assert.match(source, /action: 'publish_instance'/);
  assert.match(source, /status: 402/);
  assert.match(source, /const publishedTotal = instances\.value\.instances\.filter/);
  assert.match(source, /if \(!alreadyPublished && publishedTotal >= publishedLimit\) \{\s+return withSession\(\s+request,\s+upgradeRequired\(\{/);
  assertNoOldUpgradePath(source);
  assert.doesNotMatch(source, /listAccountInstancesInTokyo/);
  assert.doesNotMatch(source, /\/instances\/facts/);
  assert.match(source, /publishedLimit,/);
  assert.match(source, /sourceUpdatedAt: saved\.value\.row\.updatedAt/);
  assertBefore(source, gateBranch, 'materializeAccountInstancePublicPackage({');
  assertBefore(source, gateBranch, 'publishAccountInstanceInTokyo({');
  assertBefore(tokyoOperations, 'listAccountInstanceIds({', 'await writeInstanceServeState({');
  assert.doesNotMatch(tokyoOperations, /writeInstancePublicPackage/);
  assert.match(tokyoOperations, /publishedTotal >= args\.publishedLimit/);
  assert.match(tokyoOperations, /existing\.updatedAt !== args\.sourceUpdatedAt/);
  assert.match(tokyoCoordinator, /private active = false/);
  assert.match(tokyoCoordinator, /reasonKey: 'coreui\.errors\.instance\.commandInProgress'/);
  assert.match(tokyoCoordinator, /coordinateAccountInstanceSave/);
  assert.match(tokyoCoordinator, /coordinateAccountInstanceRename/);
  assert.match(tokyoCoordinator, /coordinateAccountInstanceUnpublish/);
  assert.match(tokyoCoordinator, /coordinateAccountInstanceDelete/);
  assert.doesNotMatch(tokyoCoordinator, /purgeClkLiveEntryCache/);
  assertBefore(
    tokyoRoute,
    'coordinateAccountInstancePublish({',
    'scheduleAccountInstanceCacheEviction({ cache, waitUntil, accountId, instanceId });',
  );
  assert.doesNotMatch(tokyoRoute, /await scheduleAccountInstanceCacheEviction|committed/);
  assert.doesNotMatch(tokyoClientSource, /committed/);
  assert.doesNotMatch(directSource, /committed/);
  assert.doesNotMatch(source, /committed/);
  assert.doesNotMatch(unpublishRoute, /committed/);
  assert.doesNotMatch(builderSource, /resolveCommittedPublicationFailureCopy|publishActiveInstance|publicationError/);
  assert.doesNotMatch(widgetsSource, /publicationRetry|Retry public delivery/);
  assert.doesNotMatch(publicationControls, /cache|purge|committed/);
  assert.doesNotMatch(publicationControls, /transitionedInstance|upsertRomaWidgetInstanceCache/);
  assert.match(publicationControls, /invalidateRomaWidgetsCache\(accountContext\.accountPublicId\)/);
  assert.match(publicationControls, /onInstanceChange\(refreshed\)/);
  assertBefore(
    publicationControls,
    'loadRomaWidgetsForAccount({',
    'invalidateRomaWidgetsCache(accountContext.accountPublicId);',
  );
}

async function testDeleteDoesNotDependOnRetiredPages(): Promise<void> {
  const source = await readRoute('app/api/account/instances/[instanceId]/route.ts');
  assert.match(source, /deleteAccountInstanceFromTokyo\(\{/);
  assert.doesNotMatch(source, /account-page|PageSources|pageIdsPlacingInstance|placedOnPage|pageIds/);
}

async function testRomaOwnsBuilderPublicationChrome(): Promise<void> {
  const builderSource = await readRoute('components/builder-domain.tsx');
  const widgetsSource = await readRoute('components/widgets-domain.tsx');
  const builderRoute = await readRoute('app/(authed)/builder/[instanceId]/page.tsx');
  const builderLandingRoute = await readRoute('app/(authed)/builder/page.tsx');
  const builderApp = await readFile(new URL('../../bob/components/BuilderApp.tsx', import.meta.url), 'utf8');
  const bobBoot = await readFile(new URL('../../bob/lib/session/useSessionBoot.ts', import.meta.url), 'utf8');
  const bobCss = await readFile(new URL('../../bob/app/bob_app.css', import.meta.url), 'utf8');
  const bobSessionTypes = await readFile(new URL('../../bob/lib/session/sessionTypes.ts', import.meta.url), 'utf8');
  const builderHostProtocol = await readRoute('lib/builder-host-protocol.ts');
  const copyDialog = await readRoute('components/widget-copy-code-dialog.tsx');
  const clipboard = await readRoute('lib/copy-to-clipboard.ts');
  const pageHeader = await readRoute('components/roma-page-header.tsx');
  const publicationControls = await readRoute('components/widget-publication-controls.tsx');

  assert.doesNotMatch(builderRoute, /showHeader/);
  assert.match(builderRoute, /fullCanvas/);
  assert.doesNotMatch(builderRoute, /RomaShellDefaultActions/);
  assert.doesNotMatch(builderLandingRoute, /fullCanvas/);
  assert.doesNotMatch(builderLandingRoute, /rd-canvas--builder/);
  assert.match(builderLandingRoute, /RomaShellDefaultActions/);

  assert.match(builderSource, /<RomaPageHeader\s+width="full"/);
  assert.doesNotMatch(builderSource, /className="page__header"|roma-page-heading/);
  assert.match(pageHeader, /width: 'contained' \| 'full'/);
  assert.match(pageHeader, /title: ReactNode/);
  assert.match(pageHeader, /navigationTrigger\?: ReactNode/);
  assert.match(pageHeader, /headingExtras\?: ReactNode/);
  assert.match(pageHeader, /<header className="page__header" data-width=\{width\}>/);
  assert.match(pageHeader, /<div className="page__heading">[\s\S]*?\{navigationTrigger\}[\s\S]*?<h1 className="heading-2">\{title\}<\/h1>[\s\S]*?\{headingExtras\}[\s\S]*?<\/div>/);
  assert.match(pageHeader, /<div className="page__actions">\{actions\}<\/div>/);
  assert.doesNotMatch(pageHeader, /useState|useEffect|onClick|onChange/);
  assert.match(builderSource, /<WidgetPublicationControls/);
  assert.match(widgetsSource, /showingInitialWidgetsLoading \|\| \(displayedInstances\.length > 0/);
  assert.match(widgetsSource, /<td className="diet-data-table__state-cell" colSpan=\{5\}>[\s\S]*<RomaLoadingState \/>/);
  assert.doesNotMatch(widgetsSource, /Loading widgets\.\.\./);
  assert.match(builderSource, /className="roma-nav-trigger diet-button"/);
  assert.match(builderSource, /onClick=\{\(\) => openNavigation\(navigationButtonRef\.current\)\}/);
  assert.match(builderSource, /readBobSaveControlPhase\(\{/);
  assert.match(builderSource, /bobSaveControlPhase === 'save'/);
  assert.match(builderSource, /bobSaveControlPhase === 'saving'/);
  assert.match(builderSource, /bobSaveControlPhase === 'saved'/);
  assert.match(builderSource, /targetWindow\.postMessage\(createHostSaveRequestMessage\(\), bobBaseUrl\)/);
  assertBefore(builderSource, /<WidgetPublicationControls/, /bobSaveControlPhase === 'save'/);
  assert.doesNotMatch(builderSource, /bob:host-action|open-navigation/);
  assert.doesNotMatch(builderSource, /data\.action === 'copy-code'/);
  assert.doesNotMatch(builderSource, /returnTo|returnLabel|data\.action === 'return'/);
  assert.doesNotMatch(builderSource, /<WidgetCopyCodeDialog/);
  assert.doesNotMatch(builderSource, />Copy URL</);
  assert.doesNotMatch(builderSource, />Copy embed</);
  assert.doesNotMatch(builderSource, />Copy script</);
  assert.doesNotMatch(builderSource, />Open public widget</);

  assert.match(builderApp, /className="builder-app"/);
  assert.match(builderApp, /className="editor-content"/);
  assert.match(builderApp, /className="tooldrawer-open diet-button"/);
  assert.doesNotMatch(builderApp, /TopDrawer|topdrawer|open-navigation/);
  assert.doesNotMatch(bobCss, /topdrawer/);
  assert.match(
    bobCss,
    /\.builder-app \{[^}]*padding-block-start: 0;[^}]*padding-block-end: max\(var\(--space-2\), env\(safe-area-inset-bottom\)\);/,
  );
  assert.doesNotMatch(bobCss, /\.builder-app \{[^}]*safe-area-inset-top/);
  assert.match(bobCss, /\.editor-content > \.tooldrawer-open/);
  assert.match(bobSessionTypes, /type: 'bob:save-control-state'/);
  assert.match(bobSessionTypes, /type: 'host:save-request'/);
  assert.doesNotMatch(bobSessionTypes, /bob:host-action|open-navigation/);
  assert.match(builderHostProtocol, /args\.eventOrigin !== args\.bobOrigin/);
  assert.match(builderHostProtocol, /args\.eventSource !== args\.iframeWindow/);
  assert.doesNotMatch(bobBoot, /publicActions|publishStatus|publishedAt|sourceUpdatedAt/);
  assert.doesNotMatch(bobBoot, /coreui\.errors\.builder\.publicActions\.invalid/);
  assert.doesNotMatch(bobBoot, /returnLabel/);
  assert.doesNotMatch(bobCss, /topdrawer-action-status/);
  assert.doesNotMatch(copyDialog, /data-size="large"/);
  assert.match(copyDialog, /request !== copyRequestRef\.current/);
  assert.match(clipboard, /finally \{\s+element\?\.remove\(\);/);
  assert.match(publicationControls, /nextStatus === 'published' && dirty/);
  assert.match(publicationControls, /publishBlocked = dirty && !published/);
  assert.match(publicationControls, /checked=\{status\.published\}/);
  assert.match(publicationControls, /onPendingChange\?\.\(true\)/);
  assert.match(publicationControls, /onPendingChange\?\.\(false\)/);
  assert.match(widgetsSource, /const publicationActionKey = `publication:\$\{instance\.instanceId\}`/);
  assert.match(widgetsSource, /disabled=\{rowActionsDisabled\}/);
  assert.match(widgetsSource, /current === publicationActionKey \? null : current/);
  assert.match(widgetsSource, /aria-disabled="true"/);
  assert.match(builderSource, /publicationIdlePromiseRef/);
  assert.match(builderSource, /args\.command === 'save-instance' && publicationPendingRef\.current/);
  assert.match(builderSource, /await publicationIdlePromiseRef\.current/);
  assert.match(builderSource, /onPendingChange=\{handlePublicationPendingChange\}/);
}

function testRomaOwnsExactPublicWidgetActions(): void {
  const actions = buildWidgetPublicActions({
    accountPublicId: 'CLICKEEN',
    instanceId: 'ABC123',
    baseUrl: 'https://dev.clk.live/',
  });
  assert.equal(actions.publicUrl, 'https://dev.clk.live/CLICKEEN/ABC123');
  assert.match(actions.iframeSnippet, /src="https:\/\/dev\.clk\.live\/CLICKEEN\/ABC123"/);
}

async function testWidgetsListComposition(): Promise<void> {
  const source = await readRoute('components/widgets-domain.tsx');
  const route = await readRoute('app/(authed)/widgets/page.tsx');
  const catalogRoute = await readRoute('app/(authed)/widgets/catalog/page.tsx');
  const nav = await readRoute('components/roma-nav.tsx');
  const domains = await readRoute('lib/domains.ts');
  const romaCss = await readRoute('app/roma.css');
  const publicationControls = await readRoute('components/widget-publication-controls.tsx');
  const renameRoute = await readRoute('app/api/account/instances/[instanceId]/rename/route.ts');

  assert.match(route, /<WidgetsPage view="your-widgets" \/>/);
  assert.match(catalogRoute, /<WidgetsPage view="catalog" \/>/);
  assert.doesNotMatch(route, /DomainPageShell|RomaShellDefaultActions/);
  assert.doesNotMatch(source, /useState<WidgetsView>|activeView|onViewChange|diet-tabs|role="tab"/);
  assert.match(nav, /className="roma-nav__group"/);
  assert.match(nav, /domains\.some\(\(domain\) => domain\.key === activeDomain\)/);
  assert.match(nav, /<details className="roma-nav__group" open=\{active\}>/);
  assert.doesNotMatch(domains, /key: 'pages'|href: '\/pages'/);
  assertBefore(domains, "'widgets',", "'widgetCatalog',");
  assert.match(source, /headerControls=\{view === 'your-widgets' \? \(/);
  assert.doesNotMatch(nav, /roma-nav__settings/);
  assert.doesNotMatch(romaCss, /roma-nav__settings/);
  assert.match(source, /<DieterDropdownActions/);
  assert.doesNotMatch(source, /WidgetSortHeader|roma-widget-sort/);
  assert.doesNotMatch(romaCss, /roma-widget-sort/);
  assert.match(source, /type WidgetSortKey = 'widget' \| 'name' \| 'status'/);
  assert.match(source, /aria-sort=\{sort\.key === 'widget' \? sort\.direction : 'none'\}/);
  assert.match(source, /aria-sort=\{sort\.key === 'name' \? sort\.direction : 'none'\}/);
  assert.match(source, /aria-sort=\{sort\.key === 'status' \? sort\.direction : 'none'\}/);
  assert.match(source, /const displayedInstances = useMemo\(\(\) => \{\s+if \(!canRenderWidgetData\) return \[\];/);
  assert.match(source, /catalogByWidgetType\.get\(left\.widgetType\)!\.displayName\.localeCompare/);
  assert.match(source, /displayedInstances\.map\(\(instance\)/);
  assert.match(source, /displayedCatalog\.map\(\(option\)/);
  assert.match(source, /handleCreateInstance\(option\.widgetType\)/);
  assert.match(source, /<WidgetPublicationControls/);
  assert.match(renameRoute, /updatedAt: result\.value\.updatedAt/);
  assert.match(source, /displayName: resolvedDisplayName, updatedAt: payload\.updatedAt/);
  assert.match(publicationControls, /checked=\{status\.published\}/);
  assert.match(publicationControls, /requestStatusChange\(event\.target\.checked \? 'published' : 'unpublished'\)/);
  assert.match(publicationControls, /className="roma-widget-publish-actions"/);
  assert.match(publicationControls, /<WidgetCopyCodeDialog/);
  assert.match(source, /<span className="body-xs roma-widget-instance-id">\{instance\.instanceId\}<\/span>/);
  assert.match(romaCss, /\.roma-widget-publish-actions \{[\s\S]*justify-content: flex-start;/);
  assert.match(source, /className="diet-popover roma-widget-actions-popover"/);
  assert.match(source, /instanceId: string;\s+position:/);
  assert.match(source, /instance\.instanceId === openWidgetActions\.instanceId/);
  assert.doesNotMatch(source, /instance: WidgetInstance;\s+position:/);
  assert.match(source, /\['ArrowDown', 'ArrowUp', 'Home', 'End'\]/);
  assert.doesNotMatch(source, /No \{statusFilter\} widgets\./);
  assert.doesNotMatch(source, /groupedInstances|displayedGroups|groupSorts|changeGroupSort/);
  assert.doesNotMatch(romaCss, /roma-widget-group/);
  assert.doesNotMatch(source, /menuWidth|menuHeight/);
}

async function testDieterLayoutTableAndPopupConsumption(): Promise<void> {
  const shell = await readRoute('components/roma-shell.tsx');
  const pageHeader = await readRoute('components/roma-page-header.tsx');
  const layout = await readRoute('app/layout.tsx');
  const romaCss = await readRoute('app/roma.css');
  const mainContainerCss = await readFile(
    new URL('../../dieter/layouts/main-container/main-container.css', import.meta.url),
    'utf8',
  );
  const mainContainerSpec = await readFile(
    new URL('../../dieter/layouts/main-container/main-container.spec.json', import.meta.url),
    'utf8',
  );
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
  assert.match(shell, /<RomaPageHeader\s+width="contained"/);
  assert.match(shell, /headerControls\?: ReactNode/);
  assert.match(shell, /title=\{title\}/);
  assert.match(shell, /navigationTrigger=\{renderNavigationTrigger\(\)\}/);
  assert.match(shell, /headingExtras=\{headerControls\}/);
  assert.match(shell, /actions=\{headerRight\}/);
  assert.match(pageHeader, /<header className="page__header" data-width=\{width\}>[\s\S]*?<div className="page__heading">[\s\S]*?<h1 className="heading-2">\{title\}<\/h1>[\s\S]*?<\/div>[\s\S]*?<div className="page__actions">\{actions\}<\/div>[\s\S]*?<\/header>/);
  assert.match(mainContainerSpec, /"pageHeaderDirectChildren": \["page__heading", "page__actions"\]/);
  assert.match(mainContainerSpec, /"values": \["contained", "full"\]/);
  assert.match(mainContainerCss, /\.page__header\[data-width='contained'\]/);
  assert.match(mainContainerCss, /\.page__header\[data-width='full'\]/);
  assert.match(
    mainContainerCss,
    /\.page__header\[data-width='full'\] \{[^}]*padding-inline: var\(--layout-page-padding\);/,
  );
  assert.doesNotMatch(
    mainContainerCss,
    /\.page__header\[data-width='full'\] \{[^}]*padding(?:-block)?:/,
  );
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
  assert.doesNotMatch(romaCss, /\.roma-page-heading|\.roma-builder-page \.page__header/);
  assert.match(
    romaCss,
    /\.main-container > \.page\.roma-builder-page \{\s+padding: var\(--layout-page-padding\) 0 0;/,
  );
  assert.match(romaCss, /\.roma-builder-page > \.page__content \{[\s\S]*?max-inline-size: none;[\s\S]*?margin: 0;/);
  assert.match(tableCss, /border-radius: var\(--control-radius-lg\);/);
  assert.doesNotMatch(tableCss, /box-shadow:/);
  assert.match(tableCss, /padding: var\(--space-3\) var\(--space-4\);/);
  assert.match(tableCss, /border-block-end: 1px solid var\(--color-system-gray-step5\);/);
  assert.match(tableCss, /border-block-end-color: var\(--color-system-gray-step3\);/);
  assert.match(tableCss, /th\[aria-sort\] > \.diet-button \{\s+--button-color: var\(--color-system-gray\);/);
  assert.match(tableCss, /th\[aria-sort='ascending'\] > \.diet-button,[\s\S]*?th\[aria-sort='descending'\] > \.diet-button \{\s+--button-color: var\(--color-system-black\);/);

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

  assert.match(widgets, /triggerStyle="button"/);
  assert.match(assetsPage, /triggerStyle="button"/);
  assert.match(assetsPage, /headerControls=\{\(\s+<DieterDropdownActions/);
  assert.match(assetsPage, /headerRight=\{headerActions \? \(/);
  assert.equal((assetsPage.match(/data-size="large"/g) ?? []).length, 3);
  assert.doesNotMatch(assetsPage, /data-size="medium"/);
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
    'components/roma-command-confirmation-dialog.tsx',
    'components/roma-unsaved-changes-dialog.tsx',
    'components/roma-upsell-dialog.tsx',
    'components/assets-domain.tsx',
    'components/widget-copy-code-dialog.tsx',
  ]) {
    const source = await readRoute(relativePath);
    assert.match(source, /className="diet-popup"/, `${relativePath} must consume Dieter Popup`);
    assert.match(source, /className="diet-popup__header"/, `${relativePath} must use the Popup header`);
    assert.match(source, /className="diet-popup__body"/, `${relativePath} must use the Popup body`);
    assert.match(source, /className="diet-popup__footer"/, `${relativePath} must use the Popup footer`);
    assert.doesNotMatch(source, /roma-modal/, `${relativePath} must not retain the Roma modal base`);
  }

  const accountNotice = await readRoute('components/roma-account-notice-modal.tsx');
  assert.match(accountNotice, /className="diet-popup"/, 'account notice must consume Dieter Popup');
  assert.match(accountNotice, /className="diet-popup__header"/, 'account notice must use the Popup header');
  assert.match(accountNotice, /className="diet-popup__footer"/, 'account notice must use the Popup footer');
  assert.doesNotMatch(accountNotice, /className="diet-popup__body"/, 'account notice must not retain invented body copy');

  for (const relativePath of [
    'components/assets-domain.tsx',
    'components/widget-copy-code-dialog.tsx',
    'components/roma-upsell-dialog.tsx',
  ]) {
    const source = await readRoute(relativePath);
    assert.match(source, /diet-popup__dismiss/, `${relativePath} must compose the optional Popup dismiss action`);
    assert.match(source, /data-icon="multiply"/, `${relativePath} must use the Dieter multiply Icon`);
  }

  for (const relativePath of [
    'components/roma-account-notice-modal.tsx',
    'components/roma-command-confirmation-dialog.tsx',
    'components/roma-unsaved-changes-dialog.tsx',
  ]) {
    const source = await readRoute(relativePath);
    assert.doesNotMatch(source, /diet-popup__dismiss/, `${relativePath} must retain its required-decision dismissal policy`);
  }
}

async function run(): Promise<void> {
  await testPublishGateBeforeTransition();
  console.log('PASS Publish prechecks before materialization and Tokyo atomically backs the transition');
  await testDeleteDoesNotDependOnRetiredPages();
  console.log('PASS instance deletion has no retired Pages dependency');
  await testRomaOwnsBuilderPublicationChrome();
  console.log('PASS Roma owns Builder publication chrome while Bob remains Save-only');
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
