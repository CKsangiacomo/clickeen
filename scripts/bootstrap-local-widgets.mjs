#!/usr/bin/env node
/**
 * Bootstrap local widget instances into the local Supabase DB.
 *
 * Creates/updates:
 * - public.widgets rows for each `tokyo/widgets/<widgetType>/spec.json`
 * - a `wgt_{widgetType}_main` instance in the ck-dev workspace by default
 *
 * Usage:
 *   node scripts/bootstrap-local-widgets.mjs
 *   pnpm bootstrap:local-widgets
 *
 * Options:
 *   --workspace <uuid>   Workspace id (default: ck-dev)
 *   --status <status>    published|unpublished (default: unpublished)
 *   --dry-run            Print actions without writing
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const widgetsDir = path.join(repoRoot, 'tokyo', 'widgets');

const CK_DEV_WORKSPACE_ID = '00000000-0000-0000-0000-000000000001';

function parseArgs(argv) {
  const out = { workspaceId: CK_DEV_WORKSPACE_ID, status: 'unpublished', dryRun: false };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dry-run') {
      out.dryRun = true;
      continue;
    }
    if (arg === '--workspace') {
      out.workspaceId = String(argv[i + 1] || '').trim();
      i += 1;
      continue;
    }
    if (arg === '--status') {
      out.status = String(argv[i + 1] || '').trim();
      i += 1;
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      out.help = true;
      continue;
    }
    throw new Error(`Unknown arg: ${arg}`);
  }
  return out;
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value || '').trim());
}

function requireOneOf(value, allowed, label) {
  const v = String(value || '').trim();
  if (!allowed.includes(v)) throw new Error(`Invalid ${label}: ${v} (allowed: ${allowed.join(', ')})`);
  return v;
}

function readSupabaseEnvFromCli() {
  const res = spawnSync('supabase', ['status', '--output', 'env'], { cwd: repoRoot, encoding: 'utf8' });
  if (res.status !== 0) return {};

  const env = {};
  String(res.stdout || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .forEach((line) => {
      const idx = line.indexOf('=');
      if (idx === -1) return;
      const key = line.slice(0, idx).trim();
      const val = line.slice(idx + 1).trim();
      if (key) env[key] = val;
    });
  return env;
}

function resolveSupabaseConfig() {
  const cliEnv = readSupabaseEnvFromCli();

  const supabaseUrl =
    (process.env.SUPABASE_URL || '').trim() ||
    (process.env.API_URL || '').trim() ||
    String(cliEnv.API_URL || '').trim();
  const serviceRoleKey =
    (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim() ||
    (process.env.SECRET_KEY || '').trim() ||
    String(cliEnv.SECRET_KEY || '').trim();

  if (!supabaseUrl) {
    throw new Error(
      'Missing SUPABASE_URL. Start Supabase (`supabase start`) and/or set SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY.',
    );
  }
  if (!serviceRoleKey) {
    throw new Error(
      'Missing SUPABASE_SERVICE_ROLE_KEY. Start Supabase (`supabase start`) and/or set SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY.',
    );
  }

  return { supabaseUrl: supabaseUrl.replace(/\/+$/, ''), serviceRoleKey };
}

async function supabaseFetch(cfg, pathnameWithQuery, init = {}) {
  const headers = new Headers(init.headers || {});
  headers.set('apikey', cfg.serviceRoleKey);
  headers.set('authorization', `Bearer ${cfg.serviceRoleKey}`);
  if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
  headers.set('accept', headers.get('accept') || 'application/json');
  return fetch(`${cfg.supabaseUrl}${pathnameWithQuery}`, { ...init, headers });
}

async function upsertWidgetRow(cfg, widgetType, widgetName, dryRun) {
  const payload = [{ type: widgetType, name: widgetName }];
  if (dryRun) {
    console.log(`[dry-run] upsert widgets: ${widgetType} (${widgetName})`);
    return { id: null };
  }

  const res = await supabaseFetch(cfg, `/rest/v1/widgets?on_conflict=type`, {
    method: 'POST',
    headers: { prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`widgets upsert failed (HTTP ${res.status}): ${text}`);
  }
  const rows = (await res.json().catch(() => null)) || null;
  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row?.id) throw new Error(`widgets upsert returned no id for type "${widgetType}"`);
  return row;
}

async function upsertMainInstance(cfg, args, widgetType, widgetId, config, dryRun) {
  const publicId = `wgt_${widgetType}_main`;
  const payload = [
    {
      public_id: publicId,
      workspace_id: args.workspaceId,
      widget_id: widgetId,
      status: args.status,
      config,
    },
  ];

  if (dryRun) {
    console.log(`[dry-run] upsert widget_instances: ${publicId} workspace=${args.workspaceId} status=${args.status}`);
    return;
  }

  const res = await supabaseFetch(cfg, `/rest/v1/widget_instances?on_conflict=public_id`, {
    method: 'POST',
    headers: { prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`widget_instances upsert failed (HTTP ${res.status}) for ${publicId}: ${text}`);
  }
}

function listWidgetSpecs() {
  if (!fs.existsSync(widgetsDir)) throw new Error(`Missing widgets dir: ${widgetsDir}`);

  return fs
    .readdirSync(widgetsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('.') && d.name !== 'shared' && d.name !== '_fragments')
    .map((d) => d.name)
    .map((name) => ({ name, specPath: path.join(widgetsDir, name, 'spec.json') }))
    .filter((entry) => fs.existsSync(entry.specPath))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function readWidgetSpec(specPath) {
  const raw = fs.readFileSync(specPath, 'utf8');
  const json = JSON.parse(raw);
  return json && typeof json === 'object' ? json : null;
}

function titleCase(slug) {
  const s = String(slug || '').trim();
  if (!s) return '';
  return s
    .split(/[_-]+/g)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ');
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    console.log('node scripts/bootstrap-local-widgets.mjs [--workspace <uuid>] [--status published|unpublished] [--dry-run]');
    process.exit(0);
  }

  if (!isUuid(args.workspaceId)) throw new Error(`Invalid --workspace UUID: ${args.workspaceId}`);
  args.status = requireOneOf(args.status, ['published', 'unpublished'], '--status');

  const cfg = resolveSupabaseConfig();
  const specs = listWidgetSpecs();
  if (specs.length === 0) throw new Error(`No widgets found under ${widgetsDir}`);

  console.log(`[bootstrap] widgets: ${specs.length}`);
  console.log(`[bootstrap] workspaceId: ${args.workspaceId}`);
  console.log(`[bootstrap] status: ${args.status}`);
  console.log(`[bootstrap] dryRun: ${args.dryRun ? 'true' : 'false'}`);

  for (const entry of specs) {
    const spec = readWidgetSpec(entry.specPath);
    if (!spec) throw new Error(`Invalid spec JSON: ${entry.specPath}`);
    const widgetType = String(spec.widgetname || entry.name || '').trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(widgetType)) {
      throw new Error(`Invalid widgetname "${widgetType}" in ${entry.specPath}`);
    }

    const defaults = spec.defaults;
    if (!defaults || typeof defaults !== 'object' || Array.isArray(defaults)) {
      throw new Error(`Missing defaults object in ${entry.specPath}`);
    }

    const widgetName = String(spec.displayName || '').trim() || titleCase(widgetType) || widgetType;
    const widgetRow = await upsertWidgetRow(cfg, widgetType, widgetName, args.dryRun);
    const widgetId = widgetRow.id;
    if (!args.dryRun && !widgetId) throw new Error(`Failed to resolve widget id for ${widgetType}`);

    await upsertMainInstance(cfg, args, widgetType, widgetId, defaults, args.dryRun);
    console.log(`[bootstrap] OK ${widgetType}`);
  }

  console.log('[bootstrap] done');
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
