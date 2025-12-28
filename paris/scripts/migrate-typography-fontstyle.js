#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { createClient } = require('@supabase/supabase-js');

function parseEnvFile(source) {
  return source
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .reduce((acc, line) => {
      const idx = line.indexOf('=');
      if (idx === -1) return acc;
      const key = line.slice(0, idx).trim();
      const value = line.slice(idx + 1).trim();
      acc[key] = value;
      return acc;
    }, {});
}

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function usage() {
  console.log(
    [
      'Usage:',
      '  node paris/scripts/migrate-typography-fontstyle.js --all',
      '  node paris/scripts/migrate-typography-fontstyle.js --publicId <id>',
      '',
      "Adds missing typography.roles.*.fontStyle using widget spec defaults (strict editor; no runtime fallbacks).",
    ].join('\n'),
  );
}

function ensureFontStyle(instanceData, specDefaults) {
  const next = deepClone(instanceData && typeof instanceData === 'object' ? instanceData : {});
  const defaultTypography = specDefaults?.typography;
  const defaultRoles = defaultTypography?.roles;
  if (!defaultRoles || typeof defaultRoles !== 'object' || Array.isArray(defaultRoles)) {
    return { changed: false, data: next };
  }

  if (!next.typography || typeof next.typography !== 'object' || Array.isArray(next.typography)) {
    next.typography = deepClone(defaultTypography);
    return { changed: true, data: next };
  }

  if (!next.typography.roles || typeof next.typography.roles !== 'object' || Array.isArray(next.typography.roles)) {
    next.typography.roles = deepClone(defaultRoles);
    return { changed: true, data: next };
  }

  let changed = false;
  for (const [roleKey, defaultRole] of Object.entries(defaultRoles)) {
    if (!defaultRole || typeof defaultRole !== 'object' || Array.isArray(defaultRole)) continue;

    const role = next.typography.roles[roleKey];
    if (!role || typeof role !== 'object' || Array.isArray(role)) {
      next.typography.roles[roleKey] = deepClone(defaultRole);
      changed = true;
      continue;
    }

    if (typeof role.fontStyle !== 'string' || !role.fontStyle.trim()) {
      role.fontStyle =
        typeof defaultRole.fontStyle === 'string' && defaultRole.fontStyle.trim()
          ? defaultRole.fontStyle
          : 'normal';
      changed = true;
    }
  }

  return { changed, data: next };
}

async function main() {
  const args = process.argv.slice(2);
  const wantsAll = args.includes('--all');
  const idFlagIndex = args.indexOf('--publicId');
  const publicId = idFlagIndex >= 0 ? args[idFlagIndex + 1] : null;

  if (!wantsAll && !publicId) {
    usage();
    process.exitCode = 1;
    return;
  }

  const envPath = path.resolve(__dirname, '..', '..', 'supabase', '.env');
  const envText = fs.readFileSync(envPath, 'utf8');
  const env = parseEnvFile(envText);
  const url = env.SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in supabase/.env');
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const widgetSpecs = new Map([
    ['faq', path.resolve(__dirname, '..', '..', 'tokyo', 'widgets', 'faq', 'spec.json')],
    ['countdown', path.resolve(__dirname, '..', '..', 'tokyo', 'widgets', 'countdown', 'spec.json')],
  ]);

  const { data: rows, error } = await supabase
    .from('widget_instances')
    .select('inst_public_id, inst_widget_name, inst_instancedata, inst_status')
    .neq('inst_status', 'inactive');

  if (error) {
    throw new Error(`Failed to load instances: ${error.message}`);
  }

  const candidates = (rows || []).filter((row) => {
    if (!row?.inst_public_id) return false;
    if (publicId && row.inst_public_id !== publicId) return false;
    if (!wantsAll && !publicId) return false;
    return true;
  });

  if (candidates.length === 0) {
    console.log('[migrate-fontstyle] No matching instances found.');
    return;
  }

  for (const row of candidates) {
    const widgetname = row.inst_widget_name;
    const specPath = widgetSpecs.get(widgetname);
    if (!specPath) {
      console.log(`[migrate-fontstyle] Skipping ${row.inst_public_id} (unknown widget "${widgetname}")`);
      continue;
    }

    const spec = readJson(specPath);
    if (!spec || typeof spec !== 'object' || !spec.defaults || typeof spec.defaults !== 'object') {
      throw new Error(`[migrate-fontstyle] Invalid spec defaults for "${widgetname}" (${specPath})`);
    }

    const current = row.inst_instancedata;
    const { changed, data: nextData } = ensureFontStyle(current, spec.defaults);
    if (!changed) {
      console.log(`[migrate-fontstyle] No changes for ${row.inst_public_id} (${widgetname})`);
      continue;
    }

    const { error: updateError } = await supabase
      .from('widget_instances')
      .update({ inst_instancedata: nextData })
      .eq('inst_public_id', row.inst_public_id);

    if (updateError) {
      throw new Error(`[migrate-fontstyle] Failed updating ${row.inst_public_id}: ${updateError.message}`);
    }

    console.log(`[migrate-fontstyle] Updated ${row.inst_public_id} (${widgetname})`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
