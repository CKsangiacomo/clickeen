#!/usr/bin/env tsx
/* eslint-disable no-console */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { compileWidgetServer } from '../../bob/lib/compiler.server';
import { assertSessionConfigContract } from '../../bob/lib/session/sessionConfig';
import type { CompiledControl } from '../../bob/lib/types';

type JsonRecord = Record<string, unknown>;

type WidgetEntry = {
  widgetType: string;
  instanceId: string;
};

type FillControl = {
  path: string;
  modes: Set<string>;
};

type Change = {
  key: string;
  path: string;
  from: unknown;
  to: unknown;
};

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(scriptPath), '..', '..');
const widgetsRoot = path.join(repoRoot, 'tokyo', 'product', 'widgets');
const accountId = process.env.CK_107_ACCOUNT_ID || 'CLICKEEN';
const apply = process.argv.includes('--apply');
const TOKEN_SEGMENT = /^__[^.]+__$/;

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

function loadLocalEnv(): void {
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

function installCompilerFetchShim(): void {
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
        const contentType = key.endsWith('.json')
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
        const contentType = key.endsWith('.json')
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

function setValueAtPath(root: JsonRecord, pathValue: string, value: unknown): void {
  const parts = pathValue.split('.').filter(Boolean);
  let cursor: unknown = root;
  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index]!;
    const last = index === parts.length - 1;
    if (/^\d+$/.test(part)) {
      if (!Array.isArray(cursor)) return;
      if (last) {
        cursor[Number(part)] = clone(value);
        return;
      }
      cursor = cursor[Number(part)];
      continue;
    }
    if (!isRecord(cursor)) return;
    if (last) {
      cursor[part] = clone(value);
      return;
    }
    cursor = cursor[part];
  }
}

function composeConfigWithContent(config: Record<string, unknown>, content: unknown): Record<string, unknown> {
  const next = clone(config);
  if (!isRecord(content) || !isRecord(content.fields)) return next;
  for (const [fieldPath, field] of Object.entries(content.fields)) {
    if (!isRecord(field) || typeof fieldPath !== 'string') continue;
    setValueAtPath(next, fieldPath, field.value);
  }
  return next;
}

async function compileFillControls(widgetType: string): Promise<FillControl[]> {
  const specPath = path.join(widgetsRoot, widgetType, 'spec.json');
  const widgetJson = JSON.parse(fs.readFileSync(specPath, 'utf8')) as JsonRecord;
  const compiled = await compileWidgetServer(widgetJson);
  return compiled.controls
    .filter((control): control is CompiledControl & { path: string } => (
      control.type === 'dropdown-fill' && typeof control.path === 'string' && control.path.length > 0
    ))
    .map((control) => ({
      path: control.path,
      modes: new Set(control.enumValues ?? []),
    }));
}

