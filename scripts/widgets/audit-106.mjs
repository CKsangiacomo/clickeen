#!/usr/bin/env node
/* eslint-disable no-console */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(scriptPath), '..', '..');
const widgetsRoot = path.join(repoRoot, 'tokyo', 'product', 'widgets');
const accountId = process.env.CK_106_ACCOUNT_ID || 'CLICKEEN';
const skipR2 = process.argv.includes('--skip-r2');

const widgets = [
  { widgetType: 'big-bang', instanceId: 'QD1G068MX7', expectedRoot: 'bigBang', published: false },
  { widgetType: 'calltoaction', instanceId: 'SZBSB5HHFJ', expectedRoot: 'calltoaction', published: false },
  { widgetType: 'cards', instanceId: 'U37WRSMY7J', expectedRoot: 'cards', published: false },
  { widgetType: 'countdown', instanceId: 'H7IF9M2K9B', expectedRoot: 'countdown', published: true },
  { widgetType: 'faq', instanceId: 'UZ3JEJSHII', expectedRoot: 'faq', published: true },
  { widgetType: 'logoshowcase', instanceId: '8FMVZFFPJV', expectedRoot: 'logoshowcase', published: true },
  { widgetType: 'split-carousel-media', instanceId: 'P10U6N7Y2X', expectedRoot: 'splitCarouselMedia', published: false },
  { widgetType: 'split-media', instanceId: 'KUGYTX2ZMQ', expectedRoot: 'splitMedia', published: false },
];

const sourceWidgets = [
  ...widgets,
];
const supportedWidgetTypes = new Set(sourceWidgets.map((widget) => widget.widgetType));
const expectedInstanceIds = new Set(widgets.map((widget) => widget.instanceId));

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
const shellMetadataRoots = ['typography.roleScales'];
const coreMetadataRootsByWidgetType = {};
const requiredSharedNodes = [
  ['header-content', 'header-content-no-header-cta'],
  ['header-layout', 'header-layout-no-header-cta'],
  ['core-size'],
  ['stagepod-layout'],
  ['header-appearance', 'header-appearance-no-header-cta'],
  ['stagepod-appearance'],
  ['settings-behavior'],
];
const staleAliasPatterns = [
  /^cta(?:\.|$)/,
  /^appearance\.cta/,
  /^appearance\.cardwrapper(?:\.|$)/,
  /^primaryCta(?:\.|$)/,
  /^secondaryCta(?:\.|$)/,
  /^body(?:\.|$)/,
  /^showTitle$/,
  /^title$/,
];
const packageFiles = ['instance.config.json', 'instance.content.json', 'index.html', 'styles.css', 'runtime.js', 'package.json'];

function loadLocalEnv() {
  const envPath = path.join(repoRoot, '.env.local');
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

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function mergeRecords(base, override) {
  const next = clone(base);
  for (const [key, value] of Object.entries(override || {})) {
    const existing = next[key];
    if (isRecord(existing) && isRecord(value)) next[key] = mergeRecords(existing, value);
    else next[key] = clone(value);
  }
  return next;
}

function collectLeafPaths(value, prefix = '') {
  if (Array.isArray(value)) return prefix ? [prefix] : [];
  if (!isRecord(value)) return prefix ? [prefix] : [];
  const paths = Object.entries(value).flatMap(([key, child]) => collectLeafPaths(child, prefix ? `${prefix}.${key}` : key));
  return paths.length ? paths : prefix ? [prefix] : [];
}

function collectObjectPaths(value, prefix = '') {
  if (!isRecord(value)) return [];
  const paths = [];
  for (const [key, child] of Object.entries(value)) {
    const next = prefix ? `${prefix}.${key}` : key;
    paths.push(next);
    paths.push(...collectObjectPaths(child, next));
  }
  return paths;
}

function getPath(root, pathValue) {
  let cursor = root;
  for (const part of pathValue.split('.').filter(Boolean)) {
    if (!isRecord(cursor)) return undefined;
    cursor = cursor[part];
  }
  return cursor;
}

function isValidHeaderCtaHref(value) {
  if (typeof value !== 'string' || !value.trim()) return false;
  if (!/^https?:\/\//i.test(value.trim())) return false;
  try {
    new URL(value.trim());
    return true;
  } catch {
    return false;
  }
}

function auditHeaderCtaHref(issues, scope, state) {
  if (getPath(state, 'headerCta.enabled') !== true) return;
  const href = getPath(state, 'headerCta.href');
  if (!isValidHeaderCtaHref(href)) {
    pushIssue(issues, scope, 'headerCta.href', `enabled Header CTA requires an absolute http(s) URL, got ${JSON.stringify(href)}`);
  }
}

function collectEditorPaths(node) {
  if (!isRecord(node)) return [];
  const paths = [];
  if ((node.kind === 'field' || node.kind === 'repeatable') && typeof node.path === 'string' && node.path.trim()) {
    paths.push(node.path.trim());
  }
  if (
    (node.kind === 'field' || node.kind === 'repeatable') &&
    isRecord(node.attrs) &&
    typeof node.attrs.path === 'string' &&
    node.attrs.path.trim()
  ) {
    paths.push(node.attrs.path.trim());
  }
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) value.forEach((entry) => paths.push(...collectEditorPaths(entry)));
    else if (isRecord(value)) paths.push(...collectEditorPaths(value));
  }
  return paths;
}

