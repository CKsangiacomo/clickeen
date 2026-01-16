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
const PRAGUE_STRINGS_ROOT = path.join(REPO_ROOT, 'prague-strings');
const BASE_ROOT = path.join(PRAGUE_STRINGS_ROOT, 'base', 'v1');
const ALLOWLIST_ROOT = path.join(PRAGUE_STRINGS_ROOT, 'allowlists', 'v1');
const OVERLAY_ROOT = path.join(PRAGUE_STRINGS_ROOT, 'overlays', 'v1');
const LOCALES_PATH = path.join(REPO_ROOT, 'config', 'locales.json');
const DOTENV_LOCAL = path.join(REPO_ROOT, '.env.local');

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

function chunkKeyFromFile(baseFile) {
  const rel = path.relative(BASE_ROOT, baseFile);
  const noExt = rel.replace(/\.json$/i, '');
  return ensurePosixPath(noExt);
}

function classifyChunkKey(chunkKey) {
  if (chunkKey === 'chrome') return { type: 'chrome' };
  if (chunkKey.startsWith('shared/')) return { type: 'shared', sharedKey: chunkKey };
  const match = chunkKey.match(/^(.*)\/blocks\/([^/]+)$/);
  if (!match) throw new Error(`[prague-strings] Invalid chunk key (expected */blocks/*): ${chunkKey}`);
  return { type: 'block', pagePath: match[1], blockIdFromPath: match[2] };
}

async function loadLocales() {
  return await readJson(LOCALES_PATH);
}

