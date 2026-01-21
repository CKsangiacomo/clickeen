#!/usr/bin/env node
/* eslint-disable no-console */
import crypto from 'node:crypto';

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

function getBaseUrl(envKeys, fallback) {
  for (const key of envKeys) {
    const value = process.env[key];
    if (value) return value.replace(/\/+$/, '');
  }
  return fallback;
}

async function fetchJson(url, init) {
  const res = await fetch(url, init);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`[layer-pipeline] ${url} -> ${res.status} ${text}`.trim());
  }
  return res.json();
}

async function main() {
  if (process.env.RUN_LAYER_PIPELINE_TESTS !== '1') {
    console.log('[layer-pipeline] Skipped (set RUN_LAYER_PIPELINE_TESTS=1 to run).');
    return;
  }

  const publicId = process.env.TEST_PUBLIC_ID || 'wgt_main_faq';
  const parisBase = getBaseUrl(['PARIS_BASE_URL', 'NEXT_PUBLIC_PARIS_URL'], 'http://localhost:3001');
  const tokyoBase = getBaseUrl(['TOKYO_URL', 'TOKYO_BASE_URL', 'NEXT_PUBLIC_TOKYO_URL'], 'http://localhost:4000');
  const veniceBase = getBaseUrl(['VENICE_BASE_URL', 'NEXT_PUBLIC_VENICE_URL'], 'http://localhost:3003');

  const instance = await fetchJson(`${parisBase}/api/instance/${encodeURIComponent(publicId)}`);
  if (!instance || typeof instance !== 'object' || !instance.config) {
    throw new Error('[layer-pipeline] Paris response missing config');
  }
  const baseFingerprint = sha256Hex(stableStringify(instance.config));

  const index = await fetchJson(`${tokyoBase}/l10n/instances/${encodeURIComponent(publicId)}/index.json`);
  let localeKeys = [];
  let overlayPath = '';
  let indexFingerprint = null;

  if (index?.layers?.locale?.keys) {
    localeKeys = Array.isArray(index.layers.locale.keys) ? index.layers.locale.keys : [];
    overlayPath = `/l10n/instances/${encodeURIComponent(publicId)}/locale/${encodeURIComponent(
      localeKeys.includes('en') ? 'en' : localeKeys[0]
    )}/${encodeURIComponent(baseFingerprint)}.ops.json`;
  }

  if (!localeKeys.length || !overlayPath) {
    throw new Error('[layer-pipeline] index.json missing locale keys');
  }
  const locale = localeKeys.includes('en') ? 'en' : localeKeys[0];
  if (index?.layers?.locale?.lastPublishedFingerprint) {
    indexFingerprint = index.layers.locale.lastPublishedFingerprint[locale] ?? null;
  }
  const overlay = await fetchJson(`${tokyoBase}${overlayPath}`);
  if (!overlay || overlay.baseFingerprint !== baseFingerprint) {
    throw new Error('[layer-pipeline] Overlay fingerprint mismatch');
  }

  if (indexFingerprint && indexFingerprint !== baseFingerprint) {
    const indexedOverlayPath = `/l10n/instances/${encodeURIComponent(publicId)}/locale/${encodeURIComponent(
      locale
    )}/${encodeURIComponent(indexFingerprint)}.ops.json`;
    await fetchJson(`${tokyoBase}${indexedOverlayPath}`);
  }

  const veniceRes = await fetch(`${veniceBase}/e/${encodeURIComponent(publicId)}?locale=${encodeURIComponent(locale)}`);
  if (!veniceRes.ok) {
    throw new Error(`[layer-pipeline] Venice render failed (${veniceRes.status})`);
  }

  console.log('[layer-pipeline] OK');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
