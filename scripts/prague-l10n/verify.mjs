#!/usr/bin/env node
/* eslint-disable no-console */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  collectTranslatableEntries,
  ensurePosixPath,
  fileExists,
  listJsonFiles,
  normalizeLocaleToken,
  normalizeOpPath,
  pathMatchesAllowlist,
  prettyStableJson,
  readJson,
  sha256Hex,
  stableStringify,
} from './lib.mjs';

const REPO_ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');
const ALLOWLIST_ROOT = path.join(REPO_ROOT, 'prague', 'content', 'allowlists', 'v1');
const TOKYO_PRAGUE_ROOT = path.join(REPO_ROOT, 'tokyo', 'l10n', 'prague');
const TOKYO_WIDGETS_ROOT = path.join(REPO_ROOT, 'tokyo', 'widgets');
const CHROME_BASE_PATH = path.join(REPO_ROOT, 'prague', 'content', 'base', 'v1', 'chrome.json');
const LOCALES_PATH = path.join(REPO_ROOT, 'config', 'locales.json');

function computeBaseFingerprint(config) {
  return sha256Hex(stableStringify(config));
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeLocales(raw) {
  if (!Array.isArray(raw)) throw new Error(`[prague-l10n] Invalid locales file: ${LOCALES_PATH}`);
  const locales = raw.map((v) => normalizeLocaleToken(v)).filter((v) => v);
  if (!locales.includes('en')) {
    throw new Error('[prague-l10n] locales.json must include "en"');
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
  const marker = '/tokyo/widgets/';
  const idx = normalized.lastIndexOf(marker);
  if (idx === -1) return null;
  const rest = normalized.slice(idx + marker.length);
  const parts = rest.split('/');
  if (parts.length !== 3) return null;
  if (parts[1] !== 'pages') return null;
  const widget = parts[0];
  if (!isRealWidgetDir(widget)) return null;
  const file = parts[2];
  if (!file.endsWith('.json')) return null;
  const page = file.slice(0, -'.json'.length);
  const pageId = pageIdFromWidgetPage({ widget, page });
  return { widget, page, pageId };
}

async function listWidgetPageFiles() {
  const all = await listJsonFiles(TOKYO_WIDGETS_ROOT);
  return all
    .map((filePath) => {
      const parsed = parseWidgetPageFile(filePath);
      if (!parsed) return null;
      return { ...parsed, filePath };
    })
    .filter((entry) => entry);
}

async function loadWidgetPageJson(args) {
  const json = await readJson(args.filePath);
  if (!json || typeof json !== 'object' || Array.isArray(json)) {
    throw new Error(`[prague-l10n] Invalid tokyo page JSON: ${args.filePath}`);
  }
  const blocks = json.blocks;
  if (!Array.isArray(blocks)) {
    throw new Error(`[prague-l10n] tokyo/widgets/${args.widget}/pages/${args.page}.json missing blocks[]`);
  }
  const blockTypeMap = new Map();
  for (const block of blocks) {
    if (!block || typeof block !== 'object' || Array.isArray(block)) {
      throw new Error(`[prague-l10n] Invalid block entry in tokyo/widgets/${args.widget}/pages/${args.page}.json`);
    }
    const id = String(block.id || '').trim();
    const type = String(block.type || '').trim();
    if (!id || !type) {
      throw new Error(`[prague-l10n] tokyo/widgets/${args.widget}/pages/${args.page}.json missing block id/type`);
    }
    blockTypeMap.set(id, type);
  }
  return { json, blocks, blockTypeMap };
}

function buildPageBase({ pageId, blocks, pagePath }) {
  const baseBlocks = {};
  for (const block of blocks) {
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

async function loadAllowlist(filePath) {
  const allowlist = await readJson(filePath);
  if (!isPlainObject(allowlist) || allowlist.v !== 1 || !Array.isArray(allowlist.paths)) {
    throw new Error(`[prague-l10n] Invalid allowlist ${filePath}`);
  }
  const entries = [];
  for (const entry of allowlist.paths) {
    const pathValue = typeof entry?.path === 'string' ? normalizeOpPath(entry.path) : '';
    if (!pathValue) throw new Error(`[prague-l10n] Invalid allowlist entry in ${filePath}`);
    entries.push({ path: pathValue });
  }
  return { v: allowlist.v, entries };
}

function buildAllowlistPrefix(blockId, allowlistEntries) {
  return allowlistEntries.map((entry) => `blocks.${blockId}.${entry.path}`);
}

async function migrateLegacyOverlays({ pageId, locales, baseFingerprint }) {
  const pageDir = path.join(TOKYO_PRAGUE_ROOT, pageId);
  if (!(await fileExists(pageDir))) return;

  let migrated = false;
  for (const locale of locales) {
    const legacyDir = path.join(pageDir, locale);
    const legacyPath = path.join(legacyDir, `${baseFingerprint}.ops.json`);
    if (!(await fileExists(legacyPath))) continue;
    const newDir = path.join(pageDir, 'locale', locale);
    const newPath = path.join(newDir, `${baseFingerprint}.ops.json`);
    await ensureDir(newDir);
    if (!(await fileExists(newPath))) {
      await fs.rename(legacyPath, newPath);
    } else {
      await fs.unlink(legacyPath);
    }
    migrated = true;
    try {
      const remaining = await fs.readdir(legacyDir);
      if (!remaining.length) {
        await fs.rmdir(legacyDir);
      }
    } catch {
      // Ignore cleanup failures; verification will still enforce the new layout.
    }
  }

  if (!migrated) return;
  const indexPath = path.join(pageDir, 'index.json');
  if (await fileExists(indexPath)) return;
  const keys = [...locales].sort((a, b) => a.localeCompare(b));
  if (!keys.length) return;
  const lastPublishedFingerprint = {};
  for (const locale of keys) {
    lastPublishedFingerprint[locale] = baseFingerprint;
  }
  await fs.writeFile(
    indexPath,
    prettyStableJson({
      v: 1,
      publicId: pageId,
      layers: { locale: { keys, lastPublishedFingerprint } },
    }),
  );
}

function validateOps({ ops, allowlistPaths, ref }) {
  if (!Array.isArray(ops)) throw new Error(`[prague-l10n] ${ref}: ops must be an array`);
  for (let i = 0; i < ops.length; i += 1) {
    const op = ops[i];
    if (!op || typeof op !== 'object') {
      throw new Error(`[prague-l10n] ${ref}: ops[${i}] must be an object`);
    }
    if (op.op !== 'set') {
      throw new Error(`[prague-l10n] ${ref}: ops[${i}].op must be "set"`);
    }
    const opPath = typeof op.path === 'string' ? normalizeOpPath(op.path) : '';
    if (!opPath) {
      throw new Error(`[prague-l10n] ${ref}: ops[${i}].path is required`);
    }
    if (!allowlistPaths.some((allow) => pathMatchesAllowlist(opPath, allow))) {
      throw new Error(`[prague-l10n] ${ref}: ops[${i}].path not allowlisted (${opPath})`);
    }
    if (typeof op.value !== 'string') {
      throw new Error(`[prague-l10n] ${ref}: ops[${i}].value must be a string`);
    }
  }
}

async function verifyOverlay({ overlayPath, allowlistPaths, baseFingerprint }) {
  const overlay = await readJson(overlayPath);
  if (!isPlainObject(overlay) || overlay.v !== 1) {
    throw new Error(`[prague-l10n] Invalid overlay: ${overlayPath}`);
  }
  if (overlay.baseFingerprint !== baseFingerprint) {
    throw new Error(`[prague-l10n] NOT TRANSLATED: overlay fingerprint mismatch: ${overlayPath}`);
  }
  validateOps({ ops: overlay.ops, allowlistPaths, ref: overlayPath });
  return overlay;
}

function assertOverlayComplete({ overlay, expectedPaths, ref }) {
  const overlayPaths = new Set(
    Array.isArray(overlay.ops)
      ? overlay.ops.filter((op) => op && typeof op === 'object' && op.op === 'set').map((op) => op.path)
      : [],
  );
  for (const expected of expectedPaths) {
    if (!overlayPaths.has(expected)) {
      throw new Error(`[prague-l10n] NOT TRANSLATED: ${ref} missing ${expected}`);
    }
  }
}

async function verifyLayerIndex({ pageId, locales, baseFingerprint }) {
  const indexPath = path.join(TOKYO_PRAGUE_ROOT, pageId, 'index.json');
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
  const expectedKeys = [...locales].sort((a, b) => a.localeCompare(b));
  const actualKeys = layer.keys.slice().sort((a, b) => a.localeCompare(b));
  if (expectedKeys.join(',') !== actualKeys.join(',')) {
    throw new Error(`[prague-l10n] index.json locale keys mismatch: ${indexPath}`);
  }
  if (!isPlainObject(layer.lastPublishedFingerprint)) {
    throw new Error(`[prague-l10n] index.json missing lastPublishedFingerprint: ${indexPath}`);
  }
  for (const locale of expectedKeys) {
    if (layer.lastPublishedFingerprint[locale] !== baseFingerprint) {
      throw new Error(`[prague-l10n] NOT TRANSLATED: index.json fingerprint mismatch for ${pageId}/${locale}`);
    }
  }
}

async function main() {
  const locales = normalizeLocales(await readJson(LOCALES_PATH));
  const overlayLocales = locales.filter((l) => l !== 'en');

  const pageFiles = await listWidgetPageFiles();
  if (!pageFiles.length) throw new Error('[prague-l10n] No widget pages found.');

  if (await fileExists(CHROME_BASE_PATH)) {
    const chromeBase = await readJson(CHROME_BASE_PATH);
    if (!isPlainObject(chromeBase) || chromeBase.v !== 1) {
      throw new Error(`[prague-l10n] Invalid chrome base file: ${CHROME_BASE_PATH}`);
    }
    if (!isPlainObject(chromeBase.strings)) {
      throw new Error(`[prague-l10n] chrome base missing strings: ${CHROME_BASE_PATH}`);
    }
    const chromeFingerprint = computeBaseFingerprint(chromeBase);
    await migrateLegacyOverlays({ pageId: 'chrome', locales: overlayLocales, baseFingerprint: chromeFingerprint });

    const chromeAllowlist = await loadAllowlist(path.join(ALLOWLIST_ROOT, 'chrome.allowlist.json'));
    const allowlistPaths = chromeAllowlist.entries.map((entry) => entry.path);
    const chromeItems = collectTranslatableEntries(chromeBase, chromeAllowlist.entries);
    const expectedPaths = chromeItems.map((item) => item.path);
    if (!expectedPaths.length && overlayLocales.length) {
      throw new Error('[prague-l10n] NOT TRANSLATED: chrome base missing copy paths');
    }

    for (const locale of overlayLocales) {
      const overlayPath = path.join(TOKYO_PRAGUE_ROOT, 'chrome', 'locale', locale, `${chromeFingerprint}.ops.json`);
      if (!(await fileExists(overlayPath))) {
        throw new Error(`[prague-l10n] NOT TRANSLATED: missing chrome overlay for ${locale}: ${overlayPath}`);
      }
      const overlay = await verifyOverlay({ overlayPath, allowlistPaths, baseFingerprint: chromeFingerprint });
      assertOverlayComplete({ overlay, expectedPaths, ref: overlayPath });
    }
    await verifyLayerIndex({ pageId: 'chrome', locales: overlayLocales, baseFingerprint: chromeFingerprint });
  }

  for (const entry of pageFiles) {
    const { blocks, blockTypeMap } = await loadWidgetPageJson(entry);
    const base = buildPageBase({ pageId: entry.pageId, blocks, pagePath: entry.filePath });
    const baseFingerprint = computeBaseFingerprint(base);
    await migrateLegacyOverlays({ pageId: entry.pageId, locales: overlayLocales, baseFingerprint });

    const allowlistPaths = [];
    const expectedPaths = [];
    for (const [blockId, blockType] of blockTypeMap.entries()) {
      const allowlistPath = path.join(ALLOWLIST_ROOT, 'blocks', `${blockType}.allowlist.json`);
      if (!(await fileExists(allowlistPath))) {
        throw new Error(`[prague-l10n] Missing allowlist for block type ${blockType}: ${allowlistPath}`);
      }
      const allowlist = await loadAllowlist(allowlistPath);
      allowlistPaths.push(...buildAllowlistPrefix(blockId, allowlist.entries));
      const blockBase = base.blocks[blockId];
      if (!isPlainObject(blockBase)) {
        throw new Error(`[prague-l10n] ${entry.pageId}: block ${blockId} base missing`);
      }
      const items = collectTranslatableEntries(blockBase, allowlist.entries);
      if (!items.length) {
        throw new Error(`[prague-l10n] NOT TRANSLATED: ${entry.filePath} block "${blockId}" missing copy paths`);
      }
      for (const item of items) {
        expectedPaths.push(`blocks.${blockId}.${item.path}`);
      }
    }

    for (const locale of overlayLocales) {
      const overlayPath = path.join(TOKYO_PRAGUE_ROOT, entry.pageId, 'locale', locale, `${baseFingerprint}.ops.json`);
      if (!(await fileExists(overlayPath))) {
        throw new Error(`[prague-l10n] NOT TRANSLATED: missing overlay for ${entry.pageId}/${locale}: ${overlayPath}`);
      }
      const overlay = await verifyOverlay({ overlayPath, allowlistPaths, baseFingerprint });
      assertOverlayComplete({ overlay, expectedPaths, ref: overlayPath });
    }
    await verifyLayerIndex({ pageId: entry.pageId, locales: overlayLocales, baseFingerprint });
  }

  console.log('[prague-l10n] Verification complete.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
