#!/usr/bin/env node
/* eslint-disable no-console */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');
const DOTENV_LOCAL = path.join(REPO_ROOT, '.env.local');
const LOCALES_PATH = path.join(REPO_ROOT, 'config', 'locales.json');
const INSTANCES_ROOT = path.join(REPO_ROOT, 'l10n', 'instances');

let cachedSfBaseUrl = null;

function prettyStableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'));
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

function getSfBaseUrl() {
  if (cachedSfBaseUrl) return cachedSfBaseUrl;
  const raw = String(process.env.SANFRANCISCO_BASE_URL || 'http://localhost:3002').trim();
  const trimmed = raw.replace(/\/+$/, '');
  try {
    const url = new URL(trimmed);
    cachedSfBaseUrl = url.origin;
    return cachedSfBaseUrl;
  } catch {
    cachedSfBaseUrl = trimmed;
    return cachedSfBaseUrl;
  }
}

function getSfAuth() {
  return String(process.env.PARIS_DEV_JWT || '').trim();
}

function detectItemType(pathStr, value) {
  if (typeof value !== 'string') return 'string';
  if (pathStr.endsWith('Html')) return 'richtext';
  if (value.includes('<') && value.includes('>')) return 'richtext';
  return 'string';
}

function shouldTranslateOp({ publicId, op }) {
  if (!op || typeof op !== 'object') return false;
  if (op.op !== 'set') return false;
  if (typeof op.path !== 'string' || typeof op.value !== 'string') return false;

  // Preserve brand names for logo showcase instances.
  if (publicId.includes('logoshowcase') && /^strips\.0\.logos\.\d+\.name$/.test(op.path)) return false;
  return true;
}

async function translateWithSanFrancisco({ locale, chunkKey, baseFingerprint, baseUpdatedAt, items }) {
  const auth = getSfAuth();
  if (!auth) {
    throw new Error('[l10n] Missing PARIS_DEV_JWT (required to call San Francisco translate endpoint in local/dev)');
  }

  const url = `${getSfBaseUrl()}/v1/l10n/translate`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${auth}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      job: {
        v: 1,
        surface: 'prague',
        kind: 'system',
        chunkKey,
        blockKind: 'instance',
        locale,
        baseFingerprint,
        baseUpdatedAt,
        allowlistVersion: 1,
        items,
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`[l10n] Translate failed (${res.status}) ${text}`.trim());
  }

  const data = await res.json().catch(() => null);
  const outItems = Array.isArray(data?.items) ? data.items : null;
  if (!outItems) {
    throw new Error('[l10n] Translate response missing items');
  }
  const map = new Map();
  for (const entry of outItems) {
    const p = typeof entry?.path === 'string' ? entry.path : null;
    const v = typeof entry?.value === 'string' ? entry.value : null;
    if (p && v != null) map.set(p, v);
  }
  return map;
}

async function main() {
  await loadDotenvIfPresent();

  if (!(await fileExists(INSTANCES_ROOT))) {
    console.log('[l10n] No l10n/instances sources found; nothing to translate');
    return;
  }

  const localesRaw = await readJson(LOCALES_PATH);
  if (!Array.isArray(localesRaw) || localesRaw.some((l) => typeof l !== 'string' || !l.trim())) {
    throw new Error('[l10n] Invalid config/locales.json (expected string array)');
  }
  const targetLocales = localesRaw.map((l) => l.trim().toLowerCase());

  const publicIds = (await fs.readdir(INSTANCES_ROOT, { withFileTypes: true }))
    .filter((d) => d.isDirectory() && !d.name.startsWith('.'))
    .map((d) => d.name)
    .sort();

  let wrote = 0;

  for (const publicId of publicIds) {
    const instanceDir = path.join(INSTANCES_ROOT, publicId);
    const localeDir = path.join(instanceDir, 'locale');
    const basePath = path.join(localeDir, 'en.ops.json');
    if (!(await fileExists(basePath))) {
      console.warn(`[l10n] ${publicId}: missing locale/en.ops.json; skipping`);
      continue;
    }

    const base = await readJson(basePath);
    const baseFingerprint = typeof base?.baseFingerprint === 'string' ? base.baseFingerprint : null;
    const baseUpdatedAt = typeof base?.baseUpdatedAt === 'string' ? base.baseUpdatedAt : null;
    const ops = Array.isArray(base?.ops) ? base.ops : null;
    if (!baseFingerprint || !baseUpdatedAt || !ops) {
      throw new Error(`[l10n] ${publicId}: invalid base overlay at ${path.relative(REPO_ROOT, basePath)}`);
    }

    const existingLocales = new Set(
      (await fs.readdir(localeDir, { withFileTypes: true }))
        .filter((d) => d.isFile() && d.name.endsWith('.ops.json'))
        .map((d) => d.name.replace(/\.ops\.json$/, '').toLowerCase()),
    );

    const missing = targetLocales.filter((l) => !existingLocales.has(l));
    if (!missing.length) continue;

    for (const locale of missing) {
      const translatableOps = ops.filter((op) => shouldTranslateOp({ publicId, op }));
      const items = translatableOps.map((op) => ({
        path: op.path,
        type: detectItemType(op.path, op.value),
        value: op.value,
      }));

      console.log(`[l10n] Translating ${publicId} → ${locale} (${items.length} item(s))`);
      const translated = items.length
        ? await translateWithSanFrancisco({
            locale,
            chunkKey: `instances:${publicId}`,
            baseFingerprint,
            baseUpdatedAt,
            items,
          })
        : new Map();

      const nextOps = ops.map((op) => {
        if (typeof op?.path !== 'string' || typeof op?.value !== 'string') return op;
        const value = translated.has(op.path) ? translated.get(op.path) : op.value;
        return { ...op, value };
      });

      const out = {
        v: 1,
        baseFingerprint,
        baseUpdatedAt,
        ops: nextOps,
      };
      await ensureDir(localeDir);
      await fs.writeFile(path.join(localeDir, `${locale}.ops.json`), prettyStableJson(out), 'utf8');
      wrote += 1;
    }
  }

  console.log(`[l10n] Done: wrote ${wrote} locale overlay file(s)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

