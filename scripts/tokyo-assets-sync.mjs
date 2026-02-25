#!/usr/bin/env node
/* eslint-disable no-console */
import { execSync, spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { toCanonicalAssetVersionPath } from '../tooling/ck-contracts/src/index.js';

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(scriptPath), '..');

const DEFAULT_BUCKET = 'tokyo-assets-dev';
const DEFAULT_LOCAL_BASE = 'http://localhost:4000';
const DEFAULT_REMOTE_BASE = 'https://tokyo.dev.clickeen.com';
const DEFAULT_PERSIST_TO = path.join(repoRoot, '.wrangler', 'state');
const DEFAULT_PAGE_SIZE = 500;

function printUsage() {
  console.log(`Usage: node scripts/tokyo-assets-sync.mjs [options]

Syncs missing canonical account asset blobs from remote Tokyo to local R2.
Reads canonical asset keys from local Supabase account_asset_variants.

Options:
  --local-base <url>      Local Tokyo base URL (default: ${DEFAULT_LOCAL_BASE})
  --remote-base <url>     Remote Tokyo base URL (default: ${DEFAULT_REMOTE_BASE})
  --bucket <name>         Local R2 bucket (default: ${DEFAULT_BUCKET})
  --persist-to <dir>      Wrangler local persist dir (default: ${DEFAULT_PERSIST_TO})
  --max <n>               Max missing assets to sync (default: unlimited)
  --help                  Show this message
`);
}

