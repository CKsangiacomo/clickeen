#!/usr/bin/env node
/* eslint-disable no-console */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ensurePosixPath,
  fileExists,
  listJsonFiles,
  normalizeLocaleToken,
  normalizeOpPath,
  readJson,
  sha256Hex,
  stableStringify,
} from './lib.mjs';

const REPO_ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');
const TOKYO_PRAGUE_ROOT = path.join(REPO_ROOT, 'tokyo', 'prague', 'l10n');
const TOKYO_PRAGUE_PAGES_ROOT = path.join(REPO_ROOT, 'tokyo', 'prague', 'pages');
const CHROME_BASE_PATH = path.join(REPO_ROOT, 'prague', 'content', 'base', 'v1', 'chrome.json');
const LOCALES_PATH = path.join(REPO_ROOT, 'packages', 'l10n', 'locales.json');

const cliArgs = new Set(process.argv.slice(2));
const STRICT_LATEST = cliArgs.has('--strict-latest') || String(process.env.PRAGUE_L10N_VERIFY_STRICT || '').trim() === '1';

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function computeFingerprint(value) {
  return sha256Hex(stableStringify(value));
}

function normalizeLocales(raw) {
  if (!Array.isArray(raw)) throw new Error(`[prague-l10n] Invalid locales file: ${LOCALES_PATH}`);
  const locales = raw
    .map((entry) => {
      if (typeof entry === 'string') return normalizeLocaleToken(entry);
      if (entry && typeof entry === 'object' && typeof entry.code === 'string') return normalizeLocaleToken(entry.code);
      return null;
    })
    .filter((v) => v);
  if (!locales.includes('en')) {
    throw new Error('[prague-l10n] locales.json must include an "en" locale code');
  }
  return Array.from(new Set(locales)).sort();
}

function isRealWidgetDir(name) {
  if (!name) return false;
  if (name.startsWith('_')) return false;
  if (name === 'shared') return false;
  return true;
}

function pageIdFromWidgetPage({ widget, page }) {
  return page === 'overview' ? `widgets/${widget}` : `widgets/${widget}/${page}`;
}

function parseWidgetPageFile(filePath) {
  const normalized = ensurePosixPath(filePath);
  const marker = '/tokyo/prague/pages/';
  const idx = normalized.lastIndexOf(marker);
  if (idx === -1) return null;
  const rest = normalized.slice(idx + marker.length);
  const parts = rest.split('/');
  if (parts.length !== 2) return null;
  const widget = parts[0];
  if (!isRealWidgetDir(widget)) return null;
  const file = parts[1];
  if (!file.endsWith('.json')) return null;
  const page = file.slice(0, -'.json'.length);
  const pageId = pageIdFromWidgetPage({ widget, page });
  return { widget, page, pageId };
}

async function listWidgetPageFiles() {
  const all = await listJsonFiles(TOKYO_PRAGUE_PAGES_ROOT);
  return all
    .map((filePath) => {
      const parsed = parseWidgetPageFile(filePath);
      if (!parsed) return null;
      return { ...parsed, filePath };
    })
    .filter((entry) => entry);
}

async function loadWidgetPageJson({ filePath, widget, page }) {
  const json = await readJson(filePath);
  if (!json || typeof json !== 'object' || Array.isArray(json)) {
    throw new Error(`[prague-l10n] Invalid tokyo page JSON: ${filePath}`);
  }
  const blocks = json.blocks;
  if (!Array.isArray(blocks)) {
    throw new Error(`[prague-l10n] tokyo/prague/pages/${widget}/${page}.json missing blocks[]`);
  }
  return json;
}

function buildPageBase({ pageId, pageJson, pagePath }) {
  const baseBlocks = {};
  for (const block of pageJson.blocks) {
    if (!block || typeof block !== 'object' || Array.isArray(block)) {
      throw new Error(`[prague-l10n] Invalid block entry in ${pagePath}`);
    }
    const id = String(block.id || '').trim();
    if (!id) {
      throw new Error(`[prague-l10n] ${pagePath}: block id is required`);
    }
    const copy = block.copy;
    if (!copy || typeof copy !== 'object' || Array.isArray(copy)) {
      throw new Error(`[prague-l10n] NOT TRANSLATED: ${pagePath} block "${id}" missing copy`);
    }
    baseBlocks[id] = { copy };
  }
  return { v: 1, pageId, blocks: baseBlocks };
}

