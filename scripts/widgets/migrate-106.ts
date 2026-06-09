#!/usr/bin/env tsx
/* eslint-disable no-console */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { NextRequest } from 'next/server';
import { getCompiledWidgetRouteResponse } from '../../bob/lib/api/compiled-widget-route';
import { resolveWidgetOverlayCode, toAccountAssetPublicPath } from '../../packages/ck-contracts/src';
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
  instanceId: string;
};

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(scriptPath), '..', '..');
const widgetsRoot = path.join(repoRoot, 'tokyo', 'product', 'widgets');
const accountId = process.env.CK_106_ACCOUNT_ID || 'CLICKEEN';
const apply = process.argv.includes('--apply');

const widgets: WidgetEntry[] = [
  { widgetType: 'big-bang', instanceId: 'QD1G068MX7' },
  { widgetType: 'calltoaction', instanceId: 'SZBSB5HHFJ' },
  { widgetType: 'cards', instanceId: 'U37WRSMY7J' },
  { widgetType: 'countdown', instanceId: 'H7IF9M2K9B' },
  { widgetType: 'faq', instanceId: 'UZ3JEJSHII' },
  { widgetType: 'logoshowcase', instanceId: '8FMVZFFPJV' },
  { widgetType: 'split-carousel-media', instanceId: 'P10U6N7Y2X' },
  { widgetType: 'split-media', instanceId: 'KUGYTX2ZMQ' },
];
const accountDefaultWidgetTypes = [
  ...widgets.map((widget) => widget.widgetType),
];
const supportedWidgetTypes = new Set(accountDefaultWidgetTypes);

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

function requireSupabaseConfig(): { baseUrl: string; serviceRoleKey: string } {
  const baseUrl = String(process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!baseUrl || !serviceRoleKey) {
    throw new Error('missing_supabase_env_for_registry_cleanup');
  }
  return { baseUrl, serviceRoleKey };
}

async function supabaseJson(
  pathnameWithQuery: string,
  init?: RequestInit,
): Promise<{ status: number; payload: unknown }> {
  const { baseUrl, serviceRoleKey } = requireSupabaseConfig();
  const headers = new Headers(init?.headers);
  headers.set('apikey', serviceRoleKey);
  headers.set('Authorization', `Bearer ${serviceRoleKey}`);
  if (init?.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
  const response = await fetch(`${baseUrl}${pathnameWithQuery}`, { ...init, headers });
  const text = await response.text();
  let payload: unknown = null;
  if (text.trim()) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }
  if (!response.ok) {
    throw new Error(`supabase_registry_${response.status}:${typeof payload === 'string' ? payload : JSON.stringify(payload)}`);
  }
  return { status: response.status, payload };
}

async function listRegistryRows(): Promise<JsonRecord[]> {
  const pathValue = `/rest/v1/instances?account_id=eq.${encodeURIComponent(accountId)}&select=id,widget_type,publish_status,translation_status,created_at,edited_at&order=id.asc`;
  const { payload } = await supabaseJson(pathValue);
  return Array.isArray(payload) ? payload.filter(isRecord) : [];
}

async function patchRegistryWidgetType(instanceId: string, widgetType: string, now: string): Promise<void> {
  if (!apply) return;
  await supabaseJson(
    `/rest/v1/instances?account_id=eq.${encodeURIComponent(accountId)}&id=eq.${encodeURIComponent(instanceId)}`,
    {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ widget_type: widgetType, edited_at: now }),
    },
  );
}

async function deleteRegistryRow(instanceId: string): Promise<void> {
  if (!apply) return;
  await supabaseJson(
    `/rest/v1/instances?account_id=eq.${encodeURIComponent(accountId)}&id=eq.${encodeURIComponent(instanceId)}`,
    {
      method: 'DELETE',
      headers: { Prefer: 'return=minimal' },
    },
  );
}

