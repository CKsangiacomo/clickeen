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

function usage() {
  console.log(
    [
      'Usage:',
      '  node paris/scripts/reset-instance-data-to-defaults.js --all',
      '  node paris/scripts/reset-instance-data-to-defaults.js --publicId <id>',
      '',
      'Resets legacy instance config to the current widget spec defaults (strict editor mode; no backward compat).',
    ].join('\n')
  );
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
    ['faq', path.resolve(__dirname, '..', '..', 'denver', 'widgets', 'faq', 'spec.json')],
    ['countdown', path.resolve(__dirname, '..', '..', 'denver', 'widgets', 'countdown', 'spec.json')],
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
    console.log('[reset-instances] No matching instances found.');
    return;
  }

  for (const row of candidates) {
    const widgetname = row.inst_widget_name;
    const specPath = widgetSpecs.get(widgetname);
    if (!specPath) {
      console.log(`[reset-instances] Skipping ${row.inst_public_id} (unknown widget "${widgetname}")`);
      continue;
    }

    const spec = readJson(specPath);
    if (!spec || typeof spec !== 'object' || !spec.defaults || typeof spec.defaults !== 'object') {
      throw new Error(`[reset-instances] Invalid spec defaults for "${widgetname}" (${specPath})`);
    }

    const { error: updateError } = await supabase
      .from('widget_instances')
      .update({ inst_instancedata: spec.defaults })
      .eq('inst_public_id', row.inst_public_id);

    if (updateError) {
      throw new Error(`[reset-instances] Failed updating ${row.inst_public_id}: ${updateError.message}`);
    }

    console.log(`[reset-instances] Reset ${row.inst_public_id} (${widgetname}) → spec.defaults`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
