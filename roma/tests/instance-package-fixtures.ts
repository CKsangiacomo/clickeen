import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseLimitsSpec } from '@clickeen/ck-policy';
import { readWidgetEditableFieldsContract } from '@clickeen/ck-contracts/translated-value-primitives';
import {
  COMMON_WIDGET_FACTORY_DEFAULTS,
  WIDGET_SHARED_CSS_MODULE_KEYS,
  WIDGET_SHARED_RUNTIME_MODULE_KEYS,
} from '@clickeen/widget-foundation';
import type { CompiledWidgetForPublicPackage } from '../lib/account-instance-public-package';
import { extractStylesheetSources } from '../../packages/ck-runtime-materializer/src/html';

export const PACKAGE_PARITY_WIDGETS = [
  'big-bang',
  'cards',
  'countdown',
  'faq',
  'logoshowcase',
] as const;

export type PackageParityWidget = (typeof PACKAGE_PARITY_WIDGETS)[number];

const repoRoot = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function cloneRecord(value: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

function mergeDefaultsInto(target: Record<string, unknown>, source: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(source)) {
    const existing = target[key];
    if (typeof existing === 'undefined') {
      target[key] = cloneRecord(value as Record<string, unknown>);
      continue;
    }
    if (isRecord(existing) && isRecord(value)) {
      mergeDefaultsInto(existing, value);
      continue;
    }
    target[key] = value;
  }
}

async function readText(relativePath: string): Promise<string> {
  const diskPath = relativePath.startsWith('product/widgets/')
    ? path.join(repoRoot, 'tokyo', relativePath)
    : path.join(repoRoot, relativePath);
  return readFile(diskPath, 'utf8');
}

async function readCssEntry(relativePath: string): Promise<string> {
  let source = await readText(relativePath);
  for (const match of source.matchAll(/@import\s+url\(["']?([^"')]+)["']?\);?/g)) {
    const importedPath = path.posix.join(path.posix.dirname(relativePath), match[1]);
    source = source.replace(match[0], await readCssEntry(importedPath));
  }
  return source;
}

function mediaTypeForPath(filePath: string): 'application/json' | 'text/html' | 'text/css' | 'text/javascript' {
  if (filePath.endsWith('.json')) return 'application/json';
  if (filePath.endsWith('.html')) return 'text/html';
  if (filePath.endsWith('.css')) return 'text/css';
  return 'text/javascript';
}

async function readWidgetPackageFiles(widgetType: PackageParityWidget) {
  const files: NonNullable<CompiledWidgetForPublicPackage['widgetPackage']>['files'] = {};
  for (const filename of ['spec.json', 'widget.html', 'widget.css', 'widget.client.js'] as const) {
    files[filename] = {
      mediaType: mediaTypeForPath(filename),
      source: await readText(`tokyo/product/widgets/${widgetType}/${filename}`),
    };
  }
  const editableFieldsSource = await readText(`tokyo/product/widgets/${widgetType}/editable-fields.json`);
  if (editableFieldsSource.trim()) {
    files['editable-fields.json'] = {
      mediaType: 'application/json',
      source: editableFieldsSource,
    };
  }
  const widgetHtml = files['widget.html'];
  if (!widgetHtml) throw new Error(`missing widget.html fixture:${widgetType}`);
  for (const href of extractStylesheetSources(widgetHtml.source).filter((source) => source.startsWith('/dieter/'))) {
    files[href] = {
      mediaType: 'text/css',
      source: await readCssEntry(href.slice(1)),
    };
  }
  const supportKeys = new Set<string>([...WIDGET_SHARED_CSS_MODULE_KEYS, ...WIDGET_SHARED_RUNTIME_MODULE_KEYS]);
  supportKeys.add(`product/widgets/${widgetType}/widget.css`);
  supportKeys.add(`product/widgets/${widgetType}/widget.client.js`);
  for (const key of supportKeys) {
    files[key] = {
      mediaType: mediaTypeForPath(key),
      source: await readText(key),
    };
  }
  return files;
}

export async function buildCompiledWidgetFixture(
  widgetType: PackageParityWidget,
): Promise<CompiledWidgetForPublicPackage> {
  const specSource = await readText(`tokyo/product/widgets/${widgetType}/spec.json`);
  const limitsSource = await readText(`tokyo/product/widgets/${widgetType}/limits.json`);
  const editableFieldsSource = await readText(`tokyo/product/widgets/${widgetType}/editable-fields.json`);
  const spec = JSON.parse(specSource) as Record<string, unknown>;
  if (spec.widgetname !== widgetType || typeof spec.displayName !== 'string') {
    throw new Error(`invalid widget spec fixture:${widgetType}`);
  }
  return {
    widgetname: widgetType,
    displayName: spec.displayName,
    limits: parseLimitsSpec(JSON.parse(limitsSource)),
    editableFields: readWidgetEditableFieldsContract(JSON.parse(editableFieldsSource)),
    controls: [],
    widgetPackage: {
      files: await readWidgetPackageFiles(widgetType),
    },
  };
}

export async function buildAccountDefaultStateFixture(widgetType: PackageParityWidget): Promise<Record<string, unknown>> {
  const specSource = await readText(`tokyo/product/widgets/${widgetType}/spec.json`);
  const spec = JSON.parse(specSource) as Record<string, unknown>;
  if (!isRecord(spec.defaults)) throw new Error(`missing widget defaults fixture:${widgetType}`);
  const state = cloneRecord(COMMON_WIDGET_FACTORY_DEFAULTS as unknown as Record<string, unknown>);
  mergeDefaultsInto(state, spec.defaults);
  return state;
}

export function widgetFixtureCoordinate(widgetType: PackageParityWidget) {
  return {
    accountId: 'CLICKEEN',
    instanceId: `inst_${widgetType.replace(/-/g, '_')}`,
    baseLocale: 'en',
    displayName: `${widgetType} parity`,
  };
}
