#!/usr/bin/env node
/* eslint-disable no-console */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(scriptPath), '..', '..');
const envPath = path.join(repoRoot, '.env.local');

function loadLocalEnv() {
  if (!fs.existsSync(envPath)) return;
  const text = fs.readFileSync(envPath, 'utf8');
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

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}. Add it to .env.local or export it before running this command.`);
  return value;
}

function optionalEnv(name) {
  const value = process.env[name]?.trim();
  return value || '';
}

function encodeKeyPath(key) {
  return key.split('/').map((part) => encodeURIComponent(part)).join('/');
}

function getConfig() {
  loadLocalEnv();
  const accountId = requireEnv('CLOUDFLARE_ACCOUNT_ID');
  const endpoint = optionalEnv('CLOUDFLARE_R2_ENDPOINT') || `https://${accountId}.r2.cloudflarestorage.com`;
  const accessKeyId = optionalEnv('CLOUDFLARE_R2_ACCESS_KEY_ID');
  const secretAccessKey = optionalEnv('CLOUDFLARE_R2_SECRET_ACCESS_KEY');
  const token = optionalEnv('CLOUDFLARE_R2_REST_API_TOKEN');

  return {
    accountId,
    token,
    endpoint,
    accessKeyId,
    secretAccessKey,
    bucket: requireEnv('TOKYO_R2_BUCKET'),
  };
}

async function cfJson(config, url) {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${config.token}`,
      'Content-Type': 'application/json',
    },
  });
  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = { success: false, errors: [{ message: text || response.statusText }] };
  }
  if (!response.ok || body.success === false) {
    const errors = Array.isArray(body.errors) ? body.errors : [];
    const detail = errors.map((entry) => entry.message || JSON.stringify(entry)).join('; ') || response.statusText;
    throw new Error(`Cloudflare API failed ${response.status}: ${detail}`);
  }
  return body;
}

async function verifyToken(config) {
  if (!config.token) {
    throw new Error('Missing CLOUDFLARE_R2_REST_API_TOKEN for R2 REST API verification.');
  }
  const body = await cfJson(config, 'https://api.cloudflare.com/client/v4/user/tokens/verify');
  return body.result ?? {};
}

function hashHex(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function hmac(key, value, encoding) {
  return crypto.createHmac('sha256', key).update(value).digest(encoding);
}

function formatAmzDate(date) {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, '');
}

function getSigningKey(secretAccessKey, dateStamp) {
  const kDate = hmac(`AWS4${secretAccessKey}`, dateStamp);
  const kRegion = hmac(kDate, 'auto');
  const kService = hmac(kRegion, 's3');
  return hmac(kService, 'aws4_request');
}

function escapeXml(value) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function readXmlTag(text, tag) {
  const match = text.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
  return match ? escapeXml(match[1]) : '';
}

function parseListObjectsXml(xml) {
  const objects = [];
  const contentMatches = xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g);
  for (const match of contentMatches) {
    const block = match[1];
    objects.push({
      key: readXmlTag(block, 'Key'),
      size: readXmlTag(block, 'Size'),
      lastModified: readXmlTag(block, 'LastModified'),
    });
  }
  return {
    objects,
    nextContinuationToken: readXmlTag(xml, 'NextContinuationToken'),
  };
}

async function s3Request(config, method, key, searchParams = new URLSearchParams(), body = '', contentType = '') {
  if (!config.accessKeyId || !config.secretAccessKey) {
    throw new Error('Missing CLOUDFLARE_R2_ACCESS_KEY_ID or CLOUDFLARE_R2_SECRET_ACCESS_KEY for R2 S3 access.');
  }

  const endpoint = new URL(config.endpoint);
  const pathname = `/${encodeURIComponent(config.bucket)}${key ? `/${encodeKeyPath(key)}` : ''}`;
  const canonicalQuery = new URLSearchParams([...searchParams.entries()].sort(([left], [right]) => left.localeCompare(right))).toString();
  const url = `${endpoint.origin}${pathname}${canonicalQuery ? `?${canonicalQuery}` : ''}`;
  const now = new Date();
  const amzDate = formatAmzDate(now);
  const dateStamp = amzDate.slice(0, 8);
  const payload = typeof body === 'string' ? body : '';
  const payloadHash = hashHex(payload);
  const contentTypeHeader = contentType ? `content-type:${contentType}\n` : '';
  const canonicalHeaders = `${contentTypeHeader}host:${endpoint.host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = `${contentType ? 'content-type;' : ''}host;x-amz-content-sha256;x-amz-date`;
  const canonicalRequest = [method, pathname, canonicalQuery, canonicalHeaders, signedHeaders, payloadHash].join('\n');
  const credentialScope = `${dateStamp}/auto/s3/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, credentialScope, hashHex(canonicalRequest)].join('\n');
  const signingKey = getSigningKey(config.secretAccessKey, dateStamp);
  const signature = hmac(signingKey, stringToSign, 'hex');

  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
      ...(contentType ? { 'content-type': contentType } : {}),
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
    },
    ...(method === 'PUT' ? { body: payload } : {}),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Cloudflare R2 S3 failed ${response.status}: ${text || response.statusText}`);
  }
  return text;
}

