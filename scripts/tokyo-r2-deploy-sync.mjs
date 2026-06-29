#!/usr/bin/env node
/* eslint-disable no-console */
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(scriptPath), '..');
const envPath = path.join(repoRoot, '.env.local');

const args = new Set(process.argv.slice(2));
const publishRemote = args.has('--remote');
const dryRun = args.has('--dry-run') || !publishRemote;
const jsonOutput = args.has('--json');

if (args.has('--local')) {
  console.error('[tokyo-r2-deploy-sync] Local R2 sync has been retired. Use --dry-run or --remote.');
  process.exit(1);
}

const bucket = process.env.TOKYO_R2_BUCKET || 'tokyo-assets-dev';
const concurrency = Number.parseInt(process.env.TOKYO_R2_DEPLOY_SYNC_CONCURRENCY || '3', 10);
const maxUploadAttempts = Number.parseInt(process.env.TOKYO_R2_DEPLOY_SYNC_ATTEMPTS || '4', 10);

const mappings = [
  { source: 'tokyo/product/widgets', target: 'product/widgets' },
  { source: 'tokyo/product/dieter', target: 'dieter' },
  { source: 'tokyo/roma', target: 'product/roma' },
  { source: 'tokyo/prague', target: 'prague' },
];

const allowedRoots = new Set(['dieter', 'product', 'prague']);
const contentTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'application/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.md', 'text/markdown; charset=utf-8'],
  ['.jpg', 'image/jpeg'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
]);

function loadLocalEnv() {
  if (!fsSync.existsSync(envPath)) return;
  const text = fsSync.readFileSync(envPath, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

function optionalEnv(name) {
  const value = process.env[name]?.trim();
  return value || '';
}

function deployContentType(file) {
  const ext = path.extname(file).toLowerCase();
  const contentType = contentTypes.get(ext);
  if (!contentType) {
    throw new Error(`[tokyo-r2-deploy-sync] Missing content type for "${file}" (${ext || 'no extension'})`);
  }
  return contentType;
}

async function walkFiles(root) {
  const out = [];
  const entries = await fs.readdir(root, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await walkFiles(fullPath)));
      continue;
    }
    if (entry.isFile()) out.push(fullPath);
  }
  return out;
}

function assertCanonicalKey(key) {
  const [root] = key.split('/');
  if (!allowedRoots.has(root)) {
    throw new Error(`[tokyo-r2-deploy-sync] Refusing non-canonical deploy root for key "${key}"`);
  }
  if (key.startsWith('accounts/')) {
    throw new Error(`[tokyo-r2-deploy-sync] Refusing to write account runtime key "${key}"`);
  }
  if (/^(l10n|public|published|widgets)\//.test(key)) {
    throw new Error(`[tokyo-r2-deploy-sync] Refusing stale root key "${key}"`);
  }
}

async function buildBulkEntries() {
  const entries = [];

  for (const mapping of mappings) {
    const sourceRoot = path.join(repoRoot, mapping.source);
    const files = await walkFiles(sourceRoot);

    for (const file of files) {
      const rel = path.relative(sourceRoot, file).replace(/\\/g, '/');
      if (rel.split('/').includes('.locales')) {
        throw new Error(`[tokyo-r2-deploy-sync] Refusing stale Prague .locales deploy metadata: ${file}`);
      }
      const key = path.posix.join(mapping.target, rel);
      assertCanonicalKey(key);
      entries.push({ key, file, contentType: deployContentType(file) });
    }
  }

  entries.sort((a, b) => a.key.localeCompare(b.key));
  return entries;
}

function summarize(entries) {
  const roots = new Map();
  for (const entry of entries) {
    const [root] = entry.key.split('/');
    roots.set(root, (roots.get(root) || 0) + 1);
  }
  const contentTypes = new Map();
  for (const entry of entries) {
    contentTypes.set(entry.contentType, (contentTypes.get(entry.contentType) || 0) + 1);
  }
  return {
    bucket,
    mode: dryRun ? 'dry-run' : 'remote',
    files: entries.length,
    roots: Object.fromEntries([...roots.entries()].sort(([a], [b]) => a.localeCompare(b))),
    contentTypes: Object.fromEntries([...contentTypes.entries()].sort(([a], [b]) => a.localeCompare(b))),
  };
}

function encodeKeyPath(key) {
  return key.split('/').map((part) => encodeURIComponent(part)).join('/');
}

function hashHex(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function hmac(key, value, encoding) {
  return crypto.createHmac('sha256', key).update(value).digest(encoding);
}

function formatR2SigningDate(date) {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, '');
}

function getSigningKey(secretAccessKey, dateStamp) {
  // Cloudflare R2 signed requests require these wire-compatible signing strings.
  // This is protocol signing, not a product storage dependency.
  const kDate = hmac(`AWS4${secretAccessKey}`, dateStamp);
  const kRegion = hmac(kDate, 'auto');
  const kService = hmac(kRegion, 's3');
  return hmac(kService, 'aws4_request');
}

