#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const tokyoWidgetsDir = path.join(repoRoot, 'tokyo', 'widgets');

const TEXT_EXTS = new Set(['.ts', '.tsx', '.js', '.mjs', '.cjs', '.json', '.html', '.css', '.md']);
const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  '.next',
  '.next-dev',
  '.turbo',
  '.cloudflare',
  '.vercel',
  '.wrangler',
  '.astro',
  'dist',
  'build',
]);

function isRealWidgetDir(name) {
  if (!name) return false;
  if (name.startsWith('_')) return false;
  if (name === 'shared') return false;
  return true;
}

function getAllowedKeyPrefixes() {
  // Product-owned extraction contract:
  // - Only extract keys that belong to our i18n system.
  // - This prevents accidental "t('x.y')" helpers elsewhere from polluting i18n bundles.
  const allowed = new Set(['coreui', 'prague']);

  try {
    if (fs.existsSync(tokyoWidgetsDir)) {
      const entries = fs.readdirSync(tokyoWidgetsDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (!isRealWidgetDir(entry.name)) continue;
        allowed.add(entry.name);
      }
    }
  } catch {
    // Best-effort: extraction still works for coreui/prague keys.
  }

  return allowed;
}

const ALLOWED_KEY_PREFIXES = getAllowedKeyPrefixes();

function walk(dir, out) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walk(full, out);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name);
      if (!TEXT_EXTS.has(ext)) continue;
      out.push(full);
    }
  }
}

function extractFromText(text) {
  const keys = new Set();
  const isLiteralKey = (key) => /^[a-z0-9_]+\.[a-z0-9_.-]+$/i.test(key);
  const isAllowedKey = (key) => {
    const prefix = key.split('.')[0]?.trim().toLowerCase();
    if (!prefix) return false;
    return ALLOWED_KEY_PREFIXES.has(prefix);
  };

  const patterns = [
    /\bt\(\s*["']([a-z0-9_]+\.[a-z0-9_.-]+)["']/gi,
    /\bdata-i18n-key=(?:"([^"]+)"|'([^']+)')/gi,
    /\bdata-i18n-key=&quot;([^&]+)&quot;/gi,
    /\b(?:label|placeholder|add-label|reorder-label|reorder-title|toggle-label|header-label)-key=(?:"([^"]+)"|'([^']+)')/gi,
    /\b(?:label|placeholder|add-label|reorder-label|reorder-title|toggle-label|header-label)-key=&quot;([^&]+)&quot;/gi,
    /"\$t"\s*:\s*"([^"]+)"/gi,
  ];

  for (const re of patterns) {
    let m;
    while ((m = re.exec(text)) !== null) {
      const key = (m[1] || m[2] || m[3] || m[4] || '').trim();
      if (!key) continue;
      if (!isLiteralKey(key)) continue;
      if (!isAllowedKey(key)) continue;
      keys.add(key);
    }
  }

  return keys;
}

function main() {
  const roots = ['bob', 'admin', 'tokyo', 'dieter', 'documentation', 'i18n'].map((p) => path.join(repoRoot, p));
  const files = [];
  roots.forEach((root) => {
    if (fs.existsSync(root)) walk(root, files);
  });

  const keys = new Set();
  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    for (const key of extractFromText(text)) keys.add(key);
  }

  const sorted = Array.from(keys).sort();
  process.stdout.write(`${sorted.join('\n')}\n`);
}

main();