function fillFromShorthand(value: string, control: FillControl, key: string, pathValue: string): unknown {
  const trimmed = value.trim();
  if (!trimmed || trimmed === 'transparent') return { type: 'none' };
  if (
    control.modes.has('gradient')
    && /^(linear-gradient|radial-gradient|conic-gradient)\(/i.test(trimmed)
  ) {
    return { type: 'gradient', gradient: { css: trimmed } };
  }
  if (control.modes.has('color')) return { type: 'color', color: trimmed };
  throw new Error(`${key}:${pathValue} has string shorthand "${value}" but the fill control does not declare color/gradient mode`);
}

function repairFillObject(value: JsonRecord): unknown {
  const type = typeof value.type === 'string' ? value.type : '';
  const allowedByType: Record<string, Set<string>> = {
    none: new Set(['type']),
    color: new Set(['type', 'color']),
    gradient: new Set(['type', 'gradient']),
    image: new Set(['type', 'image']),
    video: new Set(['type', 'video']),
  };
  const allowed = allowedByType[type];
  if (!allowed) return undefined;
  if (Object.keys(value).every((entryKey) => allowed.has(entryKey))) return undefined;
  const next: JsonRecord = { type };
  for (const entryKey of allowed) {
    if (entryKey !== 'type' && Object.prototype.hasOwnProperty.call(value, entryKey)) {
      next[entryKey] = value[entryKey];
    }
  }
  return next;
}

function repairPath(args: {
  root: unknown;
  control: FillControl;
  key: string;
  changes: Change[];
}): void {
  const segments = args.control.path.split('.');
  const visit = (container: unknown, index: number, concretePath: string): void => {
    if (index >= segments.length) return;
    const segment = segments[index]!;
    if (TOKEN_SEGMENT.test(segment)) {
      if (!Array.isArray(container)) return;
      container.forEach((entry, itemIndex) => visit(entry, index + 1, concretePath ? `${concretePath}.${itemIndex}` : String(itemIndex)));
      return;
    }
    const arraySuffix = segment.endsWith('[]');
    const key = arraySuffix ? segment.slice(0, -2) : segment;
    if (!isRecord(container) || !key || !Object.prototype.hasOwnProperty.call(container, key)) return;
    const nextPath = concretePath ? `${concretePath}.${key}` : key;
    if (arraySuffix) {
      const arrayValue = container[key];
      if (!Array.isArray(arrayValue)) return;
      arrayValue.forEach((entry, itemIndex) => visit(entry, index + 1, `${nextPath}.${itemIndex}`));
      return;
    }
    if (index === segments.length - 1) {
      const current = container[key];
      let replacement: unknown;
      if (typeof current === 'string') {
        replacement = fillFromShorthand(current, args.control, args.key, nextPath);
      } else if (isRecord(current)) {
        replacement = repairFillObject(current);
      } else {
        return;
      }
      if (typeof replacement === 'undefined') return;
      container[key] = replacement;
      args.changes.push({
        key: args.key,
        path: nextPath,
        from: current,
        to: replacement,
      });
      return;
    }
    visit(container[key], index + 1, nextPath);
  };
  visit(args.root, 0, '');
}

function repairRoot(args: {
  root: Record<string, unknown>;
  controls: FillControl[];
  key: string;
  changes: Change[];
}): void {
  for (const control of args.controls) {
    repairPath({
      root: args.root,
      control,
      key: args.key,
      changes: args.changes,
    });
  }
}

function pathMatchesPattern(pattern: string, pathValue: string): boolean {
  const patternParts = pattern.split('.').filter(Boolean);
  const pathParts = pathValue.split('.').filter(Boolean);
  const visit = (patternIndex: number, pathIndex: number): boolean => {
    if (patternIndex === patternParts.length && pathIndex === pathParts.length) return true;
    if (patternIndex >= patternParts.length || pathIndex >= pathParts.length) return false;
    const patternPart = patternParts[patternIndex]!;
    if (TOKEN_SEGMENT.test(patternPart)) return visit(patternIndex + 1, pathIndex + 1);
    if (patternPart.endsWith('[]')) {
      const key = patternPart.slice(0, -2);
      return pathParts[pathIndex] === key && /^\d+$/.test(pathParts[pathIndex + 1] ?? '') && visit(patternIndex + 1, pathIndex + 2);
    }
    return patternPart === pathParts[pathIndex] && visit(patternIndex + 1, pathIndex + 1);
  };
  return visit(0, 0);
}

function pruneStaleShape(args: {
  value: unknown;
  expected: unknown;
  fillPaths: readonly string[];
  key: string;
  path: string;
  changes: Change[];
}): void {
  if (args.path && args.fillPaths.some((fillPath) => pathMatchesPattern(fillPath, args.path))) return;
  if (Array.isArray(args.value)) {
    if (!Array.isArray(args.expected) || !args.expected.length) return;
    args.value.forEach((entry, index) => {
      pruneStaleShape({
        value: entry,
        expected: args.expected[0],
        fillPaths: args.fillPaths,
        key: args.key,
        path: args.path ? `${args.path}.${index}` : String(index),
        changes: args.changes,
      });
    });
    return;
  }
  if (!isRecord(args.value) || !isRecord(args.expected)) return;
  for (const staleKey of Object.keys(args.value)) {
    if (Object.prototype.hasOwnProperty.call(args.expected, staleKey)) continue;
    const stalePath = args.path ? `${args.path}.${staleKey}` : staleKey;
    args.changes.push({
      key: args.key,
      path: stalePath,
      from: args.value[staleKey],
      to: undefined,
    });
    delete args.value[staleKey];
  }
  for (const [childKey, expectedChild] of Object.entries(args.expected)) {
    pruneStaleShape({
      value: args.value[childKey],
      expected: expectedChild,
      fillPaths: args.fillPaths,
      key: args.key,
      path: args.path ? `${args.path}.${childKey}` : childKey,
      changes: args.changes,
    });
  }
}

function deleteCardsStaleItemStyleKeys(root: Record<string, unknown>, key: string, changes: Change[]): void {
  const cards = root.cards;
  if (!isRecord(cards) || !Array.isArray(cards.items)) return;
  cards.items.forEach((item, index) => {
    if (!isRecord(item) || !isRecord(item.style)) return;
    for (const staleKey of ['radius', 'shadow']) {
      if (!Object.prototype.hasOwnProperty.call(item.style, staleKey)) continue;
      const stalePath = `cards.items.${index}.style.${staleKey}`;
      changes.push({
        key,
        path: stalePath,
        from: item.style[staleKey],
        to: undefined,
      });
      delete item.style[staleKey];
    }
  });
}

function repairTypographySizeCustom(root: Record<string, unknown>, key: string, changes: Change[]): void {
  const typography = root.typography;
  if (!isRecord(typography) || !isRecord(typography.roles)) return;
  for (const [roleKey, roleValue] of Object.entries(typography.roles)) {
    if (!isRecord(roleValue) || typeof roleValue.sizeCustom !== 'string') continue;
    const match = roleValue.sizeCustom.trim().match(/^(\d+(?:\.\d+)?)px$/);
    if (!match) continue;
    const next = Number(match[1]);
    changes.push({
      key,
      path: `typography.roles.${roleKey}.sizeCustom`,
      from: roleValue.sizeCustom,
      to: next,
    });
    roleValue.sizeCustom = next;
  }
}

async function main(): Promise<void> {
  loadLocalEnv();
  installCompilerFetchShim();
  execFileSync('node', ['scripts/cloudflare/r2.mjs', 'preflight'], { cwd: repoRoot, stdio: 'pipe' });

  const controlsByWidget = new Map<string, FillControl[]>();
  for (const widget of widgets) {
    controlsByWidget.set(widget.widgetType, await compileFillControls(widget.widgetType));
  }

  const changes: Change[] = [];
  const now = new Date().toISOString();
  const accountDefaultsKey = `accounts/${accountId}/widget-defaults.json`;
  const accountDefaults = r2GetJson<JsonRecord>(accountDefaultsKey);
  const nextAccountDefaults = clone(accountDefaults);

  if (isRecord(nextAccountDefaults.shell)) {
    const shellControls = controlsByWidget.get(widgets[0]!.widgetType) ?? [];
    repairRoot({
      root: nextAccountDefaults.shell,
      controls: shellControls.filter((control) => !control.path.includes(widgets[0]!.widgetType)),
      key: `${accountDefaultsKey}:shell`,
      changes,
    });
    repairTypographySizeCustom(nextAccountDefaults.shell, `${accountDefaultsKey}:shell`, changes);
  }

  const defaultsWidgets = isRecord(nextAccountDefaults.widgets) ? nextAccountDefaults.widgets : {};
  for (const widget of widgets) {
    const entry = defaultsWidgets[widget.widgetType];
    if (!isRecord(entry) || !isRecord(entry.core)) continue;
    const specDoc = JSON.parse(fs.readFileSync(path.join(widgetsRoot, widget.widgetType, 'spec.json'), 'utf8')) as JsonRecord;
    const controls = controlsByWidget.get(widget.widgetType) ?? [];
    repairRoot({
      root: entry.core,
      controls,
      key: `${accountDefaultsKey}:widgets.${widget.widgetType}.core`,
      changes,
    });
    repairTypographySizeCustom(entry.core, `${accountDefaultsKey}:widgets.${widget.widgetType}.core`, changes);
    if (widget.widgetType === 'cards') {
      deleteCardsStaleItemStyleKeys(
        entry.core,
        `${accountDefaultsKey}:widgets.${widget.widgetType}.core`,
        changes,
      );
    }
    pruneStaleShape({
      value: entry.core,
      expected: isRecord(specDoc.defaults) ? specDoc.defaults : {},
      fillPaths: controls.map((control) => control.path),
      key: `${accountDefaultsKey}:widgets.${widget.widgetType}.core`,
      path: '',
      changes,
    });
    const fullDefault = mergeRecords(
      isRecord(nextAccountDefaults.shell) ? nextAccountDefaults.shell : {},
      entry.core,
    );
    const compiled = await compileWidgetServer(specDoc);
    assertSessionConfigContract(fullDefault, compiled);
  }

  const accountDefaultChanged = JSON.stringify(accountDefaults) !== JSON.stringify(nextAccountDefaults);
  if (accountDefaultChanged) {
    nextAccountDefaults.updatedAt = now;
    r2PutText(accountDefaultsKey, JSON.stringify(nextAccountDefaults, null, 2), 'application/json');
  }

  for (const widget of widgets) {
    const root = `accounts/${accountId}/instances/${widget.instanceId}`;
    const configKey = `${root}/instance.config.json`;
    const contentKey = `${root}/instance.content.json`;
    const configDoc = r2GetJson<JsonRecord>(configKey);
    const contentDoc = r2GetJson<JsonRecord>(contentKey);
    const nextConfigDoc = clone(configDoc);
    if (!isRecord(nextConfigDoc.config)) throw new Error(`${configKey} missing config object`);
    const specDoc = JSON.parse(fs.readFileSync(path.join(widgetsRoot, widget.widgetType, 'spec.json'), 'utf8')) as JsonRecord;
    const compiled = await compileWidgetServer(specDoc);
    const controls = controlsByWidget.get(widget.widgetType) ?? [];
    repairRoot({
      root: nextConfigDoc.config,
      controls,
      key: configKey,
      changes,
    });
    repairTypographySizeCustom(nextConfigDoc.config, configKey, changes);
    if (widget.widgetType === 'cards') deleteCardsStaleItemStyleKeys(nextConfigDoc.config, configKey, changes);
    pruneStaleShape({
      value: nextConfigDoc.config,
      expected: compiled.defaults,
      fillPaths: controls.map((control) => control.path),
      key: configKey,
      path: '',
      changes,
    });
    const fullConfig = composeConfigWithContent(nextConfigDoc.config, contentDoc);
    assertSessionConfigContract(fullConfig, compiled);

    if (JSON.stringify(configDoc) !== JSON.stringify(nextConfigDoc)) {
      nextConfigDoc.updatedAt = now;
      r2PutText(configKey, JSON.stringify(nextConfigDoc, null, 2), 'application/json');
    }
  }

  for (const change of changes) {
    console.log(`${apply ? '[apply]' : '[dry-run]'} ${change.key} ${change.path}: ${JSON.stringify(change.from)} -> ${JSON.stringify(change.to)}`);
  }
  console.log(`${apply ? '[apply]' : '[dry-run]'} ${changes.length} stored source issue(s) ${apply ? 'repaired' : 'would be repaired'}`);
  if (!apply) console.log('Dry run only. Re-run with --apply to write R2 objects.');
}

main().catch((error) => {
  if (error instanceof Error) {
    console.error(`[repair-107-fill-contract] ${error.stack || error.message}`);
  } else {
    console.error(`[repair-107-fill-contract] ${String(error)}`);
  }
  process.exit(1);
});
