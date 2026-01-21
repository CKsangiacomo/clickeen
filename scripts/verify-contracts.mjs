#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

function readFile(relPath) {
  return fs.readFileSync(path.join(repoRoot, relPath), 'utf8');
}

function assertIncludes(file, tokens) {
  const contents = readFile(file);
  for (const token of tokens) {
    if (!contents.includes(token)) {
      throw new Error(`[contracts] ${file} missing required token: ${token}`);
    }
  }
}

function assertExcludes(file, tokens) {
  const contents = readFile(file);
  for (const token of tokens) {
    if (contents.includes(token)) {
      throw new Error(`[contracts] ${file} contains forbidden token: ${token}`);
    }
  }
}

function main() {
  assertExcludes('venice/lib/tokyo.ts', ["cache: 'no-store'", 'cache: "no-store"']);
  assertIncludes('venice/lib/l10n.ts', ['/l10n/instances/', 'index.json']);

  assertIncludes('tokyo-worker/src/index.ts', ['l10n/instances/${publicId}/${locale}/', 'l10n/instances/${publicId}/index.json']);
  assertExcludes('tokyo/dev-server.mjs', ['l10n/manifest.json']);

  console.log('[contracts] OK');
}

main();