function collectSharedIds(node) {
  if (!isRecord(node)) return [];
  const ids = [];
  if (node.kind === 'shared' && typeof node.id === 'string' && node.id.trim()) ids.push(node.id.trim());
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) value.forEach((entry) => ids.push(...collectSharedIds(entry)));
    else if (isRecord(value)) ids.push(...collectSharedIds(value));
  }
  return Array.from(new Set(ids));
}

function startsPath(pathValue, family) {
  return pathValue === family || pathValue.startsWith(`${family}.`);
}

function isShellPath(pathValue) {
  const top = pathValue.split('.')[0];
  if (shellTopLevel.has(top)) return true;
  if (startsPath(pathValue, 'behavior.showBacklink') || startsPath(pathValue, 'behavior.socialShare')) return true;
  if ([...shellAppearanceKeys].some((key) => startsPath(pathValue, `appearance.${key}`))) return true;
  if (pathValue === 'typography.globalFamily') return true;
  const role = pathValue.match(/^typography\.roles\.([^.]+)/)?.[1];
  if (role && shellTypographyRoles.has(role)) return true;
  const scale = pathValue.match(/^typography\.roleScales\.([^.]+)/)?.[1];
  if (scale && shellTypographyRoles.has(scale)) return true;
  return false;
}

function isPathCovered(pathValue, controls) {
  for (const control of controls) {
    if (pathValue === control || pathValue.startsWith(`${control}.`)) return true;
  }
  return false;
}

function isMetadataPath(pathValue, roots) {
  return roots.some((root) => pathValue === root || pathValue.startsWith(`${root}.`));
}

function pathExists(root, pathValue) {
  let cursor = root;
  for (const part of pathValue.split('.').filter(Boolean)) {
    if (!isRecord(cursor)) return false;
    cursor = cursor[part];
    if (typeof cursor === 'undefined') return false;
  }
  return true;
}

function typographyControlPaths(defaults) {
  const roles = isRecord(defaults?.typography?.roles) ? defaults.typography.roles : {};
  return Object.keys(roles).flatMap((role) => [
    `typography.roles.${role}.family`,
    `typography.roles.${role}.sizePreset`,
    `typography.roles.${role}.sizeCustom`,
    `typography.roles.${role}.fontStyle`,
    `typography.roles.${role}.weight`,
    `typography.roles.${role}.color`,
    `typography.roles.${role}.lineHeightPreset`,
    `typography.roles.${role}.lineHeightCustom`,
    `typography.roles.${role}.trackingPreset`,
    `typography.roles.${role}.trackingCustom`,
  ]).concat('typography.globalFamily');
}

