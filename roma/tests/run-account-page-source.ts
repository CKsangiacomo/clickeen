import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pageIdsPlacingInstance, parseAccountPageSource } from '../lib/account-page-contract';
import { resolvePageProductPolicy } from '../lib/account-page-policy';

async function main() {
  const ordinaryPage = {
    pageId: '7UZXTP3TOI',
    displayName: 'Summer page',
    isTemplate: false,
    baseLocale: 'en-US',
    values: {
      title: 'Summer',
      description: 'A summer page',
    },
    robots: 'index-follow',
    placements: [
      { placementId: 'hero', instanceId: 'QD1G068MX7' },
      { placementId: 'faq', instanceId: 'I5918UU0IA' },
    ],
  } as const;

  const parsed = parseAccountPageSource(ordinaryPage);
  assert.deepEqual(parsed, ordinaryPage);
  assert.deepEqual(
    parseAccountPageSource({ ...ordinaryPage, baseLocale: 'fil' }),
    { ...ordinaryPage, baseLocale: 'fil' },
    'canonical three-letter locales must remain valid Page source',
  );
  assert.deepEqual(pageIdsPlacingInstance({ sources: [parsed!], instanceId: 'QD1G068MX7' }), [
    '7UZXTP3TOI',
  ]);

  assert.equal(
    parseAccountPageSource({ ...ordinaryPage, revision: 1 }),
    null,
    'unknown legacy fields must fail',
  );
  assert.equal(
    parseAccountPageSource({ ...ordinaryPage, robots: 'index,follow' }),
    null,
    'legacy robots values must fail',
  );
  assert.equal(
    parseAccountPageSource({
      ...ordinaryPage,
      placements: [...ordinaryPage.placements, ordinaryPage.placements[0]],
    }),
    null,
    'duplicate placements must fail',
  );

  const template = {
    pageId: '8UZXTP3TOI',
    displayName: 'Reusable page',
    isTemplate: true,
    values: { title: 'Template' },
    robots: 'noindex-follow',
    placements: [],
  } as const;
  assert.deepEqual(parseAccountPageSource(template), template);
  assert.equal(
    parseAccountPageSource({ ...template, baseLocale: 'en' }),
    null,
    'templates must reject locale state',
  );

  const authz = (profile: 'free' | 'tier2' | 'tier99') => ({
    profile,
    role: 'owner',
    entitlements: null,
  }) as Parameters<typeof resolvePageProductPolicy>[0];
  assert.deepEqual(
    resolvePageProductPolicy(authz('free'), 'open_page'),
    {
      ok: false,
      status: 402,
      payload: {
        ok: false,
        kind: 'UPGRADE_REQUIRED',
        upgrade: { gate: 'pages.max', action: 'open_page', current: 0, limit: 0 },
      },
    },
    'a zero Page limit must keep retained inventory visible but deny Page product actions',
  );
  assert.deepEqual(resolvePageProductPolicy(authz('tier2'), 'save_page'), { ok: true, limit: 3 });
  assert.deepEqual(resolvePageProductPolicy(authz('tier99'), 'publish_page'), { ok: true, limit: null });

  const createRoute = await readFile(
    new URL('../app/api/account/pages/route.ts', import.meta.url),
    'utf8',
  );
  const limitGate = createRoute.indexOf(
    'if (limit !== null && existing.value.sources.length >= limit)',
  );
  assert.ok(limitGate > 0, 'Page first Save must enforce pages.max');
  assert.ok(
    limitGate < createRoute.indexOf('createCompactPageId()'),
    'pages.max must run before Page ID minting',
  );
  assert.ok(
    limitGate < createRoute.indexOf('createAccountPage({'),
    'pages.max must run before Tokyo writes',
  );
  assert.match(createRoute, /resolvePageProductPolicy\(current\.value\.authzPayload, 'save_page'\)/);

  await assert.rejects(
    readFile(new URL('../app/(authed)/pages/page.tsx', import.meta.url), 'utf8'),
    /ENOENT/,
    '127A must not retain the obsolete Page UI',
  );
  const saveRoute = await readFile(
    new URL('../app/api/account/pages/[pageId]/route.ts', import.meta.url),
    'utf8',
  );
  const pageClient = await readFile(new URL('../lib/account-pages.ts', import.meta.url), 'utf8');
  const publishRoute = await readFile(
    new URL('../app/api/account/pages/[pageId]/publish/route.ts', import.meta.url),
    'utf8',
  );
  assert.match(createRoute, /parseGeneratedFiles\(bodyResult\.payload\?\.files\)/);
  assert.match(createRoute, /overlaysJson = bodyResult\.payload\?\.overlaysJson/);
  assert.match(saveRoute, /parseGeneratedFiles\(bodyResult\.payload\?\.files\)/);
  assert.match(saveRoute, /overlaysJson = bodyResult\.payload\?\.overlaysJson/);
  assert.match(
    saveRoute,
    /if \(submitted\.baseLocale !== locales\.localePolicy\.baseLocale\)/,
    'Page Update must reject a submitted package generated for a different account base locale',
  );
  assert.doesNotMatch(
    saveRoute,
    /source = \{ \.\.\.submitted, baseLocale: locales\.localePolicy\.baseLocale \}/,
    'Page Update must never rewrite the submitted source locale',
  );
  assert.match(
    saveRoute,
    /source: submitted/,
    'a matching submitted Page source must pass unchanged to Tokyo',
  );
  assert.match(saveRoute, /pageAccess\(request, current, 'open_page'\)/);
  assert.match(saveRoute, /pageAccess\(request, current, 'save_page'\)/);
  assert.match(saveRoute, /pageAccess\(request, current, 'delete_page'\)/);
  assert.match(pageClient, /body: \{ source: args\.source, files: args\.files, overlaysJson: args\.overlaysJson \}/);
  assert.match(publishRoute, /publishAccountPage\(/);
  assert.match(publishRoute, /resolvePageProductPolicy\(current\.value\.authzPayload, 'publish_page'\)/);

  console.log('Roma Page source contract verification passed.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
