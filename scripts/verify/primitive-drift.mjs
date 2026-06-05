#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();

const APPROVED_CANONICAL_FILES = new Set([
  'packages/ck-contracts/src/index.ts',
]);

const SCANNED_PATHS = [
  'bob/components/CopilotPane.tsx',
  'bob/components/td-menu-content/linkedOps.ts',
  'bob/components/useTranslationPreviewState.ts',
  'bob/lib/compiler.server.ts',
  'bob/lib/compiler/editor-contract.ts',
  'bob/lib/compiler/modules/normalization.ts',
  'prague/src/lib/widgetLabels.ts',
  'roma/app/api/account/instances/[instanceId]/copilot/route.ts',
  'roma/app/api/account/locales/route.ts',
  'roma/components/use-roma-me.ts',
  'roma/lib/auth/session.ts',
  'tokyo-worker/src/domains/account-instances/registry.ts',
  'tokyo-worker/src/domains/account-instances/normalize.ts',
  'tokyo-worker/src/domains/widget-definitions.ts',
  ...APPROVED_CANONICAL_FILES,
];

const PRIMITIVE_DEFINITIONS = [
  'isRecord',
  'isPlainRecord',
  'isPlainObject',
  'asTrimmedString',
  'decodeJwtPayload',
  'tokenIsExpired',
];

const FORBIDDEN_PRODUCT_AUTHORITY_PATHS = [
  'scripts/build-widget-catalog.mjs',
  'scripts/prague-sync.mjs',
  'tokyo/product/widgets/manifest.json',
  'tokyo/prague/l10n',
  'tokyo-worker/src/generated/widget-seo-geo-registry.ts',
  'tokyo-worker/src/domains/account-translations/generation-status.ts',
  'tokyo-worker/src/domains/account-translations/generation-status.test.ts',
  'tokyo-worker/src/domains/account-translations/queue.ts',
  'tokyo-worker/src/queue-handler.ts',
  'sanfrancisco/src/embed-file-writer.ts',
  'sanfrancisco/src/embed-file-writer.test.ts',
  'sanfrancisco/src/widget-generation-jobs.ts',
  'sanfrancisco/src/widget-generation-jobs.test.ts',
];

const FORBIDDEN_PRODUCT_AUTHORITY_SNIPPETS = [
  {
    relativePath: 'tokyo-worker/src/routes/internal-instance-routes.ts',
    snippet: '/__internal/renders/widgets/catalog.json',
    label: 'deleted generated widget catalog route',
  },
  {
    relativePath: 'tokyo-worker/src/routes/internal-instance-routes.ts',
    snippet: '/__internal/renders/widgets/',
    label: 'storage-shaped widget render route',
  },
  {
    relativePath: 'tokyo-worker/src/routes/internal-product-route-utils.ts',
    snippet: 'SavedRender',
    label: 'saved-render vocabulary in product-control route boundary',
  },
  {
    relativePath: 'tokyo-worker/src/route-helpers.ts',
    snippet: 'SavedRender',
    label: 'saved-render vocabulary in product-control auth helper',
  },
  {
    relativePath: 'tokyo-worker/src/domains/account-instances/source.ts',
    snippet: 'SavedRender',
    label: 'saved-render vocabulary in account instance source',
  },
  {
    relativePath: 'tokyo-worker/src/domains/account-instances/operations.ts',
    snippet: 'SavedRender',
    label: 'saved-render vocabulary in account instance operations',
  },
  {
    relativePath: 'roma/lib/account-instance-direct.ts',
    snippet: '/__internal/renders/widgets/',
    label: 'Roma storage-shaped Tokyo route',
  },
  {
    relativePath: 'roma/lib/account-instance-direct.ts',
    snippet: 'serve-state',
    label: 'Roma serve-state storage vocabulary',
  },
  {
    relativePath: 'roma/lib/account-instance-direct.ts',
    snippet: 'saved.json',
    label: 'Roma saved-render storage route',
  },
  {
    relativePath: 'roma/lib/account-instance-direct.ts',
    snippet: 'save.json',
    label: 'Roma saved-render storage route',
  },
  {
    relativePath: 'roma/lib/account-instance-direct.ts',
    snippet: 'sourceVersion',
    label: 'Roma sourceVersion product-boundary vocabulary',
  },
  {
    relativePath: 'roma/lib/account-instance-direct.ts',
    snippet: 'overlayId',
    label: 'Roma overlay ID product-boundary vocabulary',
  },
  {
    relativePath: 'bob/lib/session/sessionTypes.ts',
    snippet: 'locale-overlay',
    label: 'Bob locale-overlay session command',
  },
  {
    relativePath: 'bob/lib/session/sessionTypes.ts',
    snippet: 'overlayId',
    label: 'Bob overlay ID session payload',
  },
  {
    relativePath: 'bob/components/useTranslationPreviewState.ts',
    snippet: 'locale-overlay',
    label: 'Bob locale-overlay preview vocabulary',
  },
  {
    relativePath: 'bob/components/useTranslationPreviewState.ts',
    snippet: 'overlayId',
    label: 'Bob overlay ID preview payload',
  },
  {
    relativePath: 'sanfrancisco/src/tokyo-translation-client.ts',
    snippet: '/__internal/overlays',
    label: 'San Francisco overlay storage completion route',
  },
  {
    relativePath: 'sanfrancisco/src/tokyo-translation-client.ts',
    snippet: 'overlayId',
    label: 'San Francisco overlay ID completion payload',
  },
  {
    relativePath: 'tokyo-worker/src/types.ts',
    snippet: 'RENDER_SNAPSHOT_QUEUE',
    label: 'mirror/snapshot queue binding',
  },
  {
    relativePath: 'tokyo-worker/wrangler.toml',
    snippet: 'RENDER_SNAPSHOT_QUEUE',
    label: 'mirror/snapshot queue binding',
  },
  {
    relativePath: 'tokyo-worker/package.json',
    snippet: 'instance-render-snapshot',
    label: 'mirror/snapshot queue provisioning',
  },
  {
    relativePath: 'tokyo-worker/src/domains/widget-definitions.ts',
    snippet: 'WidgetOverlayContract',
    label: 'generated overlay-shaped widget field contract',
  },
  {
    relativePath: 'scripts/verify/prd103-publish-language-files.test.ts',
    snippet: 'runEmbedFileWriter',
    label: 'San Francisco-owned embed writer in publish verifier',
  },
  {
    relativePath: 'scripts/verify/prd103-publish-language-files.test.ts',
    snippet: 'sourceVersion',
    label: 'sourceVersion in publish verifier',
  },
  {
    relativePath: 'scripts/verify/prd103-publish-language-files.test.ts',
    snippet: 'script.v',
    label: 'versioned support filename in publish verifier',
  },
  {
    relativePath: 'scripts/verify/prd103-publish-language-files.test.ts',
    snippet: '/overlays/',
    label: 'overlay storage path in publish verifier',
  },
];

