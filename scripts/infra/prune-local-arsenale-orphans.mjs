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

async function loadExpectedKeys(ctx) {
  const params = new URLSearchParams({
    select: 'r2_key',
    r2_key: 'like.arsenale/o/%',
    limit: String(LIMIT),
  });
  const res = await supabaseFetch(ctx, `/account_asset_variants?${params.toString()}`, { method: 'GET' });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`[prune-arsenale-orphans] Failed to load variants (${res.status}): ${detail}`);
  }
  const rows = await res.json().catch(() => []);
  const expected = new Set();
  if (Array.isArray(rows)) {
    rows.forEach((row) => {
      const key = String(row?.r2_key || '').trim().replace(/^\/+/, '');
      if (key.startsWith('arsenale/o/')) expected.add(key);
    });
  }
  return expected;
}

function listLocalFiles(baseDir) {
  if (!fs.existsSync(baseDir)) return [];
  const out = [];
  const stack = [baseDir];
  while (stack.length > 0) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });
    entries.forEach((entry) => {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.isFile()) out.push(full);
    });
  }
  return out;
}

function removeEmptyDirs(dirPath) {
  if (!fs.existsSync(dirPath)) return;
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  entries.forEach((entry) => {
    if (!entry.isDirectory()) return;
    removeEmptyDirs(path.join(dirPath, entry.name));
  });
  const after = fs.readdirSync(dirPath);
  if (after.length === 0) {
    fs.rmdirSync(dirPath);
  }
}

async function main() {
  const ctx = readLocalSupabaseEnv();
  if (!ctx.apiUrl || !ctx.serviceRoleKey) {
    throw new Error('[prune-arsenale-orphans] Missing local Supabase credentials');
  }

  const expected = await loadExpectedKeys(ctx);
  const baseDir = path.join(ROOT, 'tokyo', 'arsenale', 'o');
  const localFiles = listLocalFiles(baseDir);

  let deleted = 0;
  let kept = 0;

  localFiles.forEach((filePath) => {
    const rel = path.relative(path.join(ROOT, 'tokyo'), filePath).replace(/\\/g, '/');
    if (expected.has(rel)) {
      kept += 1;
      return;
    }
    if (!DRY_RUN) fs.unlinkSync(filePath);
    deleted += 1;
  });

  if (!DRY_RUN && fs.existsSync(baseDir)) {
    removeEmptyDirs(baseDir);
    if (fs.existsSync(baseDir) && fs.readdirSync(baseDir).length === 0) {
      fs.rmdirSync(baseDir);
    }
  }

  console.log(
    `[prune-arsenale-orphans] done: expected=${expected.size}, localFiles=${localFiles.length}, kept=${kept}, deleted=${deleted}, dryRun=${DRY_RUN ? '1' : '0'}`,
  );
}

main().catch((err) => {
  const detail = err instanceof Error ? err.message : String(err);
  console.error(detail);
  process.exit(1);
});

