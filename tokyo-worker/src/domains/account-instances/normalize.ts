import { asTrimmedString } from '@clickeen/ck-contracts';
import {
  isCompactAccountPublicId,
  isCompactInstanceId,
  isWidgetOverlayCode,
} from '@clickeen/ck-contracts/overlay-identity';
import { normalizeLocale } from '../../asset-utils';
import { parseCatalogPresentation } from '@clickeen/ck-contracts/catalog';
import type {
  AccountInstanceConfigDocument,
  AccountInstanceContentDocument,
  AccountInstanceContentFieldStatus,
} from './types';
import { normalizeStorageId } from './utils';

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function normalizeAccountInstanceConfigDocument(
  raw: unknown,
): AccountInstanceConfigDocument | null {
  const payload = asRecord(raw);
  if (!payload) return null;
  const id = normalizeStorageId(payload.id) ?? '';
  const accountId = normalizeStorageId(payload.accountId) ?? '';
  const widgetCode = asTrimmedString(payload.widgetCode) ?? '';
  const widgetType = asTrimmedString(payload.widgetType) ?? '';
  const displayName = asTrimmedString(payload.displayName);
  const createdAt = asTrimmedString(payload.createdAt) ?? '';
  const updatedAt = asTrimmedString(payload.updatedAt) ?? '';
  const config = asRecord(payload.config);
  const isTemplate = payload.isTemplate;
  const catalogPresentation = Object.prototype.hasOwnProperty.call(payload, 'catalogPresentation')
    ? parseCatalogPresentation(payload.catalogPresentation)
    : undefined;
  if (
    !isCompactInstanceId(id) ||
    !isCompactAccountPublicId(accountId) ||
    !isWidgetOverlayCode(widgetCode) ||
    !widgetType ||
    !config ||
    (isTemplate !== true && isTemplate !== false) ||
    (Object.prototype.hasOwnProperty.call(payload, 'catalogPresentation') && !catalogPresentation) ||
    !createdAt ||
    !updatedAt
  )
    return null;
  const identity = {
    id,
    accountId,
    widgetCode,
    widgetType,
    displayName,
    config,
    createdAt,
    updatedAt,
  };
  if (isTemplate === true) {
    if (Object.prototype.hasOwnProperty.call(payload, 'baseLocale')) return null;
    return {
      ...identity,
      isTemplate: true,
      ...(catalogPresentation ? { catalogPresentation } : {}),
    };
  }
  const baseLocale = normalizeLocale(payload.baseLocale) ?? '';
  if (!baseLocale || Object.prototype.hasOwnProperty.call(payload, 'catalogPresentation')) return null;
  return { ...identity, isTemplate: false, baseLocale };
}

function normalizeContentFieldStatus(value: unknown): AccountInstanceContentFieldStatus | null {
  return value === 'ok' || value === 'changed' ? value : null;
}

export function normalizeAccountInstanceContentDocument(
  raw: unknown,
): AccountInstanceContentDocument | null {
  const payload = asRecord(raw);
  if (!payload) return null;
  const id = normalizeStorageId(payload.id) ?? '';
  const accountId = normalizeStorageId(payload.accountId) ?? '';
  const widgetType = asTrimmedString(payload.widgetType) ?? '';
  const updatedAt = asTrimmedString(payload.updatedAt) ?? '';
  const rawFields = asRecord(payload.fields);
  if (asRecord(payload.localeSync)) return null;
  if (
    !isCompactInstanceId(id) ||
    !isCompactAccountPublicId(accountId) ||
    !widgetType ||
    !updatedAt ||
    !rawFields
  )
    return null;
  const fields: AccountInstanceContentDocument['fields'] = {};
  for (const [path, rawField] of Object.entries(rawFields)) {
    const field = asRecord(rawField);
    if (!field) return null;
    if (asRecord(field.localeStatus) || asRecord(field.translatedValues)) return null;
    const value = typeof field.value === 'string' ? field.value : null;
    const status = normalizeContentFieldStatus(field.status);
    if (value == null || !status) return null;
    fields[path] = {
      ...(typeof field.identityKey === 'string' && field.identityKey
        ? { identityKey: field.identityKey }
        : {}),
      ...(typeof field.fieldPattern === 'string' && field.fieldPattern
        ? { fieldPattern: field.fieldPattern }
        : {}),
      value,
      status,
    };
  }
  return {
    id,
    accountId,
    widgetType,
    fields,
    updatedAt,
  };
}

export function resolveAccountInstanceValidationReason(raw: unknown): string {
  const payload = asRecord(raw);
  const widgetType = asTrimmedString(payload?.widgetType);
  if (!widgetType) return 'coreui.errors.instance.widgetMissing';
  return 'coreui.errors.instance.config.invalid';
}
