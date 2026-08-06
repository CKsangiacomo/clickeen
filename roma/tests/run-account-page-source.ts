import assert from 'node:assert/strict';
import {
  normalizeAccountPageSource,
  pageIdsPlacingInstance,
} from '../lib/account-page-source';

const storedPageSource = {
  accountPublicId: 'CLICKEEN',
  createdAt: '2026-06-23T16:08:16.899Z',
  displayName: 'Untitled page',
  localization: {
    countryLocaleRules: [],
    defaultLocale: 'en',
    ipLocalizationEnabled: false,
    languageSwitcherEnabled: false,
    missingLocaleBehavior: 'block_publish',
  },
  metadata: {
    description: '',
    robots: 'index,follow',
    title: 'Widgets - Faq Overview',
  },
  pageId: '7UZXTP3TOI',
  placements: [
    {
      instanceId: 'QD1G068MX7',
      placementId: 'P001',
    },
    {
      instanceId: 'I5918UU0IA',
      placementId: 'P002',
    },
  ],
  schemaVersion: 1,
  updatedAt: '2026-06-23T16:12:17.816Z',
  version: 4,
};

function testStoredVersionNormalizesAsRevision() {
  const normalized = normalizeAccountPageSource(storedPageSource);
  assert.ok(normalized);
  assert.equal(normalized.revision, 4);
  assert.deepEqual(
    pageIdsPlacingInstance({
      sources: [normalized],
      instanceId: 'QD1G068MX7',
    }),
    ['7UZXTP3TOI'],
  );
}

function testMissingRevisionAndVersionStillFails() {
  const { version, ...withoutRevision } = storedPageSource;
  void version;
  assert.equal(normalizeAccountPageSource(withoutRevision), null);
}

const tests = [
  ['stored page version normalizes as revision', testStoredVersionNormalizesAsRevision],
  ['missing revision and version still fails', testMissingRevisionAndVersionStillFails],
] as const;

let failed = false;
for (const [name, run] of tests) {
  try {
    run();
    console.log(`PASS ${name}`);
  } catch (error) {
    failed = true;
    console.error(`FAIL ${name}`);
    console.error(error);
  }
}

if (failed) process.exit(1);
