#!/usr/bin/env tsx
/* eslint-disable no-console */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { NextRequest } from 'next/server';
import { getCompiledWidgetRouteResponse } from '../../bob/lib/api/compiled-widget-route';
import {
  extractSavedTextFieldsForEditableFields,
  extractTextPrimitiveValuesForEditableFields,
  readWidgetEditableFieldsContract,
} from '../../packages/ck-contracts/src/translated-value-primitives';
import { buildSavedWidgetPublicPackage } from '../../roma/lib/widget-public-package';
import { normalizeAccountWidgetDefaultsDocument } from '../../tokyo-worker/src/domains/account-widget-defaults';

type JsonRecord = Record<string, unknown>;

type WidgetEntry = {
  widgetType: string;
  widgetCode: string;
  instanceId: string;
};

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(scriptPath), '..', '..');
const widgetsRoot = path.join(repoRoot, 'tokyo', 'product', 'widgets');
const accountId = process.env.CK_106_ACCOUNT_ID || 'CLICKEEN';
const apply = process.argv.includes('--apply');

const widgets: WidgetEntry[] = [
  { widgetType: 'big-bang', widgetCode: 'BBG', instanceId: 'QD1G068MX7' },
  { widgetType: 'calltoaction', widgetCode: 'CTA', instanceId: 'SZBSB5HHFJ' },
  { widgetType: 'cards', widgetCode: 'CRD', instanceId: 'U37WRSMY7J' },
  { widgetType: 'countdown', widgetCode: 'CNT', instanceId: 'H7IF9M2K9B' },
  { widgetType: 'faq', widgetCode: 'FAQ', instanceId: 'UZ3JEJSHII' },
  { widgetType: 'logoshowcase', widgetCode: 'LOG', instanceId: '8FMVZFFPJV' },
  { widgetType: 'split', widgetCode: 'SPL', instanceId: 'KUGYTX2ZMQ' },
];

const shellTopLevelKeys = ['header', 'headerCta', 'stage', 'pod', 'coreSize', 'localeSwitcher'] as const;
const shellAppearanceKeys = [
  'headerCta',
  'localeSwitcherBackground',
  'localeSwitcherTextColor',
  'localeSwitcherBorder',
  'localeSwitcherRadius',
  'localeSwitcherPaddingInline',
  'localeSwitcherPaddingBlock',
  'podBorder',
] as const;
const shellTypographyRoles = ['title', 'body', 'button', 'localeSwitcher'] as const;
const socialChannels = [
  'copy',
  'sms',
  'email',
  'whatsapp',
  'telegram',
  'signal',
  'messenger',
  'wechat',
  'line',
  'slack',
  'teams',
  'discord',
  'x',
  'linkedin',
  'facebook',
  'reddit',
  'instagram',
  'tiktok',
] as const;

function loadLocalEnv() {
  const envPath = path.join(repoRoot, '.env.local');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
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

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function mergeRecords(base: JsonRecord, override: JsonRecord): JsonRecord {
  const next = clone(base);
  for (const [key, value] of Object.entries(override)) {
    const existing = next[key];
    if (isRecord(existing) && isRecord(value)) {
      next[key] = mergeRecords(existing, value);
    } else if (typeof value !== 'undefined') {
      next[key] = clone(value);
    }
  }
  return next;
}

function getPath(root: unknown, pathValue: string): unknown {
  let cursor = root;
  for (const part of pathValue.split('.').filter(Boolean)) {
    if (/^\d+$/.test(part)) {
      if (!Array.isArray(cursor)) return undefined;
      cursor = cursor[Number(part)];
      continue;
    }
    if (!isRecord(cursor)) return undefined;
    cursor = cursor[part];
  }
  return cursor;
}

function setPath(root: JsonRecord, pathValue: string, value: unknown): void {
  const parts = pathValue.split('.').filter(Boolean);
  let cursor: unknown = root;
  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index]!;
    const last = index === parts.length - 1;
    const nextPart = parts[index + 1];
    if (/^\d+$/.test(part)) {
      if (!Array.isArray(cursor)) return;
      const offset = Number(part);
      if (last) {
        cursor[offset] = clone(value);
        return;
      }
      if (!isRecord(cursor[offset]) && !Array.isArray(cursor[offset])) {
        cursor[offset] = /^\d+$/.test(nextPart ?? '') ? [] : {};
      }
      cursor = cursor[offset];
      continue;
    }
    if (!isRecord(cursor)) return;
    if (last) {
      cursor[part] = clone(value);
      return;
    }
    if (!isRecord(cursor[part]) && !Array.isArray(cursor[part])) {
      cursor[part] = /^\d+$/.test(nextPart ?? '') ? [] : {};
    }
    cursor = cursor[part];
  }
}

