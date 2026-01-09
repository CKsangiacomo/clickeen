#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../..');

const srcRoot = path.join(repoRoot, 'l10n');
const outRoot = path.join(repoRoot, 'tokyo', 'l10n');

function stableStringify(value) {
  if (value == null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const keys = Object.keys(value).sort();
  const body = keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',');
  return `{${body}}`;
}

function prettyStableJson(value) {
  const parsed = JSON.parse(stableStringify(value));
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
    const res = spawnSync('git', ['rev-list', '-1', 'HEAD', '--', 'l10n', 'scripts/l10n/build.mjs'], {
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

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

const PROHIBITED_SEGMENTS = new Set(['__proto__', 'prototype', 'constructor']);

function hasProhibitedSegment(pathStr) {
  return String(pathStr || '')
    .split('.')
    .some((seg) => seg && PROHIBITED_SEGMENTS.has(seg));
}

function assertOverlayShape({ publicId, locale, data }) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error(`[l10n] ${publicId}/${locale}: overlay must be an object`);
  }
  if (data.v !== 1) throw new Error(`[l10n] ${publicId}/${locale}: v must be 1`);
  if (!Array.isArray(data.ops)) throw new Error(`[l10n] ${publicId}/${locale}: ops must be an array`);

  for (let i = 0; i < data.ops.length; i += 1) {
    const op = data.ops[i];
    if (!op || typeof op !== 'object' || Array.isArray(op)) {
      throw new Error(`[l10n] ${publicId}/${locale}: ops[${i}] must be an object`);
    }
    if (op.op !== 'set') {
      throw new Error(`[l10n] ${publicId}/${locale}: ops[${i}].op must be "set"`);
    }
    const p = typeof op.path === 'string' ? op.path.trim() : '';
    if (!p) throw new Error(`[l10n] ${publicId}/${locale}: ops[${i}].path is required`);
    if (hasProhibitedSegment(p)) throw new Error(`[l10n] ${publicId}/${locale}: ops[${i}].path contains prohibited segment`);
    if (!('value' in op)) throw new Error(`[l10n] ${publicId}/${locale}: ops[${i}].value is required`);
    if (op.value === undefined) throw new Error(`[l10n] ${publicId}/${locale}: ops[${i}].value cannot be undefined`);
  }
}

function cleanOldOutputs(outputDir, locale) {
  if (!fs.existsSync(outputDir)) return;
  const files = fs.readdirSync(outputDir, { withFileTypes: true }).filter((d) => d.isFile()).map((d) => d.name);
  for (const file of files) {
    if (file === `${locale}.ops.json`) continue;
    if (file.startsWith(`${locale}.`) && file.endsWith('.ops.json')) {
      fs.unlinkSync(path.join(outputDir, file));
    }
  }
}

function main() {
  if (!fs.existsSync(srcRoot)) {
    // No sources yet is fine; write an empty manifest for deterministic runtime behavior.
    ensureDir(outRoot);
    const manifest = { v: 1, gitSha: tryGetGitSha(), instances: {} };
    fs.writeFileSync(path.join(outRoot, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    console.log(`[l10n] No sources found (missing ${srcRoot}); wrote empty tokyo/l10n/manifest.json`);
    return;
  }

  const instancesRoot = path.join(srcRoot, 'instances');
  const manifest = { v: 1, gitSha: tryGetGitSha(), instances: {} };

  ensureDir(outRoot);
  ensureDir(path.join(outRoot, 'instances'));

  if (!fs.existsSync(instancesRoot)) {
    fs.writeFileSync(path.join(outRoot, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    console.log(`[l10n] No sources found under l10n/instances; wrote empty tokyo/l10n/manifest.json`);
    return;
  }

  const publicIds = fs
    .readdirSync(instancesRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('.'))
    .map((d) => d.name)
    .sort();

  for (const publicId of publicIds) {
    const instanceSrcDir = path.join(instancesRoot, publicId);
    const instanceOutDir = path.join(outRoot, 'instances', publicId);
    ensureDir(instanceOutDir);

    const locales = fs
      .readdirSync(instanceSrcDir, { withFileTypes: true })
      .filter((d) => d.isFile() && d.name.endsWith('.ops.json'))
      .map((d) => d.name.replace(/\.ops\.json$/, ''))
      .sort();

    const mapping = {};

    for (const locale of locales) {
      const srcPath = path.join(instanceSrcDir, `${locale}.ops.json`);
      const overlay = readJson(srcPath);
      assertOverlayShape({ publicId, locale, data: overlay });

      const stable = prettyStableJson(overlay);
      const hash = sha8(stable);
      const outName = `${locale}.${hash}.ops.json`;
      cleanOldOutputs(instanceOutDir, locale);
      fs.writeFileSync(path.join(instanceOutDir, outName), stable, 'utf8');
      mapping[locale] = { file: outName, baseUpdatedAt: overlay.baseUpdatedAt ?? null };
    }

    if (Object.keys(mapping).length) {
      manifest.instances[publicId] = mapping;
    }
  }

  fs.writeFileSync(path.join(outRoot, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  console.log(`[l10n] Built ${Object.keys(manifest.instances).length} instance overlay set(s) → tokyo/l10n (gitSha=${manifest.gitSha})`);
}

main();

