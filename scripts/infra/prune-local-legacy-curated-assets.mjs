#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = process.cwd();
const LEGACY_DIRS = [
  path.join(ROOT, 'tokyo', 'curated-assets'),
  path.join(ROOT, 'tokyo', 'workspace-assets'),
];
const DRY_RUN = String(process.env.DRY_RUN || '').trim() === '1';

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

function hasLegacyPath(config) {
  const text = JSON.stringify(config ?? {});
  return text.includes('/curated-assets/') || text.includes('/workspace-assets/') || text.includes('/assets/accounts/');
}

async function countLegacyRefs(ctx) {
  const curatedRes = await supabaseFetch(ctx, '/rest/v1/curated_widget_instances?select=config&limit=10000', {
    method: 'GET',
  });
  const workspaceRes = await supabaseFetch(ctx, '/rest/v1/widget_instances?select=config&limit=10000', {
    method: 'GET',
  });
  if (!curatedRes.ok || !workspaceRes.ok) {
    const c = await curatedRes.text().catch(() => '');
    const w = await workspaceRes.text().catch(() => '');
    throw new Error(`[prune-legacy-curated] Failed to audit legacy refs. curated=${c} workspace=${w}`);
  }
  const curatedRows = await curatedRes.json().catch(() => []);
  const workspaceRows = await workspaceRes.json().catch(() => []);
  const curatedCount = Array.isArray(curatedRows) ? curatedRows.filter((row) => hasLegacyPath(row?.config)).length : 0;
  const workspaceCount = Array.isArray(workspaceRows)
    ? workspaceRows.filter((row) => hasLegacyPath(row?.config)).length
    : 0;
  return curatedCount + workspaceCount;
}

function countFilesRecursive(dirPath) {
  if (!fs.existsSync(dirPath)) return 0;
  let count = 0;
  const stack = [dirPath];
  while (stack.length) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });
    entries.forEach((entry) => {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.isFile()) count += 1;
    });
  }
  return count;
}

async function main() {
  const ctx = readLocalSupabaseEnv();
  if (!ctx.apiUrl || !ctx.serviceRoleKey) {
    throw new Error('[prune-legacy-assets] Could not resolve local Supabase API_URL/SERVICE_ROLE_KEY');
  }

  const refs = await countLegacyRefs(ctx);
  if (refs > 0) {
    throw new Error(`[prune-legacy-assets] Aborting: found ${refs} legacy asset references in instance configs.`);
  }

  const fileCounts = LEGACY_DIRS.map((dir) => ({ dir, files: countFilesRecursive(dir) }));
  const totalFiles = fileCounts.reduce((acc, item) => acc + item.files, 0);
  if (!totalFiles) {
    console.log('[prune-legacy-assets] Nothing to prune (legacy directories already empty).');
    return;
  }

  if (DRY_RUN) {
    const details = fileCounts
      .map((item) => `${path.relative(ROOT, item.dir)}=${item.files}`)
      .join(' ');
    console.log(`[prune-legacy-assets] DRY_RUN=1 refs=0 filesToDelete=${totalFiles} ${details}`);
    return;
  }

  fileCounts.forEach((item) => {
    if (item.files > 0) {
      fs.rmSync(item.dir, { recursive: true, force: true });
    }
  });
  const details = fileCounts
    .map((item) => `${path.relative(ROOT, item.dir)}=${item.files}`)
    .join(' ');
  console.log(`[prune-legacy-assets] Deleted legacy directories (${details}).`);
}

main().catch((err) => {
  const detail = err instanceof Error ? err.message : String(err);
  console.error(detail);
  process.exit(1);
});
