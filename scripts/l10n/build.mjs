#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../..');

const srcRoot = path.join(repoRoot, 'l10n');
const outRoot = path.join(repoRoot, 'tokyo', 'l10n');
const widgetsRoot = path.join(repoRoot, 'tokyo', 'widgets');

function stableStringify(value) {
  if (value == null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const keys = Object.keys(value).sort();
  const body = keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',');
  return `{${body}}`;
}

function prettyStableJson(value) {
  const parsed = JSON.parse(stableStringify(value));
  return `${JSON.stringify(parsed, null, 2)}\n`;
}

function sha256Hex(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

const PROHIBITED_SEGMENTS = new Set(['__proto__', 'prototype', 'constructor']);
const LOCALE_PATTERN = /^[a-z]{2}(?:-[a-z0-9]+)*$/;

function hasProhibitedSegment(pathStr) {
  return String(pathStr || '')
    .split('.')
    .some((seg) => seg && PROHIBITED_SEGMENTS.has(seg));
}

function normalizeLocaleToken(raw) {
  const value = typeof raw === 'string' ? raw.trim().toLowerCase().replace(/_/g, '-') : '';
  if (!value || !LOCALE_PATTERN.test(value)) return null;
  return value;
}

function normalizeOpPath(raw) {
  return String(raw || '')
    .replace(/\[(\d+)\]/g, '.$1')
    .replace(/\.+/g, '.')
    .replace(/^\./, '')
    .replace(/\.$/, '');
}

function splitPathSegments(pathStr) {
  return String(pathStr || '')
    .split('.')
    .map((seg) => seg.trim())
    .filter(Boolean);
}

function isNumericSegment(seg) {
  return /^\d+$/.test(seg);
}

function pathMatchesAllowlist(pathStr, allowPath) {
  const pathSegs = splitPathSegments(pathStr);
  const allowSegs = splitPathSegments(allowPath);
  if (pathSegs.length !== allowSegs.length) return false;
  for (let i = 0; i < allowSegs.length; i += 1) {
    const allow = allowSegs[i];
    const actual = pathSegs[i];
    if (allow === '*') {
      if (!isNumericSegment(actual)) return false;
      continue;
    }
    if (allow !== actual) return false;
  }
  return true;
}

function resolveWidgetTypeFromPublicId(publicId) {
  if (publicId.startsWith('wgt_curated_')) {
    const rest = publicId.slice('wgt_curated_'.length);
    const widgetType = rest.split('.')[0] || '';
    return widgetType.trim() || null;
  }
  if (publicId.startsWith('wgt_main_')) {
    const widgetType = publicId.slice('wgt_main_'.length);
    return widgetType.trim() || null;
  }
  const user = publicId.match(/^wgt_([a-z0-9][a-z0-9_-]*)_u_[a-z0-9][a-z0-9_-]*$/i);
  if (user) return user[1];
  return null;
}

function loadAllowlist(widgetType) {
  const filePath = path.join(widgetsRoot, widgetType, 'localization.json');
  if (!fs.existsSync(filePath)) {
    throw new Error(`[l10n] Missing localization allowlist: ${filePath}`);
  }
  const json = readJson(filePath);
  if (!json || typeof json !== 'object' || json.v !== 1 || !Array.isArray(json.paths)) {
    throw new Error(`[l10n] Invalid localization allowlist: ${filePath}`);
  }
  return json.paths
    .map((entry) => (typeof entry?.path === 'string' ? entry.path.trim() : ''))
    .filter(Boolean);
}

async function fetchInstanceConfig(publicId) {
  const baseUrl = String(process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!baseUrl || !key) {
    throw new Error('[l10n] SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required to compute baseFingerprint');
  }

  const params = new URLSearchParams({
    select: 'public_id,config,updated_at',
    public_id: `eq.${publicId}`,
    limit: '1',
  });
  const res = await fetch(`${baseUrl}/rest/v1/widget_instances?${params.toString()}`, {
    method: 'GET',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`[l10n] Failed to load instance config (${res.status}) ${detail}`.trim());
  }
  const rows = (await res.json().catch(() => [])) || [];
  const row = rows[0];
  if (!row || typeof row !== 'object' || !row.config) {
    throw new Error(`[l10n] Missing instance config for ${publicId}`);
  }
  return {
    config: row.config,
    updatedAt: typeof row.updated_at === 'string' ? row.updated_at : null,
  };
}

async function ensureBaseFingerprint({ publicId, data }) {
  if (typeof data.baseFingerprint === 'string' && /^[a-f0-9]{64}$/i.test(data.baseFingerprint.trim())) {
    return data;
  }
  const instance = await fetchInstanceConfig(publicId);
  const baseFingerprint = sha256Hex(stableStringify(instance.config));
  return {
    ...data,
    baseFingerprint,
    baseUpdatedAt: data.baseUpdatedAt ?? instance.updatedAt ?? null,
  };
}

function assertOverlayShape({ publicId, locale, data, allowlist }) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error(`[l10n] ${publicId}/${locale}: overlay must be an object`);
  }
  if (data.v !== 1) throw new Error(`[l10n] ${publicId}/${locale}: v must be 1`);
  if (!Array.isArray(data.ops)) throw new Error(`[l10n] ${publicId}/${locale}: ops must be an array`);
  if (!data.baseFingerprint || typeof data.baseFingerprint !== 'string' || !/^[a-f0-9]{64}$/i.test(data.baseFingerprint)) {
    throw new Error(`[l10n] ${publicId}/${locale}: baseFingerprint is required`);
  }

  for (let i = 0; i < data.ops.length; i += 1) {
    const op = data.ops[i];
    if (!op || typeof op !== 'object' || Array.isArray(op)) {
      throw new Error(`[l10n] ${publicId}/${locale}: ops[${i}] must be an object`);
    }
    if (op.op !== 'set') {
      throw new Error(`[l10n] ${publicId}/${locale}: ops[${i}].op must be "set"`);
    }
    const p = typeof op.path === 'string' ? normalizeOpPath(op.path) : '';
    if (!p) throw new Error(`[l10n] ${publicId}/${locale}: ops[${i}].path is required`);
    if (hasProhibitedSegment(p)) throw new Error(`[l10n] ${publicId}/${locale}: ops[${i}].path contains prohibited segment`);
    if (allowlist && !allowlist.some((allow) => pathMatchesAllowlist(p, allow))) {
      throw new Error(`[l10n] ${publicId}/${locale}: ops[${i}].path not allowlisted (${p})`);
    }
    op.path = p;
    if (!('value' in op)) throw new Error(`[l10n] ${publicId}/${locale}: ops[${i}].value is required`);
    if (typeof op.value !== 'string') {
      throw new Error(`[l10n] ${publicId}/${locale}: ops[${i}].value must be a string`);
    }
    if (op.value === undefined) throw new Error(`[l10n] ${publicId}/${locale}: ops[${i}].value cannot be undefined`);
  }
}

