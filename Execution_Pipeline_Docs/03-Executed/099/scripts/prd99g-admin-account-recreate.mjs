#!/usr/bin/env node
/* eslint-disable no-console */
import fs from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import {
  DEFAULT_OVERLAY_EXPERIMENT,
  DEFAULT_OVERLAY_PERSONALIZATION,
  DEFAULT_OVERLAY_VERSION,
  buildOverlayId,
  isCompactAccountPublicId,
  isCompactInstanceId,
  parseOverlayId,
} from '../packages/ck-contracts/src/overlay-identity.ts';
import {
  resolveLanguageOverlayCode,
  resolveWidgetOverlayCode,
} from '../packages/ck-contracts/src/overlay-codebooks.ts';

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(scriptPath), '..');
const evidenceDir = path.join(repoRoot, 'Execution_Pipeline_Docs', '02-Executing', 'evidence');
const manifestPath = path.join(evidenceDir, '099A__r2_inventory_manifest.json');
const planPath = path.join(evidenceDir, '099G__admin_account_recreation_plan.json');
const resultPath = path.join(evidenceDir, '099G__admin_account_recreation_result.json');
const reportPath = path.join(repoRoot, 'Execution_Pipeline_Docs', '02-Executing', '099G__Admin_Account_Recreation_Report.md');

const bucket = process.env.TOKYO_R2_BUCKET || 'tokyo-assets-dev';
const oldAccountId = '00000000-0000-0000-0000-000000000100';
const adminAccountPublicId = '00000001';
const baseOldPrefix = `accounts/${oldAccountId}/widgets`;
const targetPrefix = `accounts/${adminAccountPublicId}/instances`;

const args = new Set(process.argv.slice(2));
const writeRemote = args.has('--remote');
const verifyOnly = args.has('--verify-only');
const dryRun = args.has('--dry-run') || (!writeRemote && !verifyOnly);

const selectedSources = [
  {
    widgetType: 'faq',
    oldInstanceId: 'ins_01KR8R6ZYZBDXE0DT2FB8PB0NN',
    displayName: 'FAQ example',
    reason: 'Primary admin FAQ example with published config, overlays, and SEO/GEO source material.',
  },
  {
    widgetType: 'countdown',
    oldInstanceId: 'ins_01KR8R6ZYTPM6B3CHS8KZ0CEC9',
    displayName: 'Countdown example',
    reason: 'Primary admin countdown example with published config and multilingual overlays.',
  },
  {
    widgetType: 'logoshowcase',
    oldInstanceId: 'ins_01KR8R6ZZ07S5PMJVSRKM4M7K8',
    displayName: 'Logo showcase example',
    reason: 'Primary admin logo showcase example with published config.',
  },
];

