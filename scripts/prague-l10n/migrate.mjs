#!/usr/bin/env node
/* eslint-disable no-console */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ensureDir,
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
const OLD_ROOT = path.join(REPO_ROOT, 'prague-strings');
const OLD_COMPILED_ROOT = path.join(OLD_ROOT, 'compiled', 'v1', 'en');
const OLD_OVERLAY_ROOT = path.join(OLD_ROOT, 'overlays', 'v1');
const OLD_ALLOWLIST_ROOT = path.join(OLD_ROOT, 'allowlists', 'v1');
const LOCALES_PATH = path.join(REPO_ROOT, 'config', 'locales.json');

const NEW_CONTENT_ROOT = path.join(REPO_ROOT, 'prague', 'content');
const NEW_BASE_ROOT = path.join(NEW_CONTENT_ROOT, 'base', 'v1');
const NEW_ALLOWLIST_ROOT = path.join(NEW_CONTENT_ROOT, 'allowlists', 'v1');
const NEW_ALLOWLIST_BLOCKS = path.join(NEW_ALLOWLIST_ROOT, 'blocks');

const TOKYO_PRAGUE_ROOT = path.join(REPO_ROOT, 'tokyo', 'l10n', 'prague');

function computeBaseFingerprint(config) {
  return sha256Hex(stableStringify(config));
}

function pageIdFromFile(root, filePath) {
  const rel = path.relative(root, filePath);
  const noExt = rel.replace(/\.json$/i, '');
  return ensurePosixPath(noExt);
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
  const json = await readJson(filePath);
  if (!isPlainObject(json) || json.v !== 1 || !Array.isArray(json.paths)) {
    throw new Error(`[prague-l10n] Invalid allowlist: ${filePath}`);
  }
  const entries = [];
  for (const entry of json.paths) {
    const pathValue = typeof entry?.path === 'string' ? normalizeOpPath(entry.path) : '';
    const typeValue = entry?.type === 'string' || entry?.type === 'richtext' ? entry.type : null;
    if (!pathValue || !typeValue) {
      throw new Error(`[prague-l10n] Invalid allowlist entry in ${filePath}`);
    }
    entries.push({ path: pathValue, type: typeValue });
  }
  return { v: json.v, entries };
}

async function migrateAllowlists() {
  await ensureDir(NEW_ALLOWLIST_ROOT);
  await ensureDir(NEW_ALLOWLIST_BLOCKS);

  const chromeAllowlistPath = path.join(OLD_ALLOWLIST_ROOT, 'chrome.allowlist.json');
  const chromeAllowlist = await readJson(chromeAllowlistPath);
  await fs.writeFile(path.join(NEW_ALLOWLIST_ROOT, 'chrome.allowlist.json'), prettyStableJson(chromeAllowlist));

  const blockAllowlistFiles = await listJsonFiles(path.join(OLD_ALLOWLIST_ROOT, 'blocks'));
  for (const filePath of blockAllowlistFiles) {
    const allowlist = await readJson(filePath);
    if (!isPlainObject(allowlist) || allowlist.v !== 1 || !Array.isArray(allowlist.paths)) {
      throw new Error(`[prague-l10n] Invalid block allowlist: ${filePath}`);
    }
    const next = {
      v: 1,
      paths: allowlist.paths.map((entry) => {
        const rawPath = typeof entry?.path === 'string' ? normalizeOpPath(entry.path) : '';
        if (!rawPath.startsWith('strings.')) {
          throw new Error(`[prague-l10n] Block allowlist path must start with "strings.": ${filePath}`);
        }
        const copyPath = rawPath.replace(/^strings\./, 'copy.');
        return { path: copyPath, type: entry.type };
      }),
    };
    const outPath = path.join(NEW_ALLOWLIST_BLOCKS, path.basename(filePath));
    await fs.writeFile(outPath, prettyStableJson(next));
  }
}

