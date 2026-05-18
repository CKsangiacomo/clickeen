import type { WidgetContentContract, WidgetContentField } from './overlay-primitives';

type JsonRecord = Record<string, unknown>;

export type FaqFieldIdentity = {
  instanceId: string;
  widgetType: 'faq';
  path: string;
  role: string;
  sectionId?: string;
  faqId?: string;
};

export type FaqSavedTextField = {
  identity: FaqFieldIdentity;
  label: string;
  type: 'string' | 'richtext';
  baseText: string;
};

export type FaqLanguageValue = {
  identity: FaqFieldIdentity;
  locale: string;
  value: string;
  updatedAt: string;
  jobId?: string;
};

export type FaqTranslatedField = {
  identity: FaqFieldIdentity;
  value: string;
};

export type CurrentLanguageValuesResult =
  | {
      ok: true;
      values: FaqLanguageValue[];
    }
  | {
      ok: false;
      reason:
        | 'duplicate_current_field'
        | 'duplicate_previous_value'
        | 'duplicate_translation'
        | 'missing_changed_translation'
        | 'unknown_translation_field';
      fieldKey: string;
      values: FaqLanguageValue[];
    };

export type FaqFieldsNeedingTranslationArgs = {
  previousSavedTextGraph: FaqSavedTextField[];
  currentSavedTextGraph: FaqSavedTextField[];
  previousLanguageValues: FaqLanguageValue[];
};

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export function faqFieldIdentityKey(identity: FaqFieldIdentity): string {
  const canonicalPath = identity.path.replace(/\.\d+(?=\.|$)/g, '[]');
  return [
    identity.instanceId,
    identity.widgetType,
    identity.role,
    canonicalPath,
    identity.sectionId ?? '',
    identity.faqId ?? '',
  ].join('|');
}

function assertUniqueField(out: FaqSavedTextField[], field: FaqSavedTextField): void {
  const key = faqFieldIdentityKey(field.identity);
  if (out.some((existing) => faqFieldIdentityKey(existing.identity) === key)) {
    throw new Error(`faq_language.duplicate_field:${key}`);
  }
  out.push(field);
}

function textType(field: WidgetContentField): 'string' | 'richtext' {
  return field.type;
}

function makeField(args: {
  instanceId: string;
  field: WidgetContentField;
  path: string;
  sectionId?: string;
  faqId?: string;
  value: string;
}): FaqSavedTextField {
  return {
    identity: {
      instanceId: args.instanceId,
      widgetType: 'faq',
      path: args.path,
      role: args.field.role,
      ...(args.sectionId ? { sectionId: args.sectionId } : {}),
      ...(args.faqId ? { faqId: args.faqId } : {}),
    },
    label: args.field.label,
    type: textType(args.field),
    baseText: args.value,
  };
}

function fieldByPath(contract: WidgetContentContract, path: string): WidgetContentField {
  const field = contract.fields.find((candidate) => candidate.path === path);
  if (!field) throw new Error(`faq_language.contract_field_missing:${path}`);
  return field;
}

export function buildFaqSavedTextGraph(args: {
  contract: WidgetContentContract;
  config: Record<string, unknown>;
  instanceId: string;
}): FaqSavedTextField[] {
  if (args.contract.widgetType !== 'faq') {
    throw new Error('faq_language.contract_widget_invalid');
  }

  const out: FaqSavedTextField[] = [];
  const header = isRecord(args.config.header) ? args.config.header : {};
  const cta = isRecord(args.config.cta) ? args.config.cta : {};

  for (const path of ['header.title', 'header.subtitleHtml', 'cta.label'] as const) {
    const field = fieldByPath(args.contract, path);
    const value = path.startsWith('header.') ? header[path.slice('header.'.length)] : cta.label;
    assertUniqueField(
      out,
      makeField({
        instanceId: args.instanceId,
        field,
        path,
        value: asString(value),
      }),
    );
  }

  const sections = Array.isArray(args.config.sections) ? args.config.sections : [];
  const seenSectionIds = new Set<string>();
  sections.forEach((rawSection, sectionIndex) => {
    if (!isRecord(rawSection)) throw new Error(`faq_language.section_invalid:${sectionIndex}`);
    const sectionId = asString(rawSection.id).trim();
    if (!sectionId || seenSectionIds.has(sectionId)) {
      throw new Error(`faq_language.section_id_invalid:${sectionIndex}`);
    }
    seenSectionIds.add(sectionId);
    assertUniqueField(
      out,
      makeField({
        instanceId: args.instanceId,
        field: fieldByPath(args.contract, 'sections[].title'),
        path: `sections.${sectionIndex}.title`,
        sectionId,
        value: asString(rawSection.title),
      }),
    );

    const faqs = Array.isArray(rawSection.faqs) ? rawSection.faqs : [];
    const seenFaqIds = new Set<string>();
    faqs.forEach((rawFaq, faqIndex) => {
      if (!isRecord(rawFaq)) throw new Error(`faq_language.faq_invalid:${sectionIndex}.${faqIndex}`);
      const faqId = asString(rawFaq.id).trim();
      if (!faqId || seenFaqIds.has(faqId)) {
        throw new Error(`faq_language.faq_id_invalid:${sectionIndex}.${faqIndex}`);
      }
      seenFaqIds.add(faqId);
      for (const leaf of ['question', 'answer'] as const) {
        assertUniqueField(
          out,
          makeField({
            instanceId: args.instanceId,
            field: fieldByPath(args.contract, `sections[].faqs[].${leaf}`),
            path: `sections.${sectionIndex}.faqs.${faqIndex}.${leaf}`,
            sectionId,
            faqId,
            value: asString(rawFaq[leaf]),
          }),
        );
      }
    });
  });

  return out;
}

