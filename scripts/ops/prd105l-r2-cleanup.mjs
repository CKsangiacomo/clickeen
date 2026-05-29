#!/usr/bin/env node
/* eslint-disable no-console */
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(scriptPath), '..', '..');

const DEFAULT_BUCKET = process.env.TOKYO_R2_BUCKET || 'tokyo-assets-dev';
const DEFAULT_ACCOUNT_ID =
  process.env.CLOUDFLARE_ACCOUNT_ID || process.env.CF_ACCOUNT_ID || 'a8528ec394ae2da9e5521d2ddd3aeb87';
const DEFAULT_MANIFEST_DIR = '/tmp/clickeen-105l';
const REQUEST_TIMEOUT_MS = 20_000;
const ACTIVE_ACCOUNT = 'CLICKEEN';
const OLD_ACCOUNT = '00000001';

const deployMappings = [
  { source: 'tokyo/product/widgets', target: 'product/widgets' },
  { source: 'tokyo/product/media', target: 'product/media', optional: true },
  { source: 'tokyo/product/themes', target: 'product/themes', optional: true },
  { source: 'tokyo/product/dieter', target: 'dieter' },
  { source: 'tokyo/product/fonts', target: 'fonts', optional: true },
  { source: 'tokyo/roma', target: 'product/roma', optional: true },
  { source: 'tokyo/prague', target: 'prague' },
];

function printHelp() {
  console.log(`Usage:
  node scripts/ops/prd105l-r2-cleanup.mjs [options]

Options:
  --dry-run                 Build deletion candidates only. Default.
  --delete                  Delete candidates and write a delete manifest.
  --verify                  Build a post-delete verification manifest.
  --bucket <name>           R2 bucket. Defaults to ${DEFAULT_BUCKET}.
  --account-id <id>         Cloudflare account id. Defaults to env or the dev account id.
  --manifest-dir <path>     Output manifest directory. Defaults to ${DEFAULT_MANIFEST_DIR}.
  --help                    Show this help.

The script reads CLOUDFLARE_API_TOKEN first, then falls back to Wrangler OAuth.
`);
}

function parseArgs(argv) {
  const args = {
    mode: 'dry-run',
    bucket: DEFAULT_BUCKET,
    accountId: DEFAULT_ACCOUNT_ID,
    manifestDir: DEFAULT_MANIFEST_DIR,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
    if (arg === '--dry-run') args.mode = 'dry-run';
    else if (arg === '--delete') args.mode = 'delete';
    else if (arg === '--verify') args.mode = 'verify';
    else if (arg === '--bucket') args.bucket = requireValue(argv, ++index, arg);
    else if (arg === '--account-id') args.accountId = requireValue(argv, ++index, arg);
    else if (arg === '--manifest-dir') args.manifestDir = requireValue(argv, ++index, arg);
    else throw new Error(`Unknown option: ${arg}`);
  }
  return args;
}

function requireValue(argv, index, flag) {
  const value = argv[index];
  if (!value || value.startsWith('--')) throw new Error(`${flag} requires a value.`);
  return value;
}

async function readWranglerOAuthToken() {
  const configPath = path.join(os.homedir(), 'Library', 'Preferences', '.wrangler', 'config', 'default.toml');
  const text = await fs.readFile(configPath, 'utf8');
  const match = text.match(/^oauth_token\s*=\s*"([^"]+)"/m);
  return match?.[1] || '';
}

async function readApiToken() {
  if (process.env.CLOUDFLARE_API_TOKEN) return process.env.CLOUDFLARE_API_TOKEN;
  const token = await readWranglerOAuthToken();
  if (!token) throw new Error('Cloudflare token not found in CLOUDFLARE_API_TOKEN or Wrangler OAuth config.');
  return token;
}

async function walkFiles(root) {
  const out = [];
  const entries = await fs.readdir(root, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await walkFiles(fullPath)));
    } else if (entry.isFile()) {
      out.push(fullPath);
    }
  }
  return out;
}

async function buildExpectedDeployKeys() {
  const keys = [];
  const skipped = [];
  for (const mapping of deployMappings) {
    const sourceRoot = path.join(repoRoot, mapping.source);
    let files = [];
    try {
      files = await walkFiles(sourceRoot);
    } catch (error) {
      if (mapping.optional) {
        skipped.push(mapping.source);
        continue;
      }
      throw error;
    }
    for (const file of files) {
      const rel = path.relative(sourceRoot, file).replace(/\\/g, '/');
      keys.push(path.posix.join(mapping.target, rel));
    }
  }
  return { keys: keys.sort(), skipped };
}