async function migrateBase() {
  await ensureDir(NEW_BASE_ROOT);
  const compiledFiles = await listJsonFiles(OLD_COMPILED_ROOT);
  if (!compiledFiles.length) throw new Error('[prague-l10n] No compiled base files found');

  for (const filePath of compiledFiles) {
    const pageId = pageIdFromFile(OLD_COMPILED_ROOT, filePath);
    const json = await readJson(filePath);
    if (!isPlainObject(json) || json.v !== 1) {
      throw new Error(`[prague-l10n] Invalid compiled base file: ${filePath}`);
    }
    if (pageId === 'chrome') {
      if (!isPlainObject(json.strings)) {
        throw new Error(`[prague-l10n] chrome.json missing strings: ${filePath}`);
      }
      const outPath = path.join(NEW_BASE_ROOT, 'chrome.json');
      await ensureDir(path.dirname(outPath));
      await fs.writeFile(outPath, prettyStableJson({ v: 1, strings: json.strings }));
      continue;
    }
    if (!isPlainObject(json.blocks)) {
      throw new Error(`[prague-l10n] ${filePath}: blocks must be an object`);
    }
    const blocks = {};
    for (const [blockId, block] of Object.entries(json.blocks)) {
      if (!isPlainObject(block) || !isPlainObject(block.strings)) {
        throw new Error(`[prague-l10n] ${filePath}: block ${blockId} missing strings`);
      }
      blocks[blockId] = { copy: block.strings };
    }
    const outPath = path.join(NEW_BASE_ROOT, `${pageId}.json`);
    await ensureDir(path.dirname(outPath));
    await fs.writeFile(outPath, prettyStableJson({ v: 1, pageId, blocks }));
  }
}

function buildAllowlistPrefix(blockId, allowlistEntries) {
  return allowlistEntries.map((entry) => `blocks.${blockId}.${entry.path}`);
}

function transformBlockOps({ blockId, overlayOps, allowlistPaths, pageId, locale }) {
  const ops = [];
  for (let i = 0; i < overlayOps.length; i += 1) {
    const op = overlayOps[i];
    if (!op || typeof op !== 'object') {
      throw new Error(`[prague-l10n] ${pageId}/${locale}: ops[${i}] must be an object`);
    }
    if (op.op !== 'set') {
      throw new Error(`[prague-l10n] ${pageId}/${locale}: ops[${i}].op must be "set"`);
    }
    const rawPath = typeof op.path === 'string' ? normalizeOpPath(op.path) : '';
    if (!rawPath || !rawPath.startsWith('strings.')) {
      throw new Error(`[prague-l10n] ${pageId}/${locale}: ops[${i}].path must start with "strings."`);
    }
    const copyPath = rawPath.replace(/^strings\./, 'copy.');
    const fullPath = `blocks.${blockId}.${copyPath}`;
    if (!allowlistPaths.some((allow) => pathMatchesAllowlist(fullPath, allow))) {
      throw new Error(`[prague-l10n] ${pageId}/${locale}: ops[${i}].path not allowlisted (${fullPath})`);
    }
    if (typeof op.value !== 'string') {
      throw new Error(`[prague-l10n] ${pageId}/${locale}: ops[${i}].value must be a string`);
    }
    ops.push({ op: 'set', path: fullPath, value: op.value });
  }
  return ops;
}