function shellControlPaths(defaults) {
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
  ];
  const paths = [
    'header.enabled',
    'header.title',
    'header.showSubtitle',
    'header.subtitleHtml',
    'headerCta.enabled',
    'headerCta.label',
    'headerCta.href',
    'headerCta.openMode',
    'headerCta.iconEnabled',
    'headerCta.iconPlacement',
    'headerCta.iconName',
    'header.placement',
    'header.alignment',
    'header.gap',
    'header.textGap',
    'header.ctaPlacement',
    'header.innerGap',
    'coreSize.mode',
    'coreSize.fixedHeight',
    'coreSize.minHeight',
    'coreSize.preferredVw',
    'coreSize.maxHeight',
    'pod.widthMode',
    'pod.contentWidth',
    'pod.padding.desktop.linked',
    'pod.padding.desktop.all',
    'pod.padding.desktop.top',
    'pod.padding.desktop.right',
    'pod.padding.desktop.bottom',
    'pod.padding.desktop.left',
    'pod.padding.mobile.linked',
    'pod.padding.mobile.all',
    'pod.padding.mobile.top',
    'pod.padding.mobile.right',
    'pod.padding.mobile.bottom',
    'pod.padding.mobile.left',
    'stage.alignment',
    'stage.canvas.mode',
    'stage.canvas.width',
    'stage.canvas.height',
    'stage.padding.desktop.linked',
    'stage.padding.desktop.all',
    'stage.padding.desktop.top',
    'stage.padding.desktop.right',
    'stage.padding.desktop.bottom',
    'stage.padding.desktop.left',
    'stage.padding.mobile.linked',
    'stage.padding.mobile.all',
    'stage.padding.mobile.top',
    'stage.padding.mobile.right',
    'stage.padding.mobile.bottom',
    'stage.padding.mobile.left',
    'stage.background',
    'stage.shadow',
    'stage.insideShadow.linked',
    'stage.insideShadow.layer',
    'stage.insideShadow.all',
    'stage.insideShadow.top',
    'stage.insideShadow.right',
    'stage.insideShadow.bottom',
    'stage.insideShadow.left',
    'pod.background',
    'appearance.podBorder',
    'pod.shadow',
    'pod.insideShadow.linked',
    'pod.insideShadow.layer',
    'pod.insideShadow.all',
    'pod.insideShadow.top',
    'pod.insideShadow.right',
    'pod.insideShadow.bottom',
    'pod.insideShadow.left',
    'pod.radiusLinked',
    'pod.radius',
    'pod.radiusTL',
    'pod.radiusTR',
    'pod.radiusBR',
    'pod.radiusBL',
    'appearance.headerCta.sizePreset',
    'appearance.headerCta.paddingLinked',
    'appearance.headerCta.paddingInline',
    'appearance.headerCta.paddingBlock',
    'appearance.headerCta.background',
    'appearance.headerCta.textColor',
    'appearance.headerCta.border',
    'appearance.headerCta.radius',
    'appearance.headerCta.iconSizePreset',
    'appearance.headerCta.iconSize',
    'appearance.localeSwitcherBackground',
    'appearance.localeSwitcherTextColor',
    'appearance.localeSwitcherBorder',
    'appearance.localeSwitcherRadius',
    'appearance.localeSwitcherPaddingInline',
    'appearance.localeSwitcherPaddingBlock',
    'localeSwitcher.enabled',
    'localeSwitcher.byIp',
    'localeSwitcher.alwaysShowLocale',
    'localeSwitcher.attachTo',
    'localeSwitcher.position',
    'behavior.showBacklink',
    'behavior.socialShare.enabled',
    ...socialChannels.map((channel) => `behavior.socialShare.channels.${channel}`),
    ...typographyControlPaths(defaults),
  ];
  return new Set(paths);
}

function cardWrapperControlPaths(coreDefaults, widgetType) {
  const candidates = [`${widgetType}.appearance.cardwrapper`];
  const base = candidates.find((pathValue) => pathExists(coreDefaults, pathValue));
  if (!base) return [];
  const paths = [
    `${base}.radiusLinked`,
    `${base}.radius`,
    `${base}.radiusTL`,
    `${base}.radiusTR`,
    `${base}.radiusBR`,
    `${base}.radiusBL`,
    `${base}.border`,
    `${base}.shadow`,
  ];
  if (pathExists(coreDefaults, `${base}.insideShadow`)) {
    paths.push(
      `${base}.insideShadow.linked`,
      `${base}.insideShadow.layer`,
      `${base}.insideShadow.all`,
      `${base}.insideShadow.top`,
      `${base}.insideShadow.right`,
      `${base}.insideShadow.bottom`,
      `${base}.insideShadow.left`,
    );
  }
  return paths;
}