function parseArgs(argv) {
  const args = {
    localBase: process.env.TOKYO_LOCAL_BASE_URL || DEFAULT_LOCAL_BASE,
    remoteBase: process.env.CK_CLOUD_TOKYO_BASE_URL || process.env.TOKYO_REMOTE_BASE_URL || DEFAULT_REMOTE_BASE,
    bucket: process.env.TOKYO_R2_BUCKET || DEFAULT_BUCKET,
    persistTo: process.env.TOKYO_ASSETS_SYNC_PERSIST_TO || DEFAULT_PERSIST_TO,
    max: Number.POSITIVE_INFINITY,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = String(argv[i] || '').trim();
    if (!token) continue;
    if (token === '--help' || token === '-h') {
      printUsage();
      process.exit(0);
    }
    if (token === '--local-base') {
      const next = String(argv[i + 1] || '').trim();
      if (!next) throw new Error('--local-base requires a value');
      args.localBase = next;
      i += 1;
      continue;
    }
    if (token === '--remote-base') {
      const next = String(argv[i + 1] || '').trim();
      if (!next) throw new Error('--remote-base requires a value');
      args.remoteBase = next;
      i += 1;
      continue;
    }
    if (token === '--bucket') {
      const next = String(argv[i + 1] || '').trim();
      if (!next) throw new Error('--bucket requires a value');
      args.bucket = next;
      i += 1;
      continue;
    }
    if (token === '--persist-to') {
      const next = String(argv[i + 1] || '').trim();
      if (!next) throw new Error('--persist-to requires a value');
      args.persistTo = next;
      i += 1;
      continue;
    }
    if (token === '--max') {
      const next = Number.parseInt(String(argv[i + 1] || '').trim(), 10);
      if (!Number.isFinite(next) || next <= 0) throw new Error('--max must be a positive integer');
      args.max = next;
      i += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${token}`);
  }

  args.localBase = String(args.localBase || '').trim().replace(/\/+$/, '');
  args.remoteBase = String(args.remoteBase || '').trim().replace(/\/+$/, '');
  args.persistTo = String(args.persistTo || '').trim();
  args.bucket = String(args.bucket || '').trim();
  if (!args.localBase) throw new Error('Missing local Tokyo base URL');
  if (!args.remoteBase) throw new Error('Missing remote Tokyo base URL');
  if (!args.bucket) throw new Error('Missing bucket name');
  if (!args.persistTo) throw new Error('Missing persist dir');
  return args;
}

function hydrateSupabaseEnvFromStatus() {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) return;
  let output = '';
  try {
    output = execSync('supabase status -o env', { encoding: 'utf8' });
  } catch {
    return;
  }
  for (const line of output.split('\n')) {
    const match = line.match(/^([A-Z0-9_]+)=["']?(.*?)["']?$/);
    if (!match) continue;
    const key = match[1];
    const value = match[2];
    if (!process.env[key]) process.env[key] = value;
  }
}

function buildSupabaseClient() {
  hydrateSupabaseEnvFromStatus();
  const base = String(process.env.SUPABASE_URL || process.env.API_URL || '').trim().replace(/\/+$/, '');
  const serviceRole = String(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY || '').trim();
  if (!base) throw new Error('Missing SUPABASE_URL (or API_URL)');
  if (!serviceRole) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY (or SERVICE_ROLE_KEY)');
  return { base, serviceRole };
}

async function supabaseFetch(client, pathName, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set('apikey', client.serviceRole);
  headers.set('authorization', `Bearer ${client.serviceRole}`);
  if (!headers.has('content-type') && init.body != null) {
    headers.set('content-type', 'application/json');
  }
  const res = await fetch(`${client.base}${pathName}`, {
    ...init,
    headers,
  });
  const text = await res.text().catch(() => '');
  if (!res.ok) {
    throw new Error(`Supabase ${res.status} ${pathName}: ${text || '<empty>'}`);
  }
  return text ? JSON.parse(text) : null;
}

async function loadVariantKeys(client) {
  const keys = [];
  let offset = 0;
  for (;;) {
    const params = new URLSearchParams({
      select: 'r2_key',
      order: 'created_at.asc',
      limit: String(DEFAULT_PAGE_SIZE),
      offset: String(offset),
    });
    const rows = await supabaseFetch(client, `/rest/v1/account_asset_variants?${params.toString()}`, { method: 'GET' });
    const batch = Array.isArray(rows) ? rows : [];
    if (!batch.length) break;
    for (const row of batch) {
      const key = String(row?.r2_key || '').trim();
      if (key) keys.push(key);
    }
    if (batch.length < DEFAULT_PAGE_SIZE) break;
    offset += DEFAULT_PAGE_SIZE;
  }
  return Array.from(new Set(keys));
}

async function hasLocalAsset(localBase, canonicalPath) {
  const res = await fetch(`${localBase}${canonicalPath}`, { method: 'HEAD' });
  return res.status === 200;
}

async function fetchRemoteAsset(remoteBase, canonicalPath) {
  const res = await fetch(`${remoteBase}${canonicalPath}`, { method: 'GET' });
  if (!res.ok) {
    return { ok: false, status: res.status, body: null };
  }
  const bytes = new Uint8Array(await res.arrayBuffer());
  return { ok: true, status: res.status, body: bytes };
}

function putLocalR2Object({ bucket, persistTo, key, filePath }) {
  const args = [
    '-C',
    'tokyo-worker',
    'exec',
    'wrangler',
    'r2',
    'object',
    'put',
    `${bucket}/${key}`,
    '--local',
    '--persist-to',
    persistTo,
    '--file',
    filePath,
  ];
  const result = spawnSync('pnpm', args, {
    cwd: repoRoot,
    stdio: 'pipe',
    env: process.env,
    encoding: 'utf8',
  });
  if (result.status === 0) return;
  const details = `${result.stdout || ''}${result.stderr || ''}`.trim();
  throw new Error(details || `wrangler r2 object put failed (${result.status ?? 'unknown'})`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const client = buildSupabaseClient();
  const keys = await loadVariantKeys(client);
  const canonical = keys
    .map((key) => ({ key, path: toCanonicalAssetVersionPath(key) }))
    .filter((entry) => Boolean(entry.path));

  console.log(
    `[tokyo-assets-sync] scanning ${canonical.length} canonical asset key(s) local=${args.localBase} remote=${args.remoteBase}`,
  );

  let localPresent = 0;
  let localMissing = 0;
  let synced = 0;
  let remoteMissing = 0;
  let failed = 0;
  const failures = [];
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'ck-tokyo-assets-sync-'));
  try {
    for (const entry of canonical) {
      if (synced >= args.max) break;
      const pathName = entry.path;
      const key = entry.key;
      if (!pathName) continue;

      if (await hasLocalAsset(args.localBase, pathName)) {
        localPresent += 1;
        continue;
      }

      localMissing += 1;
      const remote = await fetchRemoteAsset(args.remoteBase, pathName);
      if (!remote.ok || !remote.body) {
        remoteMissing += 1;
        failures.push(`${remote.status} ${pathName}`);
        continue;
      }

      const filePath = path.join(tempDir, `asset-${synced + 1}.bin`);
      await writeFile(filePath, remote.body);
      try {
        putLocalR2Object({
          bucket: args.bucket,
          persistTo: args.persistTo,
          key,
          filePath,
        });
        synced += 1;
        console.log(`[tokyo-assets-sync] synced ${pathName}`);
      } catch (error) {
        failed += 1;
        const detail = error instanceof Error ? error.message : String(error);
        failures.push(`put ${pathName}: ${detail}`);
      }
    }
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }

  console.log('[tokyo-assets-sync] done');
  console.log(`  total=${canonical.length}`);
  console.log(`  local_present=${localPresent}`);
  console.log(`  local_missing=${localMissing}`);
  console.log(`  synced=${synced}`);
  console.log(`  remote_missing=${remoteMissing}`);
  console.log(`  failed=${failed}`);
  if (failures.length) {
    failures.slice(0, 20).forEach((item) => console.log(`  issue: ${item}`));
    if (failures.length > 20) {
      console.log(`  issue: ... (${failures.length - 20} more)`);
    }
  }

  if (failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  const detail = error instanceof Error ? error.message : String(error);
  console.error('[tokyo-assets-sync] failed:', detail);
  process.exit(1);
});

