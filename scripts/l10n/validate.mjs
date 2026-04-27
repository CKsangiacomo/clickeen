#!/usr/bin/env node
/* eslint-disable no-console */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');

const forbiddenRepoSource = path.join(repoRoot, 'tokyo', ['admin', 'owned'].join('-'), 'l10n');

if (fs.existsSync(forbiddenRepoSource)) {
  console.error('[l10n] Forbidden repo-owned instance l10n source exists:', forbiddenRepoSource);
  process.exit(1);
}

console.log('[l10n] OK: no repo-owned account instance l10n source is present.');
