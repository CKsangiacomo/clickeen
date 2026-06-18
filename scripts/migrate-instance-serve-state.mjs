#!/usr/bin/env node
/* eslint-disable no-console */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(scriptPath), '..');
const envPath = path.join(repoRoot, '.env.local');

function loadLocalEnv() {
  if (!fs.existsSync(envPath)) return;
  const text = fs.readFileSync(envPath, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}.`);
  return value;
}

function runR2(args, options = {}) {
  return execFileSync('pnpm', ['--silent', 'cf:r2:' + args[0], ...args.slice(1)], {
    cwd: repoRoot,
    encoding: 'utf8',
    maxBuffer: options.maxBuffer ?? 64 * 1024 * 1024,
    stdio: options.stdio ?? 'pipe',
  });
}

function parseR2List(output) {
  return output
    .split(/\r?\n/)
    .map((line) => line.split('\t')[0]?.trim() ?? '')
    .filter(Boolean);
}

function readR2Json(key, options = {}) {
  try {
    return JSON.parse(runR2(['get', key]));
  } catch (error) {
    if (options.optional && error.status != null) return null;
    throw error;
  }
}

function putR2Json(key, value) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ck-instance-serve-state-'));
  const file = path.join(dir, 'serve-state.json');
  try {
    fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
    runR2(['put', key, file, '--content-type', 'application/json; charset=utf-8'], { stdio: 'pipe' });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

async function readRegistryStatuses() {
  const supabaseUrl = requireEnv('SUPABASE_URL').replace(/\/+$/, '');
  const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
  const response = await fetch(
    `${supabaseUrl}/rest/v1/instances?select=id,account_id,publish_status`,
    {
      headers: {
        apikey: serviceRoleKey,
        authorization: `Bearer ${serviceRoleKey}`,
      },
    },
  );
  const payload = await response.json().catch(() => null);
  if (!response.ok || !Array.isArray(payload)) {
    throw new Error(`Supabase instances read failed: ${response.status}`);
  }
  const statuses = new Map();
  for (const row of payload) {
    const accountId = typeof row.account_id === 'string' ? row.account_id.trim().toUpperCase() : '';
    const instanceId = typeof row.id === 'string' ? row.id.trim().toUpperCase() : '';
    const publishStatus = row.publish_status === 'published' || row.publish_status === 'unpublished'
      ? row.publish_status
      : '';
    if (!accountId || !instanceId || !publishStatus) {
      throw new Error('Supabase instances read returned malformed row.');
    }
    statuses.set(`${accountId}/${instanceId}`, publishStatus);
  }
  return statuses;
}

function serveStateFor(args) {
  const now = new Date().toISOString();
  return {
    v: 1,
    accountId: args.accountId,
    instanceId: args.instanceId,
    status: args.status,
    ...(args.status === 'published' ? { publishedAt: now } : {}),
    updatedAt: now,
  };
}

function parseInstanceConfigKey(key) {
  const parts = key.split('/');
  if (
    parts.length === 5 &&
    parts[0] === 'accounts' &&
    parts[2] === 'instances' &&
    parts[4] === 'instance.config.json'
  ) {
    return { accountId: parts[1], instanceId: parts[3] };
  }
  return null;
}

async function main() {
  loadLocalEnv();
  const apply = process.argv.includes('--apply');
  const configKeys = parseR2List(runR2(['ls', 'accounts/', '--limit', '100000']))
    .filter((key) => key.endsWith('/instance.config.json'));
  const registryStatuses = await readRegistryStatuses();
  const writes = [];
  const blockers = [];

  for (const key of configKeys) {
    const coordinate = parseInstanceConfigKey(key);
    if (!coordinate) {
      blockers.push(`${key}: invalid instance config key`);
      continue;
    }
    const config = readR2Json(key);
    if (
      !config ||
      config.accountId !== coordinate.accountId ||
      config.id !== coordinate.instanceId ||
      typeof config.widgetCode !== 'string' ||
      !config.widgetCode
    ) {
      blockers.push(`${key}: malformed instance config`);
      continue;
    }
    const registryStatus = registryStatuses.get(`${coordinate.accountId}/${coordinate.instanceId}`);
    if (!registryStatus) {
      blockers.push(`${key}: missing Supabase publish status`);
      continue;
    }
    const serveStateKey = `accounts/${coordinate.accountId}/instances/${coordinate.instanceId}/serve-state.json`;
    const existing = readR2Json(serveStateKey, { optional: true });
    if (existing) {
      if (
        existing.v !== 1 ||
        existing.accountId !== coordinate.accountId ||
        existing.instanceId !== coordinate.instanceId ||
        existing.status !== registryStatus
      ) {
        blockers.push(`${serveStateKey}: existing serve-state does not match Supabase publish status`);
      }
      continue;
    }
    writes.push({
      key: serveStateKey,
      value: serveStateFor({
        accountId: coordinate.accountId,
        instanceId: coordinate.instanceId,
        status: registryStatus,
      }),
    });
  }

  if (blockers.length) {
    console.error(`[instance-serve-state] blocked (${blockers.length})`);
    for (const blocker of blockers) console.error(`- ${blocker}`);
    process.exit(1);
  }
  console.log(`[instance-serve-state] configs=${configKeys.length} writes=${writes.length} apply=${apply ? 'yes' : 'no'}`);
  if (!apply) return;
  for (const write of writes) {
    putR2Json(write.key, write.value);
    console.log(`[instance-serve-state] wrote ${write.key}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
