import {
  CORE_SIZE_MODES,
  SHELL_EDITABLE_FIELD_PATHS,
  SHELL_EDITOR_SHARED_NODE_IDS,
  SHELL_REQUIRED_DOM_CLASSES,
  SHELL_REQUIRED_DOM_ROLES,
  pathBelongsToShell,
  pathIsForbiddenShellAlias,
  type WidgetCoreExtensionContract,
  type WidgetShellCoreLabels,
  type WidgetShellCoreSize,
} from './contract';

export type WidgetShellValidationIssue = {
  path: string;
  message: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function issue(path: string, message: string): WidgetShellValidationIssue {
  return { path, message };
}

function isShellWidgetDefaults(defaults: unknown): boolean {
  if (!isRecord(defaults)) return false;
  return Boolean(
    isRecord(defaults.header) ||
    isRecord(defaults.headerCta) ||
    isRecord(defaults.coreSize) ||
    isRecord(defaults.stage) ||
    isRecord(defaults.pod) ||
    isRecord(defaults.localeSwitcher),
  );
}

function collectObjectPaths(value: unknown, prefix = ''): string[] {
  if (!isRecord(value)) return [];
  const paths: string[] = [];
  for (const [key, child] of Object.entries(value)) {
    if (!key) continue;
    const path = prefix ? `${prefix}.${key}` : key;
    paths.push(path);
    if (isRecord(child)) paths.push(...collectObjectPaths(child, path));
  }
  return paths;
}

function collectEditorFieldPaths(node: unknown): string[] {
  if (!isRecord(node)) return [];
  const paths: string[] = [];
  if (node.kind === 'field' && typeof node.path === 'string' && node.path.trim()) {
    paths.push(node.path.trim());
  }
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) value.forEach((item) => paths.push(...collectEditorFieldPaths(item)));
    else if (isRecord(value)) paths.push(...collectEditorFieldPaths(value));
  }
  return paths;
}

function collectEditorSharedNodeIds(node: unknown): string[] {
  if (!isRecord(node)) return [];
  const ids: string[] = [];
  if (node.kind === 'shared' && typeof node.id === 'string' && node.id.trim()) {
    ids.push(node.id.trim());
  }
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) value.forEach((item) => ids.push(...collectEditorSharedNodeIds(item)));
    else if (isRecord(value)) ids.push(...collectEditorSharedNodeIds(value));
  }
  return ids;
}

function editorPathRequiresSharedShellNode(path: string): boolean {
  const normalized = path.trim();
  return (
    normalized === 'coreSize' ||
    normalized.startsWith('coreSize.') ||
    normalized === 'header' ||
    normalized.startsWith('header.') ||
    normalized === 'headerCta' ||
    normalized.startsWith('headerCta.') ||
    normalized === 'behavior.showBacklink' ||
    normalized === 'behavior.socialShare' ||
    normalized.startsWith('behavior.socialShare.')
  );
}

const GLOBAL_TYPOGRAPHY_SCALE_ROLES = new Set([
  'title',
  'body',
  'button',
  'localeSwitcher',
]);

function validateRequiredRecord(parent: Record<string, unknown>, path: string): WidgetShellValidationIssue[] {
  const value = path.split('.').reduce<unknown>((node, key) => (isRecord(node) ? node[key] : undefined), parent);
  return isRecord(value) ? [] : [issue(path, 'Shell widget source is missing required Shell default object.')];
}

function validateShellTypography(defaults: Record<string, unknown>): WidgetShellValidationIssue[] {
  const typography = isRecord(defaults.typography) ? defaults.typography : null;
  if (!typography) return [issue('typography', 'Shell widget source is missing typography defaults.')];
  const roles = isRecord(typography.roles) ? typography.roles : null;
  if (!roles) return [issue('typography.roles', 'Shell widget source is missing typography roles.')];

  const issues: WidgetShellValidationIssue[] = [];
  ['title', 'body', 'button', 'localeSwitcher'].forEach((role) => {
    if (!isRecord(roles[role])) issues.push(issue(`typography.roles.${role}`, 'Shell typography role is required.'));
  });

  const roleScales = isRecord(typography.roleScales) ? typography.roleScales : {};
  Object.keys(roles).forEach((role) => {
    if (GLOBAL_TYPOGRAPHY_SCALE_ROLES.has(role)) return;
    if (!isRecord(roleScales[role])) {
      issues.push(issue(`typography.roleScales.${role}`, 'Non-global typography role must define roleScales.'));
    }
  });
  return issues;
}

function validateShellDefaults(defaults: unknown): WidgetShellValidationIssue[] {
  if (!isRecord(defaults) || !isShellWidgetDefaults(defaults)) return [];
  const issues: WidgetShellValidationIssue[] = [];
  ['header', 'headerCta', 'stage', 'pod', 'appearance', 'typography', 'localeSwitcher', 'behavior'].forEach((path) => {
    issues.push(...validateRequiredRecord(defaults, path));
  });
  if (isRecord(defaults.uiLabels)) issues.push(...validateCoreLabels(defaults.uiLabels.core));
  if (isRecord(defaults.coreSize)) issues.push(...validateCoreSize(defaults.coreSize));
  issues.push(...validateShellTypography(defaults));
  return issues;
}

