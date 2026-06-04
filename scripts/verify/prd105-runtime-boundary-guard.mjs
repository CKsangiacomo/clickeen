#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const ACTIVE_ROOTS = [
  'tokyo-worker/src/',
  'roma/',
  'bob/',
  'prague/src/',
  'sanfrancisco/src/',
  'packages/',
];

const SKIP_PATTERNS = [
  /\.test\.[cm]?[jt]sx?$/,
  /\.spec\.[cm]?[jt]sx?$/,
  /\/dist\//,
  /\/node_modules\//,
];

const BANNED = [
  {
    label: 'queuedLocales product API field',
    pattern: /\bqueuedLocales\b/,
  },
  {
    label: 'legacy embedded translation migration helper',
    pattern: /\b(?:hasLegacyEmbeddedTranslationStorage|extractLegacyEmbeddedTranslatedValues|migrateLegacyEmbeddedTranslationsToOverlays)\b/,
  },
  {
    label: 'R2 translation generation job document',
    pattern: /translation-generation-job\.json/,
  },
];

function trackedFiles() {
  return execFileSync('git', ['ls-files'], { encoding: 'utf8' })
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function shouldScan(file) {
  return ACTIVE_ROOTS.some((root) => file.startsWith(root)) && !SKIP_PATTERNS.some((pattern) => pattern.test(file));
}

function lineFor(text, index) {
  return text.slice(0, index).split('\n').length;
}

const failures = [];

for (const file of trackedFiles()) {
  if (!shouldScan(file) || !existsSync(file)) continue;
  const text = readFileSync(file, 'utf8');
  for (const entry of BANNED) {
    const match = entry.pattern.exec(text);
    if (!match) continue;
    failures.push({
      file,
      line: lineFor(text, match.index),
      label: entry.label,
      match: match[0],
    });
  }
}

if (failures.length) {
  console.error('[prd105-runtime-boundary-guard] PRD 105 boundary violations found:');
  for (const failure of failures) {
    console.error(`- ${failure.file}:${failure.line} ${failure.label}: ${failure.match}`);
  }
  process.exit(1);
}

console.log('[prd105-runtime-boundary-guard] ok');
