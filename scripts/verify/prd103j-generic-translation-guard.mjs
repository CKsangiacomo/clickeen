#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();

const SCANNED_FILES = [
  'packages/ck-contracts/src/instance-translation-jobs.ts',
  'tokyo-worker/src/domains/account-translations/operations.ts',
  'sanfrancisco/src/instance-translation-queue.ts',
];

const FORBIDDEN_SNIPPETS = [
  'FaqSavedTextField',
  'FaqLanguageValue',
  'buildFaqSavedTextGraph',
  "widgetType: 'faq'",
  'widgetType !== \'faq\'',
];

let failed = false;

for (const relativePath of SCANNED_FILES) {
  const absolutePath = join(ROOT, relativePath);
  const source = readFileSync(absolutePath, 'utf8');
  for (const snippet of FORBIDDEN_SNIPPETS) {
    if (source.includes(snippet)) {
      console.error(`[prd103j-generic-translation-guard] ${relativePath} contains forbidden product translation snippet: ${snippet}`);
      failed = true;
    }
  }
}

if (failed) process.exit(1);

console.log('[prd103j-generic-translation-guard] ok');
