#!/usr/bin/env node
/* eslint-disable no-console */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHmac } from 'node:crypto';
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
const ALLOWLIST_ROOT = path.join(REPO_ROOT, 'prague', 'content', 'allowlists', 'current');
const TOKYO_PRAGUE_PAGES_ROOT = path.join(REPO_ROOT, 'tokyo', 'prague', 'pages');
const LOCALES_PATH = path.join(REPO_ROOT, 'packages', 'l10n', 'locales.json');
const DOTENV_LOCAL = path.join(REPO_ROOT, '.env.local');

let cachedSfBaseUrl = null;

const TRANSLATE_BATCH_MAX_ITEMS = 60;
const TRANSLATE_BATCH_MAX_CHARS = 2500;
const TRANSLATE_REQUEST_RETRIES = 2;
const TRANSLATE_SPLIT_MAX_DEPTH = 7;
const TRANSLATE_LOCALE_CONCURRENCY = Math.max(
  1,
  Number.parseInt(String(process.env.PRAGUE_L10N_TRANSLATE_CONCURRENCY || '4'), 10) || 4,
);

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

function getAiGrantSecret() {
  return String(process.env.AI_GRANT_HMAC_SECRET || '').trim();
}

function base64UrlEncodeBuffer(buffer) {
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function signPragueL10nBody({ secret, bodyText }) {
  return base64UrlEncodeBuffer(createHmac('sha256', secret).update(`prague-l10n.${bodyText}`).digest());
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

async function loadWidgetPageJson(args) {
  const json = await readJson(args.filePath);
  if (!json || typeof json !== 'object' || Array.isArray(json)) {
    throw new Error(`[prague-l10n] Invalid tokyo page JSON: ${args.filePath}`);
  }
  const blocks = json.blocks;
  if (!Array.isArray(blocks)) {
    throw new Error(`[prague-l10n] tokyo/prague/pages/${args.widget}/${args.page}.json missing blocks[]`);
  }
  const blockTypeMap = new Map();
  for (const block of blocks) {
    if (!block || typeof block !== 'object' || Array.isArray(block)) {
      throw new Error(`[prague-l10n] Invalid block entry in tokyo/prague/pages/${args.widget}/${args.page}.json`);
    }
    const id = String(block.id || '').trim();
    const type = String(block.type || '').trim();
    if (!id || !type) {
      throw new Error(`[prague-l10n] tokyo/prague/pages/${args.widget}/${args.page}.json missing block id/type`);
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
  return { pageId, blocks: baseBlocks };
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
  if (!isPlainObject(allowlist)  || !Array.isArray(allowlist.paths)) {
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
  return { entries };
}

function parseSfStatus(err) {
  const message = err instanceof Error ? err.message : String(err);
  const match = message.match(/San Francisco error (\d{3})\b/);
  if (!match) return null;
  const status = Number.parseInt(match[1], 10);
  return Number.isFinite(status) ? status : null;
}

function shouldSplitTranslateError(err) {
  const status = parseSfStatus(err);
  if (status !== 502) return false;
  const message = err instanceof Error ? err.message : String(err);
  return message.includes('Invalid JSON response') || message.includes('Empty model response');
}

async function sleep(ms) {
  if (!ms || ms <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function runWithConcurrency(items, limit, worker) {
  const queue = Array.isArray(items) ? items.slice() : [];
  if (!queue.length) return;
  const concurrency = Math.max(1, Math.min(limit, queue.length));

  const runners = Array.from({ length: concurrency }, async () => {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const next = queue.shift();
      if (typeof next === 'undefined') return;
      await worker(next);
    }
  });

  await Promise.all(runners);
}

function splitTranslateBatches(items) {
  const batches = [];
  let current = [];
  let currentChars = 0;

  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    const value = item.value;
    if (typeof value !== 'string') continue;
    const itemChars = value.length;
    if (itemChars > TRANSLATE_BATCH_MAX_CHARS) {
      throw new Error(`[prague-l10n] Translation item too large (${itemChars} chars): ${String(item.path || '')}`);
    }

    const wouldExceedItems = current.length >= TRANSLATE_BATCH_MAX_ITEMS;
    const wouldExceedChars = currentChars + itemChars > TRANSLATE_BATCH_MAX_CHARS;
    if (current.length > 0 && (wouldExceedItems || wouldExceedChars)) {
      batches.push(current);
      current = [];
      currentChars = 0;
    }

    current.push(item);
    currentChars += itemChars;
  }

  if (current.length) batches.push(current);
  return batches;
}

async function translateWithSanFrancisco({ job, items }) {
  const secret = getAiGrantSecret();
  if (!secret) {
    throw new Error('[prague-l10n] Missing AI_GRANT_HMAC_SECRET for San Francisco request signing');
  }
  const baseUrl = getSfBaseUrl();
  const url = `${baseUrl}/l10n/translate`;
  const bodyText = JSON.stringify({ ...job, items });
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-clickeen-signature': signPragueL10nBody({ secret, bodyText }),
    },
    body: bodyText,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`[prague-l10n] San Francisco error ${res.status} (${url}): ${body}`);
  }
  const json = await res.json();
  if (!json  || !Array.isArray(json.items)) {
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

async function translateWithSanFranciscoResilient({ job, items, depth = 0 }) {
  let lastError = null;

  for (let attempt = 1; attempt <= TRANSLATE_REQUEST_RETRIES; attempt += 1) {
    try {
      return await translateWithSanFrancisco({ job, items });
    } catch (err) {
      lastError = err;
      const status = parseSfStatus(err);
      const retryable = status === 429 || status === 502 || status === 503 || status === 504;
      if (!retryable || attempt === TRANSLATE_REQUEST_RETRIES) break;
      await sleep(350 * attempt);
    }
  }

  if (shouldSplitTranslateError(lastError) && items.length > 1 && depth < TRANSLATE_SPLIT_MAX_DEPTH) {
    const mid = Math.ceil(items.length / 2);
    const leftItems = items.slice(0, mid);
    const rightItems = items.slice(mid);
    console.warn(
      `[prague-l10n] ${job.chunkKey} ${job.locale}: retrying with smaller batches (${leftItems.length}+${rightItems.length})`,
    );
    const [left, right] = await Promise.all([
      translateWithSanFranciscoResilient({ job: { ...job, chunkKey: `${job.chunkKey}#a` }, items: leftItems, depth: depth + 1 }),
      translateWithSanFranciscoResilient({ job: { ...job, chunkKey: `${job.chunkKey}#b` }, items: rightItems, depth: depth + 1 }),
    ]);
    return [...left, ...right];
  }

  throw lastError;
}

function pageTranslationPath({ pageFilePath, page, locale }) {
  return path.join(path.dirname(pageFilePath), `${page}.translations`, `${locale}.json`);
}

async function translatePage({ pageId, page, pagePath, base, blockTypeMap, baseFingerprint, baseUpdatedAt, locales }) {
  if (!isPlainObject(base.blocks)) {
    throw new Error(`[prague-l10n] ${pageId}: base blocks missing`);
  }
  for (const blockId of blockTypeMap.keys()) {
    if (!base.blocks || !(blockId in base.blocks)) {
      throw new Error(`[prague-l10n] ${pageId}: base missing block "${blockId}"`);
    }
  }

  const expectedPaths = new Set();
  const pageItems = [];
  let allowlistEntryCountMax = 0;
  for (const [blockId, blockType] of blockTypeMap.entries()) {
    const allowlistPath = path.join(ALLOWLIST_ROOT, 'blocks', `${blockType}.allowlist.json`);
    if (!(await fileExists(allowlistPath))) {
      throw new Error(`[prague-l10n] Missing allowlist for block type ${blockType}: ${allowlistPath}`);
    }
    const allowlist = await loadAllowlist(allowlistPath);
    allowlistEntryCountMax = Math.max(allowlistEntryCountMax, allowlist.entries.length);
    const blockBase = base.blocks[blockId];
    if (!isPlainObject(blockBase)) {
      throw new Error(`[prague-l10n] ${pageId}: block ${blockId} base missing`);
    }
    const items = collectTranslatableEntries(blockBase, allowlist.entries);
    if (!items.length) {
      throw new Error(`[prague-l10n] NOT TRANSLATED: ${pagePath} block "${blockId}" missing copy paths`);
    }
    for (const item of items) {
      const fullPath = normalizeOpPath(`blocks.${blockId}.${item.path}`);
      if (!fullPath || hasProhibitedSegment(fullPath)) {
        throw new Error(`[prague-l10n] ${pageId}: prohibited op path "${fullPath}"`);
      }
      expectedPaths.add(fullPath);
      if (typeof item.value !== 'string') {
        throw new Error(`[prague-l10n] ${pageId}: expected string value for ${fullPath}`);
      }
      pageItems.push({ path: fullPath, type: item.type, value: item.value });
    }
  }

  const missingLocales = [];
  const overlaysByLocale = new Map();
  for (const locale of locales) {
    const outPath = pageTranslationPath({ pageFilePath: pagePath, page, locale });
    let needsRegeneration = false;
    if (!(await fileExists(outPath))) {
      needsRegeneration = true;
    } else {
      const overlay = await readJson(outPath);
      if (!overlay || typeof overlay !== 'object' ) {
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
  if (!missingLocales.length) return;

  await runWithConcurrency(missingLocales, TRANSLATE_LOCALE_CONCURRENCY, async (locale) => {
    const toTranslate = [];
    for (const item of pageItems) {
      const fullPath = item.path;
      const currentBase = item.value;
      if (typeof currentBase !== 'string') continue;
      toTranslate.push({ path: fullPath, type: item.type, value: currentBase });
    }

    const jobBase = {
      surface: 'prague',
      kind: 'system',
      chunkKey: `${pageId}/page`,
      blockKind: 'page',
      locale,
      baseFingerprint,
      baseUpdatedAt,
      allowlistId: allowlistEntryCountMax,
    };

    const batches = splitTranslateBatches(toTranslate);
    const translatedByPath = new Map();
    for (let i = 0; i < batches.length; i += 1) {
      const batch = batches[i];
      if (!batch.length) continue;
      const total = toTranslate.length;
      const label = batches.length === 1 ? `${batch.length}/${total}` : `${batch.length}/${total} (batch ${i + 1}/${batches.length})`;
      console.log(`[prague-l10n] ${pageId} ${locale}: translating ${label} item(s)`);

      const translated = await translateWithSanFranciscoResilient({
        job: batches.length === 1 ? jobBase : { ...jobBase, chunkKey: `${jobBase.chunkKey}#${i + 1}` },
        items: batch,
      });
      for (const item of translated) {
        if (typeof item?.path === 'string' && typeof item?.value === 'string') {
          translatedByPath.set(item.path, item.value);
        }
      }
    }

    const ops = [];
    for (const item of pageItems) {
      const value = translatedByPath.get(item.path);
      if (typeof value !== 'string') {
        throw new Error(`[prague-l10n] ${pageId} ${locale}: missing translation for ${item.path}`);
      }
      ops.push({ op: 'set', path: item.path, value });
    }

    overlaysByLocale.set(locale, ops);
  });

  for (const locale of missingLocales) {
    const ops = overlaysByLocale.get(locale) ?? [];
    const outPath = pageTranslationPath({ pageFilePath: pagePath, page, locale });
    const outDir = path.dirname(outPath);
    await ensureDir(outDir);
    await fs.writeFile(outPath, prettyStableJson({ baseFingerprint, baseUpdatedAt, ops }));
  }
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

  for (const entry of pageFiles) {
    const { blocks, blockTypeMap } = await loadWidgetPageJson(entry);
    const base = buildPageBase({ pageId: entry.pageId, blocks, pagePath: entry.filePath });
    const baseStat = await fs.stat(entry.filePath);
    const baseUpdatedAt = baseStat.mtime.toISOString();
    const baseFingerprint = computeBaseFingerprint(base);
    await translatePage({
      pageId: entry.pageId,
      page: entry.page,
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