async function cleanupRegistry(now: string): Promise<void> {
  const expected = new Map(widgets.map((widget) => [widget.instanceId, widget.widgetType]));
  const rows = await listRegistryRows();
  for (const row of rows) {
    const instanceId = typeof row.id === 'string' ? row.id.trim() : '';
    const widgetType = typeof row.widget_type === 'string' ? row.widget_type.trim() : '';
    const expectedWidgetType = expected.get(instanceId);
    if (expectedWidgetType) {
      if (widgetType !== expectedWidgetType) {
        await patchRegistryWidgetType(instanceId, expectedWidgetType, now);
        console.log(`${apply ? '[apply]' : '[dry-run]'} registry ${instanceId}: ${widgetType || '(missing)'} -> ${expectedWidgetType}`);
      }
      continue;
    }
    await deleteRegistryRow(instanceId);
    console.log(`${apply ? '[apply]' : '[dry-run]'} registry ${instanceId}: removed unsupported ${widgetType || '(missing)'}`);
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
  repairHeaderCtaPaddingSeed(shell);
  return shell;
}

function repairHeaderCtaPaddingSeed(state: JsonRecord): void {
  const headerCta = getPath(state, 'appearance.headerCta');
  if (!isRecord(headerCta)) return;
  const linked = headerCta.paddingLinked;
  const inline = headerCta.paddingInline;
  const block = headerCta.paddingBlock;
  const oldSeed = linked === false && inline === 18 && block === 12;
  const unlinkedEqual = linked === false && typeof inline === 'number' && inline === block;
  if (!oldSeed && !unlinkedEqual) return;
  setPath(state, 'appearance.headerCta.paddingLinked', true);
  if (oldSeed) setPath(state, 'appearance.headerCta.paddingBlock', 18);
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

function publicAssetPath(assetRef: string): string {
  return toAccountAssetPublicPath(`accounts/${accountId}/assets/${assetRef}`) ?? '';
}

function normalizeImageFillBucket(bucket: JsonRecord): JsonRecord {
  const assetRef =
    typeof bucket.assetRef === 'string' && bucket.assetRef.trim()
      ? bucket.assetRef.trim()
      : typeof bucket.name === 'string' && bucket.name.trim()
        ? bucket.name.trim()
        : '';
  const src =
    typeof bucket.src === 'string' && bucket.src.trim()
      ? bucket.src.trim()
      : assetRef
        ? publicAssetPath(assetRef)
        : '';
  return {
    ...(assetRef ? { assetRef } : {}),
    ...(typeof bucket.name === 'string' && bucket.name.trim() ? { name: bucket.name.trim() } : {}),
    src,
    fit: typeof bucket.fit === 'string' && bucket.fit.trim() ? bucket.fit.trim() : 'cover',
    position: typeof bucket.position === 'string' && bucket.position.trim() ? bucket.position.trim() : 'center',
    repeat: typeof bucket.repeat === 'string' && bucket.repeat.trim() ? bucket.repeat.trim() : 'no-repeat',
  };
}

function normalizeVideoFillBucket(bucket: JsonRecord): JsonRecord {
  const assetRef =
    typeof bucket.assetRef === 'string' && bucket.assetRef.trim()
      ? bucket.assetRef.trim()
      : typeof bucket.name === 'string' && bucket.name.trim()
        ? bucket.name.trim()
        : '';
  const src =
    typeof bucket.src === 'string' && bucket.src.trim()
      ? bucket.src.trim()
      : assetRef
        ? publicAssetPath(assetRef)
        : '';
  const posterAssetRef =
    typeof bucket.posterAssetRef === 'string' && bucket.posterAssetRef.trim()
      ? bucket.posterAssetRef.trim()
      : '';
  return {
    ...(assetRef ? { assetRef } : {}),
    ...(typeof bucket.name === 'string' && bucket.name.trim() ? { name: bucket.name.trim() } : {}),
    src,
    poster:
      typeof bucket.poster === 'string' && bucket.poster.trim()
        ? bucket.poster.trim()
        : posterAssetRef
          ? publicAssetPath(posterAssetRef)
          : '',
    ...(posterAssetRef ? { posterAssetRef } : {}),
    autoplay: bucket.autoplay !== false,
    loop: bucket.loop !== false,
    muted: bucket.muted !== false,
  };
}

function normalizeMediaFill(raw: unknown, fallback: JsonRecord): JsonRecord {
  if (!isRecord(raw)) return clone(fallback);

  if (typeof raw.kind === 'string' && isRecord(raw[raw.kind])) {
    const selected = raw[raw.kind];
    if (isRecord(selected) && selected.type === raw.kind) {
      return normalizeMediaFill(selected, fallback);
    }
  }

  if (raw.type === 'image') {
    return {
      type: 'image',
      image: normalizeImageFillBucket(isRecord(raw.image) ? raw.image : {}),
    };
  }

  if (raw.type === 'video') {
    return {
      type: 'video',
      video: normalizeVideoFillBucket(isRecord(raw.video) ? raw.video : {}),
    };
  }

  return clone(fallback);
}

function normalizeSplitMediaCore(next: JsonRecord): void {
  const splitMediaSpecDefaults = loadSpec('split-media').defaults;
  const splitMediaDefaults =
    isRecord(splitMediaSpecDefaults) && isRecord(splitMediaSpecDefaults.splitMedia)
      ? splitMediaSpecDefaults.splitMedia
      : {};
  const fallbackFill = isRecord(splitMediaDefaults.media) ? splitMediaDefaults.media : {};
  const existingSplitMedia = isRecord(next.splitMedia) ? next.splitMedia : {};
  const legacySplit = isRecord(next.split) ? next.split : {};
  const legacyItems = Array.isArray(legacySplit.items) ? legacySplit.items : [];
  const firstItem = isRecord(legacyItems[0]) ? legacyItems[0] : {};
  const sourceMedia = isRecord(existingSplitMedia.media)
    ? existingSplitMedia.media
    : isRecord(firstItem.media)
      ? firstItem.media
      : {};
  const alt =
    typeof existingSplitMedia.alt === 'string'
      ? existingSplitMedia.alt
      : typeof getPath(firstItem, 'image.alt') === 'string'
        ? (getPath(firstItem, 'image.alt') as string)
        : typeof getPath(firstItem, 'media.alt') === 'string'
          ? (getPath(firstItem, 'media.alt') as string)
          : typeof splitMediaDefaults.alt === 'string'
            ? splitMediaDefaults.alt
            : 'Product visual';
  const legacyMedia = isRecord(legacySplit.media) ? legacySplit.media : {};
  const nextCore = mergeRecords(splitMediaDefaults, existingSplitMedia);
  nextCore.media = normalizeMediaFill(sourceMedia, fallbackFill);
  nextCore.alt = alt;
  nextCore.fit =
    typeof existingSplitMedia.fit === 'string'
      ? existingSplitMedia.fit
      : typeof legacyMedia.fit === 'string'
        ? legacyMedia.fit
        : nextCore.fit;
  nextCore.position =
    typeof existingSplitMedia.position === 'string'
      ? existingSplitMedia.position
      : typeof legacyMedia.position === 'string'
        ? legacyMedia.position
        : nextCore.position;
  next.splitMedia = nextCore;
  deletePath(next, 'split');
}

function normalizeSplitCarouselMediaCore(next: JsonRecord): void {
  const specDefaults = loadSpec('split-carousel-media').defaults;
  const defaults =
    isRecord(specDefaults) && isRecord(specDefaults.splitCarouselMedia)
      ? specDefaults.splitCarouselMedia
      : {};
  const fallbackItems = Array.isArray(defaults.items) ? defaults.items : [];
  const fallbackFill = isRecord(fallbackItems[0]) && isRecord(fallbackItems[0].media) ? fallbackItems[0].media : {};
  const existing = isRecord(next.splitCarouselMedia) ? next.splitCarouselMedia : {};
  const nextCore = mergeRecords(defaults, existing);
  const items = Array.isArray(nextCore.items) ? nextCore.items : [];
  nextCore.items = items.map((rawItem, index) => {
    const fallbackItem = isRecord(fallbackItems[index])
      ? fallbackItems[index]
      : isRecord(fallbackItems[0])
        ? fallbackItems[0]
        : {};
    const item = isRecord(rawItem) ? rawItem : {};
    const id = typeof item.id === 'string' && item.id.trim() ? item.id.trim() : `visual-${index + 1}`;
    const media = normalizeMediaFill(item.media, fallbackFill);
    const alt =
      typeof item.alt === 'string'
        ? item.alt
        : typeof getPath(item, 'media.alt') === 'string'
          ? (getPath(item, 'media.alt') as string)
          : typeof fallbackItem.alt === 'string'
            ? fallbackItem.alt
            : '';
    return { ...item, id, media, alt };
  });
  next.splitCarouselMedia = nextCore;
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

  if (widgetType === 'countdown') {
    ['timer', 'layout', 'seoGeo', 'seo', 'geo', 'actions'].forEach((key) => moveObject(next, key, `countdown.${key}`));
    moveLegacyAppearanceToWidgetRoot(next, 'countdown');
    deletePath(next, 'countdown.actions.during.type');
    deletePath(next, 'countdown.geo.answerFormat');
    deletePath(next, 'countdown.seo.businessType');
  }

  if (widgetType === 'faq') {
    ['sections', 'layout', 'seoGeo', 'seo', 'geo', 'displayCategoryTitles'].forEach((key) =>
      moveObject(next, key, `faq.${key}`),
    );
    moveLegacyAppearanceToWidgetRoot(next, 'faq');
    deletePath(next, 'faq.context');
    deletePath(next, 'faq.geo.answerFormat');
    deletePath(next, 'faq.seo.businessType');
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

  if (widgetType === 'split-media') {
    normalizeSplitMediaCore(next);
  }

  if (widgetType === 'split-carousel-media') {
    normalizeSplitCarouselMediaCore(next);
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
  return buildSavedWidgetPublicPackage({
    compiled: compiled as any,
    instanceId: args.instanceId,
    baseLocale: args.baseLocale,
    displayName: args.displayName,
    state: args.state,
  });
}

function migrateAccountDefaults(accountDefaults: JsonRecord, shellDefaults: JsonRecord): JsonRecord {
  const next = clone(accountDefaults);
  next.shell = shellDefaults;
  const widgetsDoc = isRecord(next.widgets) ? next.widgets : {};
  for (const key of Object.keys(widgetsDoc)) {
    if (!supportedWidgetTypes.has(key)) delete widgetsDoc[key];
  }
  for (const widgetType of accountDefaultWidgetTypes) {
    const specDefaults = isRecord(loadSpec(widgetType).defaults) ? (loadSpec(widgetType).defaults as JsonRecord) : {};
    const currentCore = isRecord(widgetsDoc[widgetType]) && isRecord((widgetsDoc[widgetType] as JsonRecord).core)
      ? ((widgetsDoc[widgetType] as JsonRecord).core as JsonRecord)
      : {};
    const migrated = migrateWidgetNamespaces(widgetType, currentCore);
    widgetsDoc[widgetType] = {
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
  const widgetCode = resolveWidgetOverlayCode(widget.widgetType);
  if (!widgetCode) throw new Error(`unsupported_widget_type:${widget.widgetType}`);
  const currentFull = composeConfigWithContent(isRecord(configDoc.config) ? configDoc.config : {}, contentDoc);
  const migratedCurrent = migrateWidgetNamespaces(widget.widgetType, currentFull);
  const specDefaults = isRecord(loadSpec(widget.widgetType).defaults) ? (loadSpec(widget.widgetType).defaults as JsonRecord) : {};
  const instanceShell = shellFromState(shellDefaults, migratedCurrent);
  const fullConfig = mergeRecords(mergeRecords(instanceShell, specDefaults), migratedCurrent);
  setPath(fullConfig, 'stage.canvas.mode', 'viewport');
  setPath(fullConfig, 'pod.widthMode', 'full');
  migrateHeaderCtaAliases(fullConfig);
  repairHeaderCtaPaddingSeed(fullConfig);
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
    widgetCode,
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
  await cleanupRegistry(now);

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
