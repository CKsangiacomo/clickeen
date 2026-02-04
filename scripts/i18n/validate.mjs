#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const srcRoot = path.join(repoRoot, 'i18n');
const canonicalLocalesPath = path.join(repoRoot, 'config', 'locales.json');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function loadCatalog(locale, bundle) {
  const p = path.join(srcRoot, locale, `${bundle}.json`);
  if (!fs.existsSync(p)) return null;
  return readJson(p);
}

function readCanonicalLocales() {
  if (!fs.existsSync(canonicalLocalesPath)) {
    throw new Error(`[i18n] Missing canonical locales file: ${canonicalLocalesPath}`);
  }
  const raw = fs.readFileSync(canonicalLocalesPath, 'utf8');
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error(`[i18n] Invalid canonical locales file (expected array): ${canonicalLocalesPath}`);
  }
  const locales = parsed
    .map((entry) => {
      if (typeof entry === 'string') return entry.trim().toLowerCase();
      if (entry && typeof entry === 'object' && typeof entry.code === 'string') return entry.code.trim().toLowerCase();
      return '';
    })
    .filter(Boolean);
  if (!locales.includes('en')) {
    throw new Error(`[i18n] Canonical locales must include "en": ${canonicalLocalesPath}`);
  }
  // Dedupe while preserving order.
  const seen = new Set();
  const unique = [];
  for (const l of locales) {
    if (seen.has(l)) continue;
    seen.add(l);
    unique.push(l);
  }
  return unique;
}

function main() {
  const extract = spawnSync(process.execPath, [path.join(repoRoot, 'scripts/i18n/extract-keys.mjs')], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  if (extract.status !== 0) {
    throw new Error(`[i18n] extract-keys failed: ${extract.stderr || extract.stdout}`);
  }

  const keys = String(extract.stdout || '')
    .split('\n')
    .map((k) => k.trim())
    .filter(Boolean);

  const canonicalLocales = readCanonicalLocales();
  const supportedLocales = canonicalLocales.filter((locale) => {
    const corePath = path.join(srcRoot, locale, 'coreui.json');
    if (fs.existsSync(corePath)) return true;
    console.warn(`[i18n] Skipping locale "${locale}" (missing ${locale}/coreui.json)`);
    return false;
  });

  for (const locale of supportedLocales) {
    const coreui = loadCatalog(locale, 'coreui');
    if (!coreui) throw new Error(`[i18n] Missing ${locale}/coreui.json`);

    const widgetCatalogs = new Map();

    const missing = [];
    for (const key of keys) {
      const prefix = key.split('.')[0];
      if (prefix === 'coreui') {
        if (!(key in coreui)) missing.push(`${locale}: ${key}`);
        continue;
      }

      // Non-coreui keys must exist in i18n/<locale>/<bundle>.json
      if (!widgetCatalogs.has(prefix)) {
        const cat = loadCatalog(locale, prefix);
        widgetCatalogs.set(prefix, cat);
      }
      const cat = widgetCatalogs.get(prefix);
      if (!cat) {
        missing.push(`${locale}: missing catalog for bundle "${prefix}" (needed for ${key})`);
        continue;
      }
      if (!(key in cat)) missing.push(`${locale}: ${key}`);
    }

    if (missing.length) {
      throw new Error(`[i18n] Missing keys for locale "${locale}":\n${missing.join('\n')}`);
    }
  }

  console.log(`[i18n] OK: ${keys.length} referenced key(s) validated across ${supportedLocales.length} locale(s)`);
}

main();
