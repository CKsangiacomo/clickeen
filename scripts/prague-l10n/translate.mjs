#!/usr/bin/env node
/* eslint-disable no-console */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  collectTranslatableEntries,
  ensureDir,
  ensurePosixPath,
  fileExists,
  hasProhibitedSegment,
  listJsonFiles,
  normalizeLocaleToken,
  normalizeOpPath,
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
const DOTENV_LOCAL = path.join(REPO_ROOT, '.env.local');

async function writeLayerIndex({ pageId, locales, baseFingerprint }) {
  const keys = [...locales].sort((a, b) => a.localeCompare(b));
  if (!keys.length) return;
  const lastPublishedFingerprint = {};
  for (const locale of keys) {
    lastPublishedFingerprint[locale] = baseFingerprint;
  }
  const index = {
    v: 1,
    publicId: pageId,
    layers: {
      locale: {
        keys,
        lastPublishedFingerprint,
      },
    },
  };
  const outPath = path.join(TOKYO_PRAGUE_ROOT, pageId, 'index.json');
  await ensureDir(path.dirname(outPath));
  await fs.writeFile(outPath, prettyStableJson(index));
}

function getSfBaseUrl() {
  return String(process.env.SANFRANCISCO_BASE_URL || 'http://localhost:3002').replace(/\/+$/, '');
}

function getSfAuth() {
  return String(process.env.PARIS_DEV_JWT || '').trim();
}

async function loadDotenvIfPresent() {
  try {
    const raw = await fs.readFile(DOTENV_LOCAL, 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if (!key) continue;
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (process.env[key] == null || process.env[key] === '') process.env[key] = val;
    }
  } catch (err) {
    if (err && (err.code === 'ENOENT' || err.code === 'ENOTDIR')) return;
    throw err;
  }
}

function computeBaseFingerprint(config) {
  return sha256Hex(stableStringify(config));
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

async function loadLocales() {
  return await readJson(LOCALES_PATH);
}

function normalizeLocales(raw) {
  if (!Array.isArray(raw)) throw new Error(`[prague-l10n] Invalid locales file: ${LOCALES_PATH}`);
  const locales = raw.map((v) => normalizeLocaleToken(v)).filter((v) => v);
  if (!locales.includes('en')) {
    throw new Error('[prague-l10n] locales.json must include "en"');
  }
  return Array.from(new Set(locales)).sort();
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

async function loadAllowlist(filePath) {
  const allowlist = await readJson(filePath);
  if (!isPlainObject(allowlist) || allowlist.v !== 1 || !Array.isArray(allowlist.paths)) {
    throw new Error(`[prague-l10n] Invalid allowlist ${filePath}`);
  }
  const entries = [];
  for (const entry of allowlist.paths) {
    const pathValue = typeof entry?.path === 'string' ? normalizeOpPath(entry.path) : '';
    const typeValue = entry?.type === 'string' || entry?.type === 'richtext' ? entry.type : null;
    if (!pathValue || !typeValue) {
      throw new Error(`[prague-l10n] Invalid allowlist entry in ${filePath}`);
    }
    if (hasProhibitedSegment(pathValue)) {
      throw new Error(`[prague-l10n] Allowlist path contains prohibited segment: ${pathValue}`);
    }
    entries.push({ path: pathValue, type: typeValue });
  }
  return { v: allowlist.v, entries };
}

async function translateWithSanFrancisco({ job, items }) {
  const auth = getSfAuth();
  if (!auth) {
    throw new Error('[prague-l10n] Missing PARIS_DEV_JWT for San Francisco auth');
  }
  const baseUrl = getSfBaseUrl();
  const res = await fetch(`${baseUrl}/v1/l10n/translate`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${auth}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ ...job, items }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`[prague-l10n] San Francisco error ${res.status}: ${body}`);
  }
  const json = await res.json();
  if (!json || json.v !== 1 || !Array.isArray(json.items)) {
    throw new Error('[prague-l10n] Invalid San Francisco response');
  }
  if (json.items.length !== items.length) {
    throw new Error('[prague-l10n] Translation response length mismatch');
  }
  const out = [];
  for (let i = 0; i < items.length; i += 1) {
    const expected = items[i];
    const actual = json.items[i];
    if (!actual || actual.path !== expected.path || typeof actual.value !== 'string') {
      throw new Error('[prague-l10n] Translation response item mismatch');
    }
    out.push({ path: actual.path, value: actual.value });
  }
  return out;
}

async function translateChrome({ base, baseFingerprint, baseUpdatedAt, locales }) {
  const allowlist = await loadAllowlist(path.join(ALLOWLIST_ROOT, 'chrome.allowlist.json'));
  const items = collectTranslatableEntries(base, allowlist.entries);
  if (!items.length) return;

  for (const locale of locales) {
    const outDir = path.join(TOKYO_PRAGUE_ROOT, 'chrome', 'locale', locale);
    const outPath = path.join(outDir, `${baseFingerprint}.ops.json`);
    if (await fileExists(outPath)) continue;
    const job = {
      v: 1,
      surface: 'prague',
      kind: 'system',
      chunkKey: 'chrome',
      blockKind: 'chrome',
      locale,
      baseFingerprint,
      baseUpdatedAt,
      allowlistVersion: allowlist.v,
    };
    const translated = await translateWithSanFrancisco({ job, items });
    const ops = translated.map((item) => ({ op: 'set', path: item.path, value: item.value }));
    await ensureDir(outDir);
    await fs.writeFile(outPath, prettyStableJson({ v: 1, baseFingerprint, baseUpdatedAt, ops }));
  }
  await writeLayerIndex({ pageId: 'chrome', locales, baseFingerprint });
}

