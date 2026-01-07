#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Prague localization pipeline (v1)
 *
 * - Source of truth: English canonical widget page JSON:
 *     tokyo/widgets/{widgetType}/pages/{overview|templates|examples|features}.json
 * - Output: per-locale localized JSON specs written to:
 *     tokyo/widgets/{widgetType}/pages/.locales/{locale}/{page}.json
 *
 * Contract:
 * - Only translates `block.copy` string fields (deep).
 * - Never mutates ids/kinds/flags.
 * - Deterministic output file paths so Prague can load locale specs at build time.
 *
 * Secrets:
 * - Uses OPENAI_API_KEY from env. Never store keys in git.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const TOKYO_WIDGETS_DIR = path.join(REPO_ROOT, 'tokyo', 'widgets');
const SANFRANCISCO_LEXICON = path.join(REPO_ROOT, 'sanfrancisco', 'src', 'lexicon', 'global_dictionary.json');
const DOTENV_LOCAL = path.join(REPO_ROOT, '.env.local');

const CANONICAL_PAGES = ['overview', 'templates', 'examples', 'features'];
const TARGET_LOCALES = ['es', 'pt', 'de', 'fr']; // Phase-1 non-English locales. English is source.

function sha256(raw) {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

async function loadDotenvIfPresent() {
  // Local/dev convenience: allow a repo-root `.env.local` to provide OPENAI_API_KEY/OPENAI_MODEL.
  // This keeps secrets out of git, and avoids requiring manual `export ...` per shell.
  try {
    const raw = await fs.readFile(DOTENV_LOCAL, 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if (!key) continue;
      // Strip surrounding quotes if present.
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      // For this script, OPENAI_* keys must be deterministic and come from `.env.local` when present.
      // Otherwise we can accidentally pick up stale/global env vars and get confusing 401s.
      if (key === 'OPENAI_API_KEY' || key === 'OPENAI_MODEL') {
        process.env[key] = val;
        continue;
      }
      if (process.env[key] == null || process.env[key] === '') process.env[key] = val;
    }
  } catch (err) {
    if (err && (err.code === 'ENOENT' || err.code === 'ENOTDIR')) return;
    throw err;
  }
}

async function readJson(p) {
  const raw = await fs.readFile(p, 'utf8');
  return JSON.parse(raw);
}

async function fileExists(p) {
  try {
    await fs.stat(p);
    return true;
  } catch (err) {
    if (err && (err.code === 'ENOENT' || err.code === 'ENOTDIR')) return false;
    throw err;
  }
}

async function listWidgets() {
  const entries = await fs.readdir(TOKYO_WIDGETS_DIR, { withFileTypes: true });
  return entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .filter((name) => name && !name.startsWith('_') && name !== 'shared')
    .sort();
}

function* walkCopyStrings(value, prefix = []) {
  if (typeof value === 'string') {
    yield { path: prefix, value };
    return;
  }
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) yield* walkCopyStrings(value[i], [...prefix, String(i)]);
    return;
  }
  for (const key of Object.keys(value)) yield* walkCopyStrings(value[key], [...prefix, key]);
}

function setAtPath(root, pathParts, newValue) {
  let cur = root;
  for (let i = 0; i < pathParts.length - 1; i++) {
    const k = pathParts[i];
    cur = cur[k];
  }
  cur[pathParts[pathParts.length - 1]] = newValue;
}

async function openaiTranslateMany({ model, locale, glossary, strings }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('[prague-localize] Missing env: OPENAI_API_KEY');
  if (!strings.length) return [];

  // We ask for JSON output so it’s machine-safe.
  const payload = {
    model,
    input: [
      {
        role: 'system',
        content: [
          {
            type: 'input_text',
            text:
              'You are a world-class localization expert for product marketing copy. ' +
              'Translate faithfully, keep meaning and tone, avoid awkward literal phrasing. ' +
              'Never translate product names or reserved tokens. Preserve punctuation like em-dashes when appropriate.',
          },
          {
            type: 'input_text',
            text:
              'Glossary (terms must be consistent; do not invent alternates):\n' +
              JSON.stringify(glossary, null, 2),
          },
        ],
      },
      {
        role: 'user',
        content: [
          {
            type: 'input_text',
            text:
              `Translate the following English strings to locale "${locale}". ` +
              'Return ONLY valid JSON: {"translations":[...]} with the same length and order.\n\n' +
              JSON.stringify({ strings }),
          },
        ],
      },
    ],
    // Responses API: JSON schema output is configured via `text.format` (not `response_format`).
    text: {
      format: {
        type: 'json_schema',
        name: 'translations',
        strict: true,
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            translations: {
              type: 'array',
              items: { type: 'string' },
            },
          },
          required: ['translations'],
        },
      },
    },
  };

  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`[prague-localize] OpenAI error ${res.status}: ${body}`);
  }
  const data = await res.json();
  const text =
    (typeof data?.output_text === 'string' && data.output_text) ||
    (Array.isArray(data?.output)
      ? data.output
          .flatMap((o) => (Array.isArray(o?.content) ? o.content : []))
          .filter((c) => c && c.type === 'output_text' && typeof c.text === 'string')
          .map((c) => c.text)
          .join('')
      : '');
  if (!text || typeof text !== 'string') {
    throw new Error('[prague-localize] Unexpected OpenAI response: missing output text');
  }
  const parsed = JSON.parse(text);
  if (!parsed || !Array.isArray(parsed.translations)) {
    throw new Error('[prague-localize] Unexpected OpenAI JSON response shape');
  }
  if (parsed.translations.length !== strings.length) {
    throw new Error(`[prague-localize] Translation length mismatch: expected ${strings.length}, got ${parsed.translations.length}`);
  }
  return parsed.translations;
}

