#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../..');

const srcRoot = path.join(repoRoot, 'l10n', 'instances');
const widgetsRoot = path.join(repoRoot, 'tokyo', 'widgets');

const LOCALE_PATTERN = /^[a-z]{2}(?:-[a-z0-9]+)*$/;
const PROHIBITED_SEGMENTS = new Set(['__proto__', 'prototype', 'constructor']);

function stableStringify(value) {
  if (value == null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const keys = Object.keys(value).sort();
  const body = keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',');
  return `{${body}}`;
}

function sha256Hex(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
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

function hasProhibitedSegment(pathStr) {
  return String(pathStr || '')
    .split('.')
    .some((seg) => seg && PROHIBITED_SEGMENTS.has(seg));
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
  if (publicId.startsWith('wgt_web_')) {
    const rest = publicId.slice('wgt_web_'.length);
    const widgetType = rest.split('.')[0] || '';
    return widgetType.trim() || null;
  }
  const legacy = publicId.match(/^wgt_([a-z0-9][a-z0-9_-]*)_(main|tmpl_[a-z0-9][a-z0-9_-]*)$/i);
  if (legacy) return legacy[1];
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
    throw new Error('[l10n] SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
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

async function ensureBaseFingerprint({ publicId, overlay }) {
  const raw = typeof overlay.baseFingerprint === 'string' ? overlay.baseFingerprint.trim() : '';
  if (/^[a-f0-9]{64}$/i.test(raw)) {
    return overlay;
  }
  const instance = await fetchInstanceConfig(publicId);
  const baseFingerprint = sha256Hex(stableStringify(instance.config));
  return {
    ...overlay,
    baseFingerprint,
    baseUpdatedAt: overlay.baseUpdatedAt ?? instance.updatedAt ?? null,
  };
}

function assertOverlayShape({ publicId, locale, overlay, allowlist }) {
  if (!overlay || typeof overlay !== 'object' || Array.isArray(overlay)) {
    throw new Error(`[l10n] ${publicId}/${locale}: overlay must be an object`);
  }
  if (overlay.v !== 1) throw new Error(`[l10n] ${publicId}/${locale}: v must be 1`);
  if (!Array.isArray(overlay.ops)) throw new Error(`[l10n] ${publicId}/${locale}: ops must be an array`);
  if (!overlay.baseFingerprint || typeof overlay.baseFingerprint !== 'string' || !/^[a-f0-9]{64}$/i.test(overlay.baseFingerprint)) {
    throw new Error(`[l10n] ${publicId}/${locale}: baseFingerprint is required`);
  }

  overlay.ops.forEach((op, index) => {
    if (!op || typeof op !== 'object' || Array.isArray(op)) {
      throw new Error(`[l10n] ${publicId}/${locale}: ops[${index}] must be an object`);
    }
    if (op.op !== 'set') {
      throw new Error(`[l10n] ${publicId}/${locale}: ops[${index}].op must be "set"`);
    }
    const path = typeof op.path === 'string' ? normalizeOpPath(op.path) : '';
    if (!path) throw new Error(`[l10n] ${publicId}/${locale}: ops[${index}].path is required`);
    if (hasProhibitedSegment(path)) {
      throw new Error(`[l10n] ${publicId}/${locale}: ops[${index}].path contains prohibited segment`);
    }
    if (!allowlist.some((allow) => pathMatchesAllowlist(path, allow))) {
      throw new Error(`[l10n] ${publicId}/${locale}: ops[${index}].path not allowlisted (${path})`);
    }
    op.path = path;
    if (!('value' in op)) throw new Error(`[l10n] ${publicId}/${locale}: ops[${index}].value is required`);
    if (typeof op.value !== 'string') {
      throw new Error(`[l10n] ${publicId}/${locale}: ops[${index}].value must be a string`);
    }
    if (op.value === undefined) throw new Error(`[l10n] ${publicId}/${locale}: ops[${index}].value cannot be undefined`);
  });
}

async function upsertOverlay(publicId, locale, overlay) {
  const baseUrl = String(process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!baseUrl || !key) {
    throw new Error('[l10n] SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  }

  const payload = {
    public_id: publicId,
    locale,
    ops: overlay.ops,
    base_fingerprint: overlay.baseFingerprint,
    base_updated_at: overlay.baseUpdatedAt ?? null,
    source: 'manual',
    workspace_id: null,
  };

  const res = await fetch(`${baseUrl}/rest/v1/widget_instance_locales?on_conflict=public_id,locale`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Prefer: 'resolution=merge-duplicates,return=minimal',
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`[l10n] Failed to upsert overlay (${res.status}) ${detail}`.trim());
  }
}

async function main() {
  if (!fs.existsSync(srcRoot)) {
    console.log(`[l10n] No overlays found at ${srcRoot}`);
    return;
  }

  const publicIds = fs
    .readdirSync(srcRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('.'))
    .map((d) => d.name)
    .sort();

  for (const publicId of publicIds) {
    const widgetType = resolveWidgetTypeFromPublicId(publicId);
    if (!widgetType) {
      throw new Error(`[l10n] ${publicId}: Unable to resolve widgetType for allowlist validation`);
    }
    const allowlist = loadAllowlist(widgetType);
    const instanceDir = path.join(srcRoot, publicId);
    const locales = fs
      .readdirSync(instanceDir, { withFileTypes: true })
      .filter((d) => d.isFile() && d.name.endsWith('.ops.json'))
      .map((d) => d.name.replace(/\.ops\.json$/, ''))
      .sort();

    for (const localeRaw of locales) {
      const locale = normalizeLocaleToken(localeRaw);
      if (!locale) {
        throw new Error(`[l10n] ${publicId}/${localeRaw}: invalid locale token`);
      }
      const srcPath = path.join(instanceDir, `${localeRaw}.ops.json`);
      const overlay = await ensureBaseFingerprint({ publicId, overlay: readJson(srcPath) });
      assertOverlayShape({ publicId, locale, overlay, allowlist });
      await upsertOverlay(publicId, locale, overlay);
      console.log(`[l10n] Upserted ${publicId}/${locale}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
