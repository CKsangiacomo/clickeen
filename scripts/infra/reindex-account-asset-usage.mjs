#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = process.cwd();
const INDEX_TARGET = String(process.env.INDEX_TARGET || 'local').trim().toLowerCase();
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
  if (INDEX_TARGET === 'local') return { target: 'local', ...readLocalSupabaseEnv() };
  if (INDEX_TARGET === 'cloud-dev') return { target: 'cloud-dev', ...readCloudDevSupabaseEnv() };
  throw new Error(`[reindex-account-asset-usage] Unsupported INDEX_TARGET=${INDEX_TARGET} (expected local|cloud-dev)`);
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value || '').trim());
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
  const accountId = decodeURIComponent(match[1] || '').trim();
  const assetId = decodeURIComponent(match[2] || '').trim();
  if (!isUuid(accountId) || !isUuid(assetId)) return null;
  return { accountId, assetId };
}

function findAccountAssetRefsInString(value) {
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

function extractAccountAssetUsageRefs(config, publicId) {
  const out = new Map();
  const visit = (node, pathKey) => {
    if (typeof node === 'string') {
      const refs = findAccountAssetRefsInString(node);
      refs.forEach((ref) => {
        const item = {
          accountId: ref.accountId,
          assetId: ref.assetId,
          publicId,
          configPath: pathKey,
        };
        out.set(`${item.accountId}|${item.assetId}|${item.publicId}|${item.configPath}`, item);
      });
      return;
    }
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      for (let i = 0; i < node.length; i += 1) {
        visit(node[i], `${pathKey}[${i}]`);
      }
      return;
    }
    Object.entries(node).forEach(([key, value]) => {
      const nextPath = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key)
        ? `${pathKey}.${key}`
        : `${pathKey}[${JSON.stringify(key)}]`;
      visit(value, nextPath);
    });
  };
  visit(config, 'config');
  return Array.from(out.values());
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

async function fetchRows(ctx, route) {
  const res = await supabaseFetch(ctx, route, { method: 'GET' });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`[reindex-account-asset-usage] Failed ${route} (${res.status}): ${detail}`);
  }
  const rows = await res.json().catch(() => []);
  return Array.isArray(rows) ? rows : [];
}

async function deleteUsage(ctx, accountId, publicId) {
  const params = new URLSearchParams({
    account_id: `eq.${accountId}`,
    public_id: `eq.${publicId}`,
  });
  const res = await supabaseFetch(ctx, `/rest/v1/account_asset_usage?${params.toString()}`, { method: 'DELETE' });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(
      `[reindex-account-asset-usage] Failed delete usage account=${accountId} publicId=${publicId} (${res.status}): ${detail}`,
    );
  }
}

async function insertUsageRows(ctx, rows) {
  if (rows.length === 0) return;
  const res = await supabaseFetch(
    ctx,
    '/rest/v1/account_asset_usage?on_conflict=account_id,asset_id,public_id,config_path',
    {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(rows),
    },
  );
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`[reindex-account-asset-usage] Failed insert usage rows (${res.status}): ${detail}`);
  }
}

async function main() {
  const ctx = resolveContext();
  if (!ctx.apiUrl || !ctx.serviceRoleKey) {
    throw new Error(`[reindex-account-asset-usage] Missing Supabase credentials for target=${ctx.target}`);
  }

  const [workspaces, userInstances, curatedInstances] = await Promise.all([
    fetchRows(ctx, `/rest/v1/workspaces?select=id,account_id&limit=${LIMIT}`),
    fetchRows(ctx, `/rest/v1/widget_instances?select=public_id,workspace_id,config&limit=${LIMIT}`),
    fetchRows(ctx, `/rest/v1/curated_widget_instances?select=public_id,owner_account_id,config&limit=${LIMIT}`),
  ]);

  const workspaceToAccount = new Map();
  workspaces.forEach((row) => {
    const workspaceId = String(row?.id || '').trim();
    const accountId = String(row?.account_id || '').trim();
    if (isUuid(workspaceId) && isUuid(accountId)) workspaceToAccount.set(workspaceId, accountId);
  });

  const plans = [];
  const mismatches = [];

  userInstances.forEach((row) => {
    const publicId = String(row?.public_id || '').trim();
    const workspaceId = String(row?.workspace_id || '').trim();
    const accountId = workspaceToAccount.get(workspaceId) || '';
    if (!publicId || !isUuid(accountId)) return;
    const refs = extractAccountAssetUsageRefs(row?.config || {}, publicId);
    refs.forEach((ref) => {
      if (ref.accountId !== accountId) {
        mismatches.push({
          publicId,
          configPath: ref.configPath,
          expectedAccountId: accountId,
          referencedAccountId: ref.accountId,
          assetId: ref.assetId,
        });
      }
    });
    plans.push({
      publicId,
      accountId,
      rows: refs
        .filter((ref) => ref.accountId === accountId)
        .map((ref) => ({
          account_id: ref.accountId,
          asset_id: ref.assetId,
          public_id: ref.publicId,
          config_path: ref.configPath,
        })),
    });
  });

  curatedInstances.forEach((row) => {
    const publicId = String(row?.public_id || '').trim();
    const accountId = String(row?.owner_account_id || '').trim();
    if (!publicId || !isUuid(accountId)) return;
    const refs = extractAccountAssetUsageRefs(row?.config || {}, publicId);
    refs.forEach((ref) => {
      if (ref.accountId !== accountId) {
        mismatches.push({
          publicId,
          configPath: ref.configPath,
          expectedAccountId: accountId,
          referencedAccountId: ref.accountId,
          assetId: ref.assetId,
        });
      }
    });
    plans.push({
      publicId,
      accountId,
      rows: refs
        .filter((ref) => ref.accountId === accountId)
        .map((ref) => ({
          account_id: ref.accountId,
          asset_id: ref.assetId,
          public_id: ref.publicId,
          config_path: ref.configPath,
        })),
    });
  });

  if (mismatches.length > 0) {
    const sample = mismatches.slice(0, 10);
    throw new Error(
      `[reindex-account-asset-usage] Cross-account references found (${mismatches.length}). Sample: ${JSON.stringify(sample)}`,
    );
  }

  const uniquePlans = new Map();
  plans.forEach((plan) => {
    uniquePlans.set(`${plan.accountId}|${plan.publicId}`, plan);
  });

  let deleted = 0;
  let inserted = 0;

  for (const plan of uniquePlans.values()) {
    if (!DRY_RUN) {
      await deleteUsage(ctx, plan.accountId, plan.publicId);
      await insertUsageRows(ctx, plan.rows);
    }
    deleted += 1;
    inserted += plan.rows.length;
  }

  console.log(
    `[reindex-account-asset-usage] target=${ctx.target} plans=${uniquePlans.size} rows=${inserted} dryRun=${DRY_RUN ? '1' : '0'}`,
  );
}

main().catch((err) => {
  const detail = err instanceof Error ? err.message : String(err);
  console.error(detail);
  process.exit(1);
});

