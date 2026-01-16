import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { localeCandidates, normalizeLocaleToken } from '@clickeen/l10n';

const REPO_ROOT = path.resolve(fileURLToPath(new URL('../../../', import.meta.url)));
const STRINGS_ROOT = path.join(REPO_ROOT, 'prague-strings', 'compiled', 'v1');
const LOCALES_PATH = path.join(REPO_ROOT, 'config', 'locales.json');

let cachedLocales: string[] | null = null;

async function readJson(filePath: string): Promise<unknown> {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw) as unknown;
}

async function loadLocales(): Promise<string[]> {
  if (cachedLocales) return cachedLocales;
  const raw = await readJson(LOCALES_PATH);
  if (!Array.isArray(raw)) {
    throw new Error(`[prague-strings] Invalid locales file: ${LOCALES_PATH}`);
  }
  const locales = raw
    .map((value) => normalizeLocaleToken(value))
    .filter((value): value is string => Boolean(value));
  if (!locales.includes('en')) {
    throw new Error('[prague-strings] locales.json must include "en"');
  }
  cachedLocales = Array.from(new Set(locales)).sort();
  return cachedLocales;
}

async function resolveLocale(rawLocale: string): Promise<string> {
  const locales = await loadLocales();
  const candidates = localeCandidates(rawLocale, locales);
  if (!candidates.length) {
    throw new Error(`[prague-strings] Unsupported locale: ${rawLocale}`);
  }
  return candidates[0];
}

function assertCompiledShape(value: unknown, ref: string): asserts value is { v: 1; blocks: Record<string, { strings: Record<string, unknown> }> } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`[prague-strings] Invalid compiled file: ${ref}`);
  }
  const v = (value as any).v;
  if (v !== 1) throw new Error(`[prague-strings] ${ref}: v must be 1`);
  const blocks = (value as any).blocks;
  if (!blocks || typeof blocks !== 'object' || Array.isArray(blocks)) {
    throw new Error(`[prague-strings] ${ref}: blocks must be an object`);
  }
}

function assertStringsShape(value: unknown, ref: string): asserts value is { v: 1; strings: Record<string, unknown> } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`[prague-strings] Invalid compiled file: ${ref}`);
  }
  const v = (value as any).v;
  if (v !== 1) throw new Error(`[prague-strings] ${ref}: v must be 1`);
  const strings = (value as any).strings;
  if (!strings || typeof strings !== 'object' || Array.isArray(strings)) {
    throw new Error(`[prague-strings] ${ref}: strings must be an object`);
  }
}

export async function loadCompiledPageStrings(args: { locale: string; pagePath: string }) {
  const locale = await resolveLocale(args.locale);
  const filePath = path.join(STRINGS_ROOT, locale, `${args.pagePath}.json`);
  const json = await readJson(filePath);
  assertCompiledShape(json, filePath);
  return json;
}

export async function loadCompiledChromeStrings(locale: string) {
  const resolved = await resolveLocale(locale);
  const filePath = path.join(STRINGS_ROOT, resolved, 'chrome.json');
  const json = await readJson(filePath);
  assertStringsShape(json, filePath);
  return json;
}

export async function loadCompiledSharedStrings(args: { locale: string; sharedKey: string }) {
  const resolved = await resolveLocale(args.locale);
  const key = args.sharedKey.replace(/^shared\//, '');
  const filePath = path.join(STRINGS_ROOT, resolved, 'shared', `${key}.json`);
  const json = await readJson(filePath);
  assertStringsShape(json, filePath);
  return json;
}
