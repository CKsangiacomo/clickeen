import {
  CORE_SIZE_MODES,
  SHELL_EDITABLE_FIELD_PATHS,
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
  const uiLabels = isRecord(defaults.uiLabels) ? defaults.uiLabels : null;
  return Boolean(
    isRecord(defaults.header) ||
    isRecord(defaults.cta) ||
    isRecord(defaults.coreSize) ||
    (uiLabels && isRecord(uiLabels.core)),
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

function editorPathRequiresSharedShellNode(path: string): boolean {
  const normalized = path.trim();
  return (
    normalized === 'coreSize' ||
    normalized.startsWith('coreSize.') ||
    normalized === 'header' ||
    normalized.startsWith('header.') ||
    normalized === 'cta' ||
    normalized.startsWith('cta.')
  );
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
    if (pathIsForbiddenShellAlias(path)) issues.push(issue(path, 'Widget Core must not reintroduce forbidden Header/CTA aliases.'));
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
  collectObjectPaths(args.defaults).forEach((path) => {
    if (pathIsForbiddenShellAlias(path)) {
      issues.push(issue(path, 'Shell widget source must not use old Header/CTA/layout aliases.'));
    }
  });
  collectEditorFieldPaths(args.editor).forEach((path) => {
    if (editorPathRequiresSharedShellNode(path)) {
      issues.push(issue(path, 'Header/CTA/CoreSize editor controls must come from shared Shell editor nodes.'));
    }
    if (pathIsForbiddenShellAlias(path)) {
      issues.push(issue(path, 'Shell widget editor must not control old Header/CTA/layout aliases.'));
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
