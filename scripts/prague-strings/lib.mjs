import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

export const PROHIBITED_SEGMENTS = new Set(['__proto__', 'prototype', 'constructor']);
const LOCALE_PATTERN = /^[a-z]{2}(?:-[a-z0-9]+)*$/;

export function stableStringify(value) {
  if (value == null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const keys = Object.keys(value).sort();
  const body = keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',');
  return `{${body}}`;
}

export function prettyStableJson(value) {
  const parsed = JSON.parse(stableStringify(value));
  return `${JSON.stringify(parsed, null, 2)}\n`;
}

export function sha256Hex(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export async function readJson(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

export async function fileExists(filePath) {
  try {
    await fs.stat(filePath);
    return true;
  } catch (err) {
    if (err && (err.code === 'ENOENT' || err.code === 'ENOTDIR')) return false;
    throw err;
  }
}

export async function listJsonFiles(rootDir) {
  const out = [];
  async function walk(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
        continue;
      }
      if (entry.isFile() && entry.name.endsWith('.json')) out.push(fullPath);
    }
  }
  await walk(rootDir);
  return out.sort();
}

export function ensurePosixPath(value) {
  return value.split(path.sep).join('/');
}

export async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

export function normalizeLocaleToken(raw) {
  const value = typeof raw === 'string' ? raw.trim().toLowerCase().replace(/_/g, '-') : '';
  if (!value || !LOCALE_PATTERN.test(value)) return null;
  return value;
}

export function normalizeOpPath(raw) {
  return String(raw || '')
    .replace(/\[(\d+)\]/g, '.$1')
    .replace(/\.+/g, '.')
    .replace(/^\./, '')
    .replace(/\.$/, '');
}

export function splitPathSegments(pathStr) {
  return String(pathStr || '')
    .split('.')
    .map((seg) => seg.trim())
    .filter(Boolean);
}

export function isNumericSegment(seg) {
  return /^\d+$/.test(seg);
}

export function pathMatchesAllowlist(pathStr, allowPath) {
  const pathSegs = splitPathSegments(pathStr);
  const allowSegs = splitPathSegments(allowPath);
  if (pathSegs.length !== allowSegs.length) return false;
  for (let i = 0; i < allowSegs.length; i += 1) {
    const allow = allowSegs[i];
    const actual = pathSegs[i];
    if (allow === '*') {
      if (!isNumericSegment(actual)) return false;
      continue;
    }
    if (allow !== actual) return false;
  }
  return true;
}

export function hasProhibitedSegment(pathStr) {
  return splitPathSegments(pathStr).some((seg) => PROHIBITED_SEGMENTS.has(seg));
}