async function cloudflareFetch(token, args, request) {
  const url = `https://api.cloudflare.com/client/v4/accounts/${args.accountId}/r2/buckets/${args.bucket}${request.path}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: request.method || 'GET',
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    });
    const text = await response.text();
    const json = text ? JSON.parse(text) : null;
    if (!response.ok || json?.success === false) {
      throw new Error(`Cloudflare R2 ${request.method || 'GET'} ${request.path} failed: HTTP ${response.status} ${text}`);
    }
    return json;
  } finally {
    clearTimeout(timeout);
  }
}

async function listObjects(token, args, prefix) {
  const objects = [];
  let cursor = '';
  do {
    const params = new URLSearchParams({ prefix, per_page: '1000' });
    if (cursor) params.set('cursor', cursor);
    const json = await cloudflareFetch(token, args, { path: `/objects?${params.toString()}` });
    objects.push(...(json.result || []));
    cursor = json.result_info?.cursor || json.result_info?.cursors?.after || '';
  } while (cursor);
  return objects.sort((left, right) => left.key.localeCompare(right.key));
}

function isStaleActiveAccountRuntimeKey(key) {
  if (!key.startsWith(`accounts/${ACTIVE_ACCOUNT}/instances/`)) return false;
  const filename = key.split('/').at(-1) || '';
  if (filename === 'index.html') return false;
  if (filename === 'script.js') return true;
  if (/^script\..+\.js$/.test(filename)) return true;
  if (/^styles\.v.+\.css$/.test(filename)) return true;
  if (/^[a-z]{2}(?:-[A-Z]{2})?\.html$/.test(filename)) return true;
  return [
    'translation-generation-job.json',
    'generation.json',
    'queue.json',
    'status.json',
    'worker-state.json',
    'retry-state.json',
  ].includes(filename);
}

function buildCandidateManifest(args, expectedDeploy, productObjects, accountObjects) {
  const expectedSet = new Set(expectedDeploy.keys);
  const productAbsentFromRepoKeys = productObjects
    .map((object) => object.key)
    .filter((key) => key.startsWith('product/'))
    .filter((key) => !expectedSet.has(key))
    .sort();
  const productStaleKeys = productAbsentFromRepoKeys;

  const accountStaleKeys = accountObjects
    .map((object) => object.key)
    .filter((key) => key.startsWith(`accounts/${OLD_ACCOUNT}/`) || isStaleActiveAccountRuntimeKey(key))
    .sort();

  const canonicalActiveInstanceKeys = accountObjects
    .map((object) => object.key)
    .filter((key) => key.startsWith(`accounts/${ACTIVE_ACCOUNT}/instances/`))
    .filter((key) => {
      const filename = key.split('/').at(-1) || '';
      return ['index.html', 'runtime.js', 'styles.css', 'instance.config.json', 'instance.content.json'].includes(filename)
        || key.includes('/overlays/locales/');
    })
    .sort();

  return {
    v: 1,
    prd: '105L',
    mode: args.mode,
    generatedAt: new Date().toISOString(),
    bucket: args.bucket,
    counts: {
      expectedDeployKeys: expectedDeploy.keys.length,
      remoteProductKeys: productObjects.length,
      remoteAccountKeys: accountObjects.length,
      productStaleKeys: productStaleKeys.length,
      accountStaleKeys: accountStaleKeys.length,
      totalDeleteCandidates: productStaleKeys.length + accountStaleKeys.length,
      canonicalActiveInstanceKeys: canonicalActiveInstanceKeys.length,
    },
    expectedDeploySkippedRoots: expectedDeploy.skipped,
    productStaleKeys,
    accountStaleKeys,
    productAbsentFromRepoKeys,
    canonicalActiveInstanceKeys,
  };
}

async function deleteKey(token, args, key) {
  await cloudflareFetch(token, args, {
    method: 'DELETE',
    path: `/objects/${key.split('/').map(encodeURIComponent).join('/')}`,
  });
}

async function writeManifest(dir, name, manifest) {
  await fs.mkdir(dir, { recursive: true });
  const filePath = path.join(dir, name);
  await fs.writeFile(filePath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  return filePath;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const token = await readApiToken();
  const expectedDeploy = await buildExpectedDeployKeys();
  const [productObjects, accountObjects] = await Promise.all([
    listObjects(token, args, 'product/'),
    listObjects(token, args, 'accounts/'),
  ]);
  const manifest = buildCandidateManifest(args, expectedDeploy, productObjects, accountObjects);

  if (args.mode === 'delete') {
    const deletedKeys = [];
    for (const key of [...manifest.productStaleKeys, ...manifest.accountStaleKeys]) {
      await deleteKey(token, args, key);
      deletedKeys.push(key);
    }
    manifest.deletedAt = new Date().toISOString();
    manifest.deletedKeys = deletedKeys;
    manifest.counts.deletedKeys = deletedKeys.length;
    const filePath = await writeManifest(args.manifestDir, 'prd105l-delete-manifest.json', manifest);
    console.log(`[prd105l-r2-cleanup] Deleted ${deletedKeys.length} keys. Manifest: ${filePath}`);
    return;
  }

  const fileName = args.mode === 'verify' ? 'prd105l-post-delete-manifest.json' : 'prd105l-dry-run.json';
  const filePath = await writeManifest(args.manifestDir, fileName, manifest);
  console.log(JSON.stringify({ manifest: filePath, counts: manifest.counts }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
