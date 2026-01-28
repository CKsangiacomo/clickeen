#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const workspaceRoot = process.cwd();
const widgetsRoot = path.join(workspaceRoot, 'tokyo', 'widgets');
const requiredWidgets = process.argv.length > 2 ? process.argv.slice(2) : ['faq', 'countdown', 'logoshowcase'];

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

function resolvePath(value, segments) {
  if (!segments.length) return { ok: true, value };
  const [head, ...tail] = segments;
  if (head === '*') {
    if (!Array.isArray(value) || value.length === 0) return { ok: false, reason: 'wildcard expects non-empty array' };
    return resolvePath(value[0], tail);
  }
  if (Array.isArray(value)) {
    const idx = Number(head);
    if (!Number.isInteger(idx)) return { ok: false, reason: 'numeric index expected for array' };
    if (idx < 0 || idx >= value.length) return { ok: false, reason: 'index out of range' };
    return resolvePath(value[idx], tail);
  }
  if (!value || typeof value !== 'object') return { ok: false, reason: 'object expected' };
  if (!(head in value)) return { ok: false, reason: 'missing key' };
  return resolvePath(value[head], tail);
}

function splitPath(pathStr) {
  return String(pathStr || '')
    .split('.')
    .map((s) => s.trim())
    .filter(Boolean);
}

let errors = 0;

for (const widgetType of requiredWidgets) {
  const widgetDir = path.join(widgetsRoot, widgetType);
  const allowlistPath = path.join(widgetDir, 'sdr.allowlist.json');
  const specPath = path.join(widgetDir, 'spec.json');

  if (!fs.existsSync(widgetDir)) {
    console.error(`[allowlist] Missing widget folder: ${widgetType}`);
    errors += 1;
    continue;
  }

  if (!fs.existsSync(allowlistPath)) {
    console.error(`[allowlist] Missing sdr.allowlist.json for ${widgetType}`);
    errors += 1;
    continue;
  }

  if (!fs.existsSync(specPath)) {
    console.error(`[allowlist] Missing spec.json for ${widgetType}`);
    errors += 1;
    continue;
  }

  const allowlist = readJson(allowlistPath);
  const spec = readJson(specPath);
  const defaults = spec.defaults ?? spec.default ?? spec.config ?? spec.data ?? null;

  if (!defaults || typeof defaults !== 'object') {
    console.error(`[allowlist] Cannot resolve defaults in ${widgetType}/spec.json`);
    errors += 1;
    continue;
  }

  if (allowlist.v !== 1 || !Array.isArray(allowlist.paths)) {
    console.error(`[allowlist] Invalid allowlist schema in ${widgetType}`);
    errors += 1;
    continue;
  }

  for (const entry of allowlist.paths) {
    const entryPath = entry?.path;
    const entryType = entry?.type;
    if (!entryPath || typeof entryPath !== 'string') {
      console.error(`[allowlist] Invalid path entry in ${widgetType}`);
      errors += 1;
      continue;
    }
    if (entryType !== 'string' && entryType !== 'richtext') {
      console.error(`[allowlist] Invalid type for ${widgetType}:${entryPath}`);
      errors += 1;
      continue;
    }
    const segments = splitPath(entryPath);
    const resolved = resolvePath(defaults, segments);
    if (!resolved.ok) {
      console.error(`[allowlist] Path not resolvable for ${widgetType}:${entryPath} (${resolved.reason})`);
      errors += 1;
      continue;
    }
    if (typeof resolved.value !== 'string') {
      console.error(`[allowlist] Path value not string for ${widgetType}:${entryPath}`);
      errors += 1;
    }
  }
}

if (errors > 0) {
  console.error(`\n[allowlist] Validation failed with ${errors} error(s).`);
  process.exit(1);
}

console.log('[allowlist] Validation passed.');
