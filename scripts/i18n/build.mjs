#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const srcRoot = path.join(repoRoot, 'i18n');
const outRoot = path.join(repoRoot, 'tokyo', 'i18n');
const canonicalLocalesPath = path.join(repoRoot, 'config', 'locales.json');

function stableStringify(value) {
  if (value == null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const keys = Object.keys(value).sort();
  const body = keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',');
  return `{${body}}`;
}

function prettyStableJson(value) {
  const parsed = JSON.parse(stableStringify(value));
  // JSON.stringify preserves key insertion order; we already sorted recursively.
  return `${JSON.stringify(parsed, null, 2)}\n`;
}

function sha8(value) {
  return crypto.createHash('sha256').update(value).digest('hex').slice(0, 8);
}

function tryGetGitSha() {
  const fromEnv =
    process.env.CF_PAGES_COMMIT_SHA ||
    process.env.GITHUB_SHA ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    process.env.COMMIT_SHA;
  if (fromEnv && String(fromEnv).trim()) return String(fromEnv).trim();

  try {
    const res = spawnSync('git', ['rev-list', '-1', 'HEAD', '--', 'i18n', 'config/locales.json', 'scripts/i18n/build.mjs'], {
      cwd: repoRoot,
      encoding: 'utf8',
    });
    if (res.status === 0) {
      const sha = String(res.stdout || '').trim();
      if (sha) return sha;
    }
  } catch {}
  return 'unknown';
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
    .map((v) => (typeof v === 'string' ? v.trim().toLowerCase() : ''))
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

function isRtlLocale(locale) {
  const rtl = new Set(['ar', 'he', 'fa', 'ur']);
  return rtl.has(locale);
}

function assertCatalogShape({ locale, bundle, data }) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error(`[i18n] ${locale}/${bundle} must be a JSON object`);
  }

  const prefix = bundle === 'coreui' ? 'coreui.' : `${bundle}.`;
  for (const [key, value] of Object.entries(data)) {
    if (!key.startsWith(prefix)) {
      throw new Error(`[i18n] Key "${key}" must start with "${prefix}" (in ${locale}/${bundle})`);
    }
    if (typeof value === 'string') continue;
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error(`[i18n] Value for "${key}" must be a string or plural-forms object`);
    }
    if (typeof value.other !== 'string' || !value.other.trim()) {
      throw new Error(`[i18n] Plural key "${key}" must include non-empty "other"`);
    }
    for (const [form, text] of Object.entries(value)) {
      if (typeof text !== 'string') {
        throw new Error(`[i18n] Plural form "${key}.${form}" must be a string`);
      }
    }
  }
}

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function cleanBundleOutputs(localeOutDir, bundle) {
  if (!fs.existsSync(localeOutDir)) return;
  const files = fs.readdirSync(localeOutDir);
  files.forEach((file) => {
    if (file === 'coreui.json') return;
    if (file.startsWith(`${bundle}.`) && file.endsWith('.json')) {
      fs.unlinkSync(path.join(localeOutDir, file));
    }
  });
}

function main() {
  if (!fs.existsSync(srcRoot)) {
    throw new Error(`[i18n] Missing source dir: ${srcRoot}`);
  }

  const canonicalLocales = readCanonicalLocales();
  const supportedLocales = canonicalLocales.filter((locale) => {
    const corePath = path.join(srcRoot, locale, 'coreui.json');
    if (fs.existsSync(corePath)) return true;
    console.warn(`[i18n] Skipping locale "${locale}" (missing ${locale}/coreui.json)`);
    return false;
  });

  const manifest = {
    v: 1,
    gitSha: tryGetGitSha(),
    locales: {},
    bundles: {},
  };

  ensureDir(outRoot);

  for (const locale of supportedLocales) {
    const localeSrcDir = path.join(srcRoot, locale);
    const localeOutDir = path.join(outRoot, locale);
    ensureDir(localeOutDir);

    const files = fs
      .readdirSync(localeSrcDir, { withFileTypes: true })
      .filter((d) => d.isFile() && d.name.endsWith('.json'))
      .map((d) => d.name)
      .sort();

    // Note: supportedLocales already guarantees coreui.json exists.

    const bundlesForLocale = {};

    for (const file of files) {
      const bundle = file.replace(/\.json$/, '');
      const srcPath = path.join(localeSrcDir, file);
      const data = readJson(srcPath);
      assertCatalogShape({ locale, bundle, data });

      const stable = prettyStableJson(data);
      const hash = sha8(stable);
      const outName = `${bundle}.${hash}.json`;
      cleanBundleOutputs(localeOutDir, bundle);
      fs.writeFileSync(path.join(localeOutDir, outName), stable, 'utf8');
      bundlesForLocale[bundle] = outName;
    }

    manifest.locales[locale] = { dir: isRtlLocale(locale) ? 'rtl' : 'ltr' };
    manifest.bundles[locale] = bundlesForLocale;
  }

  fs.writeFileSync(path.join(outRoot, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  console.log(`[i18n] Built ${supportedLocales.length} locale(s) → tokyo/i18n (gitSha=${manifest.gitSha})`);
}

main();
