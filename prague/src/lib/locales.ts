import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(fileURLToPath(new URL('../../../', import.meta.url)));
const CANONICAL_LOCALES_FILE = path.join(REPO_ROOT, 'config', 'locales.json');

function readCanonicalLocales(): string[] {
  const raw = fs.readFileSync(CANONICAL_LOCALES_FILE, 'utf8');
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error(`[prague] Invalid canonical locales file (expected array): ${CANONICAL_LOCALES_FILE}`);
  }
  const locales = parsed
    .map((v) => (typeof v === 'string' ? v.trim().toLowerCase() : ''))
    .filter(Boolean);

  if (!locales.includes('en')) {
    throw new Error(`[prague] Canonical locales must include "en": ${CANONICAL_LOCALES_FILE}`);
  }

  // Dedupe while preserving order.
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const l of locales) {
    if (seen.has(l)) continue;
    seen.add(l);
    unique.push(l);
  }

  return unique;
}

export const PRAGUE_CANONICAL_LOCALES = readCanonicalLocales();

export type PragueLocale = string;

export function listPragueLocales(): string[] {
  return [...PRAGUE_CANONICAL_LOCALES];
}

