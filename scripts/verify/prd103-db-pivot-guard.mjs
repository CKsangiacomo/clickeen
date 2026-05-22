#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();

const failures = [];

function read(relativePath) {
  return readFileSync(join(ROOT, relativePath), 'utf8');
}

function fail(label, detail) {
  failures.push(`${label}: ${detail}`);
}

const devUpPath = 'scripts/dev-up.sh';
const devUp = read(devUpPath);
for (const snippet of [
  'supabase start',
  'supabase migration up',
  'supabase db reset',
  'supabase db push',
  'DEV_UP_USE_REMOTE_SUPABASE',
  'CK_SUPABASE_TARGET=',
]) {
  if (devUp.includes(snippet)) {
    fail(devUpPath, `forbidden Supabase lifecycle/target snippet "${snippet}"`);
  }
}

if (existsSync(join(ROOT, 'scripts/dev/local-supabase.mjs'))) {
  fail('scripts/dev/local-supabase.mjs', 'deleted local/remote Supabase target-switch helper exists');
}

const migrationPath = 'supabase/migrations/20260522090000__prd103_db_core_foundation.sql';
if (!existsSync(join(ROOT, migrationPath))) {
  fail(migrationPath, 'missing PRD 103 DB core foundation migration');
} else {
  const migration = read(migrationPath);

  const requiredTables = ['accounts', 'users', 'account_invitations', 'instances'];
  for (const table of requiredTables) {
    if (!new RegExp(`CREATE TABLE public\\.${table}\\s*\\(`).test(migration)) {
      fail(migrationPath, `missing approved table public.${table}`);
    }
  }

  const forbiddenCreates = [
    'account_members',
    'user_profiles',
    'login_identities',
    'widgets',
    'widget_instances',
    'curated_widget_instances',
    'instance_locale_values',
    'instance_translation_jobs',
  ];
  for (const table of forbiddenCreates) {
    if (new RegExp(`CREATE TABLE public\\.${table}\\s*\\(`).test(migration)) {
      fail(migrationPath, `creates deleted/non-v1 table public.${table}`);
    }
  }

  const accountsBlock = migration.match(/CREATE TABLE public\.accounts \(([\s\S]*?)\n\);/);
  if (!accountsBlock) {
    fail(migrationPath, 'missing accounts table block');
  } else {
    const block = accountsBlock[1];
    for (const column of ['public_id', 'is_platform', 'updated_at', 'name', 'slug', 'website_url', 'l10n_locales', 'l10n_policy']) {
      if (new RegExp(`\\b${column}\\b`).test(block)) {
        fail(migrationPath, `accounts table contains forbidden column ${column}`);
      }
    }
  }

  const usersBlock = migration.match(/CREATE TABLE public\.users \(([\s\S]*?)\n\);/);
  if (!usersBlock) {
    fail(migrationPath, 'missing users table block');
  } else {
    const block = usersBlock[1];
    for (const column of ['active_account_id', 'email_verified', 'phone_verified', 'whatsapp_verified']) {
      if (new RegExp(`\\b${column}\\b`).test(block)) {
        fail(migrationPath, `users table contains forbidden column ${column}`);
      }
    }
  }

  const instancesBlock = migration.match(/CREATE TABLE public\.instances \(([\s\S]*?)\n\);/);
  if (!instancesBlock) {
    fail(migrationPath, 'missing instances table block');
  } else {
    const block = instancesBlock[1];
    for (const column of [
      'display_name',
      'sourceVersion',
      'source_version',
      'widgetCode',
      'widget_code',
      'widget_key',
      'translation_job_id',
      'translation_error',
      'locale_values',
      'generated_artifacts',
    ]) {
      if (new RegExp(`\\b${column}\\b`).test(block)) {
        fail(migrationPath, `instances table contains forbidden column ${column}`);
      }
    }
  }

  if (/status_changed_at[\s\S]{0,80}updated_at/.test(migration)) {
    fail(migrationPath, 'status_changed_at must not be derived from old generic updated_at');
  }
}

if (failures.length) {
  console.error('PRD 103 DB pivot guard failed.');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('PRD 103 DB pivot guard passed.');
