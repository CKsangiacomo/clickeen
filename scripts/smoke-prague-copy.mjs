#!/usr/bin/env node
/* eslint-disable no-console */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');

const DEFAULT_BASE_URL = process.env.PRAGUE_SMOKE_BASE_URL || 'http://localhost:4321';
const DEFAULT_MARKET = process.env.PRAGUE_SMOKE_MARKET || 'us';
const DEFAULT_LOCALE = process.env.PRAGUE_SMOKE_LOCALE || 'en';
const REQUEST_TIMEOUT_MS = Number.parseInt(process.env.PRAGUE_SMOKE_TIMEOUT_MS || '10000', 10);

const CHECKS = [
  {
    key: 'overview',
    file: 'tokyo/widgets/faq/pages/overview.json',
    route: ({ market, locale }) => `/${market}/${locale}/widgets/faq/`,
    selectors: [
      { blockId: 'hero', path: 'copy.headline' },
      { blockId: 'minibob', path: 'copy.heading' },
      { blockId: 'locale-showcase', path: 'copy.title' },
    ],
  },
  {
    key: 'templates',
    file: 'tokyo/widgets/faq/pages/templates.json',
    route: ({ market, locale }) => `/${market}/${locale}/widgets/faq/templates/`,
    selectors: [
      { blockId: 'hero', path: 'copy.headline' },
      { blockId: 'big-bang', path: 'copy.headline' },
      { blockId: 'control-moat', path: 'copy.title' },
    ],
  },
  {
    key: 'examples',
    file: 'tokyo/widgets/faq/pages/examples.json',
    route: ({ market, locale }) => `/${market}/${locale}/widgets/faq/examples/`,
    selectors: [
      { blockId: 'hero', path: 'copy.headline' },
      { blockId: 'steps', path: 'copy.title' },
      { blockId: 'cta', path: 'copy.headline' },
    ],
  },
  {
    key: 'features',
    file: 'tokyo/widgets/faq/pages/features.json',
    route: ({ market, locale }) => `/${market}/${locale}/widgets/faq/features/`,
    selectors: [
      { blockId: 'steps-diff', path: 'copy.items.0.title' },
      { blockId: 'steps-diff', path: 'copy.items.1.title' },
      { blockId: 'steps-eco', path: 'copy.items.2.title' },
    ],
  },
];

function parseArgs(argv) {
  const out = {
    baseUrl: DEFAULT_BASE_URL,
    market: DEFAULT_MARKET,
    locale: DEFAULT_LOCALE,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      out.help = true;
      continue;
    }
    if (arg === '--base-url') {
      out.baseUrl = String(argv[i + 1] || '').trim();
      i += 1;
      continue;
    }
    if (arg === '--market') {
      out.market = String(argv[i + 1] || '').trim().toLowerCase();
      i += 1;
      continue;
    }
    if (arg === '--locale') {
      out.locale = String(argv[i + 1] || '').trim().toLowerCase();
      i += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }
  if (!out.baseUrl) throw new Error('Missing --base-url value');
  if (!out.market) throw new Error('Missing --market value');
  if (!out.locale) throw new Error('Missing --locale value');
  return out;
}

function normalizeBaseUrl(url) {
  return String(url || '').trim().replace(/\/+$/, '');
}

function getAtPath(obj, pathStr) {
  const parts = String(pathStr || '')
    .split('.')
    .map((p) => p.trim())
    .filter(Boolean);
  let current = obj;
  for (const part of parts) {
    if (current == null) return undefined;
    if (/^\d+$/.test(part)) {
      current = current[Number(part)];
    } else {
      current = current[part];
    }
  }
  return current;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function htmlContains(html, expected) {
  if (!expected) return true;
  return html.includes(expected) || html.includes(escapeHtml(expected));
}

async function loadExpectedStrings(check) {
  const fullPath = path.join(REPO_ROOT, check.file);
  const raw = await fs.readFile(fullPath, 'utf8');
  const json = JSON.parse(raw);
  const blocks = Array.isArray(json?.blocks) ? json.blocks : [];
  const blocksById = new Map();
  for (const block of blocks) {
    if (!block || typeof block !== 'object') continue;
    const id = String(block.id || '').trim();
    if (!id) continue;
    blocksById.set(id, block);
  }

  const strings = [];
  for (const selector of check.selectors) {
    const block = blocksById.get(selector.blockId);
    if (!block) {
      throw new Error(`[${check.key}] Missing block "${selector.blockId}" in ${check.file}`);
    }
    const value = getAtPath(block, selector.path);
    if (typeof value !== 'string' || !value.trim()) {
      throw new Error(`[${check.key}] Missing string at ${selector.blockId}.${selector.path} in ${check.file}`);
    }
    strings.push({
      blockId: selector.blockId,
      path: selector.path,
      value: value.trim(),
    });
  }
  return strings;
}

async function fetchText(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, { method: 'GET', signal: controller.signal });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText}`);
    }
    return await res.text();
  } finally {
    clearTimeout(timeout);
  }
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log('Usage: node scripts/smoke-prague-copy.mjs [--base-url URL] [--market us] [--locale en]');
    console.log('');
    console.log('Defaults:');
    console.log(`  --base-url ${DEFAULT_BASE_URL}`);
    console.log(`  --market ${DEFAULT_MARKET}`);
    console.log(`  --locale ${DEFAULT_LOCALE}`);
    process.exit(0);
  }

  const baseUrl = normalizeBaseUrl(args.baseUrl);
  const market = args.market;
  const locale = args.locale;

  console.log(`[smoke-prague-copy] Base URL: ${baseUrl}`);
  console.log(`[smoke-prague-copy] Market/Locale: ${market}/${locale}`);

  const failures = [];

  for (const check of CHECKS) {
    const route = check.route({ market, locale });
    const url = `${baseUrl}${route}`;
    let html;
    try {
      html = await fetchText(url);
    } catch (err) {
      failures.push({
        route,
        reason: `fetch failed: ${err instanceof Error ? err.message : String(err)}`,
      });
      continue;
    }

    const expected = await loadExpectedStrings(check);
    for (const entry of expected) {
      if (!htmlContains(html, entry.value)) {
        failures.push({
          route,
          reason: `missing "${entry.value}" from ${check.file} (${entry.blockId}.${entry.path})`,
        });
      }
    }
  }

  if (failures.length > 0) {
    console.error(`[smoke-prague-copy] FAIL: ${failures.length} issue(s) found`);
    for (const failure of failures) {
      console.error(`  - ${failure.route}: ${failure.reason}`);
    }
    process.exit(1);
  }

  console.log('[smoke-prague-copy] OK: Prague routes match current source copy.');
}

run().catch((err) => {
  console.error(`[smoke-prague-copy] FAIL: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
