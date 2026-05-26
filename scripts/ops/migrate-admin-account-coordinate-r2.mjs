#!/usr/bin/env node
import { createHash, createHmac } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const DEFAULT_BUCKET = process.env.TOKYO_R2_BUCKET || 'tokyo-assets-dev';
const DEFAULT_SOURCE_ACCOUNT = '00000001';
const DEFAULT_TARGET_ACCOUNT = 'CLICKEEN';

function printHelp() {
  console.log(`Usage:
  node scripts/ops/migrate-admin-account-coordinate-r2.mjs [options]

Purpose:
  Copy and verify Clickeen admin runtime R2 keys from accounts/00000001/ to accounts/CLICKEEN/.
  The default mode is dry-run. Delete/tombstone modes are intentionally explicit.

Options:
  --bucket <name>            R2 bucket name. Defaults to TOKYO_R2_BUCKET or ${DEFAULT_BUCKET}
  --source-account <id>      Source compact account id. Defaults to ${DEFAULT_SOURCE_ACCOUNT}
  --target-account <id>      Target compact account id. Defaults to ${DEFAULT_TARGET_ACCOUNT}
  --manifest <path>          Write JSON evidence manifest to this path
  --remote                   Use the remote R2 S3-compatible API
  --copy                     Copy source keys to the target prefix
  --verify                   Verify source and target key inventories match
  --delete-old               Delete old source keys after a successful verify
  --tombstone-old            Write a tombstone marker under the old prefix after verify and old-key deletion
  --force                    Required with --delete-old
  --help                     Show this help

Examples:
  node scripts/ops/migrate-admin-account-coordinate-r2.mjs --remote --manifest /tmp/prd104a-r2.json
  node scripts/ops/migrate-admin-account-coordinate-r2.mjs --remote --copy --verify --manifest /tmp/prd104a-r2.json
  node scripts/ops/migrate-admin-account-coordinate-r2.mjs --remote --verify --delete-old --force --tombstone-old --manifest /tmp/prd104a-r2.json
`);
}

function parseArgs(argv) {
  const args = {
    bucket: DEFAULT_BUCKET,
    sourceAccount: DEFAULT_SOURCE_ACCOUNT,
    targetAccount: DEFAULT_TARGET_ACCOUNT,
    manifest: null,
    remote: false,
    copy: false,
    verify: false,
    deleteOld: false,
    tombstoneOld: false,
    force: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
    if (arg === '--bucket') args.bucket = requireValue(argv, ++index, arg);
    else if (arg === '--source-account') args.sourceAccount = requireValue(argv, ++index, arg);
    else if (arg === '--target-account') args.targetAccount = requireValue(argv, ++index, arg);
    else if (arg === '--manifest') args.manifest = requireValue(argv, ++index, arg);
    else if (arg === '--remote') args.remote = true;
    else if (arg === '--copy') args.copy = true;
    else if (arg === '--verify') args.verify = true;
    else if (arg === '--delete-old') args.deleteOld = true;
    else if (arg === '--tombstone-old') args.tombstoneOld = true;
    else if (arg === '--force') args.force = true;
    else throw new Error(`Unknown option: ${arg}`);
  }
  if ((args.copy || args.verify || args.deleteOld || args.tombstoneOld) && !args.remote) {
    throw new Error('Mutation/verification modes require --remote so the storage target is explicit.');
  }
  if (args.deleteOld && !args.force) {
    throw new Error('--delete-old requires --force.');
  }
  if (args.tombstoneOld && !args.deleteOld) {
    throw new Error('--tombstone-old is only allowed together with --delete-old --force so old public objects cannot remain servable.');
  }
  if (!/^[0-9A-Z]{8}$/.test(args.sourceAccount) || !/^[0-9A-Z]{8}$/.test(args.targetAccount)) {
    throw new Error('Account ids must be 8-character uppercase compact account coordinates.');
  }
  if (args.sourceAccount === args.targetAccount) {
    throw new Error('Source and target accounts must differ.');
  }
  return args;
}

function requireValue(argv, index, flag) {
  const value = argv[index];
  if (!value || value.startsWith('--')) {
    throw new Error(`${flag} requires a value.`);
  }
  return value;
}

function requireRemoteConfig() {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID || process.env.CF_ACCOUNT_ID || process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY;
  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error('Remote R2 mode requires CLOUDFLARE_ACCOUNT_ID, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY.');
  }
  return {
    accountId,
    accessKeyId,
    secretAccessKey,
    region: 'auto',
    service: 's3',
    host: `${accountId}.r2.cloudflarestorage.com`,
  };
}

function encodePathSegment(value) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