async function translatePage({ pageId, pagePath, base, blockTypeMap, baseFingerprint, baseUpdatedAt, locales }) {
  if (!isPlainObject(base.blocks)) {
    throw new Error(`[prague-l10n] ${pageId}: base blocks missing`);
  }
  for (const blockId of blockTypeMap.keys()) {
    if (!base.blocks || !(blockId in base.blocks)) {
      throw new Error(`[prague-l10n] ${pageId}: base missing block "${blockId}"`);
    }
  }

  const blockItems = new Map();
  const expectedPaths = new Set();
  for (const [blockId, blockType] of blockTypeMap.entries()) {
    const allowlistPath = path.join(ALLOWLIST_ROOT, 'blocks', `${blockType}.allowlist.json`);
    if (!(await fileExists(allowlistPath))) {
      throw new Error(`[prague-l10n] Missing allowlist for block type ${blockType}: ${allowlistPath}`);
    }
    const allowlist = await loadAllowlist(allowlistPath);
    const blockBase = base.blocks[blockId];
    if (!isPlainObject(blockBase)) {
      throw new Error(`[prague-l10n] ${pageId}: block ${blockId} base missing`);
    }
    const items = collectTranslatableEntries(blockBase, allowlist.entries);
    if (!items.length) {
      throw new Error(`[prague-l10n] NOT TRANSLATED: ${pagePath} block "${blockId}" missing copy paths`);
    }
    blockItems.set(blockId, { items, blockType, allowlistVersion: allowlist.v });
    for (const item of items) {
      expectedPaths.add(`blocks.${blockId}.${item.path}`);
    }
  }

  const missingLocales = [];
  const overlaysByLocale = new Map();
  for (const locale of locales) {
    const outPath = path.join(TOKYO_PRAGUE_ROOT, pageId, 'locale', locale, `${baseFingerprint}.ops.json`);
    let needsRegeneration = false;
    if (!(await fileExists(outPath))) {
      needsRegeneration = true;
    } else {
      const overlay = await readJson(outPath);
      if (!overlay || typeof overlay !== 'object' || overlay.v !== 1) {
        needsRegeneration = true;
      } else if (overlay.baseFingerprint !== baseFingerprint) {
        needsRegeneration = true;
      } else {
        const overlayPaths = new Set(
          Array.isArray(overlay.ops)
            ? overlay.ops.filter((op) => op && typeof op === 'object' && op.op === 'set').map((op) => op.path)
            : [],
        );
        for (const expected of expectedPaths) {
          if (!overlayPaths.has(expected)) {
            needsRegeneration = true;
            break;
          }
        }
      }
    }
    if (!needsRegeneration) continue;
    overlaysByLocale.set(locale, []);
    missingLocales.push(locale);
  }
  if (!missingLocales.length) {
    await writeLayerIndex({ pageId, locales, baseFingerprint });
    return;
  }

  for (const [blockId, meta] of blockItems.entries()) {
    for (const locale of missingLocales) {
      const job = {
        v: 1,
        surface: 'prague',
        kind: 'system',
        chunkKey: `${pageId}/blocks/${blockId}`,
        blockKind: meta.blockType,
        locale,
        baseFingerprint,
        baseUpdatedAt,
        allowlistVersion: meta.allowlistVersion,
      };
      const translated = await translateWithSanFrancisco({ job, items: meta.items });
      const ops = translated.map((item) => ({
        op: 'set',
        path: `blocks.${blockId}.${item.path}`,
        value: item.value,
      }));
      overlaysByLocale.get(locale).push(...ops);
    }
  }

  for (const locale of missingLocales) {
    const ops = overlaysByLocale.get(locale) ?? [];
    const outDir = path.join(TOKYO_PRAGUE_ROOT, pageId, 'locale', locale);
    await ensureDir(outDir);
    const outPath = path.join(outDir, `${baseFingerprint}.ops.json`);
    await fs.writeFile(outPath, prettyStableJson({ v: 1, baseFingerprint, baseUpdatedAt, ops }));
  }

  await writeLayerIndex({ pageId, locales, baseFingerprint });
}

async function main() {
  await loadDotenvIfPresent();

  const locales = normalizeLocales(await loadLocales()).filter((l) => l !== 'en');
  if (!locales.length) {
    console.log('[prague-l10n] No non-en locales configured.');
    return;
  }

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
    const chromeStat = await fs.stat(CHROME_BASE_PATH);
    const chromeUpdatedAt = chromeStat.mtime.toISOString();
    const chromeFingerprint = computeBaseFingerprint(chromeBase);
    await translateChrome({ base: chromeBase, baseFingerprint: chromeFingerprint, baseUpdatedAt: chromeUpdatedAt, locales });
  }

  for (const entry of pageFiles) {
    const { blocks, blockTypeMap } = await loadWidgetPageJson(entry);
    const base = buildPageBase({ pageId: entry.pageId, blocks, pagePath: entry.filePath });
    const baseStat = await fs.stat(entry.filePath);
    const baseUpdatedAt = baseStat.mtime.toISOString();
    const baseFingerprint = computeBaseFingerprint(base);
    await translatePage({
      pageId: entry.pageId,
      pagePath: entry.filePath,
      base,
      blockTypeMap,
      baseFingerprint,
      baseUpdatedAt,
      locales,
    });
  }

  console.log('[prague-l10n] Overlays generated.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
