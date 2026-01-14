#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../..');

const outRoot = path.join(repoRoot, 'l10n', 'instances');

const LOCALE_PATTERN = /^[a-z]{2}(?:-[a-z0-9]+)*$/;
const PROHIBITED_SEGMENTS = new Set(['__proto__', 'prototype', 'constructor']);

function normalizeLocaleToken(raw) {
  const value = typeof raw === 'string' ? raw.trim().toLowerCase().replace(/_/g, '-') : '';
  if (!value || !LOCALE_PATTERN.test(value)) return null;
  return value;
}

function hasProhibitedSegment(pathStr) {
  return String(pathStr || '')
    .split('.')
    .some((seg) => seg && PROHIBITED_SEGMENTS.has(seg));
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function prettyStableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function isCuratedPublicId(publicId) {
  if (/^wgt_curated_/.test(publicId)) return true;
  return /^wgt_main_[a-z0-9][a-z0-9_-]*$/i.test(publicId);
}

async function listInstanceLocales() {
  const baseUrl = String(process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!baseUrl || !key) {
    throw new Error('[l10n] SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  }

  const rows = [];
  const limit = 1000;
  let offset = 0;
  while (true) {
    const params = new URLSearchParams({
      select: 'public_id,locale,ops,base_fingerprint,base_updated_at,source,workspace_id',
      limit: String(limit),
      offset: String(offset),
      order: 'public_id.asc,locale.asc',
    });
    const res = await fetch(`${baseUrl}/rest/v1/widget_instance_locales?${params.toString()}`, {
      method: 'GET',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`[l10n] Failed to list overlays (${res.status}) ${detail}`.trim());
    }
    const batch = (await res.json().catch(() => [])) || [];
    if (!batch.length) break;
    rows.push(...batch);
    if (batch.length < limit) break;
    offset += batch.length;
  }
  return rows;
}

function assertOverlayShape({ publicId, locale, ops, baseFingerprint }) {
  if (!Array.isArray(ops)) {
    throw new Error(`[l10n] ${publicId}/${locale}: ops must be an array`);
  }
  if (!baseFingerprint || typeof baseFingerprint !== 'string' || !/^[a-f0-9]{64}$/i.test(baseFingerprint)) {
    throw new Error(`[l10n] ${publicId}/${locale}: baseFingerprint is required`);
  }
  for (let i = 0; i < ops.length; i += 1) {
    const op = ops[i];
    if (!op || typeof op !== 'object' || Array.isArray(op)) {
      throw new Error(`[l10n] ${publicId}/${locale}: ops[${i}] must be an object`);
    }
    if (op.op !== 'set') {
      throw new Error(`[l10n] ${publicId}/${locale}: ops[${i}].op must be "set"`);
    }
    const p = typeof op.path === 'string' ? op.path.trim() : '';
    if (!p) throw new Error(`[l10n] ${publicId}/${locale}: ops[${i}].path is required`);
    if (hasProhibitedSegment(p)) {
      throw new Error(`[l10n] ${publicId}/${locale}: ops[${i}].path contains prohibited segment`);
    }
    if (!('value' in op)) throw new Error(`[l10n] ${publicId}/${locale}: ops[${i}].value is required`);
    if (typeof op.value !== 'string') {
      throw new Error(`[l10n] ${publicId}/${locale}: ops[${i}].value must be a string`);
    }
    if (op.value === undefined) throw new Error(`[l10n] ${publicId}/${locale}: ops[${i}].value cannot be undefined`);
  }
}

async function main() {
  const rows = await listInstanceLocales();
  const curated = rows.filter((row) => row && typeof row.public_id === 'string' && isCuratedPublicId(row.public_id));
  if (!curated.length) {
    console.log('[l10n] No curated overlays found');
    return;
  }

  for (const row of curated) {
    const publicId = String(row.public_id || '').trim();
    const locale = normalizeLocaleToken(row.locale);
    if (!publicId || !locale) continue;
    const ops = row.ops;
    const baseFingerprint = row.base_fingerprint;
    const baseUpdatedAt = typeof row.base_updated_at === 'string' ? row.base_updated_at : null;

    assertOverlayShape({ publicId, locale, ops, baseFingerprint });

    const outDir = path.join(outRoot, publicId);
    ensureDir(outDir);
    const payload = {
      v: 1,
      baseFingerprint,
      baseUpdatedAt,
      ops,
    };
    fs.writeFileSync(path.join(outDir, `${locale}.ops.json`), prettyStableJson(payload), 'utf8');
    console.log(`[l10n] Wrote ${publicId}/${locale}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
