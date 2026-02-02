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
const LOCALE_PATTERN = /^[a-z]{2,3}(?:-[a-z0-9]+)*$/;
const L10N_LAYER_ALLOWED = new Set(['locale', 'geo', 'industry', 'experiment', 'account', 'behavior', 'user']);
const LAYER_KEY_SLUG = /^[a-z0-9][a-z0-9_-]*$/;
const LAYER_KEY_EXPERIMENT = /^exp_[a-z0-9][a-z0-9_-]*:[a-z0-9][a-z0-9_-]*$/;
const LAYER_KEY_BEHAVIOR = /^behavior_[a-z0-9][a-z0-9_-]*$/;

function normalizeLayer(raw) {
  const value = String(raw || '').trim().toLowerCase();
  if (!value || !L10N_LAYER_ALLOWED.has(value)) return null;
  return value;
}

function normalizeLayerKey(layer, raw) {
  const value = String(raw || '').trim();
  if (!value) return null;
  switch (layer) {
    case 'locale': {
      const locale = value.toLowerCase().replace(/_/g, '-');
      return LOCALE_PATTERN.test(locale) ? locale : null;
    }
    case 'geo': {
      const upper = value.toUpperCase();
      return /^[A-Z]{2}$/.test(upper) ? upper : null;
    }
    case 'industry': {
      const lower = value.toLowerCase();
      return LAYER_KEY_SLUG.test(lower) ? lower : null;
    }
    case 'experiment': {
      const lower = value.toLowerCase();
      return LAYER_KEY_EXPERIMENT.test(lower) ? lower : null;
    }
    case 'account': {
      const lower = value.toLowerCase();
      return LAYER_KEY_SLUG.test(lower) ? lower : null;
    }
    case 'behavior': {
      const lower = value.toLowerCase();
      return LAYER_KEY_BEHAVIOR.test(lower) ? lower : null;
    }
    case 'user': {
      if (value === 'global') return 'global';
      const locale = value.toLowerCase().replace(/_/g, '-');
      return LOCALE_PATTERN.test(locale) ? locale : null;
    }
    default:
      return null;
  }
}

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
    if (op.value === undefined) throw new Error(`[l10n] ${ref}: ops[${i}].value cannot be undefined`);
  }
}

function normalizeGeoCountries(raw) {
  if (!Array.isArray(raw)) return null;
  const list = raw
    .map((code) => String(code || '').trim().toUpperCase())
    .filter((code) => /^[A-Z]{2}$/.test(code));
  if (!list.length) return null;
  return Array.from(new Set(list));
}

function assertLayerIndexShape({ ref, data, publicId }) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error(`[l10n] ${ref}: index must be an object`);
  }
  if (data.v !== 1) throw new Error(`[l10n] ${ref}: index v must be 1`);
  if (data.publicId && data.publicId !== publicId) {
    throw new Error(`[l10n] ${ref}: index publicId mismatch`);
  }
  if (!data.layers || typeof data.layers !== 'object') {
    throw new Error(`[l10n] ${ref}: index layers must be an object`);
  }

  const layers = {};
  for (const [layerRaw, entry] of Object.entries(data.layers)) {
    const layer = normalizeLayer(layerRaw);
    if (!layer) {
      throw new Error(`[l10n] ${ref}: invalid layer (${layerRaw})`);
    }
    if (!entry || typeof entry !== 'object' || !Array.isArray(entry.keys)) {
      throw new Error(`[l10n] ${ref}: index layer ${layer} missing keys`);
    }
    const keys = [];
    for (const rawKey of entry.keys) {
      const key = normalizeLayerKey(layer, rawKey);
      if (!key) {
        throw new Error(`[l10n] ${ref}: invalid ${layer} key (${rawKey})`);
      }
      if (!keys.includes(key)) keys.push(key);
    }
    if (!keys.length) continue;
    if (layer === 'locale' && entry.geoTargets && typeof entry.geoTargets === 'object') {
      for (const [geoKey, targets] of Object.entries(entry.geoTargets)) {
        const normalizedKey = normalizeLayerKey('locale', geoKey);
        if (!normalizedKey) {
          throw new Error(`[l10n] ${ref}: geoTargets locale invalid (${geoKey})`);
        }
        const normalized = normalizeGeoCountries(targets);
        if (!normalized) {
          throw new Error(`[l10n] ${ref}: geoTargets invalid for ${normalizedKey}`);
        }
      }
    }
    layers[layer] = keys;
  }
  if (!Object.keys(layers).length) {
    throw new Error(`[l10n] ${ref}: index layers empty`);
  }
  return layers;
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
    const indexPath = path.join(instanceDir, 'index.json');
    if (!fs.existsSync(indexPath)) {
      throw new Error(`[l10n] Missing index.json for ${publicId}`);
    }
    const indexData = readJson(indexPath);
    const indexedLayers = assertLayerIndexShape({
      ref: `${publicId}/index.json`,
      data: indexData,
      publicId,
    });
    const actualLayers = fs
      .readdirSync(instanceDir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && !d.name.startsWith('.'))
      .map((d) => d.name)
      .sort();

    for (const layer of actualLayers) {
      if (!indexedLayers[layer]) {
        throw new Error(`[l10n] ${publicId}: index.json missing layer ${layer}`);
      }
    }

    for (const [layer, keys] of Object.entries(indexedLayers)) {
      const layerDir = path.join(instanceDir, layer);
      if (!fs.existsSync(layerDir)) {
        throw new Error(`[l10n] Missing layer directory: ${publicId}/${layer}`);
      }
      const actualKeys = fs
        .readdirSync(layerDir, { withFileTypes: true })
        .filter((d) => d.isDirectory() && !d.name.startsWith('.'))
        .map((d) => d.name)
        .sort();

      for (const key of actualKeys) {
        if (!keys.includes(key)) {
          throw new Error(`[l10n] ${publicId}: index.json missing ${layer} key ${key}`);
        }
      }

      for (const key of keys) {
        const keyDir = path.join(layerDir, key);
        if (!fs.existsSync(keyDir)) {
          throw new Error(`[l10n] ${publicId}: index.json references missing ${layer} key ${key}`);
        }
        const files = fs
          .readdirSync(keyDir, { withFileTypes: true })
          .filter((d) => d.isFile() && d.name.endsWith('.ops.json'))
          .map((d) => d.name)
          .sort();

        if (!files.length) {
          throw new Error(`[l10n] Missing overlay file for ${publicId}/${layer}/${key}`);
        }

        for (const file of files) {
          const filePath = path.join(keyDir, file);
          const data = readJson(filePath);
          assertOverlayShape({ ref: `${publicId}/${layer}/${key}`, data });
          const expected = `${data.baseFingerprint}.ops.json`;
          if (file !== expected) {
            throw new Error(`[l10n] ${publicId}/${layer}/${key}: file name must be ${expected}`);
          }
          overlayCount += 1;
        }
      }
    }
  }

  console.log(`[l10n] OK: validated ${overlayCount} overlay file(s)`);
}

main();