function indexFields(fields: FaqSavedTextField[]): Map<string, FaqSavedTextField> {
  const out = new Map<string, FaqSavedTextField>();
  for (const field of fields) {
    const key = faqFieldIdentityKey(field.identity);
    if (out.has(key)) throw new Error(`faq_language.duplicate_field:${key}`);
    out.set(key, field);
  }
  return out;
}

function duplicateValueKey(values: Array<{ identity: FaqFieldIdentity }>): string | null {
  const seen = new Set<string>();
  for (const value of values) {
    const key = faqFieldIdentityKey(value.identity);
    if (seen.has(key)) return key;
    seen.add(key);
  }
  return null;
}

export function selectFaqFieldsNeedingTranslation(args: FaqFieldsNeedingTranslationArgs): FaqSavedTextField[] {
  const previous = new Map(args.previousSavedTextGraph.map((field) => [faqFieldIdentityKey(field.identity), field]));
  const previousValues = new Set(args.previousLanguageValues.map((value) => faqFieldIdentityKey(value.identity)));
  return args.currentSavedTextGraph.filter((field) => {
    const key = faqFieldIdentityKey(field.identity);
    const old = previous.get(key);
    return !old || old.baseText !== field.baseText || !previousValues.has(key);
  });
}

export function buildCurrentLanguageValues(args: {
  previousSavedTextGraph: FaqSavedTextField[];
  currentSavedTextGraph: FaqSavedTextField[];
  previousLanguageValues: FaqLanguageValue[];
  translatedValues: FaqTranslatedField[];
  locale: string;
  updatedAt: string;
  jobId: string;
}): CurrentLanguageValuesResult {
  const currentDuplicate = duplicateValueKey(args.currentSavedTextGraph);
  if (currentDuplicate) {
    return { ok: false, reason: 'duplicate_current_field', fieldKey: currentDuplicate, values: args.previousLanguageValues };
  }
  const previousValueDuplicate = duplicateValueKey(args.previousLanguageValues);
  if (previousValueDuplicate) {
    return { ok: false, reason: 'duplicate_previous_value', fieldKey: previousValueDuplicate, values: args.previousLanguageValues };
  }
  const translationDuplicate = duplicateValueKey(args.translatedValues);
  if (translationDuplicate) {
    return { ok: false, reason: 'duplicate_translation', fieldKey: translationDuplicate, values: args.previousLanguageValues };
  }

  const previousFields = indexFields(args.previousSavedTextGraph);
  const currentFields = indexFields(args.currentSavedTextGraph);
  const previousValues = new Map(
    args.previousLanguageValues.map((value) => [faqFieldIdentityKey(value.identity), value]),
  );
  const translations = new Map(args.translatedValues.map((value) => [faqFieldIdentityKey(value.identity), value]));

  const changedKeys = new Set<string>();
  for (const [key, current] of currentFields) {
    const previous = previousFields.get(key);
    if (!previous || previous.baseText !== current.baseText || !previousValues.has(key)) {
      changedKeys.add(key);
    }
  }

  for (const key of translations.keys()) {
    if (!currentFields.has(key) || !changedKeys.has(key)) {
      return { ok: false, reason: 'unknown_translation_field', fieldKey: key, values: args.previousLanguageValues };
    }
  }

  const values: FaqLanguageValue[] = [];
  for (const [key, current] of currentFields) {
    const previousValue = previousValues.get(key);
    const changed = changedKeys.has(key);
    if (!changed && previousValue) {
      values.push({
        ...previousValue,
        identity: current.identity,
      });
      continue;
    }
    const translated = translations.get(key);
    if (!translated) {
      return { ok: false, reason: 'missing_changed_translation', fieldKey: key, values: args.previousLanguageValues };
    }
    values.push({
      identity: current.identity,
      locale: args.locale,
      value: translated.value,
      updatedAt: args.updatedAt,
      jobId: args.jobId,
    });
  }

  return { ok: true, values };
}
