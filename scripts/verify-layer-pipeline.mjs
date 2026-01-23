#!/usr/bin/env node
/* eslint-disable no-console */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const PROHIBITED_SEGMENTS = new Set(['__proto__', 'prototype', 'constructor']);
const widgetsRoot = path.join(process.cwd(), 'tokyo', 'widgets');

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

function getBaseUrl(envKeys, fallback) {
  for (const key of envKeys) {
    const value = process.env[key];
    if (value) return value.replace(/\/+$/, '');
  }
  return fallback;
}

function readLocalEnvValue(key) {
  const direct = process.env[key];
  if (direct) return String(direct).trim();
  try {
    const raw = fs.readFileSync('.env.local', 'utf8');
    const match = raw.match(new RegExp(`^${key}=(.+)$`, 'm'));
    return match ? match[1].trim() : null;
  } catch {
    return null;
  }
}

function resolveDevAuthHeaders() {
  const token = readLocalEnvValue('PARIS_DEV_JWT');
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

async function fetchJson(url, init) {
  const res = await fetch(url, init);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`[layer-pipeline] ${url} -> ${res.status} ${text}`.trim());
  }
  return res.json();
}

async function fetchOptionalJson(url, init) {
  const res = await fetch(url, init);
  if (res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`[layer-pipeline] ${url} -> ${res.status} ${text}`.trim());
  }
  return res.json();
}

async function fetchJsonLoose(url, init) {
  const res = await fetch(url, init);
  const text = await res.text().catch(() => '');
  let body = text;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { res, body };
}

function normalizeLocale(raw) {
  const value = typeof raw === 'string' ? raw.trim().toLowerCase().replace(/_/g, '-') : '';
  return value || null;
}

function normalizePath(pathStr) {
  return String(pathStr || '')
    .replace(/\[(\d+)\]/g, '.$1')
    .replace(/\.+/g, '.')
    .replace(/^\./, '')
    .replace(/\.$/, '');
}

function hasProhibitedSegment(pathStr) {
  return String(pathStr || '')
    .split('.')
    .some((seg) => seg && PROHIBITED_SEGMENTS.has(seg));
}

function isIndex(segment) {
  return /^\d+$/.test(segment);
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

  if (Array.isArray(value) && isIndex(head)) {
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
    const segments = pathStr.split('.').map((seg) => seg.trim()).filter(Boolean);
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

function setAt(obj, pathStr, value) {
  const parts = String(pathStr || '')
    .split('.')
    .map((p) => p.trim())
    .filter(Boolean);

  const root = Array.isArray(obj) ? [...obj] : { ...(obj || {}) };
  let current = root;
  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i];
    const key = isIndex(part) ? Number(part) : part;
    const isLast = i === parts.length - 1;
    if (isLast) {
      current[key] = value;
      break;
    }
    const next = current[key];
    const clone = Array.isArray(next) ? [...next] : next && typeof next === 'object' ? { ...next } : {};
    current[key] = clone;
    current = clone;
  }
  return root;
}

function applySetOps(base, ops) {
  let working = base;
  for (const op of ops) {
    if (!op || typeof op !== 'object') continue;
    if (op.op !== 'set') continue;
    if (typeof op.path !== 'string' || !op.path.trim()) continue;
    const normalized = normalizePath(op.path);
    if (!normalized || hasProhibitedSegment(normalized)) continue;
    if (!('value' in op)) continue;
    working = setAt(working, normalized, op.value);
  }
  return working && typeof working === 'object' && !Array.isArray(working) ? working : base;
}

function deepEqual(a, b) {
  return stableStringify(a) === stableStringify(b);
}

function isCuratedPublicId(publicId) {
  if (/^wgt_curated_/.test(publicId)) return true;
  return /^wgt_main_[a-z0-9][a-z0-9_-]*$/i.test(publicId);
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
    throw new Error(`[layer-pipeline] Missing localization allowlist: ${filePath}`);
  }
  const json = readJson(filePath);
  if (!json || typeof json !== 'object' || json.v !== 1 || !Array.isArray(json.paths)) {
    throw new Error(`[layer-pipeline] Invalid localization allowlist: ${filePath}`);
  }
  return json.paths
    .map((entry) => (typeof entry?.path === 'string' ? entry.path.trim() : ''))
    .filter(Boolean);
}

