#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(scriptPath), '../..');
const rootEnvLocalPath = path.join(repoRoot, '.env.local');

let cachedValues = null;

function interpolateValue(value, values) {
  return String(value || '').replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (_match, key) => {
    const direct = String(process.env[key] || '').trim();
    if (direct) return direct;
    return String(values.get(key) || '');
  });
}

export function readRootEnvLocal() {
  if (cachedValues) return cachedValues;
  const values = new Map();
  if (!fs.existsSync(rootEnvLocalPath)) {
    cachedValues = values;
    return values;
  }
  const raw = fs.readFileSync(rootEnvLocalPath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    const [, key, remainder] = match;
    let value = remainder.trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values.set(key, interpolateValue(value, values));
  }
  cachedValues = values;
  return values;
}

export function resolveRootEnvValue(name) {
  const direct = String(process.env[name] || '').trim();
  if (direct) return direct;
  return String(readRootEnvLocal().get(name) || '').trim();
}

export function resolveFirstRootEnvValue(names) {
  for (const name of names) {
    const value = resolveRootEnvValue(name);
    if (value) return value;
  }
  return '';
}
