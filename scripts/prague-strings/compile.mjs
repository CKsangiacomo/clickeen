#!/usr/bin/env node
/* eslint-disable no-console */
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  ensureDir,
  ensurePosixPath,
  fileExists,
  hasProhibitedSegment,
  listJsonFiles,
  normalizeLocaleToken,
  normalizeOpPath,
  pathMatchesAllowlist,
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
const COMPILED_ROOT = path.join(PRAGUE_STRINGS_ROOT, 'compiled', 'v1');
const MANIFEST_PATH = path.join(PRAGUE_STRINGS_ROOT, 'manifest.v1.json');
const LOCALES_PATH = path.join(REPO_ROOT, 'config', 'locales.json');

function tryGetGitSha() {
  const fromEnv =
    process.env.CF_PAGES_COMMIT_SHA ||
    process.env.GITHUB_SHA ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.COMMIT_SHA;
  if (fromEnv && String(fromEnv).trim()) return String(fromEnv).trim();
  try {
    const res = spawnSync('git', ['rev-list', '-1', 'HEAD', '--', 'prague-strings', 'scripts/prague-strings'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    });
    if (res.status === 0) {
      const sha = String(res.stdout || '').trim();
      if (sha) return sha;
    }
  } catch {}
  return 'unknown';
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

function validateOverlay({ chunkKey, locale, overlay, allowlist }) {
  if (!isPlainObject(overlay) || overlay.v !== 1) {
    throw new Error(`[prague-strings] ${chunkKey}/${locale}: overlay must be { v: 1, ... }`);
  }
  if (!overlay.baseFingerprint || typeof overlay.baseFingerprint !== 'string') {
    throw new Error(`[prague-strings] ${chunkKey}/${locale}: baseFingerprint is required`);
  }
  if (!Array.isArray(overlay.ops)) {
    throw new Error(`[prague-strings] ${chunkKey}/${locale}: ops must be an array`);
  }
  const allowPaths = allowlist.map((entry) => entry.path);
  for (let i = 0; i < overlay.ops.length; i += 1) {
    const op = overlay.ops[i];
    if (!isPlainObject(op)) {
      throw new Error(`[prague-strings] ${chunkKey}/${locale}: ops[${i}] must be an object`);
    }
    if (op.op !== 'set') {
      throw new Error(`[prague-strings] ${chunkKey}/${locale}: ops[${i}].op must be "set"`);
    }
    const opPath = typeof op.path === 'string' ? normalizeOpPath(op.path) : '';
    if (!opPath) {
      throw new Error(`[prague-strings] ${chunkKey}/${locale}: ops[${i}].path is required`);
    }
    if (hasProhibitedSegment(opPath)) {
      throw new Error(`[prague-strings] ${chunkKey}/${locale}: ops[${i}].path contains prohibited segment`);
    }
    if (!allowPaths.some((allow) => pathMatchesAllowlist(opPath, allow))) {
      throw new Error(`[prague-strings] ${chunkKey}/${locale}: ops[${i}].path not allowlisted (${opPath})`);
    }
    if (!('value' in op) || typeof op.value !== 'string') {
      throw new Error(`[prague-strings] ${chunkKey}/${locale}: ops[${i}].value must be a string`);
    }
    op.path = opPath;
  }
}

function setAtPath(root, pathStr, value) {
  const segments = splitPathSegments(pathStr);
  if (!segments.length) throw new Error('[prague-strings] Invalid path');
  let cur = root;
  for (let i = 0; i < segments.length - 1; i += 1) {
    const seg = segments[i];
    if (hasProhibitedSegment(seg)) throw new Error('[prague-strings] Invalid path segment');
    if (Array.isArray(cur) && /^\d+$/.test(seg)) {
      const idx = Number(seg);
      if (idx >= cur.length) throw new Error('[prague-strings] Path index out of range');
      cur = cur[idx];
      continue;
    }
    if (!isPlainObject(cur)) throw new Error('[prague-strings] Path segment not an object');
    if (!(seg in cur)) throw new Error('[prague-strings] Path segment missing');
    cur = cur[seg];
  }
  const last = segments[segments.length - 1];
  if (Array.isArray(cur) && /^\d+$/.test(last)) {
    const idx = Number(last);
    if (idx >= cur.length) throw new Error('[prague-strings] Path index out of range');
    cur[idx] = value;
    return;
  }
  if (!isPlainObject(cur)) throw new Error('[prague-strings] Path segment not an object');
  if (!(last in cur)) throw new Error('[prague-strings] Path segment missing');
  cur[last] = value;
}

function applyOps(base, overlayOps) {
  const out = structuredClone(base);
  for (const op of overlayOps) {
    setAtPath(out, op.path, op.value);
  }
  return out;
}

function mergeNoCollision(target, source, prefix) {
  if (!isPlainObject(source)) return;
  for (const [key, value] of Object.entries(source)) {
    const nextPath = prefix ? `${prefix}.${key}` : key;
    if (key in target) {
      const targetValue = target[key];
      if (isPlainObject(targetValue) && isPlainObject(value)) {
        mergeNoCollision(targetValue, value, nextPath);
        continue;
      }
      throw new Error(`[prague-strings] Shared string collision at ${nextPath}`);
    }
    target[key] = structuredClone(value);
  }
}

function mergeStrings(sharedStrings, blockStrings) {
  const merged = structuredClone(sharedStrings);
  mergeNoCollision(merged, blockStrings, '');
  return merged;
}

async function main() {
  const locales = normalizeLocales(await loadLocales());

  const baseFiles = await listJsonFiles(BASE_ROOT);
  if (!baseFiles.length) throw new Error('[prague-strings] No base chunks found');

  const chunks = [];
  for (const baseFile of baseFiles) {
    const chunkKey = chunkKeyFromFile(baseFile);
    const chunkType = classifyChunkKey(chunkKey);
    const base = await readJson(baseFile);
    validateBaseChunk({ chunkKey, chunkType, base });
    const { allowlistPath, allowlist } = await loadAllowlist({ chunkKey, chunkType, base });
    const validatedAllowlist = validateAllowlist({ chunkKey, allowlistPath, allowlist });
    const baseFingerprint = sha256Hex(stableStringify(base));

    chunks.push({
      chunkKey,
      chunkType,
      baseFile,
      base,
      blockId: base.blockId ?? null,
      blockKind: base.blockKind ?? null,
      pagePath: chunkType.type === 'block' ? chunkType.pagePath : null,
      sharedKey: base.sharedKey ?? null,
      allowlist: validatedAllowlist.entries,
      allowlistVersion: validatedAllowlist.v,
      baseFingerprint,
    });
  }

  const manifest = {
    v: 1,
    gitSha: tryGetGitSha(),
    chunks: {},
  };

  const overlaysByChunkLocale = new Map();
  const chunkKeys = chunks.map((chunk) => chunk.chunkKey).sort();

  for (const chunkKey of chunkKeys) {
    const chunk = chunks.find((c) => c.chunkKey === chunkKey);
    if (!chunk) continue;
    const baseRel = ensurePosixPath(path.relative(PRAGUE_STRINGS_ROOT, chunk.baseFile));
    manifest.chunks[chunkKey] = {
      base: { file: baseRel, fingerprint: chunk.baseFingerprint },
      locales: {},
    };
    for (const locale of locales) {
      if (locale === 'en') continue;
      const overlayPath = path.join(OVERLAY_ROOT, chunkKey, `${locale}.ops.json`);
      if (!(await fileExists(overlayPath))) {
        throw new Error(`[prague-strings] Missing overlay for ${chunkKey}/${locale}: ${overlayPath}`);
      }
      const overlay = await readJson(overlayPath);
      validateOverlay({ chunkKey, locale, overlay, allowlist: chunk.allowlist });
      if (overlay.baseFingerprint !== chunk.baseFingerprint) {
        throw new Error(`[prague-strings] Stale overlay for ${chunkKey}/${locale}`);
      }
      overlaysByChunkLocale.set(`${chunkKey}::${locale}`, overlay);
      const rel = ensurePosixPath(path.relative(PRAGUE_STRINGS_ROOT, overlayPath));
      manifest.chunks[chunkKey].locales[locale] = { file: rel, baseFingerprint: overlay.baseFingerprint };
    }
  }

  await fs.writeFile(MANIFEST_PATH, prettyStableJson(manifest), 'utf8');

  for (const locale of locales) {
    const localizedByKey = new Map();
    for (const chunk of chunks) {
      if (locale === 'en') {
        localizedByKey.set(chunk.chunkKey, chunk.base);
        continue;
      }
      const overlay = overlaysByChunkLocale.get(`${chunk.chunkKey}::${locale}`);
      if (!overlay) {
        throw new Error(`[prague-strings] Missing overlay for ${chunk.chunkKey}/${locale}`);
      }
      localizedByKey.set(chunk.chunkKey, applyOps(chunk.base, overlay.ops));
    }

    const sharedStringsByKey = new Map();

    for (const chunk of chunks) {
      const localized = localizedByKey.get(chunk.chunkKey);
      if (!localized) continue;
      if (!isPlainObject(localized.strings)) {
        throw new Error(`[prague-strings] ${chunk.chunkKey}/${locale}: strings must be an object`);
      }
      if (chunk.chunkType.type === 'chrome') {
        const outPath = path.join(COMPILED_ROOT, locale, 'chrome.json');
        await ensureDir(path.dirname(outPath));
        await fs.writeFile(outPath, prettyStableJson({ v: 1, strings: localized.strings }), 'utf8');
      }
      if (chunk.chunkType.type === 'shared') {
        const rel = chunk.chunkKey.replace(/^shared\//, '');
        const outPath = path.join(COMPILED_ROOT, locale, 'shared', `${rel}.json`);
        await ensureDir(path.dirname(outPath));
        await fs.writeFile(outPath, prettyStableJson({ v: 1, strings: localized.strings }), 'utf8');
        sharedStringsByKey.set(chunk.chunkKey, localized.strings);
      }
    }

    const pages = new Map();
    for (const chunk of chunks) {
      if (chunk.chunkType.type !== 'block') continue;
      const localized = localizedByKey.get(chunk.chunkKey);
      if (!localized) continue;
      const blockStrings = localized.strings;
      if (!isPlainObject(blockStrings)) {
        throw new Error(`[prague-strings] ${chunk.chunkKey}/${locale}: strings must be an object`);
      }
      let merged = blockStrings;
      if (chunk.sharedKey) {
        const shared = sharedStringsByKey.get(chunk.sharedKey);
        if (!shared) {
          throw new Error(`[prague-strings] Missing shared strings ${chunk.sharedKey} for ${chunk.chunkKey}`);
        }
        merged = mergeStrings(shared, blockStrings);
      }
      const pagePath = chunk.pagePath;
      if (!pagePath) {
        throw new Error(`[prague-strings] Missing pagePath for ${chunk.chunkKey}`);
      }
      const page = pages.get(pagePath) || { v: 1, blocks: {} };
      page.blocks[chunk.blockId] = { strings: merged };
      pages.set(pagePath, page);
    }

    for (const [pagePath, page] of pages) {
      const outPath = path.join(COMPILED_ROOT, locale, `${pagePath}.json`);
      await ensureDir(path.dirname(outPath));
      await fs.writeFile(outPath, prettyStableJson(page), 'utf8');
    }
  }

  console.log('[prague-strings] Compiled outputs and manifest updated.');
}

main().catch((err) => {
  console.error(String(err?.stack || err));
  process.exit(1);
});