async function listObjectsS3(config, prefix, limit) {
  const objects = [];
  let continuationToken = '';
  do {
    const params = new URLSearchParams();
    params.set('list-type', '2');
    params.set('max-keys', String(Math.min(Math.max(limit || 1000, 1), 1000)));
    if (prefix) params.set('prefix', prefix);
    if (continuationToken) params.set('continuation-token', continuationToken);
    const xml = await s3Request(config, 'GET', '', params);
    const parsed = parseListObjectsXml(xml);
    objects.push(...parsed.objects);
    continuationToken = parsed.nextContinuationToken;
  } while (continuationToken && objects.length < limit);
  return objects.slice(0, limit);
}

async function getObjectS3(config, key) {
  return s3Request(config, 'GET', key);
}

async function putObjectS3(config, key, body, contentType) {
  await s3Request(config, 'PUT', key, new URLSearchParams(), body, contentType);
}

async function listObjectsRest(config, prefix, limit) {
  if (!config.token) {
    throw new Error('Missing CLOUDFLARE_R2_REST_API_TOKEN for REST R2 access.');
  }
  const objects = [];
  let cursor = '';
  do {
    const url = new URL(`https://api.cloudflare.com/client/v4/accounts/${config.accountId}/r2/buckets/${config.bucket}/objects`);
    if (prefix) url.searchParams.set('prefix', prefix);
    url.searchParams.set('per_page', String(Math.min(Math.max(limit || 1000, 1), 1000)));
    if (cursor) url.searchParams.set('cursor', cursor);
    const body = await cfJson(config, url.toString());
    const result = body.result;
    const pageObjects = Array.isArray(result) ? result : Array.isArray(result?.objects) ? result.objects : [];
    objects.push(...pageObjects);
    cursor = typeof result?.cursor === 'string' ? result.cursor : typeof body.result_info?.cursor === 'string' ? body.result_info.cursor : '';
  } while (cursor && objects.length < limit);
  return objects.slice(0, limit);
}

async function getObjectRest(config, key) {
  if (!config.token) {
    throw new Error('Missing CLOUDFLARE_R2_REST_API_TOKEN for REST R2 access.');
  }
  const url = `https://api.cloudflare.com/client/v4/accounts/${config.accountId}/r2/buckets/${config.bucket}/objects/${encodeKeyPath(key)}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${config.token}`,
    },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Cloudflare R2 get failed ${response.status}: ${text || response.statusText}`);
  }
  return response.text();
}

async function putObjectRest() {
  throw new Error('R2 REST put is not supported by this helper. Add CLOUDFLARE_R2_ACCESS_KEY_ID and CLOUDFLARE_R2_SECRET_ACCESS_KEY.');
}

function putObjectWrangler(config, key, body, contentType) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ck-r2-wrangler-put-'));
  const file = path.join(dir, 'body');
  try {
    fs.writeFileSync(file, body);
    const args = [
      '--filter',
      '@clickeen/tokyo-worker',
      'exec',
      'wrangler',
      'r2',
      'object',
      'put',
      `${config.bucket}/${key}`,
      '--file',
      file,
      '--remote',
    ];
    if (contentType) args.push('--content-type', contentType);
    const env = { ...process.env };
    delete env.CLOUDFLARE_API_TOKEN;
    delete env.CF_API_TOKEN;
    execFileSync('pnpm', args, { cwd: repoRoot, stdio: 'pipe', env });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function isS3WriteDenied(error) {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('AccessDenied') || message.includes('Cloudflare R2 S3 failed 403');
}

function hasS3Credentials(config) {
  return Boolean(config.accessKeyId && config.secretAccessKey);
}

async function listObjects(config, prefix, limit) {
  return hasS3Credentials(config) ? listObjectsS3(config, prefix, limit) : listObjectsRest(config, prefix, limit);
}

async function getObject(config, key) {
  return hasS3Credentials(config) ? getObjectS3(config, key) : getObjectRest(config, key);
}

async function putObject(config, key, body, contentType) {
  if (hasS3Credentials(config)) {
    try {
      await putObjectS3(config, key, body, contentType);
      return;
    } catch (error) {
      if (!isS3WriteDenied(error)) throw error;
      console.error('[cf:r2] S3 put denied; falling back to remote Wrangler R2 object put.');
    }
  }
  if (config.token || !hasS3Credentials(config)) {
    putObjectWrangler(config, key, body, contentType);
    return;
  }
  await putObjectRest(config, key, body, contentType);
}

function parseLimit(args, fallback = 100) {
  const index = args.indexOf('--limit');
  if (index < 0) return fallback;
  const value = Number.parseInt(args[index + 1] || '', 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function parseContentType(args, fallback = 'application/octet-stream') {
  const index = args.indexOf('--content-type');
  if (index < 0) return fallback;
  const value = args[index + 1]?.trim();
  return value || fallback;
}

function printUsage() {
  console.error(`Usage:
	  pnpm cf:preflight
	  pnpm cf:r2:ls <prefix> [--limit 100]
	  pnpm cf:r2:get <key>
	  pnpm cf:r2:put <key> <local-file> [--content-type application/json]

