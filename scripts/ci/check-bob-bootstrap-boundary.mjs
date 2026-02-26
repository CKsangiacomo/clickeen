#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { globSync } from 'glob';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');

const USAGE = `
Usage:
  node scripts/ci/check-bob-bootstrap-boundary.mjs [--mode <strict|report>] [--report-only]
`;

const ALLOWLISTED_BOOTSTRAP_OPTION_COUNTS = {
  'bob/lib/api/paris/proxy-helpers.ts': 1,
  'bob/app/api/assets/upload/route.ts': 1,
  'bob/app/api/assets/[accountId]/route.ts': 1,
  'bob/app/api/assets/[accountId]/[assetId]/route.ts': 1,
};

const BOOTSTRAP_OPTION_PATTERN = /allowLocalDevBootstrap\s*:/g;

function parseArgs(argv) {
  const args = {
    mode: 'strict',
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--help' || token === '-h') {
      console.log(USAGE.trim());
      process.exit(0);
    }
    if (token === '--report-only') {
      args.mode = 'report';
      continue;
    }
    if (token === '--mode') {
      const raw = String(argv[i + 1] || '').trim();
      if (!raw) throw new Error('Missing value for --mode');
      if (raw !== 'strict' && raw !== 'report') {
        throw new Error(`Invalid --mode value: ${raw}`);
      }
      args.mode = raw;
      i += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${token}`);
  }

  return args;
}

function readFile(relPath) {
  return fs.readFileSync(path.join(repoRoot, relPath), 'utf8');
}

function countMatches(contents, regex) {
  const matches = contents.match(regex);
  return matches ? matches.length : 0;
}

function collectBobFiles() {
  const pattern = path.join(repoRoot, 'bob/**/*.{ts,tsx}').replace(/\\/g, '/');
  const ignore = ['**/node_modules/**', '**/.next/**', '**/dist/**', '**/build/**'];
  return globSync(pattern, { nodir: true, ignore })
    .map((abs) => path.relative(repoRoot, abs).replace(/\\/g, '/'))
    .sort((a, b) => a.localeCompare(b));
}

function collectBootstrapOptionViolations(files) {
  const violations = [];
  const seenAllowlistPaths = new Set();

  for (const relPath of files) {
    const contents = readFile(relPath);
    const count = countMatches(contents, BOOTSTRAP_OPTION_PATTERN);
    if (count === 0) continue;

    const expected = ALLOWLISTED_BOOTSTRAP_OPTION_COUNTS[relPath] ?? 0;
    if (expected === 0) {
      violations.push({
        kind: 'forbidden-bootstrap-option',
        file: relPath,
        count,
        expected,
        reason: 'allowLocalDevBootstrap is reserved for explicit Devstudio-local bridge routes',
      });
      continue;
    }

    seenAllowlistPaths.add(relPath);
    if (count !== expected) {
      violations.push({
        kind: 'forbidden-bootstrap-option',
        file: relPath,
        count,
        expected,
        reason: 'allowLocalDevBootstrap count diverged from allowlist',
      });
    }
  }

  for (const [allowPath, expected] of Object.entries(ALLOWLISTED_BOOTSTRAP_OPTION_COUNTS)) {
    const contents = readFile(allowPath);
    const count = countMatches(contents, BOOTSTRAP_OPTION_PATTERN);
    if (count !== expected) {
      violations.push({
        kind: 'forbidden-bootstrap-option',
        file: allowPath,
        count,
        expected,
        reason: 'allowlist entry is stale',
      });
    }
  }

  return violations;
}

function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[bob-bootstrap-boundary] ${message}`);
    console.error(USAGE.trim());
    process.exit(2);
  }

  const files = collectBobFiles();
  const violations = collectBootstrapOptionViolations(files);

  const mode = args.mode === 'report' ? 'report' : 'enforced';
  console.log(`[bob-bootstrap-boundary] mode=${mode} files=${files.length}`);

  if (violations.length === 0) {
    console.log('[bob-bootstrap-boundary] OK');
    process.exit(0);
  }

  for (const violation of violations) {
    console.log(JSON.stringify(violation));
  }

  if (args.mode === 'report') {
    console.log(`[bob-bootstrap-boundary] violations=${violations.length} (not failing due to report mode)`);
    process.exit(0);
  }

  console.error(`[bob-bootstrap-boundary] FAIL violations=${violations.length}`);
  process.exit(1);
}

main();