function resolveWidgetType(instance) {
  const raw = typeof instance?.widgetType === 'string' ? instance.widgetType.trim() : '';
  if (raw) return raw;
  return resolveWidgetTypeFromPublicId(instance?.publicId || '');
}

function pickLocale(keys, preferred) {
  const normalized = normalizeLocale(preferred);
  if (normalized && keys.includes(normalized)) return normalized;
  if (keys.includes('en')) return 'en';
  return keys[0] || null;
}

async function fetchOverlay(tokyoBase, publicId, layer, layerKey, baseFingerprint) {
  const path = `/l10n/instances/${encodeURIComponent(publicId)}/${encodeURIComponent(layer)}/${encodeURIComponent(
    layerKey
  )}/${encodeURIComponent(baseFingerprint)}.ops.json`;
  return fetchOptionalJson(`${tokyoBase}${path}`);
}

function runPragueVerify() {
  if (process.env.RUN_PRAGUE_L10N_VERIFY !== '1') {
    console.log('[layer-pipeline] Prague l10n verify skipped (set RUN_PRAGUE_L10N_VERIFY=1 to run).');
    return;
  }
  const res = spawnSync(process.execPath, ['scripts/prague-l10n/verify.mjs'], { stdio: 'inherit' });
  if (res.status !== 0) {
    throw new Error('[layer-pipeline] Prague l10n verify failed');
  }
}

function listLocalInstanceIds(root) {
  if (!fs.existsSync(root)) return [];
  return fs
    .readdirSync(root)
    .filter((name) => fs.statSync(path.join(root, name)).isDirectory());
}