function coreMetadataRoots(coreDefaults, widgetType) {
  const roots = [];
  if (pathExists(coreDefaults, 'uiLabels.core')) roots.push('uiLabels.core');
  if (pathExists(coreDefaults, 'typography.roleScales')) roots.push('typography.roleScales');
  for (const root of coreMetadataRootsByWidgetType[widgetType] || []) {
    if (pathExists(coreDefaults, root)) roots.push(root);
  }
  return roots;
}

function coreControlPaths(spec, fullDefaults, coreDefaults, widgetType) {
  return new Set([
    ...collectEditorPaths(spec.editor || {}).filter((pathValue) => !isShellPath(pathValue)),
    ...typographyControlPaths(coreDefaults),
    ...typographyControlPaths(fullDefaults).filter((pathValue) => !isShellPath(pathValue)),
    ...cardWrapperControlPaths(coreDefaults, widgetType),
  ]);
}

function r2GetJson(key) {
  const text = execFileSync('node', ['scripts/cloudflare/r2.mjs', 'get', key], {
    cwd: repoRoot,
    encoding: 'utf8',
    maxBuffer: 50 * 1024 * 1024,
  });
  return JSON.parse(text);
}

function r2ListKeys(prefix) {
  const text = execFileSync('node', ['scripts/cloudflare/r2.mjs', 'ls', prefix, '--limit', '500'], {
    cwd: repoRoot,
    encoding: 'utf8',
    maxBuffer: 50 * 1024 * 1024,
  });
  return text
    .split(/\r?\n/)
    .map((line) => line.trim().split(/\s+/)[0])
    .filter((key) => key && key.startsWith(prefix));
}

function listSupabaseInstanceRows() {
  const baseUrl = String(process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!baseUrl || !serviceRoleKey) {
    warnings.push({
      scope: 'supabase registry',
      path: 'env',
      message: 'SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY missing; registry row audit skipped',
    });
    return [];
  }

  const url = `${baseUrl}/rest/v1/instances?account_id=eq.${encodeURIComponent(accountId)}&select=id,account_id,widget_type,publish_status,translation_status,created_at,edited_at&order=id.asc`;
  const text = execFileSync(
    'node',
    [
      '-e',
      `
const url = process.argv[1];
const key = process.argv[2];
const response = await fetch(url, { headers: { apikey: key, Authorization: 'Bearer ' + key } });
const text = await response.text();
if (!response.ok) {
  console.error(text || response.statusText);
  process.exit(1);
}
process.stdout.write(text);
`,
      url,
      serviceRoleKey,
    ],
    {
      cwd: repoRoot,
      encoding: 'utf8',
      maxBuffer: 50 * 1024 * 1024,
    },
  );
  const rows = JSON.parse(text);
  return Array.isArray(rows) ? rows : [];
}

function pushIssue(issues, scope, pathValue, message) {
  issues.push({ scope, path: pathValue, message });
}

function printSection(title, rows) {
  console.log(`\n## ${title}`);
  if (!rows.length) {
    console.log('OK');
    return;
  }
  rows.forEach((row) => console.log(`${row.scope}: ${row.path} - ${row.message}`));
}

loadLocalEnv();

const sourceIssues = [];
const accountIssues = [];
const instanceIssues = [];
const warnings = [];
const specs = new Map();

