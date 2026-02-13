#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = process.cwd();
const SYNC_SOURCE = String(process.env.SYNC_SOURCE || 'local').trim().toLowerCase();
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

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
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

function resolveSyncContext() {
  const envPath = path.join(ROOT, '.env.local');
  if (SYNC_SOURCE === 'local') {
    return {
      source: 'local',
      supabase: readLocalSupabaseEnv(),
      tokyoBaseUrl: String(process.env.TOKYO_WORKER_BASE_URL || 'http://localhost:8791')
        .trim()
        .replace(/\/+$/, ''),
    };
  }
  if (SYNC_SOURCE === 'cloud-dev') {
    return {
      source: 'cloud-dev',
      supabase: readCloudDevSupabaseEnv(),
      tokyoBaseUrl: String(
        process.env.TOKYO_WORKER_BASE_URL || process.env.CK_CLOUD_TOKYO_BASE_URL || parseDotEnvValue(envPath, 'CK_CLOUD_TOKYO_BASE_URL') || 'https://tokyo.dev.clickeen.com',
      )
        .trim()
        .replace(/\/+$/, ''),
    };
  }
  throw new Error(`[sync-arsenale-local] Unsupported SYNC_SOURCE=${SYNC_SOURCE} (expected local|cloud-dev)`);
}

async function supabaseFetch(ctx, route, init = {}) {
  return fetch(`${ctx.apiUrl}${route}`, {
    ...init,
    headers: {
      apikey: ctx.serviceRoleKey,
      Authorization: `Bearer ${ctx.serviceRoleKey}`,
      'content-type': 'application/json',
      ...(init.headers || {}),
    },
  });
}

async function loadActiveArsenaleKeys(ctx) {
  const params = new URLSearchParams({
    select: 'r2_key,asset_id,account_id',
    r2_key: 'like.arsenale/o/%',
    order: 'created_at.desc',
    limit: String(LIMIT),
  });
  const res = await supabaseFetch(ctx, `/rest/v1/account_asset_variants?${params.toString()}`, { method: 'GET' });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`[sync-arsenale-local] Failed to load variants (${res.status}): ${detail}`);
  }
  const rows = (await res.json().catch(() => [])) || [];
  return Array.isArray(rows) ? rows : [];
}

function toLocalPath(r2Key) {
  const key = String(r2Key || '').trim().replace(/^\/+/, '');
  if (!key.startsWith('arsenale/o/')) return null;
  if (key.includes('..')) return null;
  return path.join(ROOT, 'tokyo', key);
}

async function main() {
  const runtime = resolveSyncContext();
  const ctx = runtime.supabase;
  if (!ctx.apiUrl || !ctx.serviceRoleKey) {
    throw new Error(`[sync-arsenale-local] Could not resolve Supabase API_URL/SERVICE_ROLE_KEY for source=${runtime.source}`);
  }
  if (!runtime.tokyoBaseUrl) {
    throw new Error(`[sync-arsenale-local] Could not resolve TOKYO_WORKER_BASE_URL for source=${runtime.source}`);
  }

  const rows = await loadActiveArsenaleKeys(ctx);
  if (!rows.length) {
    console.log('[sync-arsenale-local] No arsensale keys found in account_asset_variants.');
    return;
  }

  let wrote = 0;
  let skippedExisting = 0;
  let skippedInvalid = 0;

  for (const row of rows) {
    const key = String(row?.r2_key || '').trim();
    const localPath = toLocalPath(key);
    if (!localPath) {
      skippedInvalid += 1;
      continue;
    }
    if (fs.existsSync(localPath)) {
      skippedExisting += 1;
      continue;
    }
    if (DRY_RUN) {
      wrote += 1;
      continue;
    }
    ensureDir(path.dirname(localPath));
    const sourceUrl = `${runtime.tokyoBaseUrl}/${key}`;
    let assetRes;
    try {
      assetRes = await fetch(sourceUrl, { method: 'GET' });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(
        `[sync-arsenale-local] Failed to reach Tokyo source at ${sourceUrl}. Detail: ${detail}`,
      );
    }
    if (!assetRes.ok) {
      const detail = await assetRes.text().catch(() => '');
      throw new Error(`[sync-arsenale-local] Failed to fetch ${key} (${assetRes.status}): ${detail}`);
    }
    const bytes = Buffer.from(await assetRes.arrayBuffer());
    fs.writeFileSync(localPath, bytes);
    wrote += 1;
  }

  console.log(
    `[sync-arsenale-local] source=${runtime.source} done: rows=${rows.length}, wrote=${wrote}, skippedExisting=${skippedExisting}, skippedInvalid=${skippedInvalid}, dryRun=${DRY_RUN ? '1' : '0'}`,
  );
}

main().catch((err) => {
  const detail = err instanceof Error ? err.message : String(err);
  console.error(detail);
  process.exit(1);
});
