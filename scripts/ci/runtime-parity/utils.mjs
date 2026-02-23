import crypto from 'node:crypto';

export function makeCheck(name, pass, details = {}) {
  return {
    name,
    pass: Boolean(pass),
    ...details,
  };
}

export function scenarioPassed(checks) {
  return checks.every((check) => check.pass === true);
}

export function readString(value) {
  if (typeof value !== 'string') return '';
  const normalized = value.trim();
  return normalized;
}

export function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(readString(value));
}

export function parseReasonKey(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return '';
  const root = payload;
  const nested = root.error;
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    const reason = readString(nested.reasonKey);
    if (reason) return reason;
  }
  const direct = readString(root.reasonKey);
  return direct;
}

export function uniqueStrings(values) {
  const out = [];
  const seen = new Set();
  for (const value of values) {
    const normalized = readString(value);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function randomAssetBytes(label) {
  return Buffer.from(`runtime-parity-${label}-${Date.now()}-${crypto.randomUUID()}`);
}

export function normalizeHeader(headers, name) {
  const value = headers.get(name);
  if (!value) return '';
  return String(value).trim();
}

export function parseJsonSafe(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