async function putObjectViaR2SignedApi(entry, config) {
  const body = await fs.readFile(entry.file);
  const endpoint = new URL(config.endpoint);
  const pathname = `/${encodeURIComponent(config.bucket)}/${encodeKeyPath(entry.key)}`;
  const now = new Date();
  const signingDate = formatR2SigningDate(now);
  const dateStamp = signingDate.slice(0, 8);
  const payloadHash = hashHex(body);
  const canonicalHeaders = `content-type:${entry.contentType}\nhost:${endpoint.host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${signingDate}\n`;
  const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date';
  const canonicalRequest = ['PUT', pathname, '', canonicalHeaders, signedHeaders, payloadHash].join('\n');
  const credentialScope = `${dateStamp}/auto/s3/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', signingDate, credentialScope, hashHex(canonicalRequest)].join('\n');
  const signingKey = getSigningKey(config.secretAccessKey, dateStamp);
  const signature = hmac(signingKey, stringToSign, 'hex');

  const response = await fetch(`${endpoint.origin}${pathname}`, {
    method: 'PUT',
    headers: {
      Authorization: `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
      'content-type': entry.contentType,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': signingDate,
    },
    body,
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`R2 signed put failed for ${entry.key}: ${response.status} ${text || response.statusText}`);
  }
}

function isR2SignedWriteDenied(error) {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('AccessDenied') || (message.includes('R2 signed put failed for') && message.includes(': 403 '));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function uploadWithRetry(entry, upload) {
  const attempts = Number.isFinite(maxUploadAttempts) && maxUploadAttempts > 0 ? maxUploadAttempts : 4;
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await upload(entry);
      return;
    } catch (error) {
      lastError = error;
      if (attempt === attempts) break;
      const delayMs = 500 * attempt;
      console.log(`[tokyo-r2-deploy-sync] Retry ${attempt}/${attempts - 1} for ${entry.key} after ${delayMs}ms`);
      await sleep(delayMs);
    }
  }
  throw lastError;
}

function runWranglerPut(entry) {
  return new Promise((resolve, reject) => {
    const wranglerArgs = [
      '-C',
      'tokyo-worker',
      'exec',
      'wrangler',
      'r2',
      'object',
      'put',
      `${bucket}/${entry.key}`,
      '--file',
      entry.file,
      '--remote',
      '--content-type',
      entry.contentType,
    ];

    const env = { ...process.env };
    if (env.GITHUB_ACTIONS !== 'true') {
      delete env.CLOUDFLARE_API_TOKEN;
      delete env.CF_API_TOKEN;
    }
    const child = spawn('pnpm', wranglerArgs, {
      cwd: repoRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
      env,
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk);
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`Wrangler put failed for ${entry.key} (exit ${code}): ${stderr || stdout}`));
    });
  });
}

function getR2Config() {
  loadLocalEnv();
  const accountId = optionalEnv('CLOUDFLARE_ACCOUNT_ID');
  const endpoint = optionalEnv('CLOUDFLARE_R2_ENDPOINT') || (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : '');
  const accessKeyId = optionalEnv('CLOUDFLARE_R2_ACCESS_KEY_ID');
  const secretAccessKey = optionalEnv('CLOUDFLARE_R2_SECRET_ACCESS_KEY');
  if (!endpoint || !accessKeyId || !secretAccessKey) return null;
  return { endpoint, accessKeyId, secretAccessKey, bucket };
}

async function buildUploader(entries) {
  const config = getR2Config();
  if (!config) {
    return {
      mode: 'wrangler-object-put',
      uploaded: 0,
      upload: runWranglerPut,
    };
  }

  if (!entries[0]) {
    return {
      mode: 'r2-signed-api',
      uploaded: 0,
      upload: (entry) => putObjectViaR2SignedApi(entry, config),
    };
  }

  try {
    await putObjectViaR2SignedApi(entries[0], config);
    return {
      mode: 'r2-signed-api',
      uploaded: 1,
      upload: (entry) => putObjectViaR2SignedApi(entry, config),
    };
  } catch (error) {
    if (!isR2SignedWriteDenied(error)) throw error;
    console.log('[tokyo-r2-deploy-sync] R2 signed write denied; using Wrangler object put with explicit content type.');
    await uploadWithRetry(entries[0], runWranglerPut);
    return {
      mode: 'wrangler-object-put',
      uploaded: 1,
      upload: runWranglerPut,
    };
  }
}

async function uploadEntries(entries) {
  const width = Number.isFinite(concurrency) && concurrency > 0 ? concurrency : 20;
  const uploader = await buildUploader(entries);
  console.log(`[tokyo-r2-deploy-sync] Writer: ${uploader.mode} content-type=explicit concurrency=${width}`);
  let index = uploader.uploaded;
  let uploaded = uploader.uploaded;

  async function worker() {
    while (index < entries.length) {
      const current = entries[index];
      index += 1;
      await uploadWithRetry(current, uploader.upload);
      uploaded += 1;
      if (uploaded === entries.length || uploaded % 50 === 0) {
        console.log(`[tokyo-r2-deploy-sync] Uploaded ${uploaded}/${entries.length}`);
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(width, entries.length) }, () => worker()));
}

async function main() {
  const entries = await buildBulkEntries();
  const summary = summarize(entries);

  if (jsonOutput) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    console.log(
      `[tokyo-r2-deploy-sync] ${dryRun ? 'Would upload' : 'Uploading'} ${entries.length} files to ${bucket} (${summary.mode}).`,
    );
    console.log(`[tokyo-r2-deploy-sync] Roots: ${Object.entries(summary.roots).map(([root, count]) => `${root}/=${count}`).join(', ')}`);
    console.log(`[tokyo-r2-deploy-sync] Content types: ${Object.entries(summary.contentTypes).map(([type, count]) => `${type}=${count}`).join(', ')}`);
  }

  if (dryRun) return;
  await uploadEntries(entries);
}

main().catch((err) => {
  console.error('[tokyo-r2-deploy-sync] Failed.', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