function normalizeLocales(raw) {
  if (!Array.isArray(raw)) throw new Error(`[prague-strings] Invalid locales file: ${LOCALES_PATH}`);
  const locales = raw.map((v) => normalizeLocaleToken(v)).filter((v) => v);
  if (!locales.includes('en')) {
    throw new Error('[prague-strings] locales.json must include "en"');
  }
  return Array.from(new Set(locales)).sort();
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function validateBaseChunk({ chunkKey, chunkType, base }) {
  if (!isPlainObject(base) || base.v !== 1) {
    throw new Error(`[prague-strings] ${chunkKey}: base must be { v: 1, ... }`);
  }
  if (!isPlainObject(base.strings)) {
    throw new Error(`[prague-strings] ${chunkKey}: base.strings must be an object`);
  }
  if (chunkType.type === 'block') {
    if (!base.blockId || typeof base.blockId !== 'string') {
      throw new Error(`[prague-strings] ${chunkKey}: blockId is required`);
    }
    if (base.blockId !== chunkType.blockIdFromPath) {
      throw new Error(`[prague-strings] ${chunkKey}: blockId must match file path`);
    }
    if (!base.blockKind || typeof base.blockKind !== 'string') {
      throw new Error(`[prague-strings] ${chunkKey}: blockKind is required`);
    }
  }
  if (base.sharedKey != null) {
    if (typeof base.sharedKey !== 'string' || !base.sharedKey.startsWith('shared/')) {
      throw new Error(`[prague-strings] ${chunkKey}: sharedKey must start with "shared/"`);
    }
  }
}

async function loadAllowlist({ chunkKey, chunkType, base }) {
  let allowlistPath;
  if (chunkType.type === 'chrome') {
    allowlistPath = path.join(ALLOWLIST_ROOT, 'chrome.allowlist.json');
  } else if (chunkType.type === 'shared') {
    allowlistPath = path.join(ALLOWLIST_ROOT, 'shared.allowlist.json');
  } else {
    allowlistPath = path.join(ALLOWLIST_ROOT, 'blocks', `${base.blockKind}.allowlist.json`);
  }
  return { allowlistPath, allowlist: await readJson(allowlistPath) };
}

function validateAllowlist({ chunkKey, allowlistPath, allowlist }) {
  if (!isPlainObject(allowlist) || allowlist.v !== 1 || !Array.isArray(allowlist.paths)) {
    throw new Error(`[prague-strings] ${chunkKey}: invalid allowlist ${allowlistPath}`);
  }
  const entries = [];
  for (const entry of allowlist.paths) {
    const pathValue = typeof entry?.path === 'string' ? normalizeOpPath(entry.path) : '';
    const typeValue = entry?.type === 'string' || entry?.type === 'richtext' ? entry.type : null;
    if (!pathValue || !typeValue) {
      throw new Error(`[prague-strings] ${chunkKey}: invalid allowlist entry in ${allowlistPath}`);
    }
    if (!pathValue.startsWith('strings.')) {
      throw new Error(`[prague-strings] ${chunkKey}: allowlist paths must start with "strings."`);
    }
    if (hasProhibitedSegment(pathValue)) {
      throw new Error(`[prague-strings] ${chunkKey}: allowlist path contains prohibited segment: ${pathValue}`);
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
    throw new Error('[prague-strings] Missing PARIS_DEV_JWT for San Francisco auth');
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
    throw new Error(`[prague-strings] San Francisco error ${res.status}: ${body}`);
  }
  const json = await res.json();
  if (!json || json.v !== 1 || !Array.isArray(json.items)) {
    throw new Error('[prague-strings] Invalid San Francisco response');
  }
  if (json.items.length !== items.length) {
    throw new Error('[prague-strings] Translation response length mismatch');
  }
  const out = [];
  for (let i = 0; i < items.length; i += 1) {
    const expected = items[i];
    const actual = json.items[i];
    if (!actual || actual.path !== expected.path || typeof actual.value !== 'string') {
      throw new Error('[prague-strings] Translation response item mismatch');
    }
    out.push({ path: actual.path, value: actual.value });
  }
  return out;
}

async function main() {
  await loadDotenvIfPresent();
  const rawLocales = await loadLocales();
  const locales = normalizeLocales(rawLocales).filter((l) => l !== 'en');
  if (!locales.length) {
    console.log('[prague-strings] No non-en locales configured.');
    return;
  }

  const baseFiles = await listJsonFiles(BASE_ROOT);
  if (!baseFiles.length) throw new Error('[prague-strings] No base chunks found');

  const force = new Set(process.argv.slice(2)).has('--force');

  for (const baseFile of baseFiles) {
    const chunkKey = chunkKeyFromFile(baseFile);
    const chunkType = classifyChunkKey(chunkKey);
    const base = await readJson(baseFile);
    validateBaseChunk({ chunkKey, chunkType, base });

    const { allowlistPath, allowlist } = await loadAllowlist({ chunkKey, chunkType, base });
    const validatedAllowlist = validateAllowlist({ chunkKey, allowlistPath, allowlist });

    const baseFingerprint = sha256Hex(stableStringify(base));
    const baseStat = await fs.stat(baseFile);
    const baseUpdatedAt = baseStat.mtime.toISOString();

    const entries = collectTranslatableEntries(base, validatedAllowlist.entries);

    for (const locale of locales) {
      const overlayPath = path.join(OVERLAY_ROOT, chunkKey, `${locale}.ops.json`);
      if (!force && (await fileExists(overlayPath))) {
        const existing = await readJson(overlayPath).catch(() => null);
        if (existing && existing.baseFingerprint === baseFingerprint) {
          continue;
        }
      }

      const blockKind = typeof base.blockKind === 'string' ? base.blockKind : chunkType.type;
      const job = {
        v: 1,
        surface: 'prague',
        kind: 'system',
        chunkKey,
        blockKind,
        locale,
        baseFingerprint,
        baseUpdatedAt,
        allowlistVersion: validatedAllowlist.v,
        allowlistHash: sha256Hex(stableStringify(allowlist)),
      };

      const translated = entries.length ? await translateWithSanFrancisco({ job, items: entries }) : [];
      const ops = translated.map((item) => ({ op: 'set', path: item.path, value: item.value }));

      await ensureDir(path.dirname(overlayPath));
      await fs.writeFile(
        overlayPath,
        prettyStableJson({ v: 1, baseFingerprint, baseUpdatedAt, ops }),
        'utf8',
      );
    }
  }

  console.log('[prague-strings] Overlays generated.');
}

main().catch((err) => {
  console.error(String(err?.stack || err));
  process.exit(1);
});