async function loadIndex(pageId, locales, latestFingerprint) {
  const indexPath = path.join(TOKYO_PRAGUE_ROOT, pageId, 'index.json');
  if (!(await fileExists(indexPath))) {
    const msg = `[prague-l10n] Missing index.json: ${indexPath}`;
    if (STRICT_LATEST) throw new Error(msg);
    console.warn(msg);
    return null;
  }
  const index = await readJson(indexPath);
  if (!isPlainObject(index) || index.v !== 1) {
    throw new Error(`[prague-l10n] Invalid index.json: ${indexPath}`);
  }
  if (index.publicId !== pageId) {
    throw new Error(`[prague-l10n] index.json publicId mismatch: ${indexPath}`);
  }
  if (!isPlainObject(index.layers) || !isPlainObject(index.layers.locale)) {
    throw new Error(`[prague-l10n] index.json missing locale layer: ${indexPath}`);
  }
  const layer = index.layers.locale;
  if (!Array.isArray(layer.keys)) {
    throw new Error(`[prague-l10n] index.json locale keys missing: ${indexPath}`);
  }
  const expected = [...locales].sort((a, b) => a.localeCompare(b));
  const actual = layer.keys.slice().sort((a, b) => a.localeCompare(b));
  if (expected.join(',') !== actual.join(',')) {
    const msg = `[prague-l10n] index.json locale keys mismatch: ${indexPath}`;
    if (STRICT_LATEST) throw new Error(msg);
    console.warn(msg);
  }
  if (!isPlainObject(layer.lastPublishedFingerprint)) {
    throw new Error(`[prague-l10n] index.json missing lastPublishedFingerprint: ${indexPath}`);
  }
  if (STRICT_LATEST) {
    for (const locale of expected) {
      if (layer.lastPublishedFingerprint[locale] !== latestFingerprint) {
        throw new Error(`[prague-l10n] NOT TRANSLATED: index.json fingerprint mismatch for ${pageId}/${locale}`);
      }
    }
  }
  return layer;
}

function validateOverlay(overlay, overlayPath, expectedFingerprint) {
  if (!isPlainObject(overlay) || overlay.v !== 1) {
    throw new Error(`[prague-l10n] Invalid overlay: ${overlayPath}`);
  }
  if (overlay.baseFingerprint !== expectedFingerprint) {
    throw new Error(`[prague-l10n] NOT TRANSLATED: overlay fingerprint mismatch: ${overlayPath}`);
  }
  if (!Array.isArray(overlay.ops)) {
    throw new Error(`[prague-l10n] ${overlayPath}: ops must be an array`);
  }
  for (let i = 0; i < overlay.ops.length; i += 1) {
    const op = overlay.ops[i];
    if (!op || typeof op !== 'object') {
      throw new Error(`[prague-l10n] ${overlayPath}: ops[${i}] must be an object`);
    }
    if (op.op !== 'set') {
      throw new Error(`[prague-l10n] ${overlayPath}: ops[${i}].op must be "set"`);
    }
    const opPath = typeof op.path === 'string' ? normalizeOpPath(op.path) : '';
    if (!opPath) {
      throw new Error(`[prague-l10n] ${overlayPath}: ops[${i}].path is required`);
    }
    if (typeof op.value !== 'string') {
      throw new Error(`[prague-l10n] ${overlayPath}: ops[${i}].value must be a string`);
    }
  }
}

async function verifyPageArtifacts({ pageId, overlayLocales, latestFingerprint }) {
  const layer = await loadIndex(pageId, overlayLocales, latestFingerprint);
  for (const locale of overlayLocales) {
    const publishedFingerprint = layer?.lastPublishedFingerprint?.[locale];
    const fingerprintToVerify = STRICT_LATEST ? latestFingerprint : publishedFingerprint;
    if (!fingerprintToVerify) {
      const msg = `[prague-l10n] Missing lastPublishedFingerprint for ${pageId}/${locale}`;
      if (STRICT_LATEST) throw new Error(msg);
      console.warn(msg);
      continue;
    }

    const overlayPath = path.join(TOKYO_PRAGUE_ROOT, pageId, 'locale', locale, `${fingerprintToVerify}.ops.json`);
    if (!(await fileExists(overlayPath))) {
      const msg = `[prague-l10n] NOT TRANSLATED: missing overlay for ${pageId}/${locale}: ${overlayPath}`;
      if (STRICT_LATEST) throw new Error(msg);
      console.warn(msg);
      continue;
    }

    const overlay = await readJson(overlayPath);
    validateOverlay(overlay, overlayPath, fingerprintToVerify);
  }
}

async function verifyChrome(overlayLocales) {
  if (!(await fileExists(CHROME_BASE_PATH))) return;
  const chromeBase = await readJson(CHROME_BASE_PATH);
  if (!isPlainObject(chromeBase) || chromeBase.v !== 1) {
    throw new Error(`[prague-l10n] Invalid chrome base file: ${CHROME_BASE_PATH}`);
  }
  if (!isPlainObject(chromeBase.strings)) {
    throw new Error(`[prague-l10n] chrome base missing strings: ${CHROME_BASE_PATH}`);
  }
  const fingerprint = computeFingerprint(chromeBase);
  await verifyPageArtifacts({ pageId: 'chrome', overlayLocales, latestFingerprint: fingerprint });
}

async function verifyWidgets(overlayLocales) {
  const pageFiles = await listWidgetPageFiles();
  if (!pageFiles.length) throw new Error('[prague-l10n] No widget pages found.');

  for (const entry of pageFiles) {
    const pageJson = await loadWidgetPageJson(entry);
    const base = buildPageBase({ pageId: entry.pageId, pageJson, pagePath: entry.filePath });
    const fingerprint = computeFingerprint(base);
    await verifyPageArtifacts({ pageId: entry.pageId, overlayLocales, latestFingerprint: fingerprint });
  }
}

async function main() {
  const locales = normalizeLocales(await readJson(LOCALES_PATH));
  const overlayLocales = locales.filter((locale) => locale !== 'en');

  await verifyChrome(overlayLocales);
  await verifyWidgets(overlayLocales);

  console.log('[prague-l10n] Verification complete.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