function encodeObjectPath(bucket, key = '') {
  const parts = [bucket, ...key.split('/').filter(Boolean)];
  return `/${parts.map(encodePathSegment).join('/')}`;
}

function encodeQuery(value) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

function canonicalQuery(params) {
  return [...params.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${encodeQuery(key)}=${encodeQuery(value)}`)
    .join('&');
}

function hmacSha256(key, value, encoding) {
  return createHmac('sha256', key).update(value).digest(encoding);
}

function signingKey(secretAccessKey, date, region, service) {
  const kDate = hmacSha256(`AWS4${secretAccessKey}`, date);
  const kRegion = hmacSha256(kDate, region);
  const kService = hmacSha256(kRegion, service);
  return hmacSha256(kService, 'aws4_request');
}

function hashHex(value) {
  return createHash('sha256').update(value).digest('hex');
}

function amzTimestamp(date) {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, '');
}

function signR2Request(config, args) {
  const now = new Date();
  const amzDate = amzTimestamp(now);
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = hashHex(args.body ?? '');
  const query = canonicalQuery(args.query ?? new URLSearchParams());
  const headers = {
    host: config.host,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate,
    ...args.headers,
  };
  const signedHeaders = Object.keys(headers).map((key) => key.toLowerCase()).sort();
  const canonicalHeaders = signedHeaders.map((key) => `${key}:${headers[key] ?? headers[key.toLowerCase()]}`).join('\n');
  const canonicalRequest = [
    args.method,
    args.path,
    query,
    `${canonicalHeaders}\n`,
    signedHeaders.join(';'),
    payloadHash,
  ].join('\n');
  const credentialScope = `${dateStamp}/${config.region}/${config.service}/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    hashHex(canonicalRequest),
  ].join('\n');
  const signature = hmacSha256(
    signingKey(config.secretAccessKey, dateStamp, config.region, config.service),
    stringToSign,
    'hex',
  );
  headers.authorization = `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders.join(';')}, Signature=${signature}`;
  return headers;
}

async function requestR2(config, args) {
  const query = canonicalQuery(args.query ?? new URLSearchParams());
  const url = `https://${config.host}${args.path}${query ? `?${query}` : ''}`;
  const headers = signR2Request(config, args);
  const response = await fetch(url, {
    method: args.method,
    headers,
    body: args.body,
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`R2 ${args.method} ${args.path} failed with HTTP ${response.status}: ${body}`);
  }
  return response;
}

function decodeXml(value) {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function xmlValue(xml, tag) {
  const match = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
  return match ? decodeXml(match[1]) : null;
}

function parseListObjects(xml) {
  const objects = [];
  const contents = xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g);
  for (const match of contents) {
    const content = match[1];
    const key = xmlValue(content, 'Key');
    if (!key) continue;
    objects.push({
      key,
      size: Number(xmlValue(content, 'Size') ?? Number.NaN),
      etag: xmlValue(content, 'ETag')?.replace(/^"|"$/g, '') ?? null,
    });
  }
  return {
    objects: objects.map((object) => ({
      ...object,
      size: Number.isFinite(object.size) ? object.size : null,
    })),
    isTruncated: xmlValue(xml, 'IsTruncated') === 'true',
    nextContinuationToken: xmlValue(xml, 'NextContinuationToken'),
  };
}

async function listObjects(config, bucket, prefix) {
  const objects = [];
  let continuationToken = null;
  do {
    const query = new URLSearchParams([
      ['list-type', '2'],
      ['prefix', prefix],
    ]);
    if (continuationToken) query.set('continuation-token', continuationToken);
    const response = await requestR2(config, {
      method: 'GET',
      path: encodeObjectPath(bucket),
      query,
    });
    const parsed = parseListObjects(await response.text());
    objects.push(...parsed.objects);
    continuationToken = parsed.isTruncated ? parsed.nextContinuationToken : null;
  } while (continuationToken);
  return objects.sort((left, right) => left.key.localeCompare(right.key));
}

async function getObject(config, bucket, key) {
  const response = await requestR2(config, {
    method: 'GET',
    path: encodeObjectPath(bucket, key),
  });
  return new Uint8Array(await response.arrayBuffer());
}

async function putObject(config, bucket, key, body) {
  await requestR2(config, {
    method: 'PUT',
    path: encodeObjectPath(bucket, key),
    body,
  });
}

async function deleteObject(config, bucket, key) {
  await requestR2(config, {
    method: 'DELETE',
    path: encodeObjectPath(bucket, key),
  });
}

