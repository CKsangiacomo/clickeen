#!/usr/bin/env node
/* eslint-disable no-console */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fileExists, listJsonFiles, ensurePosixPath, readJson, normalizeLocaleToken, stableStringify, sha256Hex } from './lib.mjs';

const REPO_ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');
const ALLOWLIST_ROOT = path.join(REPO_ROOT, 'prague', 'content', 'allowlists', 'v1');
const TOKYO_PRAGUE_ROOT = path.join(REPO_ROOT, 'tokyo', 'l10n', 'prague');
const TOKYO_WIDGETS_ROOT = path.join(REPO_ROOT, 'tokyo', 'widgets');
const LOCALES_PATH = path.join(REPO_ROOT, 'config', 'locales.json');

const args = new Set(process.argv.slice(2));
const strictLatest = args.has('--strict-latest') || String(process.env.PRAGUE_L10N_STATUS_STRICT || '').trim() === '1';

function computeBaseFingerprint(config) {
  return sha256Hex(stableStringify(config));
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
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
    .filter(Boolean);
}

function buildPageBase({ pageId, blocks, pagePath }) {
  const baseBlocks = {};
  for (const block of blocks) {
    if (!block || typeof block !== 'object' || Array.isArray(block)) {
      throw new Error(`[prague-l10n] Invalid block entry in ${pagePath}`);
    }
    const id = String(block.id || '').trim();
    const copy = block.copy;
    if (!id || !isPlainObject(copy)) {
      throw new Error(`[prague-l10n] ${pagePath}: blocks must have id + copy object`);
    }
    baseBlocks[id] = { copy };
  }
  return { v: 1, pageId, blocks: baseBlocks };
}

async function loadLocales() {
  const raw = await readJson(LOCALES_PATH);
  if (!Array.isArray(raw)) throw new Error(`[prague-l10n] Invalid locales file: ${LOCALES_PATH}`);
  const locales = raw
    .map((entry) => {
      if (typeof entry === 'string') return normalizeLocaleToken(entry);
      if (entry && typeof entry === 'object' && typeof entry.code === 'string') return normalizeLocaleToken(entry.code);
      return null;
    })
    .filter(Boolean);
  return Array.from(new Set(locales)).sort();
}

async function loadBlockAllowlist(blockType) {
  const allowlistPath = path.join(ALLOWLIST_ROOT, 'blocks', `${blockType}.allowlist.json`);
  const allowlist = await readJson(allowlistPath);
  if (!isPlainObject(allowlist) || allowlist.v !== 1 || !Array.isArray(allowlist.paths)) {
    throw new Error(`[prague-l10n] Invalid allowlist: ${allowlistPath}`);
  }
  return allowlist.paths
    .map((entry) => (typeof entry?.path === 'string' ? String(entry.path).trim() : ''))
    .filter(Boolean);
}

async function loadLayerIndex(pageId) {
  const indexPath = path.join(TOKYO_PRAGUE_ROOT, pageId, 'index.json');
  if (!(await fileExists(indexPath))) return null;
  const index = await readJson(indexPath).catch(() => null);
  if (!isPlainObject(index) || index.v !== 1) return null;
  const localeLayer = index.layers?.locale;
  if (!isPlainObject(localeLayer)) return null;
  return localeLayer;
}

async function main() {
  const locales = await loadLocales();
  const overlayLocales = locales.filter((l) => l !== 'en');
  const pageFiles = await listWidgetPageFiles();
  if (!pageFiles.length) {
    console.log('[prague-l10n] No widget pages found.');
    return;
  }

  let pages = 0;
  let localesChecked = 0;
  let okLatest = 0;
  let okBestAvailable = 0;
  const errors = [];
  const warnings = [];

  for (const entry of pageFiles) {
    const json = await readJson(entry.filePath);
    const blocks = Array.isArray(json?.blocks) ? json.blocks : null;
    if (!blocks) continue;
    const base = buildPageBase({ pageId: entry.pageId, blocks, pagePath: entry.filePath });
    const baseFingerprint = computeBaseFingerprint(base);

    const localeLayer = await loadLayerIndex(entry.pageId);
    pages += 1;

    for (const locale of overlayLocales) {
      localesChecked += 1;
      const publishedFingerprintRaw = localeLayer?.lastPublishedFingerprint?.[locale];
      const publishedFingerprint = typeof publishedFingerprintRaw === 'string' ? publishedFingerprintRaw : null;

      const expectedFingerprint = strictLatest ? baseFingerprint : publishedFingerprint;
      if (!expectedFingerprint) {
        problems.push({ pageId: entry.pageId, locale, kind: 'missing_index_fingerprint' });
        continue;
      }

      const overlayPath = path.join(TOKYO_PRAGUE_ROOT, entry.pageId, 'locale', locale, `${expectedFingerprint}.ops.json`);
      const snapshotPath = path.join(TOKYO_PRAGUE_ROOT, entry.pageId, 'bases', `${expectedFingerprint}.snapshot.json`);
      const overlayOk = await fileExists(overlayPath);
      const snapshotOk = await fileExists(snapshotPath);

      if (overlayOk) {
        if (strictLatest) okLatest += 1;
        else okBestAvailable += 1;
      } else {
        errors.push({
          pageId: entry.pageId,
          locale,
          kind: strictLatest ? 'missing_latest_overlay' : 'missing_published_overlay',
          path: overlayPath,
        });
      }

      if (!snapshotOk) {
        // Snapshots are required for safe stale application, but older published overlays may not have one yet.
        (strictLatest ? errors : warnings).push({
          pageId: entry.pageId,
          locale,
          kind: strictLatest ? 'missing_latest_snapshot' : 'missing_published_snapshot',
          path: snapshotPath,
        });
      }
    }
  }

  const mode = strictLatest ? 'strict-latest' : 'best-available';
  console.log(`[prague-l10n] Status (${mode})`);
  console.log(`- Pages: ${pages}`);
  console.log(`- Locales: ${overlayLocales.length} (checked ${localesChecked} page×locale pairs)`);
  if (strictLatest) {
    console.log(`- Overlays present (latest): ${okLatest}/${localesChecked}`);
  } else {
    console.log(`- Overlays present (published): ${okBestAvailable}/${localesChecked}`);
  }

  if (!errors.length && !warnings.length) {
    console.log('[prague-l10n] OK');
    return;
  }

  if (warnings.length) {
    const top = warnings.slice(0, 10);
    console.log(`[prague-l10n] Warnings (${warnings.length}): showing first ${top.length}`);
    for (const p of top) {
      console.log(`- ${p.kind}: ${p.pageId}/${p.locale} → ${p.path}`);
    }
  }

  if (errors.length) {
    const top = errors.slice(0, 25);
    console.log(`[prague-l10n] Errors (${errors.length}): showing first ${top.length}`);
    for (const p of top) {
      console.log(`- ${p.kind}: ${p.pageId}/${p.locale} → ${p.path}`);
    }
  }

  process.exitCode = strictLatest && errors.length ? 1 : 0;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