const definitionPattern = new RegExp(
  String.raw`\b(?:export\s+)?(?:function|const)\s+(${PRIMITIVE_DEFINITIONS.join('|')})\b`,
  'g',
);

const failures = [];

for (const relativePath of FORBIDDEN_PRODUCT_AUTHORITY_PATHS) {
  if (existsSync(join(ROOT, relativePath))) {
    failures.push({ relativePath, primitive: 'deleted product authority path' });
  }
}

for (const { relativePath, snippet, label } of FORBIDDEN_PRODUCT_AUTHORITY_SNIPPETS) {
  const absolutePath = join(ROOT, relativePath);
  if (!existsSync(absolutePath)) continue;
  if (readFileSync(absolutePath, 'utf8').includes(snippet)) {
    failures.push({ relativePath, primitive: label });
  }
}

const widgetsRoot = join(ROOT, 'tokyo/product/widgets');
for (const entry of readdirSync(widgetsRoot, { withFileTypes: true })) {
  if (!entry.isDirectory() || entry.name === 'shared') continue;
  for (const deletedFile of ['agent.md', 'catalog.json', 'content.json', 'seo-geo.ts']) {
    const relativePath = `tokyo/product/widgets/${entry.name}/${deletedFile}`;
    if (existsSync(join(ROOT, relativePath))) {
      failures.push({ relativePath, primitive: 'deleted widget source path' });
    }
  }
  const specPath = `tokyo/product/widgets/${entry.name}/spec.json`;
  const spec = JSON.parse(readFileSync(join(ROOT, specPath), 'utf8'));
  if (spec?.overlays && Array.isArray(spec.overlays.text)) {
    failures.push({ relativePath: specPath, primitive: 'deleted spec.overlays.text authority' });
  }
}

for (const relativePath of SCANNED_PATHS) {
  const source = readFileSync(join(ROOT, relativePath), 'utf8');
  for (const match of source.matchAll(definitionPattern)) {
    const primitive = match[1];
    if (APPROVED_CANONICAL_FILES.has(relativePath)) continue;
    failures.push({ relativePath, primitive });
  }
}

if (failures.length) {
  console.error('Primitive drift check failed.');
  console.error('Use canonical primitives from @clickeen/ck-contracts instead of adding local copies.');
  for (const failure of failures) {
    console.error(`- ${failure.relativePath}: local ${failure.primitive} definition`);
  }
  process.exit(1);
}

console.log('Primitive drift check passed.');
