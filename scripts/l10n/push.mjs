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

const LOCALE_PATTERN = /^[a-z]{2,3}(?:-[a-z0-9]+)*$/;
const L10N_LAYER_ALLOWED = new Set(['locale', 'geo', 'industry', 'experiment', 'account', 'behavior', 'user']);
const LAYER_KEY_SLUG = /^[a-z0-9][a-z0-9_-]*$/;
const LAYER_KEY_EXPERIMENT = /^exp_[a-z0-9][a-z0-9_-]*:[a-z0-9][a-z0-9_-]*$/;
const LAYER_KEY_BEHAVIOR = /^behavior_[a-z0-9][a-z0-9_-]*$/;
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

function normalizeLayer(raw) {
  const value = String(raw || '').trim().toLowerCase();
  if (!value || !L10N_LAYER_ALLOWED.has(value)) return null;
  return value;
}

function normalizeLayerKey(layer, raw) {
  const value = String(raw || '').trim();
  if (!value) return null;
  switch (layer) {
    case 'locale': {
      return normalizeLocaleToken(value);
    }
    case 'geo': {
      const upper = value.toUpperCase();
      return /^[A-Z]{2}$/.test(upper) ? upper : null;
    }
    case 'industry': {
      const lower = value.toLowerCase();
      return LAYER_KEY_SLUG.test(lower) ? lower : null;
    }
    case 'experiment': {
      const lower = value.toLowerCase();
      return LAYER_KEY_EXPERIMENT.test(lower) ? lower : null;
    }
    case 'account': {
      const lower = value.toLowerCase();
      return LAYER_KEY_SLUG.test(lower) ? lower : null;
    }
    case 'behavior': {
      const lower = value.toLowerCase();
      return LAYER_KEY_BEHAVIOR.test(lower) ? lower : null;
    }
    case 'user': {
      if (value === 'global') return 'global';
      return normalizeLocaleToken(value);
    }
    default:
      return null;
  }
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

function joinPath(base, next) {
  return base ? `${base}.${next}` : next;
}

function collectEntriesForPath({ value, segments, currentPath, out }) {
  if (segments.length === 0) {
    if (typeof value === 'string') {
      out.push({ path: currentPath, value });
    }
    return;
  }

  const [head, ...tail] = segments;
  if (!head || PROHIBITED_SEGMENTS.has(head)) return;

  if (head === '*') {
    if (!Array.isArray(value)) return;
    value.forEach((item, index) => {
      collectEntriesForPath({
        value: item,
        segments: tail,
        currentPath: joinPath(currentPath, String(index)),
        out,
      });
    });
    return;
  }

  if (Array.isArray(value) && isNumericSegment(head)) {
    const index = Number(head);
    collectEntriesForPath({
      value: value[index],
      segments: tail,
      currentPath: joinPath(currentPath, head),
      out,
    });
    return;
  }

  if (!value || typeof value !== 'object') return;
  collectEntriesForPath({
    value: value[head],
    segments: tail,
    currentPath: joinPath(currentPath, head),
    out,
  });
}

function collectAllowlistedValues(config, allowlist) {
  const out = [];
  allowlist.forEach((entry) => {
    const pathStr = String(entry || '').trim();
    if (!pathStr || hasProhibitedSegment(pathStr)) return;
    const segments = splitPathSegments(pathStr);
    if (!segments.length) return;
    collectEntriesForPath({ value: config, segments, currentPath: '', out });
  });

  const deduped = [];
  const seen = new Set();
  out.forEach((item) => {
    if (!item.path || seen.has(item.path)) return;
    seen.add(item.path);
    deduped.push(item);
  });
  return deduped;
}

function buildL10nSnapshot(config, allowlist) {
  const snapshot = {};
  collectAllowlistedValues(config, allowlist).forEach((entry) => {
    snapshot[entry.path] = entry.value;
  });
  return snapshot;
}

function computeL10nFingerprint(config, allowlist) {
  const snapshot = buildL10nSnapshot(config, allowlist);
  return sha256Hex(stableStringify(snapshot));
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

function loadLayerAllowlist(widgetType, layer) {
  if (layer === 'locale') return loadAllowlist(widgetType);
  const filePath = path.join(widgetsRoot, widgetType, 'layers', `${layer}.allowlist.json`);
  if (!fs.existsSync(filePath)) {
    return [];
  }
  const json = readJson(filePath);
  if (!json || typeof json !== 'object' || json.v !== 1 || !Array.isArray(json.paths)) {
    throw new Error(`[l10n] Invalid layer allowlist: ${filePath}`);
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
  const widgetType = resolveWidgetTypeFromPublicId(publicId);
  if (!widgetType) {
    throw new Error(`[l10n] Unable to resolve widget type for ${publicId}`);
  }
  const allowlist = loadAllowlist(widgetType);
  const baseFingerprint = computeL10nFingerprint(instance.config, allowlist);
  return {
    ...overlay,
    baseFingerprint,
    baseUpdatedAt: overlay.baseUpdatedAt ?? instance.updatedAt ?? null,
  };
}

function assertOverlayShape({ publicId, layer, layerKey, overlay, allowlist }) {
  const ref = `${publicId}/${layer}/${layerKey}`;
  if (!overlay || typeof overlay !== 'object' || Array.isArray(overlay)) {
    throw new Error(`[l10n] ${ref}: overlay must be an object`);
  }
  if (overlay.v !== 1) throw new Error(`[l10n] ${ref}: v must be 1`);
  if (!Array.isArray(overlay.ops)) throw new Error(`[l10n] ${ref}: ops must be an array`);
  if (!overlay.baseFingerprint || typeof overlay.baseFingerprint !== 'string' || !/^[a-f0-9]{64}$/i.test(overlay.baseFingerprint)) {
    throw new Error(`[l10n] ${ref}: baseFingerprint is required`);
  }

  overlay.ops.forEach((op, index) => {
    if (!op || typeof op !== 'object' || Array.isArray(op)) {
      throw new Error(`[l10n] ${ref}: ops[${index}] must be an object`);
    }
    if (op.op !== 'set') {
      throw new Error(`[l10n] ${ref}: ops[${index}].op must be "set"`);
    }
    const path = typeof op.path === 'string' ? normalizeOpPath(op.path) : '';
    if (!path) throw new Error(`[l10n] ${ref}: ops[${index}].path is required`);
    if (hasProhibitedSegment(path)) {
      throw new Error(`[l10n] ${ref}: ops[${index}].path contains prohibited segment`);
    }
    if (!allowlist.some((allow) => pathMatchesAllowlist(path, allow))) {
      throw new Error(`[l10n] ${ref}: ops[${index}].path not allowlisted (${path})`);
    }
    op.path = path;
    if (!('value' in op)) throw new Error(`[l10n] ${ref}: ops[${index}].value is required`);
    if (op.value === undefined) throw new Error(`[l10n] ${ref}: ops[${index}].value cannot be undefined`);
  });
}

async function upsertOverlay(publicId, layer, layerKey, overlay, geoTargets) {
  const baseUrl = String(process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!baseUrl || !key) {
    throw new Error('[l10n] SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  }

  const payload = {
    public_id: publicId,
    layer,
    layer_key: layerKey,
    ops: overlay.ops,
    base_fingerprint: overlay.baseFingerprint,
    base_updated_at: overlay.baseUpdatedAt ?? null,
    source: 'manual',
    workspace_id: null,
    ...(geoTargets ? { geo_targets: geoTargets } : {}),
  };

  const res = await fetch(`${baseUrl}/rest/v1/widget_instance_overlays?on_conflict=public_id,layer,layer_key`, {
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
    const instanceDir = path.join(srcRoot, publicId);

    const legacyFiles = fs
      .readdirSync(instanceDir, { withFileTypes: true })
      .filter((d) => d.isFile() && d.name.endsWith('.ops.json'))
      .map((d) => d.name);
    if (legacyFiles.length) {
      throw new Error(`[l10n] ${publicId}: legacy overlay layout detected (move files under layer/ keys)`);
    }

    const layerDirs = fs
      .readdirSync(instanceDir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && !d.name.startsWith('.'))
      .map((d) => d.name)
      .sort();

    for (const layerRaw of layerDirs) {
      const layer = normalizeLayer(layerRaw);
      if (!layer) {
        throw new Error(`[l10n] ${publicId}/${layerRaw}: invalid layer`);
      }
      const allowlist = loadLayerAllowlist(widgetType, layer);
      const layerDir = path.join(instanceDir, layerRaw);
      const layerFiles = fs
        .readdirSync(layerDir, { withFileTypes: true })
        .filter((d) => d.isFile() && d.name.endsWith('.ops.json'))
        .map((d) => d.name)
        .sort();

      for (const fileName of layerFiles) {
        const layerKeyRaw = fileName.replace(/\.ops\.json$/, '');
        const layerKey = normalizeLayerKey(layer, layerKeyRaw);
        if (!layerKey) {
          throw new Error(`[l10n] ${publicId}/${layer}: invalid layer key (${layerKeyRaw})`);
        }
        const srcPath = path.join(layerDir, fileName);
        const overlay = await ensureBaseFingerprint({ publicId, overlay: readJson(srcPath) });
        const geoTargets = layer === 'locale' && Array.isArray(overlay.geoCountries) ? overlay.geoCountries : null;
        assertOverlayShape({ publicId, layer, layerKey, overlay, allowlist });
        await upsertOverlay(publicId, layer, layerKey, overlay, geoTargets);
        console.log(`[l10n] Upserted ${publicId}/${layer}/${layerKey}`);
      }
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