function cleanOldOutputs(outputDir, keepName) {
  if (!fs.existsSync(outputDir)) return;
  const files = fs.readdirSync(outputDir, { withFileTypes: true }).filter((d) => d.isFile()).map((d) => d.name);
  for (const file of files) {
    if (file !== keepName && file.endsWith('.ops.json')) {
      fs.unlinkSync(path.join(outputDir, file));
    }
  }
}

async function main() {
  if (!fs.existsSync(srcRoot)) {
    ensureDir(outRoot);
    console.log(`[l10n] No sources found (missing ${srcRoot}); nothing to build`);
    return;
  }

  const instancesRoot = path.join(srcRoot, 'instances');

  ensureDir(outRoot);
  ensureDir(path.join(outRoot, 'instances'));

  if (!fs.existsSync(instancesRoot)) {
    console.log('[l10n] No sources found under l10n/instances; nothing to build');
    return;
  }

  let instanceCount = 0;
  let overlayCount = 0;

  const publicIds = fs
    .readdirSync(instancesRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('.'))
    .map((d) => d.name)
    .sort();

  for (const publicId of publicIds) {
    const instanceSrcDir = path.join(instancesRoot, publicId);
    const instanceOutDir = path.join(outRoot, 'instances', publicId);
    ensureDir(instanceOutDir);

    const locales = fs
      .readdirSync(instanceSrcDir, { withFileTypes: true })
      .filter((d) => d.isFile() && d.name.endsWith('.ops.json'))
      .map((d) => d.name.replace(/\.ops\.json$/, ''))
      .sort();
    if (!locales.length) continue;

    const widgetType = resolveWidgetTypeFromPublicId(publicId);
    if (!widgetType) {
      throw new Error(`[l10n] ${publicId}: Unable to resolve widgetType for allowlist validation`);
    }
    const allowlist = loadAllowlist(widgetType);

    let wroteInstance = false;
    for (const localeRaw of locales) {
      const locale = normalizeLocaleToken(localeRaw);
      if (!locale) {
        throw new Error(`[l10n] ${publicId}/${localeRaw}: invalid locale token`);
      }
      const srcPath = path.join(instanceSrcDir, `${localeRaw}.ops.json`);
      const overlay = await ensureBaseFingerprint({ publicId, data: readJson(srcPath) });
      assertOverlayShape({ publicId, locale, data: overlay, allowlist });

      const stable = prettyStableJson(overlay);
      const outName = `${overlay.baseFingerprint}.ops.json`;
      const localeOutDir = path.join(instanceOutDir, locale);
      ensureDir(localeOutDir);
      cleanOldOutputs(localeOutDir, outName);
      fs.writeFileSync(path.join(localeOutDir, outName), stable, 'utf8');
      overlayCount += 1;
      wroteInstance = true;
    }
    if (wroteInstance) instanceCount += 1;
  }

  console.log(`[l10n] Built ${overlayCount} overlays across ${instanceCount} instance(s) → tokyo/l10n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
