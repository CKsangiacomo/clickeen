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

let cachedSfBaseUrl = null;

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

async function writeBaseSnapshot(args) {
  if (!args.pageId || !args.baseFingerprint) return;
  const outDir = path.join(TOKYO_PRAGUE_ROOT, args.pageId, 'bases');
  await ensureDir(outDir);
  const outPath = path.join(outDir, `${args.baseFingerprint}.snapshot.json`);
  await fs.writeFile(outPath, prettyStableJson({ v: 1, pageId: args.pageId, baseFingerprint: args.baseFingerprint, baseUpdatedAt: args.baseUpdatedAt ?? null, snapshot: args.snapshot }));
}

async function loadLayerIndex(pageId) {
  const indexPath = path.join(TOKYO_PRAGUE_ROOT, pageId, 'index.json');
  if (!(await fileExists(indexPath))) return null;
  const index = await readJson(indexPath).catch(() => null);
  if (!index || typeof index !== 'object' || index.v !== 1) return null;
  if (!index.layers || typeof index.layers !== 'object') return null;
  const localeLayer = index.layers.locale;
  if (!localeLayer || typeof localeLayer !== 'object') return null;
  const lastPublishedFingerprint =
    localeLayer.lastPublishedFingerprint && typeof localeLayer.lastPublishedFingerprint === 'object' && !Array.isArray(localeLayer.lastPublishedFingerprint)
      ? localeLayer.lastPublishedFingerprint
      : null;
  return { lastPublishedFingerprint };
}

