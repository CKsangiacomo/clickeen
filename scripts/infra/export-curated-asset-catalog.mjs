#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = process.cwd();
const CATALOG_TARGET = String(process.env.CATALOG_TARGET || 'local').trim().toLowerCase();
const LIMIT = (() => {
  const parsed = Number.parseInt(String(process.env.LIMIT || '').trim(), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return 10000;
  return Math.min(parsed, 100000);
})();

function parseDotEnvValue(envPath, key) {
  const raw = fs.readFileSync(envPath, 'utf8');
  const line = raw
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${key}=`));
  if (!line) return '';
  const value = line.slice(key.length + 1).trim();
  if (!value) return '';
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
}

function readLocalSupabaseEnv() {
  const output = execSync('supabase status -o env', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const env = {};
  output.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    const match = trimmed.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) return;
    const key = match[1];
    let value = match[2] ?? '';
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  });
  return {
    apiUrl: String(env.API_URL || '').trim().replace(/\/+$/, ''),
    serviceRoleKey: String(env.SERVICE_ROLE_KEY || '').trim(),
  };
}

function readCloudDevSupabaseEnv() {
  const envPath = path.join(ROOT, '.env.local');
  return {
    apiUrl: String(process.env.SUPABASE_URL || parseDotEnvValue(envPath, 'SUPABASE_URL'))
      .trim()
      .replace(/\/+$/, ''),
    serviceRoleKey: String(process.env.SUPABASE_SERVICE_ROLE_KEY || parseDotEnvValue(envPath, 'SUPABASE_SERVICE_ROLE_KEY')).trim(),
  };
}

function resolveContext() {
  if (CATALOG_TARGET === 'local') return { target: 'local', ...readLocalSupabaseEnv() };
  if (CATALOG_TARGET === 'cloud-dev') return { target: 'cloud-dev', ...readCloudDevSupabaseEnv() };
  throw new Error(`[export-curated-catalog] Unsupported CATALOG_TARGET=${CATALOG_TARGET} (expected local|cloud-dev)`);
}

async function supabaseFetch(ctx, route, init = {}) {
  return fetch(`${ctx.apiUrl}/rest/v1${route}`, {
    ...init,
    headers: {
      apikey: ctx.serviceRoleKey,
      Authorization: `Bearer ${ctx.serviceRoleKey}`,
      'content-type': 'application/json',
      ...(init.headers || {}),
    },
  });
}

async function loadRows(ctx, route) {
  const res = await supabaseFetch(ctx, route, { method: 'GET' });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`[export-curated-catalog] Failed ${route} (${res.status}): ${detail}`);
  }
  const rows = await res.json().catch(() => []);
  return Array.isArray(rows) ? rows : [];
}

function localPathFromR2Key(r2Key) {
  const key = String(r2Key || '').trim().replace(/^\/+/, '');
  if (!key.startsWith('arsenale/o/')) return null;
  return path.join(ROOT, 'tokyo', key);
}

async function main() {
  const ctx = resolveContext();
  if (!ctx.apiUrl || !ctx.serviceRoleKey) {
    throw new Error(`[export-curated-catalog] Missing Supabase credentials for target=${ctx.target}`);
  }

  const [curated, usageRaw, variants] = await Promise.all([
    loadRows(ctx, `/curated_widget_instances?select=public_id,owner_account_id,updated_at&order=public_id.asc&limit=${LIMIT}`),
    loadRows(ctx, `/account_asset_usage?select=public_id,account_id,asset_id,config_path,updated_at&order=public_id.asc&limit=${LIMIT}`),
    loadRows(ctx, `/account_asset_variants?select=account_id,asset_id,variant,filename,r2_key,content_type,size_bytes&limit=${LIMIT}`),
  ]);
  const usage = usageRaw.filter((row) => String(row?.public_id || '').startsWith('wgt_curated_'));

  const variantByAsset = new Map();
  variants.forEach((row) => {
    const key = `${row.account_id}|${row.asset_id}|${row.variant}`;
    variantByAsset.set(key, row);
  });

  const byPublicId = new Map();
  curated.forEach((row) => {
    byPublicId.set(String(row.public_id || '').trim(), {
      publicId: String(row.public_id || '').trim(),
      ownerAccountId: String(row.owner_account_id || '').trim(),
      updatedAt: row.updated_at || null,
      assets: [],
    });
  });

  usage.forEach((row) => {
    const publicId = String(row.public_id || '').trim();
    const accountId = String(row.account_id || '').trim();
    const assetId = String(row.asset_id || '').trim();
    const configPath = String(row.config_path || '').trim();
    const container = byPublicId.get(publicId);
    if (!container) return;

    const variant = variantByAsset.get(`${accountId}|${assetId}|original`) || null;
    const r2Key = variant?.r2_key ? String(variant.r2_key).replace(/^\/+/, '') : null;
    const localPath = r2Key ? localPathFromR2Key(r2Key) : null;
    const localFileExists = localPath ? fs.existsSync(localPath) : false;

    container.assets.push({
      configPath,
      accountId,
      assetId,
      variant: variant?.variant || 'original',
      filename: variant?.filename || null,
      r2Key,
      localMirrorPath: localPath ? path.relative(ROOT, localPath).replace(/\\/g, '/') : null,
      localMirrorExists: localFileExists,
      usageUpdatedAt: row.updated_at || null,
    });
  });

  const instances = Array.from(byPublicId.values()).map((entry) => ({
    ...entry,
    assetCount: entry.assets.length,
    assets: entry.assets.sort((a, b) => a.configPath.localeCompare(b.configPath)),
  }));

  const payload = {
    generatedAt: new Date().toISOString(),
    target: ctx.target,
    totalCuratedInstances: instances.length,
    totalCuratedAssetRefs: instances.reduce((sum, item) => sum + item.assetCount, 0),
    instances,
  };

  const outDir = path.join(ROOT, 'tokyo', 'arsenale', 'catalog');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `curated-assets.${ctx.target}.json`);
  fs.writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.log(`[export-curated-catalog] wrote ${path.relative(ROOT, outPath)} (instances=${instances.length})`);
}

main().catch((err) => {
  const detail = err instanceof Error ? err.message : String(err);
  console.error(detail);
  process.exit(1);
});