function destinationKey(key, sourcePrefix, targetPrefix) {
  if (!key.startsWith(sourcePrefix)) {
    throw new Error(`Source key does not start with ${sourcePrefix}: ${key}`);
  }
  return `${targetPrefix}${key.slice(sourcePrefix.length)}`;
}

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

async function copyObject(config, args, sourceKey, targetKey, workdir) {
  const safeName = encodeURIComponent(sourceKey);
  const filePath = join(workdir, safeName);
  const bytes = await getObject(config, args.bucket, sourceKey);
  await writeFile(filePath, bytes);
  const persisted = await readFile(filePath);
  await putObject(config, args.bucket, targetKey, persisted);
  await rm(filePath, { force: true });
  return { sourceKey, targetKey, byteLength: bytes.byteLength, sha256: sha256(bytes) };
}

async function writeTombstone(config, args, sourcePrefix, targetPrefix, workdir) {
  const key = `${sourcePrefix}_PRD104A_TOMBSTONED.json`;
  const filePath = join(workdir, 'prd104a-tombstone.json');
  const body = {
    v: 1,
    reason: 'PRD104A admin account coordinate migrated',
    sourcePrefix,
    targetPrefix,
    createdAt: new Date().toISOString(),
  };
  await writeFile(filePath, `${JSON.stringify(body, null, 2)}\n`, 'utf8');
  await putObject(config, args.bucket, key, await readFile(filePath));
  return key;
}

function compareInventories(sourceObjects, targetObjects, sourcePrefix, targetPrefix) {
  const targetByKey = new Map(targetObjects.map((object) => [object.key, object]));
  const missing = [];
  const sizeMismatches = [];
  for (const sourceObject of sourceObjects) {
    const expectedKey = destinationKey(sourceObject.key, sourcePrefix, targetPrefix);
    const targetObject = targetByKey.get(expectedKey);
    if (!targetObject) {
      missing.push(expectedKey);
      continue;
    }
    if (sourceObject.size !== null && targetObject.size !== null && sourceObject.size !== targetObject.size) {
      sizeMismatches.push({ sourceKey: sourceObject.key, targetKey: expectedKey, sourceSize: sourceObject.size, targetSize: targetObject.size });
    }
  }
  return { ok: missing.length === 0 && sizeMismatches.length === 0, missing, sizeMismatches };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const sourcePrefix = `accounts/${args.sourceAccount}/`;
  const targetPrefix = `accounts/${args.targetAccount}/`;
  const startedAt = new Date().toISOString();
  const mode = args.copy || args.verify || args.deleteOld || args.tombstoneOld ? 'execute' : 'dry-run';
  const evidence = {
    v: 1,
    prd: '104A',
    mode,
    bucket: args.bucket,
    sourcePrefix,
    targetPrefix,
    startedAt,
    sourceObjects: [],
    targetObjects: [],
    copies: [],
    verification: null,
    tombstoneKey: null,
    deletedSourceKeys: [],
  };

  if (mode === 'dry-run' && !args.remote) {
    console.log(JSON.stringify(evidence, null, 2));
    return;
  }

  const workdir = await mkdtemp(join(tmpdir(), 'prd104a-r2-'));
  try {
    const config = requireRemoteConfig();
    evidence.sourceObjects = await listObjects(config, args.bucket, sourcePrefix);
    if (evidence.sourceObjects.length === 0) {
      throw new Error(`No source keys found under ${sourcePrefix}. Stop before changing Supabase.`);
    }

    if (args.copy) {
      for (const sourceObject of evidence.sourceObjects) {
        const targetKey = destinationKey(sourceObject.key, sourcePrefix, targetPrefix);
        evidence.copies.push(await copyObject(config, args, sourceObject.key, targetKey, workdir));
      }
    }

    evidence.targetObjects = await listObjects(config, args.bucket, targetPrefix);

    if (args.verify || args.deleteOld || args.tombstoneOld) {
      evidence.verification = compareInventories(evidence.sourceObjects, evidence.targetObjects, sourcePrefix, targetPrefix);
      if (!evidence.verification.ok) {
        throw new Error(`Verification failed: ${JSON.stringify(evidence.verification)}`);
      }
    }

    if (args.deleteOld) {
      for (const sourceObject of evidence.sourceObjects) {
        await deleteObject(config, args.bucket, sourceObject.key);
        evidence.deletedSourceKeys.push(sourceObject.key);
      }
    }

    if (args.tombstoneOld) {
      evidence.tombstoneKey = await writeTombstone(config, args, sourcePrefix, targetPrefix, workdir);
    }

    evidence.completedAt = new Date().toISOString();
    if (args.manifest) {
      await writeFile(args.manifest, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
    }
    console.log(JSON.stringify(evidence, null, 2));
  } finally {
    await rm(workdir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