function getSfBaseUrl() {
  if (cachedSfBaseUrl) return cachedSfBaseUrl;
  const raw = String(process.env.SANFRANCISCO_BASE_URL || 'http://localhost:3002').trim();
  const trimmed = raw.replace(/\/+$/, '');
  try {
    const url = new URL(trimmed);
    if (url.pathname && url.pathname !== '/') {
      console.warn(
        `[prague-l10n] SANFRANCISCO_BASE_URL should be an origin (no path). Using "${url.origin}" instead of "${url.href}".`,
      );
    }
    cachedSfBaseUrl = url.origin;
    return cachedSfBaseUrl;
  } catch (err) {
    cachedSfBaseUrl = trimmed;
    return cachedSfBaseUrl;
  }
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
  const url = `${baseUrl}/v1/l10n/translate`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${auth}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ ...job, items }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`[prague-l10n] San Francisco error ${res.status} (${url}): ${body}`);
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

  const expectedPaths = new Set(items.map((item) => item.path));
  for (const locale of locales) {
    const outDir = path.join(TOKYO_PRAGUE_ROOT, 'chrome', 'locale', locale);
    const outPath = path.join(outDir, `${baseFingerprint}.ops.json`);
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
  const baseSnapshot = {};
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
      const fullPath = normalizeOpPath(`blocks.${blockId}.${item.path}`);
      expectedPaths.add(fullPath);
      if (typeof item.value === 'string') {
        baseSnapshot[fullPath] = item.value;
      }
    }
  }

  await writeBaseSnapshot({ pageId, baseFingerprint, baseUpdatedAt, snapshot: baseSnapshot });

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

  const prevIndex = await loadLayerIndex(pageId);
  const previousByLocale = new Map();
  for (const locale of missingLocales) {
    const prevFingerprintRaw = prevIndex?.lastPublishedFingerprint ? prevIndex.lastPublishedFingerprint[locale] : null;
    const prevFingerprint = typeof prevFingerprintRaw === 'string' ? prevFingerprintRaw.trim() : '';
    if (!prevFingerprint || prevFingerprint === baseFingerprint) {
      previousByLocale.set(locale, null);
      continue;
    }

    const prevOverlayPath = path.join(TOKYO_PRAGUE_ROOT, pageId, 'locale', locale, `${prevFingerprint}.ops.json`);
    const prevSnapshotPath = path.join(TOKYO_PRAGUE_ROOT, pageId, 'bases', `${prevFingerprint}.snapshot.json`);
    if (!(await fileExists(prevOverlayPath)) || !(await fileExists(prevSnapshotPath))) {
      previousByLocale.set(locale, null);
      continue;
    }

    const overlay = await readJson(prevOverlayPath).catch(() => null);
    const snapshotFile = await readJson(prevSnapshotPath).catch(() => null);
    const ops = Array.isArray(overlay?.ops) ? overlay.ops : null;
    const snapshot =
      snapshotFile && typeof snapshotFile === 'object' && snapshotFile.v === 1 && snapshotFile.snapshot && typeof snapshotFile.snapshot === 'object' && !Array.isArray(snapshotFile.snapshot)
        ? snapshotFile.snapshot
        : null;
    if (!ops || !snapshot) {
      previousByLocale.set(locale, null);
      continue;
    }

    const prevOpsByPath = new Map();
    for (const op of ops) {
      if (!op || typeof op !== 'object') continue;
      if (op.op !== 'set') continue;
      const p = typeof op.path === 'string' ? normalizeOpPath(op.path) : '';
      if (!p || hasProhibitedSegment(p)) continue;
      const v = typeof op.value === 'string' ? op.value : null;
      if (v == null) continue;
      prevOpsByPath.set(p, v);
    }

    const prevSnapshot = {};
    for (const [key, value] of Object.entries(snapshot)) {
      if (typeof value !== 'string') continue;
      prevSnapshot[normalizeOpPath(key)] = value;
    }

    previousByLocale.set(locale, { prevFingerprint, prevOpsByPath, prevSnapshot });
  }

  for (const [blockId, meta] of blockItems.entries()) {
    const fullItems = meta.items.map((item) => ({
      ...item,
      fullPath: normalizeOpPath(`blocks.${blockId}.${item.path}`),
    }));

    for (const locale of missingLocales) {
      const prev = previousByLocale.get(locale) ?? null;

      const carry = new Map();
      const toTranslate = [];
      for (const item of fullItems) {
        const fullPath = item.fullPath;
        if (!fullPath) continue;
        const currentBase = baseSnapshot[fullPath];

        if (prev && typeof currentBase === 'string') {
          const prevBase = prev.prevSnapshot[fullPath];
          const unchanged = typeof prevBase === 'string' && prevBase === currentBase;
          if (unchanged) {
            const prevValue = prev.prevOpsByPath.get(fullPath);
            if (typeof prevValue === 'string' && prevValue.trim()) {
              carry.set(item.path, prevValue);
              continue;
            }
          }
        }

        toTranslate.push({ path: item.path, type: item.type, value: item.value });
      }

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
      const total = fullItems.length;
      const changed = toTranslate.length;
      console.log(`[prague-l10n] ${pageId} ${locale}: translating ${changed}/${total} item(s) for ${meta.blockType}`);

      const translated = changed ? await translateWithSanFrancisco({ job, items: toTranslate }) : [];
      const translatedByPath = new Map();
      for (const item of translated) {
        if (typeof item?.path === 'string' && typeof item?.value === 'string') {
          translatedByPath.set(item.path, item.value);
        }
      }

      const ops = [];
      for (const item of fullItems) {
        const value = carry.has(item.path) ? carry.get(item.path) : translatedByPath.get(item.path);
        if (typeof value !== 'string') continue;
        ops.push({
          op: 'set',
          path: `blocks.${blockId}.${item.path}`,
          value,
        });
      }
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
    const chromeAllowlist = await loadAllowlist(path.join(ALLOWLIST_ROOT, 'chrome.allowlist.json'));
    const chromeItems = collectTranslatableEntries(chromeBase, chromeAllowlist.entries);
    const chromeSnapshot = {};
    for (const item of chromeItems) {
      if (typeof item?.path === 'string' && typeof item?.value === 'string') {
        chromeSnapshot[item.path] = item.value;
      }
    }
    await writeBaseSnapshot({ pageId: 'chrome', baseFingerprint: chromeFingerprint, baseUpdatedAt: chromeUpdatedAt, snapshot: chromeSnapshot });
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
