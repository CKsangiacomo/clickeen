import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const roots = [
  'berlin/src',
  'roma/app/api/session',
  'roma/lib/auth',
  'bob/lib/auth',
];

const forbidden = [
  { name: 'Supabase Auth browser/product API', pattern: /supabase\.auth/i },
  { name: 'password login product path', pattern: /password[_ -]?login|\/auth\/login\/password|\/api\/session\/login/i },
  { name: 'PostgREST product token path', pattern: /postgrest/i },
  { name: 'fallback account behavior', pattern: /fallback account|privileged fallback/i },
  { name: 'legacy user id bridge', pattern: /legacyUserId|p_legacy_user_id/i },
  { name: 'Berlin widget ownership', pattern: /widget_instances|publicId|publish state|serve state|l10n overlay|instance inventory/i },
];

const extensions = new Set(['.js', '.jsx', '.mjs', '.ts', '.tsx']);

function extensionOf(file) {
  const dot = file.lastIndexOf('.');
  return dot === -1 ? '' : file.slice(dot);
}

function* walk(path) {
  if (!existsSync(path)) return;
  const info = statSync(path);
  if (info.isFile()) {
    if (extensions.has(extensionOf(path))) yield path;
    return;
  }
  for (const entry of readdirSync(path)) {
    if (entry === 'node_modules' || entry === '.next' || entry === '.wrangler') continue;
    yield* walk(join(path, entry));
  }
}

const failures = [];

for (const root of roots.map((path) => join(repoRoot, path))) {
  for (const file of walk(root)) {
    const source = readFileSync(file, 'utf8');
    for (const rule of forbidden) {
      if (rule.pattern.test(source)) {
        failures.push(`${relative(repoRoot, file)}: ${rule.name}`);
      }
    }
  }
}

if (failures.length) {
  console.error('Berlin auth boundary verification failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Berlin auth boundary verification passed.');
