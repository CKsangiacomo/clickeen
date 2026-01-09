#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const srcRoot = path.join(repoRoot, 'i18n');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function loadCatalog(locale, bundle) {
  const p = path.join(srcRoot, locale, `${bundle}.json`);
  if (!fs.existsSync(p)) return null;
  return readJson(p);
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

  const locales = fs
    .readdirSync(srcRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();

  if (!locales.includes('en')) {
    throw new Error('[i18n] Missing required locale: en');
  }

  const supportedLocales = locales.filter((locale) => {
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

      // Widget keys must exist in i18n/<locale>/<widget>.json
      if (!widgetCatalogs.has(prefix)) {
        const cat = loadCatalog(locale, prefix);
        widgetCatalogs.set(prefix, cat);
      }
      const cat = widgetCatalogs.get(prefix);
      if (!cat) {
        missing.push(`${locale}: missing catalog for widget "${prefix}" (needed for ${key})`);
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
