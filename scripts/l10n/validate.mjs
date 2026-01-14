#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../..');

const outRoot = path.join(repoRoot, 'tokyo', 'l10n');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

const PROHIBITED_SEGMENTS = new Set(['__proto__', 'prototype', 'constructor']);

function hasProhibitedSegment(pathStr) {
  return String(pathStr || '')
    .split('.')
    .some((seg) => seg && PROHIBITED_SEGMENTS.has(seg));
}

function assertOverlayShape({ ref, data }) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error(`[l10n] ${ref}: overlay must be an object`);
  }
  if (data.v !== 1) throw new Error(`[l10n] ${ref}: v must be 1`);
  if (!Array.isArray(data.ops)) throw new Error(`[l10n] ${ref}: ops must be an array`);
  if (!data.baseFingerprint || typeof data.baseFingerprint !== 'string' || !/^[a-f0-9]{64}$/i.test(data.baseFingerprint)) {
    throw new Error(`[l10n] ${ref}: baseFingerprint is required`);
  }
  for (let i = 0; i < data.ops.length; i += 1) {
    const op = data.ops[i];
    if (!op || typeof op !== 'object' || Array.isArray(op)) {
      throw new Error(`[l10n] ${ref}: ops[${i}] must be an object`);
    }
    if (op.op !== 'set') throw new Error(`[l10n] ${ref}: ops[${i}].op must be "set"`);
    const p = typeof op.path === 'string' ? op.path.trim() : '';
    if (!p) throw new Error(`[l10n] ${ref}: ops[${i}].path is required`);
    if (hasProhibitedSegment(p)) throw new Error(`[l10n] ${ref}: ops[${i}].path contains prohibited segment`);
    if (!('value' in op)) throw new Error(`[l10n] ${ref}: ops[${i}].value is required`);
    if (typeof op.value !== 'string') throw new Error(`[l10n] ${ref}: ops[${i}].value must be a string`);
    if (op.value === undefined) throw new Error(`[l10n] ${ref}: ops[${i}].value cannot be undefined`);
  }
}

function main() {
  const manifestPath = path.join(outRoot, 'manifest.json');
  if (!fs.existsSync(manifestPath)) throw new Error(`[l10n] Missing manifest: ${manifestPath}`);

  const manifest = readJson(manifestPath);
  if (!manifest || typeof manifest !== 'object' || manifest.v !== 1) {
    throw new Error('[l10n] manifest.json must be { v: 1, ... }');
  }
  if (!manifest.instances || typeof manifest.instances !== 'object') {
    throw new Error('[l10n] manifest.instances missing or invalid');
  }

  const baseDir = path.join(outRoot, 'instances');
  for (const [publicId, locales] of Object.entries(manifest.instances)) {
    if (!locales || typeof locales !== 'object' || Array.isArray(locales)) {
      throw new Error(`[l10n] manifest.instances.${publicId} must be an object`);
    }
    for (const [locale, entry] of Object.entries(locales)) {
      const file = entry && typeof entry === 'object' ? entry.file : null;
      if (typeof file !== 'string' || !file.trim()) {
        throw new Error(`[l10n] manifest.instances.${publicId}.${locale}.file missing`);
      }
      const filePath = path.join(baseDir, publicId, file);
      if (!fs.existsSync(filePath)) {
        throw new Error(`[l10n] Missing overlay file for ${publicId}/${locale}: ${filePath}`);
      }
      const data = readJson(filePath);
      assertOverlayShape({ ref: `${publicId}/${locale}`, data });
    }
  }

  console.log('[l10n] OK: manifest + overlays validated');
}

main();