async function localizeWidgetPage({ widget, page, locale, model, glossary }) {
  const srcPath = path.join(TOKYO_WIDGETS_DIR, widget, 'pages', `${page}.json`);
  if (!(await fileExists(srcPath))) return { skipped: true, reason: 'missing source' };

  const srcRaw = await fs.readFile(srcPath, 'utf8');
  const srcHash = sha256(srcRaw);
  const src = JSON.parse(srcRaw);

  const outDir = path.join(TOKYO_WIDGETS_DIR, widget, 'pages', '.locales', locale);
  const outPath = path.join(outDir, `${page}.json`);
  const metaPath = path.join(outDir, `${page}.meta.json`);

  if (await fileExists(metaPath)) {
    const meta = await readJson(metaPath).catch(() => null);
    if (meta && meta.srcHash === srcHash && meta.model === model) {
      return { skipped: true, reason: 'up-to-date' };
    }
  }

  if (!src || typeof src !== 'object' || Array.isArray(src)) {
    throw new Error(`[prague-localize] Invalid source JSON: ${srcPath}`);
  }
  if (!Array.isArray(src.blocks)) {
    throw new Error(`[prague-localize] Missing blocks[] in: ${srcPath}`);
  }

  // Collect strings from block.copy only.
  const refs = [];
  const strings = [];
  for (const block of src.blocks) {
    if (!block || typeof block !== 'object') continue;
    const copy = block.copy;
    if (!copy) continue;
    for (const hit of walkCopyStrings(copy, [])) {
      const key = `${String(block.id)}:${hit.path.join('.')}`;
      refs.push({ blockId: block.id, path: hit.path, key });
      strings.push(hit.value);
    }
  }

  const translations = await openaiTranslateMany({ model, locale, glossary, strings });

  // Apply translations back into a cloned object.
  const out = structuredClone(src);
  const blocks = out.blocks;
  const copyByBlockId = new Map();
  for (const b of blocks) {
    if (b && typeof b === 'object') copyByBlockId.set(b.id, b.copy);
  }
  for (let i = 0; i < refs.length; i++) {
    const ref = refs[i];
    const t = translations[i];
    const copy = copyByBlockId.get(ref.blockId);
    if (!copy) continue;
    setAtPath(copy, ref.path, t);
  }

  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(outPath, `${JSON.stringify(out, null, 2)}\n`, 'utf8');
  await fs.writeFile(
    metaPath,
    `${JSON.stringify({ v: 1, widget, page, locale, model, srcHash }, null, 2)}\n`,
    'utf8',
  );
  return { skipped: false, outPath };
}

async function main() {
  await loadDotenvIfPresent();
  const model = process.env.OPENAI_MODEL || 'gpt-5.2';
  const glossary = (await readJson(SANFRANCISCO_LEXICON).catch(() => ({}))) || {};

  console.log(`[prague-localize] model=${model}`);
  const widgets = await listWidgets();
  console.log(`[prague-localize] widgets=${widgets.length}`);

  let wrote = 0;
  let skipped = 0;
  for (const widget of widgets) {
    for (const page of CANONICAL_PAGES) {
      for (const locale of TARGET_LOCALES) {
        const res = await localizeWidgetPage({ widget, page, locale, model, glossary });
        if (res.skipped) skipped++;
        else wrote++;
      }
    }
  }
  console.log(`[prague-localize] done: wrote=${wrote}, skipped=${skipped}`);
}

main().catch((err) => {
  console.error(String(err?.stack || err));
  process.exit(1);
});

