#!/usr/bin/env node

/**
 * Local helper: sync the Dieter design system into Denver's asset tree.
 *
 * This is a DEV-ONLY convenience so that Denver can serve Dieter from a single
 * CDN-style base URL (http://localhost:4000/dieter/...) without duplicating
 * source of truth. The authoritative source remains the top-level `dieter/`
 * directory; this script just copies it into `denver/dieter/`.
 */

import fs from 'node:fs';
import path from 'node:path';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const rootDir = path.resolve(__dirname, '..');
const sourceDir = path.join(rootDir, 'dieter');
const targetDir = path.join(rootDir, 'denver', 'dieter');

function main() {
  if (!fs.existsSync(sourceDir)) {
    console.error('[sync-dieter-to-denver] Source directory not found:', sourceDir);
    process.exit(1);
  }

  // Ensure parent exists
  fs.mkdirSync(path.dirname(targetDir), { recursive: true });

  // Remove any previous copy so deletions are reflected
  fs.rmSync(targetDir, { recursive: true, force: true });

  // Shallow copy of the whole Dieter tree; Denver will serve static assets from here.
  fs.cpSync(sourceDir, targetDir, { recursive: true });

  // eslint-disable-next-line no-console
  console.log('[sync-dieter-to-denver] Synced Dieter →', targetDir);
}

main();
