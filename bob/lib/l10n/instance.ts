import { computeBaseFingerprint, normalizeLocaleToken } from '@clickeen/l10n';
import { setAt } from '../utils/paths';

export type LocalizationOp = { op: 'set'; path: string; value: string };

const PROHIBITED_SEGMENTS = new Set(['__proto__', 'prototype', 'constructor']);

function normalizeOpPath(raw: string): string {
  return String(raw || '')
    .replace(/\[(\d+)\]/g, '.$1')
    .replace(/\.+/g, '.')
    .replace(/^\./, '')
    .replace(/\.$/, '');
}

function splitPathSegments(pathStr: string): string[] {
  return String(pathStr || '')
    .split('.')
    .map((seg) => seg.trim())
    .filter(Boolean);
}

function isNumericSegment(seg: string): boolean {
  return /^\d+$/.test(seg);
}

export function isCuratedPublicId(publicId: string): boolean {
  if (/^wgt_curated_/.test(publicId)) return true;
  return /^wgt_main_[a-z0-9][a-z0-9_-]*$/.test(publicId);
}

function hasProhibitedSegment(pathStr: string): boolean {
  return String(pathStr || '')
    .split('.')
    .some((seg) => seg && PROHIBITED_SEGMENTS.has(seg));
}

export function pathMatchesAllowlist(pathStr: string, allowPath: string): boolean {
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

export function filterAllowlistedOps(ops: LocalizationOp[], allowlist: string[]) {
  const filtered: LocalizationOp[] = [];
  const rejected: LocalizationOp[] = [];

  for (const op of ops) {
    const path = normalizeOpPath(op.path);
    if (!path || hasProhibitedSegment(path)) {
      rejected.push(op);
      continue;
    }
    const allowed = allowlist.some((allow) => pathMatchesAllowlist(path, allow));
    if (!allowed) {
      rejected.push(op);
      continue;
    }
    filtered.push({ ...op, path });
  }

  return { filtered, rejected };
}

export function mergeLocalizationOps(existing: LocalizationOp[], incoming: LocalizationOp[]): LocalizationOp[] {
  const map = new Map<string, LocalizationOp>();
  existing.forEach((op) => {
    if (op && typeof op.path === 'string') map.set(op.path, op);
  });
  incoming.forEach((op) => {
    if (op && typeof op.path === 'string') map.set(op.path, op);
  });
  return Array.from(map.values());
}

export function applyLocalizationOps(base: Record<string, unknown>, ops: LocalizationOp[]): Record<string, unknown> {
  let working: Record<string, unknown> = base;
  for (const op of ops) {
    if (!op || typeof op !== 'object') continue;
    if (op.op !== 'set') continue;
    if (typeof op.path !== 'string' || !op.path.trim()) continue;
    if (hasProhibitedSegment(op.path)) continue;
    if (typeof op.value !== 'string') continue;
    working = setAt(working, op.path, op.value) as Record<string, unknown>;
  }
  return working;
}

export { computeBaseFingerprint, normalizeLocaleToken };