function validateShellSharedEditorNodes(editor: unknown, defaults: unknown): WidgetShellValidationIssue[] {
  if (!isRecord(defaults) || !isShellWidgetDefaults(defaults)) return [];
  const ids = new Set(collectEditorSharedNodeIds(editor));
  const issues: WidgetShellValidationIssue[] = [];
  ['header-content', 'header-layout', 'stagepod-layout', 'header-appearance', 'stagepod-appearance'].forEach((id) => {
    if (!ids.has(id) && !ids.has(`${id}-no-header-cta`)) {
      issues.push(issue(`editor.shared.${id}`, 'Shell widget editor must use the shared Shell editor node.'));
    }
  });
  if (isRecord(defaults.coreSize) && !ids.has('core-size')) {
    issues.push(issue('editor.shared.core-size', 'Shell widget editor must use the shared Core size editor node.'));
  }
  if (isRecord(defaults.behavior) && !ids.has('settings-behavior')) {
    issues.push(issue('editor.shared.settings-behavior', 'Shell widget editor must use the shared Settings behavior editor node.'));
  }
  ids.forEach((id) => {
    if (!(SHELL_EDITOR_SHARED_NODE_IDS as readonly string[]).includes(id)) {
      issues.push(issue(`editor.shared.${id}`, 'Unknown shared Shell editor node.'));
    }
  });
  return issues;
}

export function validateCoreLabels(labels: unknown): WidgetShellValidationIssue[] {
  const issues: WidgetShellValidationIssue[] = [];
  if (!isRecord(labels)) return [issue('uiLabels.core', 'Core labels must be an object.')];
  (['singular', 'plural', 'sizeCluster'] as const).forEach((key) => {
    if (!isNonEmptyString(labels[key])) issues.push(issue(`uiLabels.core.${key}`, 'Core label must be a non-empty string.'));
  });
  return issues;
}

export function validateCoreSize(size: unknown): WidgetShellValidationIssue[] {
  const issues: WidgetShellValidationIssue[] = [];
  if (!isRecord(size)) return [issue('coreSize', 'Core size must be an object.')];
  if (!CORE_SIZE_MODES.includes(size.mode as any)) issues.push(issue('coreSize.mode', 'Core size mode must be auto, fixed, or responsive.'));
  (['fixedHeight', 'minHeight', 'preferredVw', 'maxHeight'] as const).forEach((key) => {
    if (typeof size[key] !== 'number' || !Number.isFinite(size[key])) {
      issues.push(issue(`coreSize.${key}`, 'Core size value must be a finite number.'));
    }
  });
  return issues;
}

export function validateCoreExtensionContract(contract: WidgetCoreExtensionContract): WidgetShellValidationIssue[] {
  const issues: WidgetShellValidationIssue[] = [];
  contract.coreStatePaths.forEach((path) => {
    if (pathBelongsToShell(path)) issues.push(issue(path, 'Widget Core must not own Shell state paths.'));
    if (pathIsForbiddenShellAlias(path)) issues.push(issue(path, 'Widget Core must not reintroduce forbidden Header/Header CTA aliases.'));
  });
  contract.coreEditableFieldPaths.forEach((path) => {
    if ((SHELL_EDITABLE_FIELD_PATHS as readonly string[]).includes(path)) {
      issues.push(issue(path, 'Widget Core editable fields must not duplicate Shell editable fields.'));
    }
  });
  issues.push(...validateCoreLabels(contract.coreLabels));
  issues.push(...validateCoreSize(contract.coreSizeDefaults));
  return issues;
}

export function validateShellDom(html: string): WidgetShellValidationIssue[] {
  const issues: WidgetShellValidationIssue[] = [];
  SHELL_REQUIRED_DOM_ROLES.forEach((role) => {
    if (!html.includes(`data-role="${role}"`)) issues.push(issue(`dom.${role}`, `Missing data-role="${role}".`));
  });
  SHELL_REQUIRED_DOM_CLASSES.forEach((className) => {
    if (!html.includes(className)) issues.push(issue(`dom.${className}`, `Missing ${className}.`));
  });
  return issues;
}

export function validateWidgetShellSource(args: {
  widgetType: string;
  defaults: unknown;
  editor: unknown;
}): WidgetShellValidationIssue[] {
  if (!isShellWidgetDefaults(args.defaults)) return [];

  const issues: WidgetShellValidationIssue[] = [];
  issues.push(...validateShellDefaults(args.defaults));
  issues.push(...validateShellSharedEditorNodes(args.editor, args.defaults));
  collectObjectPaths(args.defaults).forEach((path) => {
    if (pathIsForbiddenShellAlias(path)) {
      issues.push(issue(path, 'Shell widget source must not use old Header/Header CTA/layout aliases.'));
    }
  });
  collectEditorFieldPaths(args.editor).forEach((path) => {
    if (editorPathRequiresSharedShellNode(path)) {
      issues.push(issue(path, 'Shell editor controls must come from shared Shell editor nodes.'));
    }
    if (pathIsForbiddenShellAlias(path)) {
      issues.push(issue(path, 'Shell widget editor must not control old Header/Header CTA/layout aliases.'));
    }
  });
  return issues.map((entry) => ({
    path: entry.path,
    message: `${args.widgetType}: ${entry.message}`,
  }));
}

export function assertValidWidgetShellSource(args: {
  widgetType: string;
  defaults: unknown;
  editor: unknown;
}): void {
  const issues = validateWidgetShellSource(args);
  if (issues.length) {
    throw new Error(`widget_shell_source_invalid:${issues.map((entry) => entry.path).join(',')}`);
  }
}

export function assertValidWidgetCoreExtension(contract: WidgetCoreExtensionContract): void {
  const issues = validateCoreExtensionContract(contract);
  if (issues.length) {
    throw new Error(`widget_shell_core_contract_invalid:${issues.map((entry) => entry.path).join(',')}`);
  }
}