for (const widget of sourceWidgets) {
  const widgetDir = path.join(widgetsRoot, widget.widgetType);
  const specPath = path.join(widgetDir, 'spec.json');
  const editablePath = path.join(widgetDir, 'editable-fields.json');
  const clientPath = path.join(widgetDir, 'widget.client.js');
  const cssPath = path.join(widgetDir, 'widget.css');
  const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
  const editable = JSON.parse(fs.readFileSync(editablePath, 'utf8'));
  const clientSource = fs.readFileSync(clientPath, 'utf8');
  const cssSource = fs.readFileSync(cssPath, 'utf8');
  specs.set(widget.widgetType, spec);

  const loc = fs.readFileSync(specPath, 'utf8').split(/\r?\n/).length;
  const defaultRoots = Object.keys(spec.defaults || {});
  const shellDefaults = collectLeafPaths(spec.defaults || {}).filter(isShellPath);
  if (shellDefaults.length) {
    pushIssue(sourceIssues, widget.widgetType, 'spec.defaults', `contains Shell default paths: ${shellDefaults.slice(0, 20).join(', ')}`);
  }

  const sharedIds = collectSharedIds(spec.editor || {});
  requiredSharedNodes.forEach((family) => {
    if (!family.some((id) => sharedIds.includes(id))) {
      pushIssue(sourceIssues, widget.widgetType, `editor.shared.${family[0]}`, 'missing required shared Shell editor node');
    }
  });

  const objectPaths = collectObjectPaths(spec.defaults || {});
  const staleSourceAliases = objectPaths.filter((pathValue) => staleAliasPatterns.some((pattern) => pattern.test(pathValue)));
  if (staleSourceAliases.length) {
    pushIssue(sourceIssues, widget.widgetType, 'source aliases', `old aliases remain: ${staleSourceAliases.slice(0, 20).join(', ')}`);
  }
  if (/\bstate\.core\b/.test(clientSource)) {
    pushIssue(sourceIssues, widget.widgetType, 'widget.client.js', 'runtime reads transitional state.core instead of widget-specific Core namespace');
  }
  if (/\bstate\.appearance(?:\s*&&\s*state\.appearance)?\.cardwrapper\b/.test(clientSource)) {
    pushIssue(sourceIssues, widget.widgetType, 'widget.client.js', 'runtime reads root state.appearance.cardwrapper; cardwrapper is widget Core appearance');
  }
  if (['split-carousel-media', 'split-media'].includes(widget.widgetType)) {
    const coreClass =
      widget.widgetType === 'split-media'
        ? 'ck-split-media__core'
        : 'ck-split-carousel-media__core';
    const autoSizingPattern = new RegExp(`\\.${coreClass}\\[data-core-size-mode=['"]auto['"]\\][\\s\\S]*aspect-ratio`);
    if (!autoSizingPattern.test(cssSource)) {
      pushIssue(sourceIssues, widget.widgetType, 'widget.css', 'Split Core must define intrinsic auto sizing for absolutely positioned media');
    }
    const coreSizeSource = fs.readFileSync(path.join(widgetsRoot, 'shared', 'coreSize.js'), 'utf8');
    if (!/dataset\.coreSizeMode/.test(coreSizeSource)) {
      pushIssue(sourceIssues, widget.widgetType, '../shared/coreSize.js', 'shared CoreSize must expose active sizing mode for Core auto rendering');
    }
  }

  const hasExpectedRoot = defaultRoots.includes(widget.expectedRoot);
  if (!hasExpectedRoot) {
    pushIssue(sourceIssues, widget.widgetType, 'spec.defaults', `does not use widget-specific Core root "${widget.expectedRoot}"`);
  }
  if (defaultRoots.includes('core')) {
    pushIssue(sourceIssues, widget.widgetType, 'spec.defaults.core', 'transitional generic core.* root remains');
  }

  const editableFields = Array.isArray(editable.fields) ? editable.fields : [];
  editableFields.forEach((field, index) => {
    const pathValue = typeof field?.path === 'string' ? field.path.trim() : '';
    if (!pathValue) pushIssue(sourceIssues, widget.widgetType, `editable-fields[${index}]`, 'missing path');
    if (staleAliasPatterns.some((pattern) => pattern.test(pathValue))) {
      pushIssue(sourceIssues, widget.widgetType, pathValue, 'editable field uses old alias path');
    }
  });

  console.log(
    `[source] ${widget.widgetType}: specLOC=${loc} roots=${defaultRoots.join(',')} editorFields=${collectEditorPaths(spec.editor || {}).length} editableFields=${editableFields.length}`,
  );
}

