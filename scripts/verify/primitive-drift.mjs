#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();

const APPROVED_CANONICAL_FILES = new Set([
  'packages/ck-contracts/src/index.ts',
]);

const SCANNED_PATHS = [
  'bob/components/CopilotPane.tsx',
  'bob/components/td-menu-content/linkedOps.ts',
  'bob/components/useLocaleOverlayPreviewState.ts',
  'bob/lib/compiler.server.ts',
  'bob/lib/compiler/editor-contract.ts',
  'bob/lib/compiler/modules/normalization.ts',
  'prague/src/lib/widgetCatalog.ts',
  'roma/app/api/account/instances/[instanceId]/copilot/route.ts',
  'roma/app/api/account/locales/route.ts',
  'roma/components/use-roma-me.ts',
  'roma/lib/auth/session.ts',
  'tokyo-worker/src/domains/render/instance-index.ts',
  'tokyo-worker/src/domains/render/normalize.ts',
  'tokyo-worker/src/domains/widget-catalog.ts',
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

const definitionPattern = new RegExp(
  String.raw`\b(?:export\s+)?(?:function|const)\s+(${PRIMITIVE_DEFINITIONS.join('|')})\b`,
  'g',
);

const failures = [];

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
