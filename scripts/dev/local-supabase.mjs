#!/usr/bin/env node

import { execSync } from 'node:child_process';

const SUPABASE_URL_KEYS = ['SUPABASE_URL', 'API_URL'];
const SUPABASE_SERVICE_ROLE_KEYS = ['SUPABASE_SERVICE_ROLE_KEY', 'SERVICE_ROLE_KEY'];

function isRemoteSupabaseModeEnabled() {
  const raw = String(process.env.DEV_UP_USE_REMOTE_SUPABASE || '').trim().toLowerCase();
  return raw === '1' || raw === 'true';
}

function normalizeSupabaseBaseUrl(raw) {
  const value = String(raw || '').trim().replace(/\/+$/, '');
  if (!value) return '';
  if (
    !isRemoteSupabaseModeEnabled() &&
    (value.startsWith('https://127.0.0.1:') || value.startsWith('https://localhost:'))
  ) {
    return `http://${value.slice('https://'.length)}`;
  }
  return value;
}

function parseEnvOutput(output) {
  const env = {};
  for (const line of String(output || '').split('\n')) {
    const match = line.match(/^([A-Z0-9_]+)=["']?(.*?)["']?$/);
    if (!match) continue;
    const [, key, value] = match;
    env[key] = value;
  }
  return env;
}

export function readFirstEnv(keys, source = process.env) {
  for (const key of keys) {
    const value = String(source[key] || '').trim();
    if (value) return value;
  }
  return '';
}

export function readLocalSupabaseStatusEnv() {
  let output = '';
  try {
    output = execSync('supabase status -o env', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    return null;
  }
  const env = parseEnvOutput(output);
  const base = normalizeSupabaseBaseUrl(readFirstEnv(SUPABASE_URL_KEYS, env));
  const serviceRole = readFirstEnv(SUPABASE_SERVICE_ROLE_KEYS, env);
  if (!base || !serviceRole) return null;
  return { base, serviceRole, env };
}

export function createSupabaseClient(options = {}) {
  const { preferLocal = true } = options;

  if (preferLocal && !isRemoteSupabaseModeEnabled()) {
    const local = readLocalSupabaseStatusEnv();
    if (local) return { base: local.base, serviceRole: local.serviceRole };
  }

  const base = normalizeSupabaseBaseUrl(readFirstEnv(SUPABASE_URL_KEYS));
  const serviceRole = readFirstEnv(SUPABASE_SERVICE_ROLE_KEYS);
  if (base && serviceRole) {
    return { base, serviceRole };
  }

  const local = readLocalSupabaseStatusEnv();
  if (local) return { base: local.base, serviceRole: local.serviceRole };

  throw new Error('Missing SUPABASE_URL/API_URL and SUPABASE_SERVICE_ROLE_KEY/SERVICE_ROLE_KEY');
}

export function createSupabaseHeaders(client, contentType = null) {
  const headers = new Headers();
  headers.set('apikey', client.serviceRole);
  headers.set('authorization', `Bearer ${client.serviceRole}`);
  headers.set('accept', 'application/json');
  if (contentType) headers.set('content-type', contentType);
  return headers;
}

export async function supabaseFetchJson(client, pathName, init = {}) {
  const response = await fetch(`${client.base}${pathName}`, {
    ...init,
    headers: init.headers || createSupabaseHeaders(client),
    cache: 'no-store',
  });
  const text = await response.text().catch(() => '');
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(`Supabase ${response.status} ${pathName}: ${text || '<empty>'}`);
  }
  return payload;
}
