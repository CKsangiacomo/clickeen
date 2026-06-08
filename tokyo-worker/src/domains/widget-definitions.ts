import { isRecord } from '@clickeen/ck-contracts';
import {
  resolveWidgetOverlayCode,
  resolveWidgetTypeForOverlayCode,
} from '@clickeen/ck-contracts/overlay-codebooks';
import type { WidgetEditableFieldsContract } from '@clickeen/ck-contracts/translated-value-primitives';
import { readWidgetEditableFieldsContract } from '@clickeen/ck-contracts/translated-value-primitives';
import {
  WIDGET_DEFINITION_SOURCES,
  type WidgetDefinitionSource,
} from '../generated/widget-definition-sources';
import { pathBelongsToShell } from '@clickeen/widget-shell';

export type WidgetDefinition = {
  widgetType: string;
  widgetCode: string;
  editableFields: WidgetEditableFieldsContract;
};

type WidgetDefinitionInternal = WidgetDefinition & {
  itemKey?: string | null;
  defaults?: unknown;
  accountDefaultControlPaths: string[];
  accountDefaultMetadataPaths: string[];
};

function cloneRecord(value: Record<string, unknown>): Record<string, unknown> {
  return typeof structuredClone === 'function'
    ? (structuredClone(value) as Record<string, unknown>)
    : (JSON.parse(JSON.stringify(value)) as Record<string, unknown>);
}

function asNonEmptyString(value: unknown): string | null {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return normalized || null;
}

function readPath(value: unknown, path: string): unknown {
  let cursor = value;
  for (const part of path.split('.').filter(Boolean)) {
    if (!isRecord(cursor)) return undefined;
    cursor = cursor[part];
  }
  return cursor;
}

function pathExists(value: unknown, path: string): boolean {
  return typeof readPath(value, path) !== 'undefined';
}

function collectEditorFieldPaths(value: unknown): string[] {
  const paths = new Set<string>();
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (!isRecord(node)) return;
    if (node.kind === 'field' && typeof node.path === 'string' && node.path.trim()) {
      paths.add(node.path.trim());
    }
    Object.values(node).forEach(visit);
  };
  visit(value);
  return [...paths];
}

const TYPOGRAPHY_CONTROL_LEAVES = [
  'family',
  'sizePreset',
  'sizeCustom',
  'fontStyle',
  'weight',
  'color',
  'lineHeightPreset',
  'lineHeightCustom',
  'trackingPreset',
  'trackingCustom',
] as const;

function collectCoreTypographyControlPaths(defaults: unknown): string[] {
  const roles = readPath(defaults, 'typography.roles');
  if (!isRecord(roles)) return [];
  return Object.keys(roles).flatMap((role) =>
    TYPOGRAPHY_CONTROL_LEAVES.map((leaf) => `typography.roles.${role}.${leaf}`),
  );
}

function resolveCoreCardWrapperBasePath(defaults: unknown, widgetType: string): string | null {
  const candidates = ['appearance.cardwrapper', `${widgetType}.appearance.cardwrapper`];
  return candidates.find((path) => isRecord(readPath(defaults, path))) ?? null;
}

function collectCoreCardWrapperControlPaths(defaults: unknown, widgetType: string): string[] {
  const basePath = resolveCoreCardWrapperBasePath(defaults, widgetType);
  if (!basePath) return [];
  const paths = [
    `${basePath}.radiusLinked`,
    `${basePath}.radius`,
    `${basePath}.radiusTL`,
    `${basePath}.radiusTR`,
    `${basePath}.radiusBR`,
    `${basePath}.radiusBL`,
    `${basePath}.border`,
    `${basePath}.shadow`,
  ];
  if (isRecord(readPath(defaults, `${basePath}.insideShadow`))) {
    paths.push(
      `${basePath}.insideShadow.linked`,
      `${basePath}.insideShadow.layer`,
      `${basePath}.insideShadow.all`,
      `${basePath}.insideShadow.top`,
      `${basePath}.insideShadow.right`,
      `${basePath}.insideShadow.bottom`,
      `${basePath}.insideShadow.left`,
    );
  }
  return paths;
}

function isCoreSoftwareMetadataPath(path: string): boolean {
  return (
    path === 'uiLabels.core' ||
    path.startsWith('uiLabels.core.') ||
    path === 'typography.roleScales' ||
    path.startsWith('typography.roleScales.')
  );
}

function collectCoreAccountDefaultControlPaths(defaults: unknown, editor: unknown): string[] {
  const paths = new Set<string>();
  collectEditorFieldPaths(editor).forEach((path) => {
    if (!pathBelongsToShell(path) && !isCoreSoftwareMetadataPath(path)) paths.add(path);
  });
  collectCoreTypographyControlPaths(defaults).forEach((path) => paths.add(path));
  return [...paths].sort((left, right) => left.localeCompare(right));
}

const CORE_SOFTWARE_METADATA_PATHS_BY_WIDGET_TYPE: Record<string, readonly string[]> = {
  countdown: [
    'countdown.actions.during.type',
    'countdown.geo.answerFormat',
    'countdown.seo.businessType',
  ],
  faq: ['faq.context.websiteUrl', 'faq.geo.answerFormat', 'faq.seo.businessType'],
};

