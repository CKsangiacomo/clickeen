#!/usr/bin/env node
/* eslint-disable no-console */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
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
  splitPathSegments,
  stableStringify,
} from './lib.mjs';

const REPO_ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');
const BASE_ROOT = path.join(REPO_ROOT, 'prague', 'content', 'base', 'v1');
const ALLOWLIST_ROOT = path.join(REPO_ROOT, 'prague', 'content', 'allowlists', 'v1');
const TOKYO_PRAGUE_ROOT = path.join(REPO_ROOT, 'tokyo', 'l10n', 'prague');
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

function pageIdFromFile(baseFile) {
  const rel = path.relative(BASE_ROOT, baseFile);
  const noExt = rel.replace(/\.json$/i, '');
  return ensurePosixPath(noExt);
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

function joinPath(base, next) {
  return base ? `${base}.${next}` : next;
}

function collectEntriesForPath({ value, segments, currentPath, type, out }) {
  if (segments.length === 0) {
    if (typeof value === 'string') {
      out.push({ path: currentPath, type, value });
    }
    return;
  }

  const [head, ...tail] = segments;
  if (!head || hasProhibitedSegment(head)) return;

  if (head === '*') {
    if (!Array.isArray(value)) return;
    value.forEach((item, index) => {
      collectEntriesForPath({
        value: item,
        segments: tail,
        currentPath: joinPath(currentPath, String(index)),
        type,
        out,
      });
    });
    return;
  }

  if (Array.isArray(value) && /^\d+$/.test(head)) {
    const index = Number(head);
    collectEntriesForPath({
      value: value[index],
      segments: tail,
      currentPath: joinPath(currentPath, head),
      type,
      out,
    });
    return;
  }

  if (!isPlainObject(value)) return;
  collectEntriesForPath({
    value: value[head],
    segments: tail,
    currentPath: joinPath(currentPath, head),
    type,
    out,
  });
}

function collectTranslatableEntries(base, allowlistEntries) {
  const out = [];
  for (const entry of allowlistEntries) {
    const segments = splitPathSegments(entry.path);
    collectEntriesForPath({
      value: base,
      segments,
      currentPath: '',
      type: entry.type,
      out,
    });
  }
  const deduped = [];
  const seen = new Set();
  for (const item of out) {
    if (!seen.has(item.path)) {
      seen.add(item.path);
      deduped.push(item);
    }
  }
  return deduped;
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

async function translatePage({ pageId, base, baseFingerprint, baseUpdatedAt, locales }) {
  const blockTypeMap = await loadTokyoPage(pageId);
  for (const blockId of Object.keys(base.blocks || {})) {
    if (!blockTypeMap.has(blockId)) {
      throw new Error(`[prague-l10n] ${pageId}: block "${blockId}" missing from tokyo page`);
    }
  }
  for (const blockId of blockTypeMap.keys()) {
    if (!base.blocks || !(blockId in base.blocks)) {
      throw new Error(`[prague-l10n] ${pageId}: base missing block "${blockId}"`);
    }
  }

  const missingLocales = [];
  const overlaysByLocale = new Map();
  for (const locale of locales) {
    const outPath = path.join(TOKYO_PRAGUE_ROOT, pageId, 'locale', locale, `${baseFingerprint}.ops.json`);
    if (await fileExists(outPath)) continue;
    overlaysByLocale.set(locale, []);
    missingLocales.push(locale);
  }
  if (!missingLocales.length) {
    await writeLayerIndex({ pageId, locales, baseFingerprint });
    return;
  }

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
    if (!items.length) continue;

    for (const locale of missingLocales) {
      const job = {
        v: 1,
        surface: 'prague',
        kind: 'system',
        chunkKey: `${pageId}/blocks/${blockId}`,
        blockKind: blockType,
        locale,
        baseFingerprint,
        baseUpdatedAt,
        allowlistVersion: allowlist.v,
      };
      const translated = await translateWithSanFrancisco({ job, items });
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

  const baseFiles = await listJsonFiles(BASE_ROOT);
  if (!baseFiles.length) throw new Error('[prague-l10n] No base content found.');

  for (const basePath of baseFiles) {
    const pageId = pageIdFromFile(basePath);
    const base = await readJson(basePath);
    if (!isPlainObject(base) || base.v !== 1) {
      throw new Error(`[prague-l10n] Invalid base file: ${basePath}`);
    }
    const baseStat = await fs.stat(basePath);
    const baseUpdatedAt = baseStat.mtime.toISOString();
    const baseFingerprint = computeBaseFingerprint(base);

    if (pageId === 'chrome') {
      if (!isPlainObject(base.strings)) {
        throw new Error(`[prague-l10n] chrome base missing strings: ${basePath}`);
      }
      await translateChrome({ base, baseFingerprint, baseUpdatedAt, locales });
      continue;
    }
    if (!isPlainObject(base.blocks)) {
      throw new Error(`[prague-l10n] ${basePath}: blocks must be an object`);
    }
    await translatePage({ pageId, base, baseFingerprint, baseUpdatedAt, locales });
  }

  console.log('[prague-l10n] Overlays generated.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
