import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createBlankPageDraft } from '../components/page-builder-model';
import { normalizeRomaPagesResponse } from '../components/use-roma-pages';

async function read(relativePath: string): Promise<string> {
  return readFile(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

function assertBefore(source: string, earlier: string | RegExp, later: string | RegExp): void {
  const first = typeof earlier === 'string' ? source.indexOf(earlier) : source.search(earlier);
  const second = typeof later === 'string' ? source.indexOf(later) : source.search(later);
  assert.notEqual(first, -1, `Missing ${String(earlier)}`);
  assert.notEqual(second, -1, `Missing ${String(later)}`);
  assert.ok(first < second, `${String(earlier)} must appear before ${String(later)}`);
}

async function main() {
  assert.deepEqual(createBlankPageDraft('en-US'), {
    displayName: 'Untitled page',
    isTemplate: false,
    baseLocale: 'en-US',
    values: { title: '' },
    robots: 'index-follow',
    placements: [],
  });

  const inventory = normalizeRomaPagesResponse({
    accountId: 'CLICKEEN',
    pages: [{
      source: {
        pageId: '7UZXTP3TOI',
        displayName: 'Summer page',
        isTemplate: false,
        baseLocale: 'en-US',
        values: { title: 'Summer' },
        robots: 'index-follow',
        placements: [],
      },
      serveState: { published: false, needsUpdate: false },
      savedLocales: ['en-US'],
    }],
  });
  assert.equal(inventory?.pages[0]?.source.displayName, 'Summer page');
  assert.equal(normalizeRomaPagesResponse({ accountId: 'CLICKEEN', pages: [{ source: {}, serveState: {}, savedLocales: [] }] }), null);

  const builder = await read('components/page-builder.tsx');
  const content = await read('components/page-builder-content.tsx');
  const seo = await read('components/page-builder-seo.tsx');
  const imageUpload = await read('components/dieter-image-upload.tsx');
  const workspace = await read('components/page-workspace.tsx');
  const list = await read('components/page-list.tsx');
  const domains = await read('lib/domains.ts');
  const bob = await read('components/builder-domain.tsx');
  const bobTopDrawer = await readFile(new URL('../../bob/components/TopDrawer.tsx', import.meta.url), 'utf8');
  const bobCss = await readFile(new URL('../../bob/app/bob_app.css', import.meta.url), 'utf8');
  const editorShell = await readFile(new URL('../../bob/lib/editor-shell.css', import.meta.url), 'utf8');
  const romaCss = await read('app/roma.css');
  const productDefaults = await readFile(new URL('../../packages/widget-shell/src/defaults.ts', import.meta.url), 'utf8');
  const newPageRoute = await read('app/(authed)/page-builder/new/page.tsx');
  const savedPageRoute = await read('app/(authed)/page-builder/[pageId]/page.tsx');

  assert.match(domains, /key: 'pages', label: 'Pages', href: '\/pages'/);
  assert.match(newPageRoute, /<PageBuilder \/>/);
  assert.match(savedPageRoute, /<PageBuilder pageId=\{pageId\} \/>/);
  assert.match(list, /['"]\/page-builder\/new['"]/);
  assert.match(list, /`\/page-builder\/\$\{encodeURIComponent\(id\)\}`/);
  assert.match(builder, /createCompactPageId\(\)/);
  assertBefore(builder, 'generatePageDraft({', "accountApi.fetchJson('/api/account/pages'");
  assert.match(builder, /currentPageId \|\| createCompactPageId\(\)/);
  assert.match(builder, /const sourceForSave: PageDraftSource = \{ \.\.\.source, baseLocale \}/);
  assertBefore(builder, 'setPreviewingGenerated(true)', 'await nextPaint()');
  assertBefore(builder, 'await nextPaint()', 'const completeSource: AccountPage');
  assert.match(builder, /clearRomaPagesCache\(accountContext\.accountPublicId\)/);
  assert.match(builder, /if \(!generated\.overlaysJson\) throw new Error\('Page overlay output is missing\.'\)/);
  assert.doesNotMatch(builder, /generated\.overlaysJson \?\? \{\}/);
  assert.match(builder, /if \(pageId && loadFailed\)/);
  assert.match(builder, /if \(isNotFoundError\(placementError\)\) return unavailablePlacement/);
  assert.match(builder, /payload\?\.overlay\?\.values/);
  assert.match(builder, /accountPolicy\.role !== 'viewer'/);
  assert.match(builder, /\}, \[loading, router\]\)/);
  assert.match(builder, /onClick=\{\(\) => void save\(needsUpdate\)\}/);
  assert.match(builder, /onClick=\{\(\) => void changePublished\(true\)\}/);
  assert.match(builder, /Delete page\?/);
  assert.match(builder, /setDeleteOpen\(true\)/);
  assert.doesNotMatch(builder, /changePublished[\s\S]{0,500}generatePageDraft/);
  assert.match(builder, /activePanel === 'content'/);
  assert.match(builder, />Content</);
  assert.match(builder, />SEO\/GEO\/AEO</);
  assert.doesNotMatch(builder, />Languages<|>Translations<|>Meta</);
  assert.match(builder, /embedded returnLabel="Done, go back to the page"/);
  assert.match(builder, /contextMessage="You're editing the saved widget\. Other pages using it will also need updating\."/);
  assert.match(builder, /freshEntryBlocked && needsUpdate/);
  assert.match(builder, /setFreshEntryBlocked\(detail\.serveState\.needsUpdate\)/);
  assert.match(builder, /setFreshEntryBlocked\(false\)/);
  assert.match(builder, /readTranslationResult/);
  assert.match(builder, /typeof value\.accepted !== 'boolean'/);
  assert.match(builder, /No translation languages are available for this page\./);
  assert.match(builder, /setNotice\(null\);[\s\S]{0,100}try \{/);
  assert.match(builder, /We couldn't update this page\. Try again\./);
  assert.match(builder, /We couldn't save this page\. Try again\./);
  assert.match(builder, /Translations generated, but failed/);
  assert.match(builder, /Generate translations for: \$\{missingLocales\.join\(', '\)\} before publishing\./);
  assert.match(builder, />Copy URL</);
  assert.match(builder, />Copy code</);
  assert.match(builder, />Unpublish</);
  assert.match(builder, /currentPageId \? 'Current' : 'Unsaved'/);
  assert.match(bob, /embedded\?: boolean/);
  assert.match(bob, /if \(embedded \|\| !activeInstanceId\) return/);
  assert.match(bobTopDrawer, /returnLabel/);

  assert.match(content, /Filter widgets by publish status/);
  assert.match(content, /Show published/);
  assert.match(content, /Show unpublished/);
  assert.match(content, /aria-label="Sort by widget"/);
  assert.match(content, /aria-label="Sort by instance name"/);
  assert.match(content, /aria-label="Sort by published status"/);
  assert.match(content, /Add to page/);
  assert.match(content, /On page/);
  assert.match(content, /Manage order/);
  assert.match(content, /diet-object-manager__modal-row/);
  assert.match(content, /createDialogLifecycle/);
  assert.match(content, /const loadInstances = useCallback/);
  assert.match(content, />Retry</);
  assert.match(content, /requestOrderDismissRef/);
  assert.match(content, /placementRowsRef\.current\.get\(selectedPlacementId\)\?\.scrollIntoView/);
  assert.match(content, /<RomaUnsavedChangesDialog/);
  assert.match(content, /onKeepEditing=\{\(\) => \{ setOrderDiscardOpen\(false\); setOrderOpen\(true\); \}\}/);

  assert.match(seo, /Page title/);
  assert.match(seo, /Meta description/);
  assert.match(seo, /Social title/);
  assert.match(seo, /Social description/);
  assert.match(seo, /Generate translations/);
  assert.match(seo, /Index this page/);
  assert.match(seo, /Hide this page/);
  assert.doesNotMatch(seo, /schema editor|structured data/i);
  assert.match(seo, /<DieterImageUpload/);
  assert.match(imageUpload, /accept="image\/\*"/);
  assert.match(imageUpload, />Upload new image</);
  assert.match(imageUpload, />Remove</);
  assert.match(imageUpload, /onUpsell\(\)/);

  assert.match(workspace, /attachShadow\(\{ mode: 'open' \}\)/);
  assert.match(workspace, /scrollIntoView/);
  assert.match(workspace, /onClick=\{onAdd\}/);
  assert.match(workspace, /data-ck-page-editor-placement/);
  assert.match(workspace, /runRuntime\(args\.container, args\.files\.runtimeJs\)/);
  assert.match(workspace, /runRuntime\(host, placement\.files\.runtimeJs\)/);
  assert.doesNotMatch(workspace, /iframe|srcdoc|#[0-9a-f]{3,8}/i);
  assert.doesNotMatch(workspace, /clk\.live|publicUrl|iframeSnippet/);
  assert.match(romaCss, /\.roma-page-workspace__placement\[aria-current='true'\] \{ border-color:var\(--role-focus\); \}/);
  assert.doesNotMatch(romaCss, /\.roma-page-workspace[^\n]*#[0-9a-f]{3,8}/i);
  assert.match(list, /buildPagePublicActions/);
  assert.match(list, /\/rename`, \{ method: 'POST'/);
  assert.match(list, /accountPolicy\.role !== 'viewer'/);
  assert.match(list, /if \(!canUsePages\) \{ setUpsellOpen\(true\); return; \} void mutate\(statusKey/);
  assert.match(list, /if \(!canUsePages\) \{ setUpsellOpen\(true\); return; \} setRenamePage\(page\)/);
  assert.match(list, /<PublicCodeDialog/);
  assert.doesNotMatch(list, /iframe|runtime\.js/);

  assert.match(editorShell, /\.builder-app/);
  assert.doesNotMatch(bobCss, /^\.builder-app\s*\{/m);
  assert.doesNotMatch(bobCss, /^\.editor-content\s*\{/m);
  assert.doesNotMatch(bobCss, /^\.tooldrawer\s*\{/m);
  assert.doesNotMatch(bobCss, /^\.workspace\s*\{/m);
  assert.match(productDefaults, /href: 'https:\/\/clickeen\.com\/'/);
  assert.doesNotMatch(productDefaults, /www\.clickeen\.com/);

  console.log('Roma Page Builder contract verification passed.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