function deletePath(root: JsonRecord, pathValue: string): void {
  const parts = pathValue.split('.').filter(Boolean);
  let cursor: unknown = root;
  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index]!;
    const last = index === parts.length - 1;
    if (/^\d+$/.test(part)) {
      if (!Array.isArray(cursor)) return;
      const offset = Number(part);
      if (last) return;
      cursor = cursor[offset];
      continue;
    }
    if (!isRecord(cursor) || !Object.prototype.hasOwnProperty.call(cursor, part)) return;
    if (last) {
      delete cursor[part];
      return;
    }
    cursor = cursor[part];
  }
}

function moveObject(root: JsonRecord, fromPath: string, toPath: string): void {
  const source = getPath(root, fromPath);
  if (!isRecord(source)) {
    deletePath(root, fromPath);
    return;
  }
  const target = getPath(root, toPath);
  setPath(root, toPath, isRecord(target) ? mergeRecords(target, source) : source);
  deletePath(root, fromPath);
}

function moveValue(root: JsonRecord, fromPath: string, toPath: string): void {
  const value = getPath(root, fromPath);
  if (typeof value === 'undefined') return;
  setPath(root, toPath, value);
  deletePath(root, fromPath);
}

function r2GetJson<T>(key: string): T {
  const text = execFileSync('node', ['scripts/cloudflare/r2.mjs', 'get', key], {
    cwd: repoRoot,
    encoding: 'utf8',
    maxBuffer: 80 * 1024 * 1024,
  });
  return JSON.parse(text) as T;
}

function r2GetText(key: string): string {
  return execFileSync('node', ['scripts/cloudflare/r2.mjs', 'get', key], {
    cwd: repoRoot,
    encoding: 'utf8',
    maxBuffer: 80 * 1024 * 1024,
  });
}

function installCompilerFetchShim() {
  const realFetch = globalThis.fetch.bind(globalThis);
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const rawUrl = typeof input === 'string' || input instanceof URL ? String(input) : input.url;
    let parsed: URL | null = null;
    try {
      parsed = new URL(rawUrl);
    } catch {
      parsed = null;
    }
    const pathname = parsed?.pathname ?? '';
    if (pathname.startsWith('/dieter/')) {
      const key = pathname.replace(/^\/+/, '');
      try {
        const body = r2GetText(key);
        const contentType =
          key.endsWith('.json')
            ? 'application/json'
            : key.endsWith('.html')
              ? 'text/html'
              : key.endsWith('.css')
                ? 'text/css'
                : key.endsWith('.js')
                  ? 'text/javascript'
                  : 'text/plain';
        return new Response(body, { status: 200, headers: { 'content-type': contentType } });
      } catch {
        return new Response('Not found', { status: 404 });
      }
    }
    if (pathname.startsWith('/widgets/')) {
      const key = `product/widgets/${pathname.replace(/^\/widgets\/+/, '')}`;
      try {
        const body = r2GetText(key);
        const contentType =
          key.endsWith('.json')
            ? 'application/json'
            : key.endsWith('.html')
              ? 'text/html'
              : key.endsWith('.css')
                ? 'text/css'
                : key.endsWith('.js')
                  ? 'text/javascript'
                  : 'text/plain';
        return new Response(body, {
          status: 200,
          headers: {
            'content-type': contentType,
            etag: `"${Buffer.from(key).toString('base64url')}"`,
          },
        });
      } catch {
        return new Response('Not found', { status: 404 });
      }
    }
    return realFetch(input as Parameters<typeof fetch>[0], init);
  }) as typeof fetch;
}