if (!skipR2) {
  execFileSync('node', ['scripts/cloudflare/r2.mjs', 'preflight'], { cwd: repoRoot, stdio: 'pipe' });
  const accountDefaults = r2GetJson(`accounts/${accountId}/widget-defaults.json`);
  const accountWidgetDefaults = isRecord(accountDefaults.widgets) ? accountDefaults.widgets : {};
  Object.keys(accountWidgetDefaults)
    .filter((widgetType) => !supportedWidgetTypes.has(widgetType))
    .forEach((widgetType) =>
      pushIssue(accountIssues, 'account widget defaults', `widgets.${widgetType}`, 'unsupported widget defaults key remains'),
    );
  const accountShell = accountDefaults.shell || {};
  auditHeaderCtaHref(accountIssues, 'account shell defaults', accountShell);
  const shellControls = shellControlPaths(accountShell);
  collectLeafPaths(accountShell)
    .filter((pathValue) => !isPathCovered(pathValue, shellControls))
    .filter((pathValue) => !isMetadataPath(pathValue, shellMetadataRoots))
    .forEach((pathValue) => pushIssue(accountIssues, 'account shell defaults', pathValue, 'not covered by Builder control contract'));

  for (const widget of widgets) {
    const spec = specs.get(widget.widgetType);
    const core = accountDefaults.widgets?.[widget.widgetType]?.core;
    if (!isRecord(core)) {
      pushIssue(accountIssues, widget.widgetType, 'account widgets', 'missing account Core defaults');
      continue;
    }
    const fullDefaults = mergeRecords(accountShell, core);
    const controls = coreControlPaths(spec, fullDefaults, core, widget.widgetType);
    const metadataRoots = coreMetadataRoots(core, widget.widgetType);
    collectLeafPaths(core)
      .filter((pathValue) => !isPathCovered(pathValue, controls))
      .filter((pathValue) => !isMetadataPath(pathValue, metadataRoots))
      .forEach((pathValue) => pushIssue(accountIssues, widget.widgetType, pathValue, 'not covered by Builder control contract'));
  }

  const registryRows = listSupabaseInstanceRows();
  for (const row of registryRows) {
    const id = typeof row?.id === 'string' ? row.id : '';
    const widgetType = typeof row?.widget_type === 'string' ? row.widget_type : '';
    if (!expectedInstanceIds.has(id)) {
      pushIssue(instanceIssues, 'supabase registry', id || '(missing id)', `unexpected live instance row remains (${widgetType || 'unknown widget type'})`);
      continue;
    }
    const expected = widgets.find((widget) => widget.instanceId === id);
    if (expected && widgetType !== expected.widgetType) {
      pushIssue(instanceIssues, 'supabase registry', id, `expected ${expected.widgetType}, got ${widgetType || 'unknown widget type'}`);
    }
    if (widgetType && !supportedWidgetTypes.has(widgetType)) {
      pushIssue(instanceIssues, 'supabase registry', id, `unsupported widget_type ${widgetType}`);
    }
  }

  const instanceRootKeys = r2ListKeys(`accounts/${accountId}/instances/`);
  const r2InstanceIds = new Set(
    instanceRootKeys
      .map((key) => key.match(new RegExp(`^accounts/${accountId}/instances/([^/]+)/instance\\.config\\.json$`))?.[1])
      .filter(Boolean),
  );
  for (const instanceId of r2InstanceIds) {
    if (!expectedInstanceIds.has(instanceId)) {
      pushIssue(instanceIssues, 'r2 instances', instanceId, 'unexpected live instance source remains');
    }
  }

  for (const widget of widgets) {
    const prefix = `accounts/${accountId}/instances/${widget.instanceId}/`;
    const keys = r2ListKeys(prefix);
    const wrapper = r2GetJson(`${prefix}instance.config.json`);
    const content = r2GetJson(`${prefix}instance.content.json`);
    const state = wrapper.config;
    if (wrapper.widgetType !== widget.widgetType) {
      pushIssue(instanceIssues, widget.instanceId, 'widgetType', `expected ${widget.widgetType}, got ${String(wrapper.widgetType)}`);
    }
    if (!isRecord(state)) {
      pushIssue(instanceIssues, widget.instanceId, 'config', 'instance.config.json missing config object');
      continue;
    }

    ['header', 'headerCta', 'stage', 'pod', 'coreSize', 'localeSwitcher', 'behavior', 'appearance', 'typography'].forEach((root) => {
      if (!isRecord(state[root])) pushIssue(instanceIssues, widget.instanceId, root, 'missing Shell state root');
    });
    auditHeaderCtaHref(instanceIssues, widget.instanceId, state);
    ['headerCta', 'localeSwitcherBackground', 'localeSwitcherTextColor', 'localeSwitcherBorder', 'localeSwitcherRadius', 'localeSwitcherPaddingInline', 'localeSwitcherPaddingBlock', 'podBorder'].forEach((key) => {
      if (typeof state.appearance?.[key] === 'undefined') {
        pushIssue(instanceIssues, widget.instanceId, `appearance.${key}`, 'missing Shell appearance default');
      }
    });
    ['title', 'body', 'button', 'localeSwitcher'].forEach((role) => {
      if (!isRecord(state.typography?.roles?.[role])) {
        pushIssue(instanceIssues, widget.instanceId, `typography.roles.${role}`, 'missing Shell typography role');
      }
    });
    if (state.stage?.canvas?.mode !== 'viewport') {
      pushIssue(instanceIssues, widget.instanceId, 'stage.canvas.mode', `must be viewport, got ${String(state.stage?.canvas?.mode)}`);
    }
    if (state.pod?.widthMode !== 'full') {
      pushIssue(instanceIssues, widget.instanceId, 'pod.widthMode', `must be full, got ${String(state.pod?.widthMode)}`);
    }
    if (!isRecord(state[widget.expectedRoot])) {
      pushIssue(instanceIssues, widget.instanceId, widget.expectedRoot, 'missing widget-specific Core state root');
    }
    if (isRecord(state.core)) {
      pushIssue(instanceIssues, widget.instanceId, 'core', 'generic core.* saved state remains');
    }
    const channels = state.behavior?.socialShare?.channels;
    if (!isRecord(channels) || Object.keys(channels).length !== 18) {
      pushIssue(instanceIssues, widget.instanceId, 'behavior.socialShare.channels', 'missing complete Shell social-share channel defaults');
    }

    const staleAliases = collectObjectPaths(state).filter((pathValue) => staleAliasPatterns.some((pattern) => pattern.test(pathValue)));
    staleAliases.forEach((pathValue) => pushIssue(instanceIssues, widget.instanceId, pathValue, 'old saved-state alias remains'));

    const contentFields = content.fields && isRecord(content.fields) ? Object.keys(content.fields) : [];
    contentFields
      .filter((pathValue) => staleAliasPatterns.some((pattern) => pattern.test(pathValue)))
      .forEach((pathValue) => pushIssue(instanceIssues, widget.instanceId, `content.fields.${pathValue}`, 'old content alias remains'));
    contentFields
      .filter((pathValue) => pathValue === 'core' || pathValue.startsWith('core.'))
      .forEach((pathValue) => pushIssue(instanceIssues, widget.instanceId, `content.fields.${pathValue}`, 'generic core.* content path remains'));

    packageFiles.forEach((file) => {
      if (!keys.includes(`${prefix}${file}`)) pushIssue(instanceIssues, widget.instanceId, file, 'live instance missing package/source file');
    });
  }
}

printSection('Source Issues', sourceIssues);
printSection('Account Defaults Issues', accountIssues);
printSection('Live Instance Issues', instanceIssues);
printSection('Warnings', warnings);

const totalIssues = sourceIssues.length + accountIssues.length + instanceIssues.length;
if (totalIssues > 0) {
  console.error(`\n[106 audit] FAIL: ${totalIssues} issue(s).`);
  process.exit(1);
}

console.log('\n[106 audit] PASS');
