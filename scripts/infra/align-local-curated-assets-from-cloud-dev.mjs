#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = process.cwd();
const DRY_RUN = String(process.env.DRY_RUN || '').trim() === '1';
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

function readCloudDevContext() {
  const envPath = path.join(ROOT, '.env.local');
  return {
    apiUrl: String(process.env.SUPABASE_URL || parseDotEnvValue(envPath, 'SUPABASE_URL'))
      .trim()
      .replace(/\/+$/, ''),
    serviceRoleKey: String(process.env.SUPABASE_SERVICE_ROLE_KEY || parseDotEnvValue(envPath, 'SUPABASE_SERVICE_ROLE_KEY')).trim(),
    tokyoBaseUrl: String(process.env.CK_CLOUD_TOKYO_BASE_URL || parseDotEnvValue(envPath, 'CK_CLOUD_TOKYO_BASE_URL') || 'https://tokyo.dev.clickeen.com')
      .trim()
      .replace(/\/+$/, ''),
  };
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
    throw new Error(`[align-local-curated] Failed ${route} (${res.status}): ${detail}`);
  }
  const rows = await res.json().catch(() => []);
  return Array.isArray(rows) ? rows : [];
}

function toLocalPathFromR2Key(r2Key) {
  const key = String(r2Key || '').trim().replace(/^\/+/, '');
  if (!key.startsWith('arsenale/o/')) return null;
  if (key.includes('..')) return null;
  return path.join(ROOT, 'tokyo', key);
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

async function main() {
  const local = readLocalSupabaseEnv();
  const cloud = readCloudDevContext();
  if (!local.apiUrl || !local.serviceRoleKey) {
    throw new Error('[align-local-curated] Missing local Supabase credentials');
  }
  if (!cloud.apiUrl || !cloud.serviceRoleKey) {
    throw new Error('[align-local-curated] Missing cloud-dev Supabase credentials');
  }
  if (!cloud.tokyoBaseUrl) {
    throw new Error('[align-local-curated] Missing cloud Tokyo base URL');
  }

  const [localUsageRaw, cloudUsageRaw, localVariants, cloudVariants] = await Promise.all([
    loadRows(
      local,
      `/account_asset_usage?select=account_id,asset_id,public_id,config_path&limit=${LIMIT}`,
    ),
    loadRows(
      cloud,
      `/account_asset_usage?select=account_id,asset_id,public_id,config_path&limit=${LIMIT}`,
    ),
    loadRows(local, `/account_asset_variants?select=account_id,asset_id,r2_key,filename,variant&limit=${LIMIT}`),
    loadRows(cloud, `/account_asset_variants?select=account_id,asset_id,r2_key,filename,variant&limit=${LIMIT}`),
  ]);

  const localUsage = localUsageRaw.filter((row) => String(row?.public_id || '').startsWith('wgt_curated_'));
  const cloudUsage = cloudUsageRaw.filter((row) => String(row?.public_id || '').startsWith('wgt_curated_'));

  const localByKey = new Map();
  localUsage.forEach((row) => {
    const key = `${row.public_id}|${row.config_path}`;
    localByKey.set(key, row);
  });

  const cloudByKey = new Map();
  cloudUsage.forEach((row) => {
    const key = `${row.public_id}|${row.config_path}`;
    cloudByKey.set(key, row);
  });

  const localVariantByAsset = new Map();
  localVariants.forEach((row) => {
    const key = `${row.account_id}|${row.asset_id}|original`;
    localVariantByAsset.set(key, row);
  });
  const cloudVariantByAsset = new Map();
  cloudVariants.forEach((row) => {
    const key = `${row.account_id}|${row.asset_id}|original`;
    cloudVariantByAsset.set(key, row);
  });

  let copied = 0;
  let skipped = 0;
  let missingPairs = 0;

  for (const [usageKey, localRow] of localByKey.entries()) {
    const cloudRow = cloudByKey.get(usageKey);
    if (!cloudRow) {
      missingPairs += 1;
      continue;
    }
    const localVariant = localVariantByAsset.get(`${localRow.account_id}|${localRow.asset_id}|original`);
    const cloudVariant = cloudVariantByAsset.get(`${cloudRow.account_id}|${cloudRow.asset_id}|original`);
    if (!localVariant || !cloudVariant) {
      missingPairs += 1;
      continue;
    }

    const sourceUrl = `${cloud.tokyoBaseUrl}/${String(cloudVariant.r2_key || '').replace(/^\/+/, '')}`;
    const destPath = toLocalPathFromR2Key(localVariant.r2_key);
    if (!destPath) {
      skipped += 1;
      continue;
    }
    if (!DRY_RUN && fs.existsSync(destPath)) {
      skipped += 1;
      continue;
    }

    if (!DRY_RUN) {
      const res = await fetch(sourceUrl, { method: 'GET' });
      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        throw new Error(`[align-local-curated] Failed to fetch ${sourceUrl} (${res.status}): ${detail}`);
      }
      const bytes = Buffer.from(await res.arrayBuffer());
      ensureDir(path.dirname(destPath));
      fs.writeFileSync(destPath, bytes);
    }
    copied += 1;
  }

  console.log(
    `[align-local-curated] done: localUsage=${localUsage.length}, cloudUsage=${cloudUsage.length}, copied=${copied}, skipped=${skipped}, missingPairs=${missingPairs}, dryRun=${DRY_RUN ? '1' : '0'}`,
  );
}

main().catch((err) => {
  const detail = err instanceof Error ? err.message : String(err);
  console.error(detail);
  process.exit(1);
});
