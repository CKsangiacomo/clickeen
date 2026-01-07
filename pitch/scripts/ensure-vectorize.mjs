#!/usr/bin/env node
/* eslint-disable no-console */

import { spawnSync } from 'node:child_process';

const INDEX_NAME = process.env.PITCH_DOCS_INDEX_NAME || 'clickeen-pitch-docs';
const DIMENSIONS = '1536';
const METRIC = 'cosine';

function run(cmd, args) {
  const res = spawnSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  return {
    status: res.status ?? 1,
    stdout: String(res.stdout ?? ''),
    stderr: String(res.stderr ?? ''),
  };
}

function isAlreadyExists(stderr) {
  const s = stderr.toLowerCase();
  return s.includes('already exists') || (s.includes('already') && s.includes('exist')) || s.includes('name already in use');
}

function main() {
  console.log(`[pitch] ensuring Vectorize index exists: ${INDEX_NAME}`);
  const res = run('wrangler', ['vectorize', 'create', INDEX_NAME, '--dimensions', DIMENSIONS, '--metric', METRIC]);
  if (res.status === 0) {
    console.log(`[pitch] Vectorize index created: ${INDEX_NAME}`);
    return;
  }
  if (isAlreadyExists(res.stderr)) {
    console.log(`[pitch] Vectorize index already exists: ${INDEX_NAME}`);
    return;
  }
  console.error(res.stdout);
  console.error(res.stderr);
  process.exit(res.status || 1);
}

main();


