#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const ROOT_ALLOWLIST = [
  {
    test: (file) => file.startsWith('Execution_Pipeline_Docs/'),
    reason: 'executed PRDs may discuss removed paths as history',
  },
  {
    test: (file) => file.startsWith('documentation/strategy/'),
    reason: 'strategy drafts are historical/non-operational narrative, not active public serving guidance',
  },
  {
    test: (file) => file.includes('/CompetitorAnalysis/'),
    reason: 'captured competitor pages are external reference material',
  },
  {
    test: (file) => file === 'scripts/verify/prd100-static-public-guard.mjs',
    reason: 'guard source names the banned patterns it enforces',
  },
  {
    test: (file) => file === 'bob/lib/embed-snippets.test.ts',
    reason: 'negative assertion proving copied snippets do not contain old public paths',
  },
  {
    test: (file) => file === 'tokyo-worker/src/routes/clk-live-routes.test.ts',
    reason: 'deny tests intentionally request private files and folders',
  },
];

const SKIP_PATH_PARTS = [
  '/node_modules/',
  '/.next/',
  '/.turbo/',
  '/dist/',
  '/test-results/',
  '/.vercel/',
  '/.cloudflare/',
];

const SCANNED_EXTENSIONS = new Set([
  '.astro',
  '.css',
  '.html',
  '.js',
  '.json',
  '.md',
  '.mjs',
  '.ts',
  '.tsx',
  '.toml',
  '.yaml',
  '.yml',
]);

const BANNED_PATTERNS = [
  { label: 'embed.clickeen.com', pattern: /embed\.clickeen\.com/i },
  { label: 'publicEmbedId', pattern: /publicEmbedId/ },
  { label: 'public /widget/ route', pattern: /(^|["'`\s])\/widget\// },
  { label: 'public /renders/accounts/ route', pattern: /\/renders\/accounts\// },
  { label: 'public /renders/widgets/ route', pattern: /\/renders\/widgets\// },
  { label: 'published/config.json projection', pattern: /published\/config\.json/ },
  { label: 'published/live/r.json projection', pattern: /published\/live\/r\.json/ },
  { label: 'published/overlays projection', pattern: /published\/overlays\// },
  { label: 'live/r.json runtime pointer', pattern: /live\/r\.json/ },
  { label: 'shortener public serving concept', pattern: /\bshortener\b/i },
  { label: 'redirect alias public serving concept', pattern: /\bredirect alias\b/i },
];

const GENERATED_OUTPUT_FETCH_PATTERNS = [
  { label: 'generated output fetches instance.json', pattern: /fetch\s*\([^)]*instance\.json/is },
  { label: 'generated output fetches overlays', pattern: /fetch\s*\([^)]*overlays\//is },
  { label: 'generated output fetches config.json', pattern: /fetch\s*\([^)]*config\.json/is },
  { label: 'generated output fetches published projection', pattern: /fetch\s*\([^)]*published\//is },
  { label: 'generated output fetches render route', pattern: /fetch\s*\([^)]*renders\//is },
  { label: 'generated output fetches widget route', pattern: /fetch\s*\([^)]*widget\//is },
  { label: 'generated output fetches Roma', pattern: /fetch\s*\([^)]*roma/is },
  { label: 'generated output fetches Bob', pattern: /fetch\s*\([^)]*bob/is },
  { label: 'generated output fetches Venice', pattern: /fetch\s*\([^)]*venice/is },
  { label: 'generated output fetches San Francisco', pattern: /fetch\s*\([^)]*san[-]?francisco/is },
];

function trackedFiles() {
  const out = execFileSync('git', ['ls-files'], { encoding: 'utf8' });
  return out.split('\n').map((line) => line.trim()).filter(Boolean);
}

function extensionOf(file) {
  const match = file.match(/(\.[^.]+)$/);
  return match ? match[1] : '';
}

function isAllowedFile(file) {
  const normalized = `/${file}`;
  if (SKIP_PATH_PARTS.some((part) => normalized.includes(part))) return true;
  return ROOT_ALLOWLIST.some((entry) => entry.test(file));
}

function shouldScan(file) {
  if (isAllowedFile(file)) return false;
  return SCANNED_EXTENSIONS.has(extensionOf(file));
}

function lineFor(text, index) {
  return text.slice(0, index).split('\n').length;
}

function findFailures(file, text) {
  const failures = [];
  for (const entry of [...BANNED_PATTERNS, ...GENERATED_OUTPUT_FETCH_PATTERNS]) {
    const match = entry.pattern.exec(text);
    if (!match) continue;
    const matched = match[0];
    const lineNumber = lineFor(text, match.index);
    const lineText = text.split('\n')[lineNumber - 1] || '';
    if (lineText.includes('/__internal/renders/widgets/')) continue;
    failures.push({
      file,
      line: lineNumber,
      label: entry.label,
      match: matched.replace(/\s+/g, ' ').slice(0, 160),
    });
  }
  return failures;
}

const failures = [];
for (const file of trackedFiles()) {
  if (!shouldScan(file)) continue;
  if (!existsSync(file)) continue;
  const text = readFileSync(file, 'utf8');
  failures.push(...findFailures(file, text));
}

if (failures.length) {
  console.error('[prd100-static-public-guard] banned PRD 100 public-runtime references found:');
  for (const failure of failures) {
    console.error(`- ${failure.file}:${failure.line} ${failure.label}: ${failure.match}`);
  }
  process.exit(1);
}

console.log('[prd100-static-public-guard] active public serving paths are static clk.live only.');
