import faqSpecJson from '../../tokyo/widgets/faq/spec.json';

export type WidgetConfigContractIssue = {
  path: string;
  message: string;
};

type EnumRule = {
  path: string;
  values: readonly string[];
};

type NumberRangeRule = {
  path: string;
  min: number;
  max: number;
};

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function describeTemplateType(template: unknown): string {
  if (typeof template === 'string') return 'a string';
  if (typeof template === 'boolean') return 'a boolean';
  if (typeof template === 'number') return 'a finite number';
  if (Array.isArray(template)) return 'an array';
  if (isPlainRecord(template)) return 'an object';
  return 'a valid value';
}

function validateShapeAgainstTemplate(args: {
  template: unknown;
  value: unknown;
  path: string;
  issues: WidgetConfigContractIssue[];
}) {
  const { template, value, path, issues } = args;

  if (typeof template === 'string') {
    if (typeof value !== 'string') {
      issues.push({ path, message: `${path} must be a string` });
    }
    return;
  }

  if (typeof template === 'boolean') {
    if (typeof value !== 'boolean') {
      issues.push({ path, message: `${path} must be a boolean` });
    }
    return;
  }

  if (typeof template === 'number') {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      issues.push({ path, message: `${path} must be a finite number` });
    }
    return;
  }

  if (Array.isArray(template)) {
    if (!Array.isArray(value)) {
      issues.push({ path, message: `${path} must be an array` });
      return;
    }

    if (template.length === 0) return;
    const itemTemplate = template[0];
    value.forEach((entry, index) => {
      validateShapeAgainstTemplate({
        template: itemTemplate,
        value: entry,
        path: `${path}[${index}]`,
        issues,
      });
    });
    return;
  }

  if (isPlainRecord(template)) {
    if (!isPlainRecord(value)) {
      issues.push({ path, message: `${path} must be an object` });
      return;
    }

    for (const [key, childTemplate] of Object.entries(template)) {
      if (!Object.prototype.hasOwnProperty.call(value, key)) {
        const childPath = `${path}.${key}`;
        issues.push({
          path: childPath,
          message: `${childPath} is required and must be ${describeTemplateType(childTemplate)}`,
        });
        continue;
      }
      validateShapeAgainstTemplate({
        template: childTemplate,
        value: value[key],
        path: `${path}.${key}`,
        issues,
      });
    }
  }
}

function readPath(root: Record<string, unknown>, dottedPath: string): unknown {
  const segments = dottedPath.split('.');
  let current: unknown = root;
  for (const segment of segments) {
    if (!isPlainRecord(current) || !Object.prototype.hasOwnProperty.call(current, segment)) {
      return undefined;
    }
    current = current[segment];
  }
  return current;
}

function validateEnumRules(
  config: Record<string, unknown>,
  rules: readonly EnumRule[],
  issues: WidgetConfigContractIssue[],
) {
  for (const rule of rules) {
    const value = readPath(config, rule.path);
    if (typeof value !== 'string') continue;
    if (!rule.values.includes(value)) {
      issues.push({
        path: `config.${rule.path}`,
        message: `config.${rule.path} must be ${rule.values.join('|')}`,
      });
    }
  }
}

function validateNumberRangeRules(
  config: Record<string, unknown>,
  rules: readonly NumberRangeRule[],
  issues: WidgetConfigContractIssue[],
) {
  for (const rule of rules) {
    const value = readPath(config, rule.path);
    if (typeof value !== 'number' || !Number.isFinite(value)) continue;
    if (value < rule.min || value > rule.max) {
      issues.push({
        path: `config.${rule.path}`,
        message: `config.${rule.path} must be ${rule.min}..${rule.max}`,
      });
    }
  }
}

const FAQ_DEFAULTS = (faqSpecJson as { defaults?: unknown }).defaults as Record<string, unknown>;

const FAQ_ENUM_RULES: readonly EnumRule[] = [
  { path: 'header.alignment', values: ['left', 'center', 'right'] },
  { path: 'header.placement', values: ['top', 'bottom', 'left', 'right'] },
  { path: 'header.ctaPlacement', values: ['right', 'below'] },
  { path: 'cta.iconPlacement', values: ['left', 'right'] },
  { path: 'layout.type', values: ['accordion', 'list', 'multicolumn'] },
  { path: 'layout.cardsLayout', values: ['grid', 'masonry'] },
  { path: 'layout.itemQaGapPreset', values: ['xs', 's', 'm', 'l', 'xl', 'custom'] },
  { path: 'appearance.linkStyle', values: ['underline', 'highlight', 'color'] },
  { path: 'appearance.ctaSizePreset', values: ['xs', 's', 'm', 'l', 'xl', 'custom'] },
  { path: 'appearance.ctaIconSizePreset', values: ['xs', 's', 'm', 'l', 'xl', 'custom'] },
  { path: 'appearance.iconStyle', values: ['plus', 'chevron', 'arrow', 'arrowshape'] },
];

const FAQ_NUMBER_RANGE_RULES: readonly NumberRangeRule[] = [
  { path: 'layout.itemQaGapCustom', min: 0, max: 120 },
  { path: 'appearance.ctaBorder.width', min: 0, max: 12 },
  { path: 'appearance.cardwrapper.border.width', min: 0, max: 12 },
  { path: 'appearance.podBorder.width', min: 0, max: 12 },
  { path: 'appearance.cardwrapper.shadow.alpha', min: 0, max: 100 },
];

function validateFaqConfigContract(config: Record<string, unknown>): WidgetConfigContractIssue[] {
  const issues: WidgetConfigContractIssue[] = [];
  validateShapeAgainstTemplate({
    template: FAQ_DEFAULTS,
    value: config,
    path: 'config',
    issues,
  });

  if (issues.length > 0) {
    return issues;
  }

  validateEnumRules(config, FAQ_ENUM_RULES, issues);
  validateNumberRangeRules(config, FAQ_NUMBER_RANGE_RULES, issues);
  return issues;
}

export function validateWidgetConfigContract(
  widgetType: string,
  config: Record<string, unknown>,
): WidgetConfigContractIssue[] {
  if (widgetType === 'faq') {
    return validateFaqConfigContract(config);
  }
  return [];
}