function collectCoreAccountDefaultMetadataPaths(defaults: unknown, widgetType: string): string[] {
  const paths: string[] = [];
  if (pathExists(defaults, 'uiLabels.core')) paths.push('uiLabels.core');
  if (pathExists(defaults, 'typography.roleScales')) paths.push('typography.roleScales');
  for (const path of CORE_SOFTWARE_METADATA_PATHS_BY_WIDGET_TYPE[widgetType] ?? []) {
    if (pathExists(defaults, path)) paths.push(path);
  }
  return paths;
}

function readWidgetDefinitionSource(source: WidgetDefinitionSource): WidgetDefinitionInternal {
  const spec = isRecord(source.spec) ? source.spec : null;
  if (!spec) {
    throw new Error(`widget_definition_source_invalid:${source.widgetType}`);
  }
  const widgetType = asNonEmptyString(spec.widgetname);
  if (widgetType !== source.widgetType) {
    throw new Error(`widget_definition_widget_type_mismatch:${source.widgetType}`);
  }
  if (!isRecord(spec.defaults)) {
    throw new Error(`widget_definition_defaults_missing:${source.widgetType}`);
  }
  const widgetCode = resolveWidgetOverlayCode(widgetType);
  if (!widgetCode) {
    throw new Error(`widget_definition_widget_code_missing:${widgetType}`);
  }

  const editableFields = readWidgetEditableFieldsContract(source.editableFields);
  if (editableFields.widgetType !== widgetType) {
    throw new Error(`widget_definition_editable_fields_mismatch:${widgetType}`);
  }

  return {
    widgetType,
    widgetCode,
    itemKey: asNonEmptyString(spec.itemKey),
    editableFields,
    defaults: spec.defaults,
    accountDefaultControlPaths: [
      ...new Set([
        ...collectCoreAccountDefaultControlPaths(spec.defaults, spec.editor),
        ...collectCoreCardWrapperControlPaths(spec.defaults, widgetType),
      ]),
    ].sort((left, right) => left.localeCompare(right)),
    accountDefaultMetadataPaths: collectCoreAccountDefaultMetadataPaths(spec.defaults, widgetType),
  };
}

const WIDGET_DEFINITIONS: WidgetDefinitionInternal[] = WIDGET_DEFINITION_SOURCES.map(
  readWidgetDefinitionSource,
).sort((a, b) => a.widgetType.localeCompare(b.widgetType));

function publicEntry(entry: WidgetDefinitionInternal): WidgetDefinition {
  return {
    widgetType: entry.widgetType,
    widgetCode: entry.widgetCode,
    editableFields: entry.editableFields,
  };
}

function resolveDefinitionInternal(widgetType: string): WidgetDefinitionInternal | null {
  const normalized = String(widgetType || '').trim();
  return WIDGET_DEFINITIONS.find((candidate) => candidate.widgetType === normalized) || null;
}

export function validateWidgetSource(): { ok: true; widgetTypes: string[] } {
  return { ok: true, widgetTypes: WIDGET_DEFINITIONS.map((entry) => entry.widgetType) };
}

export function listWidgetDefinitions(): WidgetDefinition[] {
  return WIDGET_DEFINITIONS.map(publicEntry);
}

export function getWidgetDefinition(widgetType: string): WidgetDefinition | null {
  const entry = resolveDefinitionInternal(widgetType);
  return entry ? publicEntry(entry) : null;
}

export function resolveWidgetCode(widgetType: string): string | null {
  return getWidgetDefinition(widgetType)?.widgetCode ?? null;
}

export function resolveWidgetTypeFromCode(widgetCode: string): string | null {
  const normalized = String(widgetCode || '')
    .trim()
    .toUpperCase();
  return resolveWidgetTypeForOverlayCode(normalized);
}

export function resolveWidgetDefaults(widgetType: string): Record<string, unknown> | null {
  const entry = resolveDefinitionInternal(widgetType);
  return entry && isRecord(entry.defaults) ? cloneRecord(entry.defaults) : null;
}

export function listWidgetCoreFactoryDefaults(): Array<{
  widgetType: string;
  core: Record<string, unknown>;
}> {
  return WIDGET_DEFINITIONS.map((entry) => ({
    widgetType: entry.widgetType,
    core: isRecord(entry.defaults) ? cloneRecord(entry.defaults) : {},
  }));
}

export function listWidgetAccountDefaultContracts(): Array<{
  widgetType: string;
  coreFactoryDefaults: Record<string, unknown>;
  coreControlPaths: string[];
  coreMetadataPaths: string[];
}> {
  return WIDGET_DEFINITIONS.map((entry) => ({
    widgetType: entry.widgetType,
    coreFactoryDefaults: isRecord(entry.defaults) ? cloneRecord(entry.defaults) : {},
    coreControlPaths: [...entry.accountDefaultControlPaths],
    coreMetadataPaths: [...entry.accountDefaultMetadataPaths],
  }));
}
