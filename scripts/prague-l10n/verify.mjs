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
const TOKYO_PRAGUE_PAGES_ROOT = path.join(REPO_ROOT, 'tokyo', 'prague', 'pages');
const LOCALES_PATH = path.join(REPO_ROOT, 'packages', 'l10n', 'locales.json');

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
    .filter((value) => value);
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
  if (!Array.isArray(json.blocks)) {
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

function validateOverlay(overlay, overlayPath, expectedFingerprint) {
  if (!isPlainObject(overlay) || overlay.v !== 1) {
    throw new Error(`[prague-l10n] Invalid translation file: ${overlayPath}`);
  }
  if (overlay.baseFingerprint !== expectedFingerprint) {
    throw new Error(`[prague-l10n] NOT TRANSLATED: translation fingerprint mismatch: ${overlayPath}`);
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
    if (!opPath || !opPath.startsWith('blocks.')) {
      throw new Error(`[prague-l10n] ${overlayPath}: ops[${i}].path must target page blocks`);
    }
    if (typeof op.value !== 'string') {
      throw new Error(`[prague-l10n] ${overlayPath}: ops[${i}].value must be a string`);
    }
  }
}

async function verifyPageTranslations({ filePath, widget, page, pageId, overlayLocales }) {
  const pageJson = await loadWidgetPageJson({ filePath, widget, page });
  const base = buildPageBase({ pageId, pageJson, pagePath: filePath });
  const fingerprint = computeFingerprint(base);
  const translationsDir = path.join(path.dirname(filePath), `${page}.translations`);

  for (const locale of overlayLocales) {
    const translationPath = path.join(translationsDir, `${locale}.json`);
    if (!(await fileExists(translationPath))) {
      throw new Error(`[prague-l10n] NOT TRANSLATED: missing ${translationPath}`);
    }
    validateOverlay(await readJson(translationPath), translationPath, fingerprint);
  }
}

async function main() {
  const locales = normalizeLocales(await readJson(LOCALES_PATH));
  const overlayLocales = locales.filter((locale) => locale !== 'en');
  const pageFiles = await listWidgetPageFiles();
  if (!pageFiles.length) throw new Error('[prague-l10n] No widget pages found.');

  for (const page of pageFiles) {
    await verifyPageTranslations({ ...page, overlayLocales });
  }

  console.log('[prague-l10n] Verification complete.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
