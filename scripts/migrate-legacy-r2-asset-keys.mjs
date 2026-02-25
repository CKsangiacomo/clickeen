#!/usr/bin/env node

import { execFile, execSync } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

const execFileAsync = promisify(execFile);

const DEFAULT_BUCKET = 'tokyo-assets-dev';
const DEFAULT_PERSIST_TO = '.wrangler/state/v3';
const DEFAULT_PAGE_SIZE = 200;

function printUsage() {
  console.log(`Usage: node scripts/migrate-legacy-r2-asset-keys.mjs [options]

Options:
  --apply                 Persist changes (default: dry-run)
  --delete-legacy         Delete legacy R2 object after copy (only with --apply)
  --bucket <name>         R2 bucket name (default: ${DEFAULT_BUCKET})
  --persist-to <dir>      Wrangler local persistence dir (default: ${DEFAULT_PERSIST_TO})
  --asset-id <uuid>       Restrict to one asset_id
  --page-size <n>         Batch size for reads (default: ${DEFAULT_PAGE_SIZE})
  --help                  Show this message
`);
}

function parseArgs(argv) {
  const out = {
    apply: false,
    deleteLegacy: false,
    bucket: DEFAULT_BUCKET,
    persistTo: DEFAULT_PERSIST_TO,
    assetId: '',
    pageSize: DEFAULT_PAGE_SIZE,
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = String(argv[i] || '').trim();
    if (!arg) continue;
    if (arg === '--help' || arg === '-h') {
      out.help = true;
      continue;
    }
    if (arg === '--apply') {
      out.apply = true;
      continue;
    }
    if (arg === '--delete-legacy') {
      out.deleteLegacy = true;
      continue;
    }
    if (arg === '--bucket') {
      const next = String(argv[i + 1] || '').trim();
      if (!next) throw new Error('--bucket requires a value');
      out.bucket = next;
      i += 1;
      continue;
    }
    if (arg === '--persist-to') {
      const next = String(argv[i + 1] || '').trim();
      if (!next) throw new Error('--persist-to requires a value');
      out.persistTo = next;
      i += 1;
      continue;
    }
    if (arg === '--asset-id') {
      const next = String(argv[i + 1] || '').trim();
      if (!next) throw new Error('--asset-id requires a value');
      out.assetId = next.toLowerCase();
      i += 1;
      continue;
    }
    if (arg === '--page-size') {
      const next = Number.parseInt(String(argv[i + 1] || '').trim(), 10);
      if (!Number.isFinite(next) || next <= 0 || next > 1000) {
        throw new Error('--page-size must be an integer between 1 and 1000');
      }
      out.pageSize = next;
      i += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!out.apply && out.deleteLegacy) {
    throw new Error('--delete-legacy requires --apply');
  }

  return out;
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

async function loadLegacyVariantRows(client, args) {
  const rows = [];
  let offset = 0;
  for (;;) {
    const params = new URLSearchParams({
      select: 'account_id,asset_id,variant,filename,r2_key',
      r2_key: 'like.arsenale/o/%',
      order: 'asset_id.asc,variant.asc',
      limit: String(args.pageSize),
      offset: String(offset),
    });
    if (args.assetId) params.set('asset_id', `eq.${args.assetId}`);
    const page = await supabaseFetch(client, `/rest/v1/account_asset_variants?${params.toString()}`, { method: 'GET' });
    const batch = Array.isArray(page) ? page : [];
    if (!batch.length) break;
    rows.push(...batch);
    if (batch.length < args.pageSize || args.assetId) break;
    offset += args.pageSize;
  }
  return rows;
}

function normalizeVariant(raw) {
  const value = String(raw || '').trim().toLowerCase();
  return value || 'original';
}

function normalizeFilename(raw, fallbackKey) {
  const explicit = String(raw || '').trim();
  if (explicit) return explicit;
  const tail = String(fallbackKey || '').trim().split('/').pop() || '';
  return tail || 'asset.bin';
}

function buildCanonicalR2Key(row) {
  const accountId = String(row.account_id || '').trim().toLowerCase();
  const assetId = String(row.asset_id || '').trim().toLowerCase();
  const variant = normalizeVariant(row.variant);
  const filename = normalizeFilename(row.filename, row.r2_key);
  const variantSegment = variant === 'original' ? '' : `${variant}/`;
  return `assets/versions/${accountId}/${assetId}/${variantSegment}${filename}`;
}

async function runWranglerR2Object(args) {
  const cliArgs = ['--filter', '@clickeen/tokyo-worker', 'exec', 'wrangler', 'r2', 'object', ...args];
  const { stdout, stderr } = await execFileAsync('pnpm', cliArgs, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
  return `${stdout || ''}${stderr || ''}`.trim();
}

async function copyLocalR2Object({ bucket, persistTo, fromKey, toKey }) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'ck-r2-migrate-'));
  const tempFile = path.join(tempDir, 'object.bin');
  try {
    await runWranglerR2Object(['get', `${bucket}/${fromKey}`, '--local', '--persist-to', persistTo, '--file', tempFile]);
    await runWranglerR2Object(['put', `${bucket}/${toKey}`, '--local', '--persist-to', persistTo, '--file', tempFile]);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function deleteLocalR2Object({ bucket, persistTo, key }) {
  await runWranglerR2Object(['delete', `${bucket}/${key}`, '--local', '--persist-to', persistTo]);
}

async function patchVariantR2Key(client, row, nextKey) {
  const params = new URLSearchParams({
    account_id: `eq.${row.account_id}`,
    asset_id: `eq.${row.asset_id}`,
    variant: `eq.${row.variant}`,
  });
  await supabaseFetch(client, `/rest/v1/account_asset_variants?${params.toString()}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ r2_key: nextKey }),
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printUsage();
    return;
  }

  const client = buildSupabaseClient();
  const rows = await loadLegacyVariantRows(client, args);

  console.log(
    `[migrate-legacy-r2-asset-keys] mode=${args.apply ? 'apply' : 'dry-run'} rows=${rows.length} bucket=${args.bucket}`,
  );

  let copied = 0;
  let patched = 0;
  let deleted = 0;
  const failures = [];

  for (const row of rows) {
    const fromKey = String(row.r2_key || '').trim();
    const nextKey = buildCanonicalR2Key(row);
    const identity = `${row.asset_id}:${row.variant}`;

    if (!fromKey || !fromKey.startsWith('arsenale/o/')) continue;

    if (!args.apply) {
      console.log(`[migrate-legacy-r2-asset-keys] would-migrate ${identity} ${fromKey} -> ${nextKey}`);
      continue;
    }

    try {
      await copyLocalR2Object({
        bucket: args.bucket,
        persistTo: args.persistTo,
        fromKey,
        toKey: nextKey,
      });
      copied += 1;
      await patchVariantR2Key(client, row, nextKey);
      patched += 1;
      if (args.deleteLegacy) {
        await deleteLocalR2Object({
          bucket: args.bucket,
          persistTo: args.persistTo,
          key: fromKey,
        });
        deleted += 1;
      }
      console.log(`[migrate-legacy-r2-asset-keys] migrated ${identity} -> ${nextKey}`);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      failures.push(`${identity}: ${detail}`);
      console.error(`[migrate-legacy-r2-asset-keys] failed ${identity}: ${detail}`);
    }
  }

  console.log('[migrate-legacy-r2-asset-keys] done');
  console.log(`  rows=${rows.length}`);
  console.log(`  copied=${copied}`);
  console.log(`  patched=${patched}`);
  console.log(`  deleted_legacy=${deleted}`);
  console.log(`  failures=${failures.length}`);
  if (failures.length) {
    failures.slice(0, 20).forEach((entry) => console.log(`  failure: ${entry}`));
    if (failures.length > 20) {
      console.log(`  failure: ... (${failures.length - 20} more)`);
    }
    process.exitCode = 1;
  }
}

main().catch((error) => {
  const detail = error instanceof Error ? error.message : String(error);
  console.error('[migrate-legacy-r2-asset-keys] failed:', detail);
  process.exitCode = 1;
});
