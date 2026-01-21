#!/usr/bin/env node
/* eslint-disable no-console */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  fileExists,
  listJsonFiles,
  normalizeLocaleToken,
  normalizeOpPath,
  pathMatchesAllowlist,
  readJson,
  sha256Hex,
  stableStringify,
} from './lib.mjs';

const REPO_ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');
const BASE_ROOT = path.join(REPO_ROOT, 'prague', 'content', 'base', 'v1');
const ALLOWLIST_ROOT = path.join(REPO_ROOT, 'prague', 'content', 'allowlists', 'v1');
const TOKYO_PRAGUE_ROOT = path.join(REPO_ROOT, 'tokyo', 'l10n', 'prague');
const LOCALES_PATH = path.join(REPO_ROOT, 'config', 'locales.json');

function computeBaseFingerprint(config) {
  return sha256Hex(stableStringify(config));
}

function pageIdFromFile(baseFile) {
  const rel = path.relative(BASE_ROOT, baseFile);
  const noExt = rel.replace(/\.json$/i, '');
  return noExt.split(path.sep).join('/');
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

function mapPageIdToWidget(pageId) {
  const parts = String(pageId || '').split('/').filter(Boolean);
  if (parts[0] !== 'widgets' || !parts[1]) {
    throw new Error(`[prague-l10n] Unsupported pageId: ${pageId}`);
  }
  const widget = parts[1];
  const page = parts[2] ?? 'overview';
  return { widget, page };
}

async function loadTokyoPage(pageId) {
  const { widget, page } = mapPageIdToWidget(pageId);
  const pagePath = path.join(REPO_ROOT, 'tokyo', 'widgets', widget, 'pages', `${page}.json`);
  const json = await readJson(pagePath);
  if (!json || typeof json !== 'object' || Array.isArray(json)) {
    throw new Error(`[prague-l10n] Invalid tokyo page JSON: ${pagePath}`);
  }
  const blocks = json.blocks;
  if (!Array.isArray(blocks)) {
    throw new Error(`[prague-l10n] tokyo/widgets/${widget}/pages/${page}.json missing blocks[]`);
  }
  const map = new Map();
  for (const block of blocks) {
    if (!block || typeof block !== 'object' || Array.isArray(block)) {
      throw new Error(`[prague-l10n] Invalid block entry in tokyo/widgets/${widget}/pages/${page}.json`);
    }
    const id = String(block.id || '');
    const type = String(block.type || '');
    if (!id || !type) {
      throw new Error(`[prague-l10n] tokyo/widgets/${widget}/pages/${page}.json missing block id/type`);
    }
    map.set(id, type);
  }
  return map;
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
    throw new Error(`[prague-l10n] Stale overlay fingerprint: ${overlayPath}`);
  }
  validateOps({ ops: overlay.ops, allowlistPaths, ref: overlayPath });
}

async function main() {
  const locales = normalizeLocales(await readJson(LOCALES_PATH));
  const overlayLocales = locales.filter((l) => l !== 'en');

  const baseFiles = await listJsonFiles(BASE_ROOT);
  if (!baseFiles.length) throw new Error('[prague-l10n] No base content found.');

  for (const basePath of baseFiles) {
    const pageId = pageIdFromFile(basePath);
    const base = await readJson(basePath);
    if (!isPlainObject(base) || base.v !== 1) {
      throw new Error(`[prague-l10n] Invalid base file: ${basePath}`);
    }
    const baseFingerprint = computeBaseFingerprint(base);

    if (pageId === 'chrome') {
      if (!isPlainObject(base.strings)) {
        throw new Error(`[prague-l10n] chrome base missing strings: ${basePath}`);
      }
      const chromeAllowlist = await loadAllowlist(path.join(ALLOWLIST_ROOT, 'chrome.allowlist.json'));
      const allowlistPaths = chromeAllowlist.entries.map((entry) => entry.path);
      for (const locale of overlayLocales) {
        const overlayPath = path.join(TOKYO_PRAGUE_ROOT, 'chrome', locale, `${baseFingerprint}.ops.json`);
        if (!(await fileExists(overlayPath))) {
          throw new Error(`[prague-l10n] Missing chrome overlay for ${locale}: ${overlayPath}`);
        }
        await verifyOverlay({ overlayPath, allowlistPaths, baseFingerprint });
      }
      continue;
    }

    if (!isPlainObject(base.blocks)) {
      throw new Error(`[prague-l10n] ${basePath}: blocks must be an object`);
    }

    const blockTypeMap = await loadTokyoPage(pageId);
    for (const blockId of Object.keys(base.blocks)) {
      if (!blockTypeMap.has(blockId)) {
        throw new Error(`[prague-l10n] ${pageId}: block "${blockId}" missing from tokyo page`);
      }
    }
    for (const blockId of blockTypeMap.keys()) {
      if (!(blockId in base.blocks)) {
        throw new Error(`[prague-l10n] ${pageId}: base missing block "${blockId}"`);
      }
    }

    const allowlistPaths = [];
    for (const [blockId, blockType] of blockTypeMap.entries()) {
      const allowlistPath = path.join(ALLOWLIST_ROOT, 'blocks', `${blockType}.allowlist.json`);
      if (!(await fileExists(allowlistPath))) {
        throw new Error(`[prague-l10n] Missing allowlist for block type ${blockType}: ${allowlistPath}`);
      }
      const allowlist = await loadAllowlist(allowlistPath);
      allowlistPaths.push(...buildAllowlistPrefix(blockId, allowlist.entries));
    }

    for (const locale of overlayLocales) {
      const overlayPath = path.join(TOKYO_PRAGUE_ROOT, pageId, locale, `${baseFingerprint}.ops.json`);
      if (!(await fileExists(overlayPath))) {
        throw new Error(`[prague-l10n] Missing overlay for ${pageId}/${locale}: ${overlayPath}`);
      }
      await verifyOverlay({ overlayPath, allowlistPaths, baseFingerprint });
    }
  }

  console.log('[prague-l10n] Verification complete.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