function r2PutText(key: string, body: string, contentType: string): void {
  if (!apply) return;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ck-r2-put-'));
  const file = path.join(dir, 'body');
  try {
    fs.writeFileSync(file, body);
    execFileSync('node', ['scripts/cloudflare/r2.mjs', 'put', key, file, '--content-type', contentType], {
      cwd: repoRoot,
      stdio: 'pipe',
    });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function loadSpec(widgetType: string): JsonRecord {
  return JSON.parse(fs.readFileSync(path.join(widgetsRoot, widgetType, 'spec.json'), 'utf8')) as JsonRecord;
}

function loadEditableFields(widgetType: string) {
  return readWidgetEditableFieldsContract(
    JSON.parse(fs.readFileSync(path.join(widgetsRoot, widgetType, 'editable-fields.json'), 'utf8')),
  );
}

function shellFromState(base: JsonRecord, state: JsonRecord): JsonRecord {
  const shell: JsonRecord = {};
  for (const key of shellTopLevelKeys) {
    const baseValue = base[key];
    const stateValue = state[key];
    if (isRecord(baseValue) || isRecord(stateValue)) {
      shell[key] = mergeRecords(isRecord(baseValue) ? baseValue : {}, isRecord(stateValue) ? stateValue : {});
    }
  }

  const baseAppearance = isRecord(base.appearance) ? base.appearance : {};
  const stateAppearance = isRecord(state.appearance) ? state.appearance : {};
  shell.appearance = {};
  for (const key of shellAppearanceKeys) {
    const baseValue = baseAppearance[key];
    const stateValue = stateAppearance[key];
    if (isRecord(baseValue) || isRecord(stateValue)) {
      (shell.appearance as JsonRecord)[key] = mergeRecords(isRecord(baseValue) ? baseValue : {}, isRecord(stateValue) ? stateValue : {});
    } else if (typeof stateValue !== 'undefined') {
      (shell.appearance as JsonRecord)[key] = clone(stateValue);
    } else if (typeof baseValue !== 'undefined') {
      (shell.appearance as JsonRecord)[key] = clone(baseValue);
    }
  }

  const baseTypography = isRecord(base.typography) ? base.typography : {};
  const stateTypography = isRecord(state.typography) ? state.typography : {};
  const baseRoles = isRecord(baseTypography.roles) ? baseTypography.roles : {};
  const stateRoles = isRecord(stateTypography.roles) ? stateTypography.roles : {};
  shell.typography = {
    globalFamily: stateTypography.globalFamily ?? baseTypography.globalFamily ?? 'Inter',
    roles: {},
  };
  for (const role of shellTypographyRoles) {
    const baseRole = baseRoles[role];
    const stateRole = stateRoles[role];
    if (isRecord(baseRole) || isRecord(stateRole)) {
      (shell.typography as JsonRecord).roles = isRecord((shell.typography as JsonRecord).roles)
        ? (shell.typography as JsonRecord).roles
        : {};
      ((shell.typography as JsonRecord).roles as JsonRecord)[role] = mergeRecords(
        isRecord(baseRole) ? baseRole : {},
        isRecord(stateRole) ? stateRole : {},
      );
    }
  }

  const baseBehavior = isRecord(base.behavior) ? base.behavior : {};
  const stateBehavior = isRecord(state.behavior) ? state.behavior : {};
  const socialShare = mergeRecords(
    isRecord(baseBehavior.socialShare) ? baseBehavior.socialShare : {},
    isRecord(stateBehavior.socialShare) ? stateBehavior.socialShare : {},
  );
  const channels = mergeRecords(
    Object.fromEntries(socialChannels.map((channel) => [channel, true])),
    isRecord(socialShare.channels) ? socialShare.channels : {},
  );
  shell.behavior = {
    showBacklink: stateBehavior.showBacklink ?? baseBehavior.showBacklink ?? true,
    socialShare: {
      ...socialShare,
      enabled: socialShare.enabled === true,
      channels,
    },
  };

  setPath(shell, 'stage.canvas.mode', 'viewport');
  setPath(shell, 'pod.widthMode', 'full');
  return shell;
}

function migrateHeaderCtaAliases(state: JsonRecord): void {
  moveObject(state, 'cta', 'headerCta');
  moveObject(state, 'primaryCta', 'headerCta');
  deletePath(state, 'secondaryCta');
  const appearanceMap: Record<string, string> = {
    ctaBackground: 'background',
    ctaTextColor: 'textColor',
    ctaBorder: 'border',
    ctaRadius: 'radius',
    ctaPaddingInline: 'paddingInline',
    ctaPaddingBlock: 'paddingBlock',
    ctaPaddingLinked: 'paddingLinked',
    ctaSizePreset: 'sizePreset',
    ctaIconSizePreset: 'iconSizePreset',
    ctaIconSize: 'iconSize',
  };
  for (const [oldKey, newKey] of Object.entries(appearanceMap)) {
    moveValue(state, `appearance.${oldKey}`, `appearance.headerCta.${newKey}`);
  }
}

function keepOnlyShellBehavior(behavior: unknown): JsonRecord {
  const source = isRecord(behavior) ? behavior : {};
  const next: JsonRecord = {};
  if (typeof source.showBacklink !== 'undefined') next.showBacklink = source.showBacklink;
  if (isRecord(source.socialShare)) next.socialShare = source.socialShare;
  return next;
}

function pruneEmptyObject(root: JsonRecord, pathValue: string): void {
  const value = getPath(root, pathValue);
  if (isRecord(value) && Object.keys(value).length === 0) deletePath(root, pathValue);
}

function moveLegacyAppearanceToWidgetRoot(root: JsonRecord, widgetType: string): void {
  const appearance = isRecord(root.appearance) ? root.appearance : null;
  if (!appearance) return;
  for (const key of Object.keys(appearance)) {
    if ((shellAppearanceKeys as readonly string[]).includes(key)) continue;
    moveValue(root, `appearance.${key}`, `${widgetType}.appearance.${key}`);
  }
  pruneEmptyObject(root, 'appearance');
}

function migrateWidgetNamespaces(widgetType: string, state: JsonRecord): JsonRecord {
  const next = clone(state);
  migrateHeaderCtaAliases(next);
  moveValue(next, 'headline', 'header.title');
  moveValue(next, 'subheadline', 'header.subtitleHtml');
  deletePath(next, 'showTitle');
  deletePath(next, 'title');

  if (widgetType === 'cards') {
    moveObject(next, 'core', 'cards');
    moveLegacyAppearanceToWidgetRoot(next, 'cards');
  }

  if (widgetType === 'split') {
    moveObject(next, 'core', 'split');
    moveLegacyAppearanceToWidgetRoot(next, 'split');
    const visual = isRecord(next.visual) ? next.visual : null;
    if (visual && visual.enabled !== false && isRecord(visual.fill)) {
      setPath(next, 'split.items.0.kind', visual.fill.type === 'video' ? 'video' : 'image');
      setPath(next, 'split.items.0.media', visual.fill);
    }
    deletePath(next, 'visual');
    deletePath(next, 'layout');
  }

  if (widgetType === 'countdown') {
    ['timer', 'layout', 'seoGeo', 'seo', 'geo', 'actions'].forEach((key) => moveObject(next, key, `countdown.${key}`));
    moveLegacyAppearanceToWidgetRoot(next, 'countdown');
  }

  if (widgetType === 'faq') {
    ['sections', 'layout', 'seoGeo', 'seo', 'geo', 'context', 'displayCategoryTitles'].forEach((key) =>
      moveObject(next, key, `faq.${key}`),
    );
    moveLegacyAppearanceToWidgetRoot(next, 'faq');
    const behavior = isRecord(next.behavior) ? next.behavior : {};
    const coreBehavior: JsonRecord = {};
    ['displayImages', 'displayVideos', 'expandAll', 'expandFirst', 'multiOpen'].forEach((key) => {
      if (typeof behavior[key] !== 'undefined') coreBehavior[key] = behavior[key];
    });
    if (Object.keys(coreBehavior).length) setPath(next, 'faq.behavior', coreBehavior);
    next.behavior = keepOnlyShellBehavior(behavior);
    pruneEmptyObject(next, 'behavior');
  }

  if (widgetType === 'logoshowcase') {
    ['strips', 'spacing', 'type', 'typeConfig', 'seoGeo'].forEach((key) => moveObject(next, key, `logoshowcase.${key}`));
    moveLegacyAppearanceToWidgetRoot(next, 'logoshowcase');
    const behavior = isRecord(next.behavior) ? next.behavior : {};
    if (typeof behavior.randomOrder !== 'undefined') setPath(next, 'logoshowcase.behavior.randomOrder', behavior.randomOrder);
    next.behavior = keepOnlyShellBehavior(behavior);
    pruneEmptyObject(next, 'behavior');
  }

  return next;
}

function composeConfigWithContent(config: JsonRecord, content: JsonRecord): JsonRecord {
  const next = clone(config);
  const fields = isRecord(content.fields) ? content.fields : {};
  for (const [fieldPath, field] of Object.entries(fields)) {
    if (isRecord(field) && typeof field.value === 'string') {
      setPath(next, fieldPath, field.value);
    }
  }
  return next;
}

function stripContent(config: JsonRecord, widgetType: string): JsonRecord {
  const next = clone(config);
  const contract = loadEditableFields(widgetType);
  for (const item of extractTextPrimitiveValuesForEditableFields({ contract, config })) {
    deletePath(next, item.path);
  }
  return next;
}

function contentFromFullConfig(args: {
  widgetType: string;
  instanceId: string;
  accountId: string;
  config: JsonRecord;
  previous: JsonRecord;
  updatedAt: string;
}): JsonRecord {
  const contract = loadEditableFields(args.widgetType);
  const previousFields = isRecord(args.previous.fields) ? args.previous.fields : {};
  const previousByIdentity = new Map(
    Object.values(previousFields)
      .filter((field): field is JsonRecord => isRecord(field) && typeof field.identityKey === 'string')
      .map((field) => [field.identityKey as string, field]),
  );
  const fields: JsonRecord = {};
  for (const item of extractSavedTextFieldsForEditableFields({ contract, config: args.config })) {
    const previous = previousByIdentity.get(item.identityKey) ?? previousFields[item.path];
    const sameValue = isRecord(previous) && previous.value === item.baseText;
    fields[item.path] = {
      identityKey: item.identityKey,
      fieldPattern: item.fieldPattern,
      value: item.baseText,
      status: sameValue && typeof previous.status === 'string' ? previous.status : 'changed',
    };
  }
  return {
    id: args.instanceId,
    accountId: args.accountId,
    widgetType: args.widgetType,
    fields,
    updatedAt: args.updatedAt,
  };
}

function repairCurrentClickeenSampleText(args: {
  widgetType: string;
  instanceId: string;
  config: JsonRecord;
  shellDefaults: JsonRecord;
}): void {
  if (accountId !== 'CLICKEEN') return;
  if (args.widgetType !== 'split' || args.instanceId !== 'KUGYTX2ZMQ') return;

  const requireShellString = (path: string): string => {
    const value = getPath(args.shellDefaults, path);
    if (typeof value === 'string' && value.trim()) return value;
    throw new Error(`missing_required_shell_default:${path}`);
  };
  if (typeof getPath(args.config, 'header.title') === 'string' && !String(getPath(args.config, 'header.title')).trim()) {
    setPath(args.config, 'header.title', requireShellString('header.title'));
  }
  if (
    typeof getPath(args.config, 'header.subtitleHtml') === 'string' &&
    !String(getPath(args.config, 'header.subtitleHtml')).trim()
  ) {
    setPath(args.config, 'header.subtitleHtml', requireShellString('header.subtitleHtml'));
  }
  if (
    typeof getPath(args.config, 'headerCta.label') === 'string' &&
    !String(getPath(args.config, 'headerCta.label')).trim()
  ) {
    setPath(args.config, 'headerCta.label', requireShellString('headerCta.label'));
  }
}

async function buildPackage(args: {
  widgetType: string;
  instanceId: string;
  baseLocale: string;
  displayName: string | null;
  state: JsonRecord;
}) {
  const response = await getCompiledWidgetRouteResponse(
    new NextRequest(new URL(`http://migration.local/api/widgets/${encodeURIComponent(args.widgetType)}/compiled?ts=${Date.now()}`)),
    { params: Promise.resolve({ widgetname: args.widgetType }) },
  );
  const compiled = await response.json().catch(() => null);
  if (!response.ok || !isRecord(compiled) || !isRecord(compiled.widgetPackage)) {
    throw new Error(`compiled_widget_invalid:${args.widgetType}:${response.status}`);
  }
  const embeddedPackages = await loadEmbeddedPackages(args.state);
  return buildSavedWidgetPublicPackage({
    compiled: compiled as any,
    instanceId: args.instanceId,
    baseLocale: args.baseLocale,
    displayName: args.displayName,
    state: args.state,
    embeddedPackages,
  });
}

async function loadEmbeddedPackages(state: JsonRecord) {
  const split = isRecord(state.split) ? state.split : null;
  const items = Array.isArray(split?.items) ? split.items : [];
  const ids = Array.from(
    new Set(
      items
        .map((item) => (isRecord(item) && isRecord(item.instance) && typeof item.instance.instanceId === 'string' ? item.instance.instanceId : ''))
        .map((id) => id.trim().toUpperCase())
        .filter(Boolean),
    ),
  );
  return ids.map((instanceId) => {
    const root = `accounts/${accountId}/instances/${instanceId}`;
    return {
      instanceId,
      indexHtml: r2GetText(`${root}/index.html`),
      stylesCss: r2GetText(`${root}/styles.css`),
      runtimeJs: r2GetText(`${root}/runtime.js`),
    };
  });
}

function migrateAccountDefaults(accountDefaults: JsonRecord, shellDefaults: JsonRecord): JsonRecord {
  const next = clone(accountDefaults);
  next.shell = shellDefaults;
  const widgetsDoc = isRecord(next.widgets) ? next.widgets : {};
  for (const widget of widgets) {
    const specDefaults = isRecord(loadSpec(widget.widgetType).defaults) ? (loadSpec(widget.widgetType).defaults as JsonRecord) : {};
    const currentCore = isRecord(widgetsDoc[widget.widgetType]) && isRecord((widgetsDoc[widget.widgetType] as JsonRecord).core)
      ? ((widgetsDoc[widget.widgetType] as JsonRecord).core as JsonRecord)
      : {};
    const migrated = migrateWidgetNamespaces(widget.widgetType, currentCore);
    widgetsDoc[widget.widgetType] = {
      core: mergeRecords(specDefaults, migrated),
    };
  }
  next.widgets = widgetsDoc;
  next.updatedAt = new Date().toISOString();
  const normalized = normalizeAccountWidgetDefaultsDocument(next, accountId);
  if (!normalized) throw new Error('account_widget_defaults_normalize_failed');
  return normalized as unknown as JsonRecord;
}

async function migrateInstance(widget: WidgetEntry, shellDefaults: JsonRecord, now: string) {
  const root = `accounts/${accountId}/instances/${widget.instanceId}`;
  const configDoc = r2GetJson<JsonRecord>(`${root}/instance.config.json`);
  const contentDoc = r2GetJson<JsonRecord>(`${root}/instance.content.json`);
  const currentFull = composeConfigWithContent(isRecord(configDoc.config) ? configDoc.config : {}, contentDoc);
  const migratedCurrent = migrateWidgetNamespaces(widget.widgetType, currentFull);
  const specDefaults = isRecord(loadSpec(widget.widgetType).defaults) ? (loadSpec(widget.widgetType).defaults as JsonRecord) : {};
  const instanceShell = shellFromState(shellDefaults, migratedCurrent);
  const fullConfig = mergeRecords(mergeRecords(instanceShell, specDefaults), migratedCurrent);
  setPath(fullConfig, 'stage.canvas.mode', 'viewport');
  setPath(fullConfig, 'pod.widthMode', 'full');
  migrateHeaderCtaAliases(fullConfig);
  repairCurrentClickeenSampleText({
    widgetType: widget.widgetType,
    instanceId: widget.instanceId,
    config: fullConfig,
    shellDefaults,
  });

  const nextContent = contentFromFullConfig({
    widgetType: widget.widgetType,
    instanceId: widget.instanceId,
    accountId,
    config: fullConfig,
    previous: contentDoc,
    updatedAt: now,
  });
  const nextConfig = {
    ...configDoc,
    accountId,
    id: widget.instanceId,
    widgetCode: widget.widgetCode,
    widgetType: widget.widgetType,
    config: stripContent(fullConfig, widget.widgetType),
    updatedAt: now,
  };
  const publicPackage = await buildPackage({
    widgetType: widget.widgetType,
    instanceId: widget.instanceId,
    baseLocale: typeof configDoc.baseLocale === 'string' ? configDoc.baseLocale : 'en',
    displayName: typeof configDoc.displayName === 'string' ? configDoc.displayName : null,
    state: fullConfig,
  });

  const writes = [
    [`${root}/instance.config.json`, JSON.stringify(nextConfig, null, 2), 'application/json'],
    [`${root}/instance.content.json`, JSON.stringify(nextContent, null, 2), 'application/json'],
    [`${root}/index.html`, publicPackage.indexHtml, 'text/html; charset=utf-8'],
    [`${root}/styles.css`, publicPackage.stylesCss, 'text/css; charset=utf-8'],
    [`${root}/runtime.js`, publicPackage.runtimeJs, 'text/javascript; charset=utf-8'],
    [`${root}/package.json`, JSON.stringify({ v: 1, dependencies: publicPackage.dependencies }, null, 2), 'application/json'],
  ] as const;

  for (const [key, body, contentType] of writes) {
    r2PutText(key, body, contentType);
  }

  console.log(`${apply ? '[apply]' : '[dry-run]'} ${widget.widgetType}/${widget.instanceId}: ${writes.length} object(s) ${apply ? 'written' : 'would be written'}`);
}

async function main() {
  loadLocalEnv();
  installCompilerFetchShim();
  execFileSync('node', ['scripts/cloudflare/r2.mjs', 'preflight'], { cwd: repoRoot, stdio: 'pipe' });

  const accountDefaults = r2GetJson<JsonRecord>(`accounts/${accountId}/widget-defaults.json`);
  const ctaConfig = r2GetJson<JsonRecord>(`accounts/${accountId}/instances/SZBSB5HHFJ/instance.config.json`);
  const ctaContent = r2GetJson<JsonRecord>(`accounts/${accountId}/instances/SZBSB5HHFJ/instance.content.json`);
  const ctaFull = migrateWidgetNamespaces('calltoaction', composeConfigWithContent(isRecord(ctaConfig.config) ? ctaConfig.config : {}, ctaContent));
  const shellDefaults = shellFromState(isRecord(accountDefaults.shell) ? accountDefaults.shell : {}, ctaFull);
  const migratedAccountDefaults = migrateAccountDefaults(accountDefaults, shellDefaults);
  r2PutText(
    `accounts/${accountId}/widget-defaults.json`,
    JSON.stringify(migratedAccountDefaults, null, 2),
    'application/json',
  );
  console.log(`${apply ? '[apply]' : '[dry-run]'} account widget defaults ${apply ? 'written' : 'would be written'}`);

  const now = new Date().toISOString();
  for (const widget of widgets) {
    await migrateInstance(widget, shellDefaults, now);
  }

  if (!apply) {
    console.log('\nDry run only. Re-run with --apply to write R2 objects.');
  }
}

main().catch((error) => {
  if (error instanceof Error) {
    console.error(`[migrate-106] ${error.stack || error.message}`);
  } else {
    console.error(`[migrate-106] ${String(error)}`);
  }
  process.exit(1);
});
