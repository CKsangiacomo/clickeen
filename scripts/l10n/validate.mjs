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
const LOCALE_PATTERN = /^[a-z]{2}(?:-[a-z0-9]+)*$/;

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
  const baseDir = path.join(outRoot, 'instances');
  if (!fs.existsSync(baseDir)) {
    console.log('[l10n] OK: no instance overlays found');
    return;
  }

  let overlayCount = 0;

  const publicIds = fs
    .readdirSync(baseDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('.'))
    .map((d) => d.name)
    .sort();

  for (const publicId of publicIds) {
    const instanceDir = path.join(baseDir, publicId);
    const locales = fs
      .readdirSync(instanceDir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && !d.name.startsWith('.'))
      .map((d) => d.name)
      .sort();

    for (const locale of locales) {
      if (!LOCALE_PATTERN.test(locale)) {
        throw new Error(`[l10n] Invalid locale folder name: ${publicId}/${locale}`);
      }
      const localeDir = path.join(instanceDir, locale);
      const files = fs
        .readdirSync(localeDir, { withFileTypes: true })
        .filter((d) => d.isFile() && d.name.endsWith('.ops.json'))
        .map((d) => d.name)
        .sort();

      if (!files.length) {
        throw new Error(`[l10n] Missing overlay file for ${publicId}/${locale}`);
      }

      for (const file of files) {
        const filePath = path.join(localeDir, file);
        const data = readJson(filePath);
        assertOverlayShape({ ref: `${publicId}/${locale}`, data });
        const expected = `${data.baseFingerprint}.ops.json`;
        if (file !== expected) {
          throw new Error(`[l10n] ${publicId}/${locale}: file name must be ${expected}`);
        }
        overlayCount += 1;
      }
    }
  }

  console.log(`[l10n] OK: validated ${overlayCount} overlay file(s)`);
}

main();
