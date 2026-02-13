#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = process.cwd();
const DRY_RUN = String(process.env.DRY_RUN || '').trim() === '1';
const INCLUDE_LOCAL = String(process.env.INCLUDE_LOCAL || '1').trim() !== '0';
const INCLUDE_CLOUD_DEV = String(process.env.INCLUDE_CLOUD_DEV || '1').trim() !== '0';
const MIRROR_SOURCE = String(process.env.MIRROR_SOURCE || 'cloud-dev').trim().toLowerCase();
const LIMIT = (() => {
  const parsed = Number.parseInt(String(process.env.LIMIT || '').trim(), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
  return String(Math.min(parsed, 100000));
})();

function log(message) {
  console.log(`[assets-converge] ${message}`);
}

function parseDotEnvValue(envPath, key) {
  if (!fs.existsSync(envPath)) return '';
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
  try {
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
  } catch {
    return { apiUrl: '', serviceRoleKey: '' };
  }
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

function parseBooleanEnv(raw, fallback) {
  const value = String(raw ?? '').trim().toLowerCase();
  if (!value) return fallback;
  if (['1', 'true', 'yes', 'y'].includes(value)) return true;
  if (['0', 'false', 'no', 'n'].includes(value)) return false;
  return fallback;
}

function runStep(name, command, extraEnv = {}) {
  const env = {
    ...process.env,
    ...extraEnv,
  };
  if (LIMIT) env.LIMIT = LIMIT;
  log(`START ${name}`);
  execSync(command, { stdio: 'inherit', env, cwd: ROOT });
  log(`DONE  ${name}`);
}

function hasLegacyRef(config) {
  const text = JSON.stringify(config ?? {});
  return text.includes('/workspace-assets/') || text.includes('/curated-assets/') || text.includes('/assets/accounts/');
}

function normalizeAccountAssetPath(pathname) {
  if (pathname.startsWith('/assets/accounts/')) {
    return pathname.replace(/^\/assets\/accounts\//, '/arsenale/o/');
  }
  return pathname;
}

function parseAccountAssetRef(raw) {
  const value = String(raw || '').trim();
  if (!value) return null;

  let pathname = '';
  if (/^https?:\/\//i.test(value)) {
    try {
      pathname = new URL(value).pathname;
    } catch {
      return null;
    }
  } else if (value.startsWith('/')) {
    pathname = value;
  } else {
    return null;
  }

  const normalized = normalizeAccountAssetPath(pathname);
  const match = normalized.match(/^\/arsenale\/o\/([^/]+)\/([^/]+)\/[^/]+\/[^/]+$/);
  if (!match) return null;
  return { accountId: decodeURIComponent(match[1] || ''), assetId: decodeURIComponent(match[2] || '') };
}

function findAssetRefsInString(value) {
  const out = [];
  const direct = parseAccountAssetRef(value);
  if (direct) out.push(direct);

  const urlPattern = /url\(\s*(['"]?)([^'")]+)\1\s*\)/gi;
  let match = urlPattern.exec(value);
  while (match) {
    const ref = parseAccountAssetRef(match[2] || '');
    if (ref) out.push(ref);
    match = urlPattern.exec(value);
  }
  return out;
}

function extractAssetRefs(config) {
  const out = [];
  const visit = (node) => {
    if (typeof node === 'string') {
      out.push(...findAssetRefsInString(node));
      return;
    }
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      node.forEach((item) => visit(item));
      return;
    }
    Object.values(node).forEach((item) => visit(item));
  };
  visit(config);
  return out;
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

async function fetchRows(ctx, route) {
  const res = await supabaseFetch(ctx, route, { method: 'GET' });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`[assets-converge] Failed ${route} (${res.status}): ${detail}`);
  }
  const rows = await res.json().catch(() => []);
  return Array.isArray(rows) ? rows : [];
}

async function auditEnvironment(label, ctx) {
  if (!ctx.apiUrl || !ctx.serviceRoleKey) {
    throw new Error(`[assets-converge] Missing Supabase credentials for ${label}`);
  }

  const [workspaces, curated, instances, usage] = await Promise.all([
    fetchRows(ctx, `/workspaces?select=id,account_id&limit=${LIMIT || '10000'}`),
    fetchRows(ctx, `/curated_widget_instances?select=public_id,owner_account_id,config&limit=${LIMIT || '10000'}`),
    fetchRows(ctx, `/widget_instances?select=public_id,workspace_id,config&limit=${LIMIT || '10000'}`),
    fetchRows(ctx, `/account_asset_usage?select=account_id,asset_id,public_id&limit=${LIMIT || '10000'}`),
  ]);

  const workspaceToAccount = new Map();
  workspaces.forEach((row) => {
    const workspaceId = String(row?.id || '').trim();
    const accountId = String(row?.account_id || '').trim();
    if (workspaceId && accountId) workspaceToAccount.set(workspaceId, accountId);
  });

  const legacyCurated = curated.filter((row) => hasLegacyRef(row?.config)).length;
  const legacyUser = instances.filter((row) => hasLegacyRef(row?.config)).length;
  if (legacyCurated > 0 || legacyUser > 0) {
    throw new Error(
      `[assets-converge] ${label} audit failed: legacy refs remain (curated=${legacyCurated}, user=${legacyUser})`,
    );
  }

  const expectedUsage = new Set();
  const violations = [];

  curated.forEach((row) => {
    const publicId = String(row?.public_id || '').trim();
    const accountId = String(row?.owner_account_id || '').trim();
    if (!publicId || !accountId) return;
    extractAssetRefs(row?.config || {}).forEach((ref) => {
      if (ref.accountId !== accountId) {
        violations.push({ publicId, kind: 'curated', expectedAccountId: accountId, actualAccountId: ref.accountId });
        return;
      }
      expectedUsage.add(`${accountId}|${ref.assetId}|${publicId}`);
    });
  });

  instances.forEach((row) => {
    const publicId = String(row?.public_id || '').trim();
    const workspaceId = String(row?.workspace_id || '').trim();
    const accountId = String(workspaceToAccount.get(workspaceId) || '').trim();
    if (!publicId || !accountId) return;
    extractAssetRefs(row?.config || {}).forEach((ref) => {
      if (ref.accountId !== accountId) {
        violations.push({ publicId, kind: 'user', expectedAccountId: accountId, actualAccountId: ref.accountId });
        return;
      }
      expectedUsage.add(`${accountId}|${ref.assetId}|${publicId}`);
    });
  });

  if (violations.length > 0) {
    throw new Error(
      `[assets-converge] ${label} audit failed: cross-account refs found (${violations.length}). sample=${JSON.stringify(
        violations.slice(0, 5),
      )}`,
    );
  }

  const actualUsage = new Set(
    usage.map((row) => `${String(row?.account_id || '').trim()}|${String(row?.asset_id || '').trim()}|${String(row?.public_id || '').trim()}`),
  );

  for (const item of expectedUsage) {
    if (!actualUsage.has(item)) {
      throw new Error(`[assets-converge] ${label} audit failed: missing usage row for ${item}`);
    }
  }

  log(
    `${label} audit ok: curated=${curated.length} user=${instances.length} legacy=0 usageRows=${usage.length} expectedUsageKeys=${expectedUsage.size}`,
  );
}

function auditLocalFilesystem() {
  const curatedDir = path.join(ROOT, 'tokyo', 'curated-assets');
  const workspaceDir = path.join(ROOT, 'tokyo', 'workspace-assets');
  const curatedExists = fs.existsSync(curatedDir);
  const workspaceExists = fs.existsSync(workspaceDir);
  if (curatedExists || workspaceExists) {
    throw new Error(
      `[assets-converge] local filesystem audit failed: legacy dirs still exist (curated-assets=${curatedExists}, workspace-assets=${workspaceExists})`,
    );
  }
  log('local filesystem audit ok: no legacy tokyo/{curated-assets,workspace-assets} dirs');
}

async function main() {
  if (!INCLUDE_LOCAL && !INCLUDE_CLOUD_DEV) {
    throw new Error('[assets-converge] Nothing to do: both INCLUDE_LOCAL and INCLUDE_CLOUD_DEV are disabled.');
  }

  log(
    `begin dryRun=${DRY_RUN ? '1' : '0'} includeLocal=${INCLUDE_LOCAL ? '1' : '0'} includeCloudDev=${INCLUDE_CLOUD_DEV ? '1' : '0'} mirrorSource=${MIRROR_SOURCE}`,
  );

  if (INCLUDE_LOCAL) {
    runStep('migrate-curated local', 'node scripts/infra/migrate-curated-assets-to-arsenale.mjs', {
      MIGRATION_TARGET: 'local',
      DRY_RUN: DRY_RUN ? '1' : '',
    });
    runStep('reindex-usage local', 'node scripts/infra/reindex-account-asset-usage.mjs', {
      INDEX_TARGET: 'local',
      DRY_RUN: DRY_RUN ? '1' : '',
    });
    runStep('prune-legacy local', 'node scripts/infra/prune-local-legacy-curated-assets.mjs', {
      DRY_RUN: DRY_RUN ? '1' : '',
    });
  }

  if (INCLUDE_CLOUD_DEV) {
    runStep('migrate-curated cloud-dev', 'node scripts/infra/migrate-curated-assets-to-arsenale.mjs', {
      MIGRATION_TARGET: 'cloud-dev',
      DRY_RUN: DRY_RUN ? '1' : '',
    });
    runStep('reindex-usage cloud-dev', 'node scripts/infra/reindex-account-asset-usage.mjs', {
      INDEX_TARGET: 'cloud-dev',
      DRY_RUN: DRY_RUN ? '1' : '',
    });
  }

  if (INCLUDE_LOCAL) {
    const mirrorSource = INCLUDE_CLOUD_DEV ? MIRROR_SOURCE : 'local';
    runStep('sync-local-mirror', 'node scripts/infra/sync-local-arsenale-mirror.mjs', {
      SYNC_SOURCE: mirrorSource,
      DRY_RUN: DRY_RUN ? '1' : '',
    });
  }

  if (DRY_RUN) {
    log('dry-run complete (audit skipped by design)');
    return;
  }

  if (INCLUDE_LOCAL) {
    await auditEnvironment('local', readLocalSupabaseEnv());
    auditLocalFilesystem();
  }
  if (INCLUDE_CLOUD_DEV) {
    await auditEnvironment('cloud-dev', readCloudDevSupabaseEnv());
  }

  log('converge complete');
}

main().catch((err) => {
  const detail = err instanceof Error ? err.message : String(err);
  console.error(detail);
  process.exit(1);
});

