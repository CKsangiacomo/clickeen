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

export function assertValidWidgetCoreExtension(contract: WidgetCoreExtensionContract): void {
  const issues = validateCoreExtensionContract(contract);
  if (issues.length) {
    throw new Error(`widget_shell_core_contract_invalid:${issues.map((entry) => entry.path).join(',')}`);
  }
}
