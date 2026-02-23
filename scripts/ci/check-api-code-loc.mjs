#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { globSync } from 'glob';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');

const DEFAULT_SCOPES = [
  'tokyo-worker/src',
  'paris/src/domains',
  'roma/app/api',
  'bob/app/api',
];

const USAGE = `
Usage:
  node scripts/ci/check-api-code-loc.mjs [--max-code-loc N] [--scope PATH]... [--mode <strict|report>] [--report-only]

Examples:
  node scripts/ci/check-api-code-loc.mjs --max-code-loc 800
  node scripts/ci/check-api-code-loc.mjs --max-code-loc 800 --scope paris/src/domains/roma
  node scripts/ci/check-api-code-loc.mjs --max-code-loc 800 --mode report
`;

function parseArgs(argv) {
  const args = {
    maxCodeLoc: 800,
    scopes: [],
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
      if (!raw) {
        throw new Error('Missing value for --mode');
      }
      if (raw !== 'strict' && raw !== 'report') {
        throw new Error(`Invalid --mode value: ${raw}`);
      }
      args.mode = raw;
      i += 1;
      continue;
    }
    if (token === '--max-code-loc') {
      const raw = argv[i + 1];
      if (!raw) {
        throw new Error('Missing value for --max-code-loc');
      }
      const parsed = Number(raw);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new Error(`Invalid --max-code-loc value: ${raw}`);
      }
      args.maxCodeLoc = Math.trunc(parsed);
      i += 1;
      continue;
    }
    if (token === '--scope') {
      const raw = argv[i + 1];
      if (!raw) {
        throw new Error('Missing value for --scope');
      }
      args.scopes.push(raw);
      i += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${token}`);
  }

  if (args.scopes.length === 0) {
    args.scopes = [...DEFAULT_SCOPES];
  }

  return args;
}

function toAbsolute(p) {
  return path.isAbsolute(p) ? p : path.join(repoRoot, p);
}

function looksLikeGlob(scope) {
  return /[*?[\]{}()]/.test(scope);
}

function collectFiles(scopes) {
  const files = new Set();
  const ignore = [
    '**/node_modules/**',
    '**/.next/**',
    '**/.next-dev/**',
    '**/.turbo/**',
    '**/dist/**',
    '**/build/**',
    '**/.wrangler/**',
  ];

  function addGlob(pattern) {
    const absolutePattern = toAbsolute(pattern).replace(/\\/g, '/');
    const matches = globSync(absolutePattern, { nodir: true, ignore });
    for (const file of matches) {
      if (file.endsWith('.ts') || file.endsWith('.tsx')) {
        files.add(path.resolve(file));
      }
    }
  }

  for (const scope of scopes) {
    const absoluteScope = toAbsolute(scope);
    if (looksLikeGlob(scope)) {
      addGlob(scope);
      continue;
    }
    if (!fs.existsSync(absoluteScope)) {
      throw new Error(`Scope does not exist: ${scope}`);
    }
    const stat = fs.statSync(absoluteScope);
    if (stat.isFile()) {
      if (absoluteScope.endsWith('.ts') || absoluteScope.endsWith('.tsx')) {
        files.add(path.resolve(absoluteScope));
      }
      continue;
    }
    addGlob(path.join(scope, '**/*.{ts,tsx}'));
  }

  return Array.from(files).sort((a, b) => a.localeCompare(b));
}

function countCodeLoc(contents) {
  const lines = contents.split(/\r?\n/);
  let inBlockComment = false;
  let codeLoc = 0;

  for (const rawLine of lines) {
    const line = String(rawLine ?? '');
    let i = 0;
    let hasCode = false;

    while (i < line.length) {
      if (inBlockComment) {
        const endIdx = line.indexOf('*/', i);
        if (endIdx === -1) {
          i = line.length;
          break;
        }
        inBlockComment = false;
        i = endIdx + 2;
        continue;
      }

      while (i < line.length && /\s/.test(line[i])) i += 1;
      if (i >= line.length) break;

      if (line.startsWith('//', i)) break;
      if (line.startsWith('/*', i)) {
        inBlockComment = true;
        i += 2;
        continue;
      }

      hasCode = true;
      break;
    }

    if (hasCode) codeLoc += 1;
  }

  return codeLoc;
}

function analyzeFiles(files, maxCodeLoc) {
  const violations = [];
  for (const absolutePath of files) {
    const contents = fs.readFileSync(absolutePath, 'utf8');
    const physicalLoc = contents.split(/\r?\n/).length;
    const codeLoc = countCodeLoc(contents);
    if (codeLoc > maxCodeLoc) {
      violations.push({
        path: path.relative(repoRoot, absolutePath).replace(/\\/g, '/'),
        codeLoc,
        physicalLoc,
        maxAllowed: maxCodeLoc,
      });
    }
  }
  return violations.sort((a, b) => b.codeLoc - a.codeLoc || a.path.localeCompare(b.path));
}

function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[api-loc] ${message}`);
    console.error(USAGE.trim());
    process.exit(2);
  }

  let files;
  try {
    files = collectFiles(args.scopes);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[api-loc] ${message}`);
    process.exit(2);
  }

  const violations = analyzeFiles(files, args.maxCodeLoc);
  const mode = args.mode === 'report' ? 'report' : 'enforced';
  console.log(`[api-loc] mode=${mode} maxCodeLoc=${args.maxCodeLoc} files=${files.length}`);

  if (violations.length === 0) {
    console.log('[api-loc] OK');
    process.exit(0);
  }

  for (const violation of violations) {
    console.log(JSON.stringify(violation));
  }

  if (args.mode === 'report') {
    console.log(`[api-loc] violations=${violations.length} (not failing due to report mode)`);
    process.exit(0);
  }

  console.error(`[api-loc] FAIL violations=${violations.length}`);
  process.exit(1);
}

main();
