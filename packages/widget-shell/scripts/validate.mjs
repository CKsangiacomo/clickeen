#!/usr/bin/env node
/* eslint-disable no-console */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(scriptPath), '..', '..', '..');
const widgetsRoot = path.join(repoRoot, 'tokyo', 'product', 'widgets');

const shellTopLevel = new Set(['header', 'headerCta', 'stage', 'pod', 'coreSize', 'localeSwitcher']);
const shellAppearanceKeys = new Set([
  'headerCta',
  'localeSwitcherBackground',
  'localeSwitcherTextColor',
  'localeSwitcherBorder',
  'localeSwitcherRadius',
  'localeSwitcherPaddingInline',
  'localeSwitcherPaddingBlock',
  'podBorder',
]);
const shellTypographyRoles = new Set(['title', 'body', 'button', 'localeSwitcher']);
const shellSharedEditorNodeIds = new Set([
  'header-content',
  'header-content-no-header-cta',
  'header-layout',
  'header-layout-no-header-cta',
  'core-size',
  'header-appearance',
  'header-appearance-no-header-cta',
  'stagepod-appearance',
  'stagepod-layout',
  'stagepod-corners',
  'settings-behavior',
]);
const requiredShellSharedEditorFamilies = [
  ['header-content', 'header-content-no-header-cta'],
  ['header-layout', 'header-layout-no-header-cta'],
  ['core-size'],
  ['stagepod-layout'],
  ['header-appearance', 'header-appearance-no-header-cta'],
  ['stagepod-appearance'],
  ['settings-behavior'],
];

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function leafPaths(value, prefix = '') {
  if (!isRecord(value)) return [prefix];
  const keys = Object.keys(value);
  if (!keys.length) return [prefix];
  return keys.flatMap((key) => leafPaths(value[key], prefix ? `${prefix}.${key}` : key));
}

function startsPath(pathValue, family) {
  return pathValue === family || pathValue.startsWith(`${family}.`);
}

function isShellPath(pathValue) {
  if (shellTopLevel.has(pathValue.split('.')[0])) return true;
  if (startsPath(pathValue, 'behavior.showBacklink') || startsPath(pathValue, 'behavior.socialShare')) return true;
  if ([...shellAppearanceKeys].some((key) => startsPath(pathValue, `appearance.${key}`))) return true;
  if (pathValue === 'typography.globalFamily') return true;
  const role = pathValue.match(/^typography\.roles\.([^.]+)/)?.[1];
  if (role && shellTypographyRoles.has(role)) return true;
  const scale = pathValue.match(/^typography\.roleScales\.([^.]+)/)?.[1];
  if (scale && shellTypographyRoles.has(scale)) return true;
  return false;
}

function collectSharedEditorNodeIds(value) {
  if (!isRecord(value)) return [];
  const ids = [];
  if (value.kind === 'shared' && typeof value.id === 'string' && value.id.trim()) {
    ids.push(value.id.trim());
  }
  for (const child of Object.values(value)) {
    if (Array.isArray(child)) {
      child.forEach((entry) => ids.push(...collectSharedEditorNodeIds(entry)));
    } else if (isRecord(child)) {
      ids.push(...collectSharedEditorNodeIds(child));
    }
  }
  return ids;
}

function validateSharedEditorNodes(widgetType, editor) {
  const ids = new Set(collectSharedEditorNodeIds(editor));
  const localIssues = [];
  requiredShellSharedEditorFamilies.forEach((family) => {
    if (!family.some((id) => ids.has(id))) {
      localIssues.push(`${widgetType}:editor.shared.${family[0]}`);
    }
  });
  ids.forEach((id) => {
    if (!shellSharedEditorNodeIds.has(id)) {
      localIssues.push(`${widgetType}:editor.shared.${id}:unknown`);
    }
  });
  return localIssues;
}

const issues = [];
for (const widgetType of fs.readdirSync(widgetsRoot).sort()) {
  const specPath = path.join(widgetsRoot, widgetType, 'spec.json');
  if (!fs.existsSync(specPath)) continue;
  const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
  for (const pathValue of leafPaths(spec.defaults || {}).filter(Boolean)) {
    if (isShellPath(pathValue)) issues.push(`${widgetType}:${pathValue}`);
  }
  issues.push(...validateSharedEditorNodes(widgetType, spec.editor));
}

if (issues.length) {
  console.error(`[widget-shell validate] Shell defaults remain in widget specs (${issues.length})`);
  issues.forEach((issue) => console.error(issue));
  process.exit(1);
}

console.log('[widget-shell validate] OK: widget specs contain Core defaults only and declare required Shell editor nodes');
