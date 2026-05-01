export type WidgetConfigContractIssue = {
  path: string;
  message: string;
};

export type WidgetConfigContractResult =
  | { ok: true }
  | {
      ok: false;
      reasonKey: 'coreui.errors.instance.widgetMissing' | 'coreui.errors.instance.config.invalid';
      issues: WidgetConfigContractIssue[];
    };

const ACTIVE_WIDGET_TYPES = new Set(['faq', 'countdown', 'logoshowcase']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function optionalString(value: unknown): boolean {
  return value == null || typeof value === 'string';
}

function optionalBoolean(value: unknown): boolean {
  return value == null || typeof value === 'boolean';
}

function optionalNumber(value: unknown): boolean {
  return value == null || (typeof value === 'number' && Number.isFinite(value));
}

function pushIssue(issues: WidgetConfigContractIssue[], path: string, message: string) {
  issues.push({ path, message });
}

function validateFaqConfig(config: Record<string, unknown>): WidgetConfigContractIssue[] {
  const issues: WidgetConfigContractIssue[] = [];
  const sections = config.sections;
  if (sections == null) return issues;
  if (!Array.isArray(sections)) {
    pushIssue(issues, 'config.sections', 'sections must be an array when present');
    return issues;
  }
  sections.forEach((section, sectionIndex) => {
    const sectionPath = `config.sections.${sectionIndex}`;
    if (!isRecord(section)) {
      pushIssue(issues, sectionPath, 'section must be an object');
      return;
    }
    if (!optionalString(section.id)) pushIssue(issues, `${sectionPath}.id`, 'section id must be a string when present');
    if (!optionalString(section.title)) pushIssue(issues, `${sectionPath}.title`, 'section title must be a string when present');
    const faqs = section.faqs;
    if (faqs == null) return;
    if (!Array.isArray(faqs)) {
      pushIssue(issues, `${sectionPath}.faqs`, 'faqs must be an array when present');
      return;
    }
    faqs.forEach((faq, faqIndex) => {
      const faqPath = `${sectionPath}.faqs.${faqIndex}`;
      if (!isRecord(faq)) {
        pushIssue(issues, faqPath, 'faq must be an object');
        return;
      }
      if (!optionalString(faq.id)) pushIssue(issues, `${faqPath}.id`, 'faq id must be a string when present');
      if (!optionalString(faq.question)) pushIssue(issues, `${faqPath}.question`, 'question must be a string when present');
      if (!optionalString(faq.answer)) pushIssue(issues, `${faqPath}.answer`, 'answer must be a string when present');
      if (!optionalBoolean(faq.defaultOpen)) pushIssue(issues, `${faqPath}.defaultOpen`, 'defaultOpen must be a boolean when present');
    });
  });
  return issues;
}

function validateCountdownConfig(config: Record<string, unknown>): WidgetConfigContractIssue[] {
  const issues: WidgetConfigContractIssue[] = [];
  const timer = config.timer;
  if (timer == null) return issues;
  if (!isRecord(timer)) {
    pushIssue(issues, 'config.timer', 'timer must be an object when present');
    return issues;
  }
  for (const key of ['mode', 'repeat', 'timeUnit', 'timezone', 'targetDate'] as const) {
    if (!optionalString(timer[key])) pushIssue(issues, `config.timer.${key}`, `${key} must be a string when present`);
  }
  for (const key of ['timeAmount', 'targetNumber', 'countDuration', 'startingNumber'] as const) {
    if (!optionalNumber(timer[key])) pushIssue(issues, `config.timer.${key}`, `${key} must be a number when present`);
  }
  const labels = timer.labels;
  if (labels != null) {
    if (!isRecord(labels)) {
      pushIssue(issues, 'config.timer.labels', 'labels must be an object when present');
    } else {
      for (const key of ['days', 'hours', 'minutes', 'seconds'] as const) {
        if (!optionalString(labels[key])) pushIssue(issues, `config.timer.labels.${key}`, `${key} label must be a string when present`);
      }
    }
  }
  return issues;
}

function validateLogoShowcaseConfig(config: Record<string, unknown>): WidgetConfigContractIssue[] {
  const issues: WidgetConfigContractIssue[] = [];
  const strips = config.strips;
  if (strips == null) return issues;
  if (!Array.isArray(strips)) {
    pushIssue(issues, 'config.strips', 'strips must be an array when present');
    return issues;
  }
  strips.forEach((strip, stripIndex) => {
    const stripPath = `config.strips.${stripIndex}`;
    if (!isRecord(strip)) {
      pushIssue(issues, stripPath, 'strip must be an object');
      return;
    }
    if (!optionalString(strip.id)) pushIssue(issues, `${stripPath}.id`, 'strip id must be a string when present');
    const logos = strip.logos;
    if (logos == null) return;
    if (!Array.isArray(logos)) {
      pushIssue(issues, `${stripPath}.logos`, 'logos must be an array when present');
      return;
    }
    logos.forEach((logo, logoIndex) => {
      const logoPath = `${stripPath}.logos.${logoIndex}`;
      if (!isRecord(logo)) {
        pushIssue(issues, logoPath, 'logo must be an object');
        return;
      }
      for (const key of ['id', 'name', 'alt', 'href', 'title', 'caption', 'logoFill'] as const) {
        if (!optionalString(logo[key])) pushIssue(issues, `${logoPath}.${key}`, `${key} must be a string when present`);
      }
      for (const key of ['nofollow', 'targetBlank'] as const) {
        if (!optionalBoolean(logo[key])) pushIssue(issues, `${logoPath}.${key}`, `${key} must be a boolean when present`);
      }
      if (logo.asset != null && !isRecord(logo.asset)) {
        pushIssue(issues, `${logoPath}.asset`, 'asset must be an object when present');
      }
    });
  });
  return issues;
}

export function validateWidgetConfigContract(args: {
  widgetType: unknown;
  config: unknown;
}): WidgetConfigContractResult {
  const widgetType = typeof args.widgetType === 'string' ? args.widgetType.trim() : '';
  if (!widgetType) {
    return {
      ok: false,
      reasonKey: 'coreui.errors.instance.widgetMissing',
      issues: [{ path: 'widgetType', message: 'widgetType is required' }],
    };
  }
  if (!isRecord(args.config)) {
    return {
      ok: false,
      reasonKey: 'coreui.errors.instance.config.invalid',
      issues: [{ path: 'config', message: 'config must be an object' }],
    };
  }
  if (!ACTIVE_WIDGET_TYPES.has(widgetType)) {
    return { ok: true };
  }

  const issues =
    widgetType === 'faq'
      ? validateFaqConfig(args.config)
      : widgetType === 'countdown'
        ? validateCountdownConfig(args.config)
        : validateLogoShowcaseConfig(args.config);

  return issues.length ? { ok: false, reasonKey: 'coreui.errors.instance.config.invalid', issues } : { ok: true };
}
