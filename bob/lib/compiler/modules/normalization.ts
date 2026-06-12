import { isRecord as isPlainRecord } from '@clickeen/ck-contracts';
import type { WidgetNormalizationIdRule, WidgetNormalizationSpec } from '../../types';

const FORBIDDEN_PATH_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

function isSafePathKey(value: string): boolean {
  return Boolean(value && /^[a-zA-Z0-9_-]+$/.test(value) && !FORBIDDEN_PATH_KEYS.has(value));
}

function splitPath(path: string): string[] {
  const raw = String(path || '').trim();
  if (!raw) throw new Error('[BobCompiler] normalization path must be a non-empty string');

  const segments = raw.split('.').map((segment) => segment.trim());
  if (segments.some((segment) => !segment)) {
    throw new Error(`[BobCompiler] normalization path "${raw}" contains empty segments`);
  }

  return segments.map((segment) => {
    const hasArraySuffix = segment.endsWith('[]');
    const key = hasArraySuffix ? segment.slice(0, -2) : segment;
    if (!isSafePathKey(key)) {
      throw new Error(`[BobCompiler] normalization path segment "${segment}" is invalid`);
    }
    return hasArraySuffix ? `${key}[]` : key;
  });
}

function parseIdRule(ruleRaw: unknown, index: number): WidgetNormalizationIdRule {
  if (!isPlainRecord(ruleRaw)) {
    throw new Error(`[BobCompiler] normalization.idRules[${index}] must be an object`);
  }
  const arrayPathRaw = ruleRaw.arrayPath;
  if (typeof arrayPathRaw !== 'string' || !arrayPathRaw.trim()) {
    throw new Error(`[BobCompiler] normalization.idRules[${index}].arrayPath must be a non-empty string`);
  }
  const arrayPath = splitPath(arrayPathRaw).join('.');

  const idKeyRaw = ruleRaw.idKey;
  if (typeof idKeyRaw !== 'string' || !isSafePathKey(idKeyRaw.trim())) {
    throw new Error(`[BobCompiler] normalization.idRules[${index}].idKey must be a safe key`);
  }

  return { arrayPath, idKey: idKeyRaw.trim() };
}

export function normalizeWidgetNormalizationSpec(raw: unknown): WidgetNormalizationSpec | undefined {
  if (raw == null) return undefined;
  if (!isPlainRecord(raw)) {
    throw new Error('[BobCompiler] normalization must be an object');
  }
  Object.keys(raw).forEach((key) => { if (key !== 'idRules') throw new Error(`[BobCompiler] normalization.${key} is not supported`); });

  const idRulesRaw: unknown = raw.idRules;
  if (idRulesRaw != null && !Array.isArray(idRulesRaw)) {
    throw new Error('[BobCompiler] normalization.idRules must be an array');
  }

  const idRules = ((idRulesRaw ?? []) as unknown[]).map((rule, index) => parseIdRule(rule, index));

  if (!idRules.length) return undefined;
  return { idRules };
}
