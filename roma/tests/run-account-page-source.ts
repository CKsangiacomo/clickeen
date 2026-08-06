import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pageIdsPlacingInstance, parseAccountPageSource } from '../lib/account-page-contract';

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
  assert.match(createRoute, /readPolicyLimit\(policy, 'pages\.max'\)/);

  await assert.rejects(
    readFile(new URL('../app/(authed)/pages/page.tsx', import.meta.url), 'utf8'),
    /ENOENT/,
    '127A must not retain the obsolete Page UI',
  );
  await assert.rejects(
    readFile(
      new URL('../app/api/account/pages/[pageId]/publish/route.ts', import.meta.url),
      'utf8',
    ),
    /ENOENT/,
    '127A must not retain obsolete Page publication routes',
  );

  console.log('Roma Page source contract verification passed.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
