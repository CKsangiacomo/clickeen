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
  const workspace = await read('components/page-workspace.tsx');
  const list = await read('components/page-list.tsx');
  const domains = await read('lib/domains.ts');
  const bob = await read('components/builder-domain.tsx');
  const bobTopDrawer = await readFile(new URL('../../bob/components/TopDrawer.tsx', import.meta.url), 'utf8');
  const bobCss = await readFile(new URL('../../bob/app/bob_app.css', import.meta.url), 'utf8');
  const editorShell = await readFile(new URL('../../bob/lib/editor-shell.css', import.meta.url), 'utf8');
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
  assert.match(builder, /onClick=\{\(\) => void save\(needsUpdate\)\}/);
  assert.match(builder, /onClick=\{\(\) => void changePublished\(true\)\}/);
  assert.doesNotMatch(builder, /changePublished[\s\S]{0,500}generatePageDraft/);
  assert.match(builder, /activePanel === 'content'/);
  assert.match(builder, />Content</);
  assert.match(builder, />SEO\/GEO\/AEO</);
  assert.doesNotMatch(builder, />Languages<|>Translations<|>Meta</);
  assert.match(builder, /embedded returnLabel="Done, go back to the page"/);
  assert.match(builder, /contextMessage="You are editing a saved widget\./);
  assert.match(bob, /embedded\?: boolean/);
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

  assert.match(seo, /Page title/);
  assert.match(seo, /Meta description/);
  assert.match(seo, /Social title/);
  assert.match(seo, /Social description/);
  assert.match(seo, /Generate translations/);
  assert.match(seo, /Index this page/);
  assert.match(seo, /Hide this page/);
  assert.doesNotMatch(seo, /schema editor|structured data/i);

  assert.match(workspace, /srcdoc/);
  assert.match(workspace, /data-ck-page-editor-placement/);
  assert.doesNotMatch(workspace, /clk\.live|publicUrl|iframeSnippet/);
  assert.match(list, /buildPagePublicActions/);
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