function loadLocalIndex(root, publicId) {
  const indexPath = path.join(root, publicId, 'index.json');
  if (!fs.existsSync(indexPath)) return null;
  try {
    const raw = fs.readFileSync(indexPath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function listLocalLocales(root, publicId) {
  const dir = path.join(root, publicId, 'locale');
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => fs.statSync(path.join(dir, name)).isDirectory());
}

function listLocalFingerprints(root, publicId, locale) {
  const dir = path.join(root, publicId, 'locale', locale);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith('.ops.json'))
    .map((name) => name.replace(/\.ops\.json$/i, ''));
}

function hasOverlayFile(root, publicId, locale, fingerprint) {
  const filePath = path.join(root, publicId, 'locale', locale, `${fingerprint}.ops.json`);
  return fs.existsSync(filePath);
}

async function fetchInstanceConfig(parisBase, publicId, authHeaders) {
  const { res, body } = await fetchJsonLoose(
    `${parisBase}/api/instance/${encodeURIComponent(publicId)}`,
    { headers: authHeaders },
  );
  if (!res.ok || !body || typeof body !== 'object' || !body.config) return null;
  return body;
}

function resolveIndexLocaleKeys(index) {
  return Array.isArray(index?.layers?.locale?.keys) ? index.layers.locale.keys : [];
}

function resolveIndexFingerprint(index, locale) {
  return index?.layers?.locale?.lastPublishedFingerprint?.[locale] ?? null;
}

async function main() {
  if (process.env.RUN_LAYER_PIPELINE_TESTS !== '1') {
    console.log('[layer-pipeline] Skipped (set RUN_LAYER_PIPELINE_TESTS=1 to run).');
    return;
  }

  const parisBase = getBaseUrl(['PARIS_BASE_URL', 'NEXT_PUBLIC_PARIS_URL'], 'http://localhost:3001');
  const tokyoBase = getBaseUrl(['TOKYO_URL', 'TOKYO_BASE_URL', 'NEXT_PUBLIC_TOKYO_URL'], 'http://localhost:4000');
  const veniceBase = getBaseUrl(['VENICE_BASE_URL', 'NEXT_PUBLIC_VENICE_URL'], 'http://localhost:3003');
  const authHeaders = resolveDevAuthHeaders();
  const localRoot = path.join(process.cwd(), 'tokyo', 'l10n', 'instances');

  const seedPublicId = process.env.TEST_PUBLIC_ID;
  const missingLocaleOverride = normalizeLocale(process.env.TEST_MISSING_LOCALE);
  const unindexedLocaleOverride = normalizeLocale(process.env.TEST_UNINDEXED_LOCALE);
  const localIds = listLocalInstanceIds(localRoot);
  const allIds = Array.from(new Set([seedPublicId, ...localIds].filter(Boolean)));

  const instances = [];
  for (const id of allIds) {
    const instance = await fetchInstanceConfig(parisBase, id, authHeaders);
    if (!instance) continue;
    const widgetType = resolveWidgetType(instance);
    if (!widgetType) {
      throw new Error(`[layer-pipeline] Missing widgetType for ${id}`);
    }
    const allowlist = loadAllowlist(widgetType);
    const baseFingerprint = computeL10nFingerprint(instance.config, allowlist);
    const index = loadLocalIndex(localRoot, id);
    const localeKeys = resolveIndexLocaleKeys(index);
    const localLocales = listLocalLocales(localRoot, id);
    instances.push({
      publicId: id,
      config: instance.config,
      baseFingerprint,
      index,
      localeKeys,
      localLocales,
    });
  }

  if (!instances.length) {
    throw new Error('[layer-pipeline] No instances available for testing');
  }

  function resolveOverrideInstance(envKey) {
    if (!seedPublicId) {
      throw new Error(`[layer-pipeline] ${envKey} requires TEST_PUBLIC_ID`);
    }
    const target = instances.find((item) => item.publicId === seedPublicId);
    if (!target) {
      throw new Error(`[layer-pipeline] No instance found for ${envKey} (TEST_PUBLIC_ID=${seedPublicId})`);
    }
    return target;
  }

  function findApplyCandidate() {
    const preferredId = seedPublicId;
    const ordered = preferredId
      ? [instances.find((item) => item.publicId === preferredId), ...instances]
      : instances;
    for (const item of ordered) {
      if (!item) continue;
      for (const key of item.localeKeys) {
        const indexFingerprint = resolveIndexFingerprint(item.index, key);
        if (indexFingerprint !== item.baseFingerprint) continue;
        if (!hasOverlayFile(localRoot, item.publicId, key, item.baseFingerprint)) continue;
        return { ...item, locale: key };
      }
    }
    return null;
  }

  function findStaleCandidate() {
    for (const item of instances) {
      for (const key of item.localeKeys) {
        const indexFingerprint = resolveIndexFingerprint(item.index, key);
        if (indexFingerprint && indexFingerprint !== item.baseFingerprint) {
          return { ...item, locale: key, indexFingerprint };
        }
      }
    }
    return null;
  }

  function findMissingCandidate() {
    if (missingLocaleOverride) {
      const target = resolveOverrideInstance('TEST_MISSING_LOCALE');
      const locale = missingLocaleOverride;
      const localeKeys = resolveIndexLocaleKeys(target.index);
      if (!localeKeys.includes(locale)) {
        throw new Error(`[layer-pipeline] TEST_MISSING_LOCALE ${locale} not present in index`);
      }
      const indexFingerprint = resolveIndexFingerprint(target.index, locale);
      if (indexFingerprint && indexFingerprint !== target.baseFingerprint) {
        throw new Error(`[layer-pipeline] TEST_MISSING_LOCALE ${locale} is stale, not missing`);
      }
      if (hasOverlayFile(localRoot, target.publicId, locale, target.baseFingerprint)) {
        throw new Error(`[layer-pipeline] TEST_MISSING_LOCALE ${locale} overlay exists`);
      }
      return { ...target, locale };
    }
    for (const item of instances) {
      for (const key of item.localeKeys) {
        const indexFingerprint = resolveIndexFingerprint(item.index, key);
        if (indexFingerprint !== item.baseFingerprint) continue;
        if (!hasOverlayFile(localRoot, item.publicId, key, item.baseFingerprint)) {
          return { ...item, locale: key };
        }
      }
    }
    return null;
  }

  function findUnindexedCandidate() {
    if (unindexedLocaleOverride) {
      const target = resolveOverrideInstance('TEST_UNINDEXED_LOCALE');
      const locale = unindexedLocaleOverride;
      const localeSet = new Set(target.localeKeys);
      if (localeSet.has(locale)) {
        throw new Error(`[layer-pipeline] TEST_UNINDEXED_LOCALE ${locale} is indexed`);
      }
      if (!hasOverlayFile(localRoot, target.publicId, locale, target.baseFingerprint)) {
        throw new Error(`[layer-pipeline] TEST_UNINDEXED_LOCALE ${locale} overlay missing`);
      }
      return { ...target, locale };
    }
    for (const item of instances) {
      const localeSet = new Set(item.localeKeys);
      for (const locale of item.localLocales) {
        if (localeSet.has(locale)) continue;
        if (!hasOverlayFile(localRoot, item.publicId, locale, item.baseFingerprint)) continue;
        return { ...item, locale };
      }
    }
    return null;
  }

  const applyCandidate = findApplyCandidate();
  if (!applyCandidate) {
    throw new Error('[layer-pipeline] No instance has an applyable locale overlay');
  }

  const locale = pickLocale([applyCandidate.locale], process.env.TEST_LOCALE) ?? applyCandidate.locale;
  const overlay = await fetchOverlay(
    tokyoBase,
    applyCandidate.publicId,
    'locale',
    locale,
    applyCandidate.baseFingerprint,
  );
  if (overlay && overlay.baseFingerprint !== applyCandidate.baseFingerprint) {
    throw new Error('[layer-pipeline] Overlay fingerprint mismatch');
  }

  const expectedState = overlay?.ops?.length
    ? applySetOps(applyCandidate.config, overlay.ops)
    : applyCandidate.config;
  const { res: applyRes, body: applyBody } = await fetchJsonLoose(
    `${veniceBase}/r/${encodeURIComponent(applyCandidate.publicId)}?locale=${encodeURIComponent(locale)}`,
    { headers: authHeaders },
  );
  if (!applyRes.ok || !deepEqual(applyBody?.state, expectedState)) {
    throw new Error('[layer-pipeline] Venice localized state mismatch');
  }

  const staleCandidate = findStaleCandidate();
  if (staleCandidate) {
    const { res, body } = await fetchJsonLoose(
      `${veniceBase}/r/${encodeURIComponent(staleCandidate.publicId)}?locale=${encodeURIComponent(staleCandidate.locale)}`,
      { headers: authHeaders },
    );
    if (isCuratedPublicId(staleCandidate.publicId)) {
      if (res.ok) throw new Error('[layer-pipeline] Expected fail-fast for curated stale overlay');
      console.log('[layer-pipeline] Stale overlay handling (curated fail-fast): OK');
    } else if (!deepEqual(body?.state, staleCandidate.config)) {
      throw new Error('[layer-pipeline] Stale overlay should be skipped but was applied');
    } else {
      console.log('[layer-pipeline] Stale overlay handling: OK');
    }
  } else {
    console.log('[layer-pipeline] Stale overlay handling: skipped (no mismatch detected).');
  }

  const missingCandidate = findMissingCandidate();
  if (missingCandidate) {
    const { res, body } = await fetchJsonLoose(
      `${veniceBase}/r/${encodeURIComponent(missingCandidate.publicId)}?locale=${encodeURIComponent(missingCandidate.locale)}`,
      { headers: authHeaders },
    );
    if (isCuratedPublicId(missingCandidate.publicId)) {
      if (res.ok) throw new Error('[layer-pipeline] Expected fail-fast for curated missing overlay');
      console.log('[layer-pipeline] Missing overlay handling (curated fail-fast): OK');
    } else if (!deepEqual(body?.state, missingCandidate.config)) {
      throw new Error('[layer-pipeline] Missing overlay should be skipped but was applied');
    } else {
      console.log('[layer-pipeline] Missing overlay handling: OK');
    }
  } else {
    console.log('[layer-pipeline] Missing overlay handling: skipped (no missing overlays found).');
  }

  const unindexedCandidate = findUnindexedCandidate();
  if (unindexedCandidate) {
    const { res, body } = await fetchJsonLoose(
      `${veniceBase}/r/${encodeURIComponent(unindexedCandidate.publicId)}?locale=${encodeURIComponent(unindexedCandidate.locale)}`,
      { headers: authHeaders },
    );
    if (isCuratedPublicId(unindexedCandidate.publicId)) {
      if (res.ok) throw new Error('[layer-pipeline] Expected fail-fast for curated unindexed overlay');
      console.log('[layer-pipeline] Publish ordering (curated fail-fast): OK');
    } else if (!deepEqual(body?.state, unindexedCandidate.config)) {
      throw new Error('[layer-pipeline] Unindexed overlay should be skipped but was applied');
    } else {
      console.log('[layer-pipeline] Publish ordering: OK');
    }
  } else {
    console.log('[layer-pipeline] Publish ordering: skipped (no unindexed overlays found).');
  }

  runPragueVerify();

  console.log('[layer-pipeline] OK');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