function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((item) => (item === undefined ? 'null' : stableStringify(item))).join(',')}]`;
  }
  const parts = [];
  for (const key of Object.keys(value).sort()) {
    const next = value[key];
    if (next === undefined || typeof next === 'function' || typeof next === 'symbol') continue;
    parts.push(`${JSON.stringify(key)}:${stableStringify(next)}`);
  }
  return `{${parts.join(',')}}`;
}

function prettyJson(value) {
  return `${JSON.stringify(JSON.parse(stableStringify(value)), null, 2)}\n`;
}

function jsonFingerprint(value) {
  return createHash('sha256').update(prettyJson(value)).digest('hex');
}

function deterministicInstanceId(oldInstanceId) {
  const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const digest = createHash('sha256').update(`prd99g:${oldInstanceId}`).digest();
  let out = '';
  for (const byte of digest) {
    out += alphabet[byte % alphabet.length];
    if (out.length === 10) break;
  }
  if (!isCompactInstanceId(out)) throw new Error(`failed_to_mint_instance_id:${oldInstanceId}:${out}`);
  return out;
}

function localePolicyFromOld(raw) {
  const baseLocale = typeof raw?.localePolicy?.baseLocale === 'string' ? raw.localePolicy.baseLocale : 'en';
  const ipRaw = raw?.localePolicy?.ip && typeof raw.localePolicy.ip === 'object' ? raw.localePolicy.ip : {};
  const switcherRaw =
    raw?.localePolicy?.switcher && typeof raw.localePolicy.switcher === 'object' ? raw.localePolicy.switcher : {};
  return {
    baseLocale,
    ip: {
      enabled: ipRaw.enabled === true,
      countryToLocale:
        ipRaw.countryToLocale && typeof ipRaw.countryToLocale === 'object' && !Array.isArray(ipRaw.countryToLocale)
          ? ipRaw.countryToLocale
          : {},
    },
    switcher: {
      enabled: switcherRaw.enabled === true,
      ...(typeof switcherRaw.alwaysShowLocale === 'string' && switcherRaw.alwaysShowLocale.trim()
        ? { alwaysShowLocale: switcherRaw.alwaysShowLocale.trim() }
        : {}),
    },
  };
}

function readEnvFile(filePath) {
  if (!existsSync(filePath)) return {};
  const out = {};
  for (const line of readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const index = trimmed.indexOf('=');
    if (index <= 0) continue;
    out[trimmed.slice(0, index)] = trimmed.slice(index + 1).replace(/^['"]|['"]$/g, '');
  }
  return out;
}

function loadManifestKeys() {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  return new Set((manifest.objects || []).map((object) => object.key).filter(Boolean));
}

function runWrangler(wranglerArgs, options = {}) {
  const result = spawnSync('pnpm', ['--filter', '@clickeen/tokyo-worker', 'exec', 'wrangler', ...wranglerArgs], {
    cwd: repoRoot,
    env: process.env,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 20,
  });
  if (result.status !== 0) {
    const detail = [result.stdout, result.stderr].filter(Boolean).join('\n').slice(0, 3000);
    throw new Error(`[prd99g] wrangler failed: ${wranglerArgs.join(' ')}\n${detail}`);
  }
  if (options.quiet !== true) {
    const line = wranglerArgs.join(' ');
    console.log(`[prd99g] wrangler ${line}`);
  }
  return result;
}

async function getObjectJson(key, tmpDir) {
  const file = path.join(tmpDir, `${createHash('sha1').update(key).digest('hex')}.json`);
  runWrangler(['r2', 'object', 'get', `${bucket}/${key}`, '--remote', '--file', file], { quiet: true });
  return JSON.parse(await fs.readFile(file, 'utf8'));
}

async function writeLocalJson(root, key, value) {
  const file = path.join(root, key);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, prettyJson(value), 'utf8');
  return { key, file };
}

function sourcePrefix(source) {
  return `${baseOldPrefix}/${source.widgetType}/${source.oldInstanceId}`;
}

function targetRoot(instanceId) {
  return `${targetPrefix}/${instanceId}`;
}

function overlayValues(oldOverlay) {
  if (oldOverlay?.values && typeof oldOverlay.values === 'object' && !Array.isArray(oldOverlay.values)) {
    return oldOverlay.values;
  }
  if (oldOverlay?.textPack && typeof oldOverlay.textPack === 'object' && !Array.isArray(oldOverlay.textPack)) {
    return oldOverlay.textPack;
  }
  return {};
}

function assertOverlayBelongs(overlayId, instanceId) {
  const parsed = parseOverlayId(overlayId);
  if (!parsed.ok) throw new Error(`overlay_id_invalid:${overlayId}:${parsed.reason}`);
  if (parsed.value.accountPublicId !== adminAccountPublicId || parsed.value.instanceId !== instanceId) {
    throw new Error(`overlay_id_wrong_owner:${overlayId}`);
  }
}

async function buildPlan() {
  if (!isCompactAccountPublicId(adminAccountPublicId)) throw new Error('admin public id is invalid');
  const keys = loadManifestKeys();
  const plan = [];
  for (const source of selectedSources) {
    const widgetCode = resolveWidgetOverlayCode(source.widgetType);
    if (!widgetCode) throw new Error(`unknown widget type:${source.widgetType}`);
    const oldRoot = sourcePrefix(source);
    const instanceId = deterministicInstanceId(source.oldInstanceId);
    const required = ['instance.json', 'config.json', 'publish.json', 'published/config.json'].map((suffix) => `${oldRoot}/${suffix}`);
    const missing = required.filter((key) => !keys.has(key));
    if (missing.length) throw new Error(`selected source is incomplete:${source.widgetType}:${missing.join(',')}`);
    const overlays = [...keys]
      .filter((key) => key.startsWith(`${oldRoot}/overlays/l10n/`) && key.endsWith('/overlay.json'))
      .sort();
    const seoMeta = [...keys]
      .filter((key) => key.startsWith(`${oldRoot}/seo/meta/`) && key.endsWith('.json'))
      .sort();
    plan.push({
      ...source,
      oldRoot,
      instanceId,
      widgetCode,
      targetRoot: targetRoot(instanceId),
      required,
      overlays,
      seoMeta,
    });
  }
  return plan;
}

async function stageInstance(args) {
  const { source, tmpDir, outDir } = args;
  const oldInstance = await getObjectJson(`${source.oldRoot}/instance.json`, tmpDir);
  const oldConfig = await getObjectJson(`${source.oldRoot}/config.json`, tmpDir);
  const oldPublish = await getObjectJson(`${source.oldRoot}/publish.json`, tmpDir);

  const now = new Date().toISOString();
  const configFp = jsonFingerprint(oldConfig);
  const instance = {
    v: 1,
    id: source.instanceId,
    accountId: adminAccountPublicId,
    widgetCode: source.widgetCode,
    widgetType: source.widgetType,
    displayName: source.displayName,
    meta: oldInstance?.meta && typeof oldInstance.meta === 'object' && !Array.isArray(oldInstance.meta) ? oldInstance.meta : null,
    createdAt: typeof oldInstance?.createdAt === 'string' ? oldInstance.createdAt : now,
    updatedAt: now,
    configFp,
  };

  const outputs = [];
  outputs.push(await writeLocalJson(outDir, `${source.targetRoot}/instance.json`, instance));
  outputs.push(await writeLocalJson(outDir, `${source.targetRoot}/config.json`, oldConfig));
  outputs.push(await writeLocalJson(outDir, `${source.targetRoot}/published/config.json`, oldConfig));

  const overlayLanguages = {};
  for (const overlayKey of source.overlays) {
    const locale = overlayKey.match(/\/overlays\/l10n\/([^/]+)\/overlay\.json$/)?.[1] ?? '';
    const languageCode = resolveLanguageOverlayCode(locale);
    if (!languageCode) throw new Error(`unknown overlay locale:${overlayKey}`);
    const overlayId = buildOverlayId({
      accountPublicId: adminAccountPublicId,
      widgetCode: source.widgetCode,
      instanceId: source.instanceId,
      languageCode,
      experiment: DEFAULT_OVERLAY_EXPERIMENT,
      personalization: DEFAULT_OVERLAY_PERSONALIZATION,
      version: DEFAULT_OVERLAY_VERSION,
    });
    assertOverlayBelongs(overlayId, source.instanceId);
    const oldOverlay = await getObjectJson(overlayKey, tmpDir);
    const overlay = { v: 1, values: overlayValues(oldOverlay) };
    outputs.push(await writeLocalJson(outDir, `${source.targetRoot}/overlays/${overlayId}.json`, overlay));
    outputs.push(
      await writeLocalJson(
        outDir,
        `${source.targetRoot}/selected-overlays/${languageCode}/${DEFAULT_OVERLAY_EXPERIMENT}/${DEFAULT_OVERLAY_PERSONALIZATION}.json`,
        { v: 1, overlayId },
      ),
    );
    overlayLanguages[languageCode] = overlayId;
  }

  for (const metaKey of source.seoMeta) {
    const suffix = metaKey.slice(`${source.oldRoot}/seo/meta/`.length);
    const meta = await getObjectJson(metaKey, tmpDir);
    outputs.push(await writeLocalJson(outDir, `${source.targetRoot}/published/seo/meta/${suffix}`, meta));
  }

  const publish = {
    v: 1,
    id: source.instanceId,
    accountId: adminAccountPublicId,
    widgetCode: source.widgetCode,
    widgetType: source.widgetType,
    status: 'published',
    configFp,
    localePolicy: localePolicyFromOld(oldPublish),
    ...(Object.keys(overlayLanguages).length ? { overlays: { languages: overlayLanguages } } : {}),
    ...(oldPublish?.seoGeo === true ? { seoGeo: true } : {}),
    updatedAt: now,
  };
  outputs.push(await writeLocalJson(outDir, `${source.targetRoot}/publish.json`, publish));

  return {
    instance,
    publish,
    outputs,
    overlayCount: Object.keys(overlayLanguages).length,
    seoMetaCount: source.seoMeta.length,
  };
}

async function stageIndex(outDir, staged) {
  const entries = staged
    .map(({ source, result }) => ({
      accountId: adminAccountPublicId,
      id: source.instanceId,
      widgetCode: source.widgetCode,
      widgetType: source.widgetType,
      displayName: source.displayName,
      publishStatus: result.publish.status === 'published' ? 'published' : 'unpublished',
      updatedAt: result.instance.updatedAt,
    }))
    .sort((left, right) => {
      const byWidget = left.widgetType.localeCompare(right.widgetType);
      if (byWidget !== 0) return byWidget;
      return left.id.localeCompare(right.id);
    });
  return writeLocalJson(outDir, `${targetPrefix}/index.json`, {
    v: 1,
    accountId: adminAccountPublicId,
    entries,
    updatedAt: new Date().toISOString(),
  });
}

async function bulkPut(entries, tmpDir) {
  const bulkFile = path.join(tmpDir, 'bulk-put.json');
  await fs.writeFile(bulkFile, `${JSON.stringify(entries.map(({ key, file }) => ({ key, file })), null, 2)}\n`, 'utf8');
  runWrangler([
    'r2',
    'bulk',
    'put',
    bucket,
    '--filename',
    bulkFile,
    '--remote',
    '--concurrency',
    String(process.env.PRD99G_R2_CONCURRENCY || '20'),
  ]);
}

async function verifyRemote(plan, tmpDir) {
  const index = await getObjectJson(`${targetPrefix}/index.json`, tmpDir);
  if (index?.accountId !== adminAccountPublicId || !Array.isArray(index.entries) || index.entries.length !== plan.length) {
    throw new Error('remote index verification failed');
  }
  const checks = [];
  for (const source of plan) {
    const root = source.targetRoot;
    const instance = await getObjectJson(`${root}/instance.json`, tmpDir);
    const publish = await getObjectJson(`${root}/publish.json`, tmpDir);
    const config = await getObjectJson(`${root}/config.json`, tmpDir);
    const publishedConfig = await getObjectJson(`${root}/published/config.json`, tmpDir);
    if (instance?.accountId !== adminAccountPublicId || instance?.id !== source.instanceId || instance?.widgetCode !== source.widgetCode) {
      throw new Error(`remote instance verification failed:${source.instanceId}`);
    }
    if (publish?.accountId !== adminAccountPublicId || publish?.id !== source.instanceId || publish?.widgetCode !== source.widgetCode) {
      throw new Error(`remote publish verification failed:${source.instanceId}`);
    }
    if (!config || !publishedConfig) throw new Error(`remote config verification failed:${source.instanceId}`);
    for (const overlayId of Object.values(publish.overlays?.languages ?? {})) {
      assertOverlayBelongs(overlayId, source.instanceId);
      await getObjectJson(`${root}/overlays/${overlayId}.json`, tmpDir);
    }
    checks.push({
      widgetType: source.widgetType,
      instanceId: source.instanceId,
      status: publish.status,
      overlays: Object.keys(publish.overlays?.languages ?? {}).length,
      seoGeo: publish.seoGeo === true,
    });
  }
  return { indexEntries: index.entries.length, checks };
}

async function smokePublic(plan) {
  const env = readEnvFile(path.join(repoRoot, '.env.local'));
  const tokyoBase = (process.env.TOKYO_PUBLIC_BASE_URL || env.TOKYO_PUBLIC_BASE_URL || 'https://tokyo.dev.clickeen.com').replace(/\/+$/, '');
  if (!tokyoBase) return { skipped: true, reason: 'missing CK_CLOUD_TOKYO_BASE_URL' };
  const checks = [];
  for (const source of plan) {
    const liveUrl = `${tokyoBase}/renders/accounts/${adminAccountPublicId}/instances/${source.instanceId}/live/r.json`;
    const configUrl = `${tokyoBase}/renders/accounts/${adminAccountPublicId}/instances/${source.instanceId}/config.json`;
    const live = await fetch(liveUrl);
    const config = await fetch(configUrl);
    checks.push({
      widgetType: source.widgetType,
      instanceId: source.instanceId,
      liveStatus: live.status,
      configStatus: config.status,
    });
    if (!live.ok || !config.ok) throw new Error(`public Tokyo smoke failed:${source.instanceId}:${live.status}:${config.status}`);
  }
  return { skipped: false, checks };
}

function renderReport(payload) {
  const lines = [
    '# PRD 099G Admin Account Recreation Report',
    '',
    `Generated: ${payload.generatedAt}`,
    `Bucket: ${bucket}`,
    `Admin account public ID: ${adminAccountPublicId}`,
    '',
    '## Selected Admin Instances',
    '',
    '| Widget | Old Source | New Instance | Overlays | SEO/GEO Meta Objects |',
    '| --- | --- | --- | ---: | ---: |',
  ];
  for (const item of payload.instances) {
    lines.push(`| ${item.widgetType} | ${item.oldInstanceId} | ${item.instanceId} | ${item.overlayCount} | ${item.seoMetaCount} |`);
  }
  lines.push(
    '',
    '## Why Only These Three',
    '',
    'PRD99 keeps widget software in `product/widgets/` and keeps account runtime state under `accounts/{accountPublicId}/instances/{instanceId}/`. The recreation therefore creates one normal admin account instance per real product widget and does not preserve the old duplicate account-owned widget lane.',
    '',
    '## Remote Verification',
    '',
    `Index entries verified: ${payload.remoteVerification?.indexEntries ?? 0}`,
    '',
    '## Public Tokyo Smoke',
    '',
  );
  if (payload.publicSmoke?.skipped) {
    lines.push(`Skipped: ${payload.publicSmoke.reason}`);
  } else {
    for (const check of payload.publicSmoke?.checks ?? []) {
      lines.push(`- ${check.widgetType} ${check.instanceId}: live ${check.liveStatus}, config ${check.configStatus}`);
    }
  }
  lines.push('');
  return `${lines.join('\n')}\n`;
}

async function main() {
  const plan = await buildPlan();
  await fs.mkdir(evidenceDir, { recursive: true });
  await fs.writeFile(planPath, prettyJson({ generatedAt: new Date().toISOString(), bucket, plan }), 'utf8');
  console.log(`[prd99g] Planned ${plan.length} admin instances.`);
  for (const item of plan) {
    console.log(`[prd99g] ${item.widgetType}: ${item.oldInstanceId} -> ${item.instanceId}`);
  }
  if (dryRun) return;

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'prd99g-'));
  const outDir = path.join(tmpDir, 'out');
  try {
    let staged = [];
    if (!verifyOnly) {
      for (const source of plan) {
        console.log(`[prd99g] Staging ${source.widgetType} ${source.instanceId}.`);
        const result = await stageInstance({ source, tmpDir, outDir });
        staged.push({ source, result });
      }
      const indexOutput = await stageIndex(outDir, staged);
      const outputs = [...staged.flatMap(({ result }) => result.outputs), indexOutput];
      console.log(`[prd99g] Uploading ${outputs.length} recreated admin account objects.`);
      await bulkPut(outputs, tmpDir);
    }

    const remoteVerification = await verifyRemote(plan, tmpDir);
    const publicSmoke = await smokePublic(plan);
    if (verifyOnly) {
      staged = plan.map((source) => ({
        source,
        result: {
          overlayCount: remoteVerification.checks.find((check) => check.instanceId === source.instanceId)?.overlays ?? 0,
          seoMetaCount: source.seoMeta.length,
        },
      }));
    }

    const result = {
      generatedAt: new Date().toISOString(),
      bucket,
      adminAccountPublicId,
      mode: verifyOnly ? 'verify-only' : 'remote',
      instances: plan.map((source) => {
        const resultForSource = staged.find((entry) => entry.source.instanceId === source.instanceId)?.result;
        return {
          widgetType: source.widgetType,
          oldInstanceId: source.oldInstanceId,
          instanceId: source.instanceId,
          oldRoot: source.oldRoot,
          targetRoot: source.targetRoot,
          overlayCount: resultForSource?.overlayCount ?? 0,
          seoMetaCount: resultForSource?.seoMetaCount ?? source.seoMeta.length,
        };
      }),
      remoteVerification,
      publicSmoke,
    };
    await fs.writeFile(resultPath, prettyJson(result), 'utf8');
    await fs.writeFile(reportPath, renderReport(result), 'utf8');
    console.log(`[prd99g] Wrote ${path.relative(repoRoot, resultPath)}`);
    console.log(`[prd99g] Wrote ${path.relative(repoRoot, reportPath)}`);
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
