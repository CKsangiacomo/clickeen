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
  node scripts/ci/check-paris-boundary.mjs [--mode <strict|report>] [--report-only]
`;

const FORBIDDEN_PACKAGE_DEPENDENCIES = [
  'openai',
  '@anthropic-ai/sdk',
  'sharp',
  'puppeteer',
  'playwright',
  '@aws-sdk',
  'canvas',
  'fluent-ffmpeg',
];

const FORBIDDEN_IMPORT_PATTERNS = [
  { label: 'provider-sdk', regex: /from\s+['"]openai['"]/g },
  { label: 'provider-sdk', regex: /from\s+['"]@anthropic-ai\/sdk['"]/g },
  { label: 'render-sdk', regex: /from\s+['"]sharp['"]/g },
  { label: 'render-sdk', regex: /from\s+['"]puppeteer(?:\/core)?['"]/g },
  { label: 'render-sdk', regex: /from\s+['"]playwright(?:-core)?['"]/g },
  { label: 'binary-sdk', regex: /from\s+['"]@aws-sdk\//g },
  { label: 'render-sdk', regex: /from\s+['"]canvas['"]/g },
  { label: 'binary-sdk', regex: /from\s+['"]fluent-ffmpeg['"]/g },
  { label: 'dynamic-require', regex: /require\(\s*['"](?:openai|@anthropic-ai\/sdk|sharp|puppeteer(?:\/core)?|playwright(?:-core)?|canvas|fluent-ffmpeg)['"]\s*\)/g },
];

const BYTE_OP_RULES = [
  {
    op: 'arrayBuffer',
    regex: /\.arrayBuffer\s*\(/g,
    allowlist: {},
  },
  {
    op: 'formData',
    regex: /\.formData\s*\(/g,
    allowlist: {},
  },
];

const LOCAL_EXECUTION_PATTERN_RULES = [
  {
    label: 'local-direct-dispatch-switch',
    regex: /useDirectDispatch/g,
    allowlist: {},
  },
  {
    label: 'local-l10n-publish',
    regex: /publishLayerLocal\s*\(/g,
    allowlist: {},
  },
  {
    label: 'local-render-snapshot',
    regex: /\/renders\/instances\/\$\{encodeURIComponent\(job\.publicId\)\}\/snapshot/g,
    allowlist: {},
  },
  {
    label: 'command-sync-wait',
    regex: /await\s+waitForRenderSnapshotState\s*\(/g,
    allowlist: {},
  },
];

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

function collectParisFiles() {
  const pattern = path.join(repoRoot, 'paris/src/**/*.{ts,tsx}').replace(/\\/g, '/');
  const ignore = [
    '**/node_modules/**',
    '**/.wrangler/**',
    '**/dist/**',
    '**/build/**',
  ];
  return globSync(pattern, { nodir: true, ignore })
    .map((abs) => path.relative(repoRoot, abs).replace(/\\/g, '/'))
    .sort((a, b) => a.localeCompare(b));
}

function countMatches(contents, regex) {
  const matches = contents.match(regex);
  return matches ? matches.length : 0;
}

function collectPackageDependencyViolations() {
  const pkg = JSON.parse(readFile('paris/package.json'));
  const dependencyNames = [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {}),
    ...Object.keys(pkg.optionalDependencies || {}),
  ];

  const violations = [];
  for (const name of dependencyNames) {
    for (const forbidden of FORBIDDEN_PACKAGE_DEPENDENCIES) {
      const forbiddenPrefix = `${forbidden}/`;
      if (name === forbidden || name.startsWith(forbiddenPrefix)) {
        violations.push({
          kind: 'package-dependency',
          file: 'paris/package.json',
          token: name,
          reason: `Forbidden runtime dependency in Paris boundary: ${forbidden}`,
        });
      }
    }
  }
  return violations;
}

function collectImportViolations(files) {
  const violations = [];
  for (const relPath of files) {
    const contents = readFile(relPath);
    for (const rule of FORBIDDEN_IMPORT_PATTERNS) {
      const count = countMatches(contents, rule.regex);
      if (count > 0) {
        violations.push({
          kind: 'forbidden-import',
          file: relPath,
          token: rule.label,
          count,
        });
      }
    }
  }
  return violations;
}

function collectByteOpViolations(files) {
  const violations = [];

  for (const rule of BYTE_OP_RULES) {
    const seenAllowlistPaths = new Set();

    for (const relPath of files) {
      const contents = readFile(relPath);
      const count = countMatches(contents, rule.regex);
      if (count === 0) continue;

      const expected = rule.allowlist[relPath] ?? 0;
      if (expected === 0) {
        violations.push({
          kind: 'forbidden-byte-op',
          file: relPath,
          op: rule.op,
          count,
          expected,
          reason: `${rule.op} is forbidden in Paris except explicit migration shims`,
        });
        continue;
      }

      seenAllowlistPaths.add(relPath);
      if (count !== expected) {
        violations.push({
          kind: 'forbidden-byte-op',
          file: relPath,
          op: rule.op,
          count,
          expected,
          reason: `${rule.op} count diverged from allowlist`,
        });
      }
    }

    for (const [allowPath, expected] of Object.entries(rule.allowlist)) {
      if (seenAllowlistPaths.has(allowPath)) continue;
      const contents = readFile(allowPath);
      const count = countMatches(contents, rule.regex);
      if (count !== expected) {
        violations.push({
          kind: 'forbidden-byte-op',
          file: allowPath,
          op: rule.op,
          count,
          expected,
          reason: `${rule.op} allowlist entry is stale`,
        });
      }
    }
  }

  return violations;
}

function collectAllowlistedPatternViolations(files, rules) {
  const violations = [];

  for (const rule of rules) {
    const seenAllowlistPaths = new Set();

    for (const relPath of files) {
      const contents = readFile(relPath);
      const count = countMatches(contents, rule.regex);
      if (count === 0) continue;

      const expected = rule.allowlist[relPath] ?? 0;
      if (expected === 0) {
        violations.push({
          kind: 'forbidden-pattern',
          file: relPath,
          token: rule.label,
          count,
          expected,
          reason: `${rule.label} is allowlisted only for explicit legacy paths`,
        });
        continue;
      }

      seenAllowlistPaths.add(relPath);
      if (count !== expected) {
        violations.push({
          kind: 'forbidden-pattern',
          file: relPath,
          token: rule.label,
          count,
          expected,
          reason: `${rule.label} count diverged from allowlist`,
        });
      }
    }

    for (const [allowPath, expected] of Object.entries(rule.allowlist)) {
      if (seenAllowlistPaths.has(allowPath)) continue;
      const contents = readFile(allowPath);
      const count = countMatches(contents, rule.regex);
      if (count !== expected) {
        violations.push({
          kind: 'forbidden-pattern',
          file: allowPath,
          token: rule.label,
          count,
          expected,
          reason: `${rule.label} allowlist entry is stale`,
        });
      }
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
    console.error(`[paris-boundary] ${message}`);
    console.error(USAGE.trim());
    process.exit(2);
  }

  const files = collectParisFiles();
  const violations = [
    ...collectPackageDependencyViolations(),
    ...collectImportViolations(files),
    ...collectByteOpViolations(files),
    ...collectAllowlistedPatternViolations(files, LOCAL_EXECUTION_PATTERN_RULES),
  ];

  const mode = args.mode === 'report' ? 'report' : 'enforced';
  console.log(`[paris-boundary] mode=${mode} files=${files.length}`);

  if (violations.length === 0) {
    console.log('[paris-boundary] OK');
    process.exit(0);
  }

  for (const violation of violations) {
    console.log(JSON.stringify(violation));
  }

  if (args.mode === 'report') {
    console.log(`[paris-boundary] violations=${violations.length} (not failing due to report mode)`);
    process.exit(0);
  }

  console.error(`[paris-boundary] FAIL violations=${violations.length}`);
  process.exit(1);
}

main();