async function migrateOverlays() {
  const locales = normalizeLocales(await readJson(LOCALES_PATH));
  const overlayLocales = locales.filter((l) => l !== 'en');
  if (!overlayLocales.length) {
    console.log('[prague-l10n] No non-en locales configured.');
    return;
  }

  const baseFiles = await listJsonFiles(NEW_BASE_ROOT);
  for (const basePath of baseFiles) {
    const pageId = pageIdFromFile(NEW_BASE_ROOT, basePath);
    const base = await readJson(basePath);
    if (!isPlainObject(base) || base.v !== 1) {
      throw new Error(`[prague-l10n] Invalid base file: ${basePath}`);
    }
    const baseStat = await fs.stat(basePath);
    const baseUpdatedAt = baseStat.mtime.toISOString();
    const baseFingerprint = computeBaseFingerprint(base);
    const outBaseDir = path.join(TOKYO_PRAGUE_ROOT, pageId);

    if (pageId === 'chrome') {
      const allowlist = await loadAllowlist(path.join(NEW_ALLOWLIST_ROOT, 'chrome.allowlist.json'));
      const allowlistPaths = allowlist.entries.map((entry) => entry.path);
      for (const locale of overlayLocales) {
        const overlayPath = path.join(OLD_OVERLAY_ROOT, 'chrome', `${locale}.ops.json`);
        if (!(await fileExists(overlayPath))) {
          throw new Error(`[prague-l10n] Missing chrome overlay for ${locale}: ${overlayPath}`);
        }
        const overlay = await readJson(overlayPath);
        if (!isPlainObject(overlay) || overlay.v !== 1 || !Array.isArray(overlay.ops)) {
          throw new Error(`[prague-l10n] Invalid chrome overlay: ${overlayPath}`);
        }
        const ops = [];
        for (const op of overlay.ops) {
          const rawPath = typeof op?.path === 'string' ? normalizeOpPath(op.path) : '';
          if (!rawPath) throw new Error(`[prague-l10n] chrome/${locale}: invalid op path`);
          if (!allowlistPaths.some((allow) => pathMatchesAllowlist(rawPath, allow))) {
            throw new Error(`[prague-l10n] chrome/${locale}: op not allowlisted (${rawPath})`);
          }
          if (op.op !== 'set' || typeof op.value !== 'string') {
            throw new Error(`[prague-l10n] chrome/${locale}: invalid op`);
          }
          ops.push({ op: 'set', path: rawPath, value: op.value });
        }
        ops.sort((a, b) => a.path.localeCompare(b.path));
        const outDir = path.join(outBaseDir, locale);
        await ensureDir(outDir);
        const outPath = path.join(outDir, `${baseFingerprint}.ops.json`);
        await fs.writeFile(outPath, prettyStableJson({ v: 1, baseFingerprint, baseUpdatedAt, ops }));
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

    const overlaysByLocale = new Map();
    for (const locale of overlayLocales) {
      overlaysByLocale.set(locale, []);
    }

    for (const [blockId, blockType] of blockTypeMap.entries()) {
      const allowlistPath = path.join(NEW_ALLOWLIST_BLOCKS, `${blockType}.allowlist.json`);
      if (!(await fileExists(allowlistPath))) {
        throw new Error(`[prague-l10n] Missing allowlist for block type ${blockType}: ${allowlistPath}`);
      }
      const allowlist = await loadAllowlist(allowlistPath);
      const allowlistPaths = buildAllowlistPrefix(blockId, allowlist.entries);

      for (const locale of overlayLocales) {
        const overlayPath = path.join(OLD_OVERLAY_ROOT, pageId, 'blocks', blockId, `${locale}.ops.json`);
        if (!(await fileExists(overlayPath))) {
          throw new Error(`[prague-l10n] Missing overlay for ${pageId}/${blockId}/${locale}: ${overlayPath}`);
        }
        const overlay = await readJson(overlayPath);
        if (!isPlainObject(overlay) || overlay.v !== 1 || !Array.isArray(overlay.ops)) {
          throw new Error(`[prague-l10n] Invalid overlay for ${pageId}/${blockId}/${locale}: ${overlayPath}`);
        }
        const ops = transformBlockOps({ blockId, overlayOps: overlay.ops, allowlistPaths, pageId, locale });
        overlaysByLocale.get(locale).push(...ops);
      }
    }

    for (const locale of overlayLocales) {
      const ops = overlaysByLocale.get(locale) ?? [];
      ops.sort((a, b) => a.path.localeCompare(b.path));
      const outDir = path.join(outBaseDir, locale);
      await ensureDir(outDir);
      const outPath = path.join(outDir, `${baseFingerprint}.ops.json`);
      await fs.writeFile(outPath, prettyStableJson({ v: 1, baseFingerprint, baseUpdatedAt, ops }));
    }
  }
}

async function main() {
  if (!(await fileExists(OLD_COMPILED_ROOT))) {
    throw new Error(`[prague-l10n] Missing ${OLD_COMPILED_ROOT}. Run the old pipeline or ensure compiled outputs exist.`);
  }
  await migrateAllowlists();
  await migrateBase();
  await migrateOverlays();
  console.log('[prague-l10n] Migration complete.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