Required env, loaded from .env.local if not exported:
  CLOUDFLARE_ACCOUNT_ID
  TOKYO_R2_BUCKET

Preferred R2 object auth:
  CLOUDFLARE_R2_ACCESS_KEY_ID
  CLOUDFLARE_R2_SECRET_ACCESS_KEY
  CLOUDFLARE_R2_ENDPOINT (optional; defaults from account id)

REST fallback auth:
  CLOUDFLARE_R2_REST_API_TOKEN`);
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (!command || command === '--help' || command === '-h') {
    printUsage();
    process.exit(command ? 0 : 1);
  }

  const config = getConfig();

  if (command === 'preflight') {
    console.log(`[cf:preflight] account=${config.accountId}`);
    console.log(`[cf:preflight] bucket=${config.bucket}`);
    if (hasS3Credentials(config)) {
      console.log(`[cf:preflight] r2 s3 credentials=present accessKeyLength=${config.accessKeyId.length}`);
    } else {
      console.log(`[cf:preflight] rest token=present length=${config.token.length}`);
      await verifyToken(config);
      console.log('[cf:preflight] token verify ok');
    }
    const listed = await listObjects(config, 'accounts/', 1);
    console.log(`[cf:preflight] list accounts/ ok (${listed.length} object${listed.length === 1 ? '' : 's'} sampled)`);
    const faqSpec = await getObject(config, 'product/widgets/faq/spec.json');
    JSON.parse(faqSpec);
    console.log('[cf:preflight] get product/widgets/faq/spec.json ok');
    return;
  }

  if (command === 'ls') {
    const prefix = args.find((arg) => !arg.startsWith('--')) || '';
    const limit = parseLimit(args, 100);
    const objects = await listObjects(config, prefix, limit);
    for (const object of objects) {
      const key = object.key ?? object.name ?? object.objectKey ?? '';
      const size = object.size ?? object.uploadedSize ?? '';
      const uploaded = object.uploaded ?? object.modified ?? object.lastModified ?? '';
      console.log([key, size, uploaded].filter((value) => value !== '').join('\t'));
    }
    return;
  }

  if (command === 'get') {
    const key = args.find((arg) => !arg.startsWith('--')) || '';
    if (!key) throw new Error('Missing object key.');
    process.stdout.write(await getObject(config, key));
    return;
  }

  if (command === 'put') {
    const positional = args.filter((arg) => !arg.startsWith('--'));
    const key = positional[0] || '';
    const localFile = positional[1] || '';
    if (!key) throw new Error('Missing object key.');
    if (!localFile) throw new Error('Missing local file.');
    const body = fs.readFileSync(path.resolve(process.cwd(), localFile), 'utf8');
    await putObject(config, key, body, parseContentType(args));
    console.log(`[cf:r2] wrote ${key}`);
    return;
  }

  printUsage();
  throw new Error(`Unknown command: ${command}`);
}

main().catch((error) => {
  console.error(`[cf:r2] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
