#!/usr/bin/env node

import { parseCanonicalAssetRef, toCanonicalAssetVersionPath } from '../tooling/ck-contracts/src/index.js';

const DEFAULT_PAGE_SIZE = 200;
const TABLES = ['widget_instances', 'curated_widget_instances'];

function usage() {
  console.log(`Usage: node scripts/migrate-asset-ref-hard-cut.mjs [options]

Options:
  --apply                 Persist changes (default: dry-run)
  --page-size <n>         Supabase batch size (default: ${DEFAULT_PAGE_SIZE})
  --skip-configs          Skip widget config migration (defaults to on)
  --help                  Show this message

Required env:
  SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY
`);
}

function parseArgs(argv) {
  const out = {
    apply: false,
    pageSize: DEFAULT_PAGE_SIZE,
    skipConfigs: false,
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
    if (arg === '--skip-configs') {
      out.skipConfigs = true;
      continue;
    }
    if (arg === '--page-size') {
      const value = Number.parseInt(String(argv[i + 1] || '').trim(), 10);
      if (!Number.isFinite(value) || value < 1 || value > 1000) {
        throw new Error('--page-size must be an integer between 1 and 1000');
      }
      out.pageSize = value;
      i += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }
  return out;
}

function requiredEnv(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

async function supabaseFetch(pathnameWithQuery, init = {}) {
  const base = requiredEnv('SUPABASE_URL').replace(/\/+$/, '');
  const key = requiredEnv('SUPABASE_SERVICE_ROLE_KEY');
  const headers = new Headers(init.headers || {});
  headers.set('apikey', key);
  headers.set('authorization', `Bearer ${key}`);
  if (!headers.has('content-type') && init.body) headers.set('content-type', 'application/json');
  const response = await fetch(`${base}${pathnameWithQuery}`, { ...init, headers });
  const text = await response.text().catch(() => '');
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { response, text, json };
}

function resolveAssetRef(raw) {
  const value = String(raw || '').trim();
  if (!value) return '';
  const parsedDirect = parseCanonicalAssetRef(value);
  if (parsedDirect?.kind === 'version') return parsedDirect.versionKey;
  const canonicalPath = toCanonicalAssetVersionPath(value);
  if (!canonicalPath) return '';
  const parsedPath = parseCanonicalAssetRef(canonicalPath);
  return parsedPath?.kind === 'version' ? parsedPath.versionKey : '';
}

function rewriteAssetRefs(node, stats) {
  if (!node || typeof node !== 'object') return node;
  if (Array.isArray(node)) {
    return node.map((entry) => rewriteAssetRefs(entry, stats));
  }

  const record = { ...node };

  if (typeof record.versionId === 'string') {
    const nextRef = resolveAssetRef(record.versionId);
    if (nextRef) {
      delete record.versionId;
      record.ref = nextRef;
      stats.versionIdToRef += 1;
    }
  }

  if (typeof record.ref === 'string') {
    const normalizedRef = resolveAssetRef(record.ref);
    if (normalizedRef && normalizedRef !== record.ref) {
      record.ref = normalizedRef;
      stats.normalizedRef += 1;
    }
  }

  for (const [key, value] of Object.entries(record)) {
    if ((key === 'asset' || key === 'poster') && typeof value === 'string') {
      const ref = resolveAssetRef(value);
      if (ref) {
        record[key] = { ref };
        stats.stringToAssetRefObject += 1;
        continue;
      }
    }
    record[key] = rewriteAssetRefs(value, stats);
  }

  return record;
}

function migrateConfig(config) {
  const stats = {
    versionIdToRef: 0,
    normalizedRef: 0,
    stringToAssetRefObject: 0,
  };
  const rewritten = rewriteAssetRefs(config, stats);
  const changed = stats.versionIdToRef + stats.normalizedRef + stats.stringToAssetRefObject > 0;
  return { changed, config: rewritten, stats };
}

async function migrateTable(table, apply, pageSize) {
  let offset = 0;
  const out = {
    table,
    scanned: 0,
    changed: 0,
    updated: 0,
    versionIdToRef: 0,
    normalizedRef: 0,
    stringToAssetRefObject: 0,
  };

  while (true) {
    const to = offset + pageSize - 1;
    const params = new URLSearchParams({
      select: 'id,public_id,config',
      order: 'id.asc',
    });
    const { response, json, text } = await supabaseFetch(`/rest/v1/${table}?${params.toString()}`, {
      method: 'GET',
      headers: { Range: `${offset}-${to}` },
    });
    if (!response.ok) {
      throw new Error(`[${table}] read failed (${response.status}) ${text.slice(0, 300)}`);
    }

    const rows = Array.isArray(json) ? json : [];
    if (!rows.length) break;
    out.scanned += rows.length;

    for (const row of rows) {
      const id = String(row?.id || '').trim();
      if (!id) continue;
      const migration = migrateConfig(row?.config ?? {});
      if (!migration.changed) continue;
      out.changed += 1;
      out.versionIdToRef += migration.stats.versionIdToRef;
      out.normalizedRef += migration.stats.normalizedRef;
      out.stringToAssetRefObject += migration.stats.stringToAssetRefObject;
      if (!apply) continue;

      const q = new URLSearchParams({ id: `eq.${id}` });
      const patch = await supabaseFetch(`/rest/v1/${table}?${q.toString()}`, {
        method: 'PATCH',
        headers: {
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({ config: migration.config }),
      });
      if (!patch.response.ok) {
        throw new Error(`[${table}] patch failed id=${id} (${patch.response.status}) ${patch.text.slice(0, 300)}`);
      }
      out.updated += 1;
    }

    if (rows.length < pageSize) break;
    offset += pageSize;
  }

  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    usage();
    return;
  }

  const mode = args.apply ? 'apply' : 'dry-run';
  console.log(`[migrate-asset-ref-hard-cut] mode=${mode}`);

  if (!args.skipConfigs) {
    for (const table of TABLES) {
      const summary = await migrateTable(table, args.apply, args.pageSize);
      console.log(
        `[migrate-asset-ref-hard-cut] ${table} scanned=${summary.scanned} changed=${summary.changed} updated=${summary.updated} versionIdToRef=${summary.versionIdToRef} normalizedRef=${summary.normalizedRef} stringToAssetRefObject=${summary.stringToAssetRefObject}`,
      );
    }
  } else {
    console.log('[migrate-asset-ref-hard-cut] skipped widget config migration');
  }

  console.log('[migrate-asset-ref-hard-cut] manifest migration stage retired (runtime is strict manifest-only)');

  console.log('[migrate-asset-ref-hard-cut] done');
}

main().catch((error) => {
  const detail = error instanceof Error ? error.message : String(error);
  console.error('[migrate-asset-ref-hard-cut] failed:', detail);
  process.exit(1);
});
