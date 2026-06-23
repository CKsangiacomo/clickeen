import { asTrimmedString } from '@clickeen/ck-contracts';
import {
  isCompactAccountPublicId,
  isCompactInstanceId,
  isWidgetOverlayCode,
} from '@clickeen/ck-contracts/overlay-identity';
import { normalizeLocale } from '../../asset-utils';
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

function normalizeInstanceMeta(value: unknown): Record<string, unknown> | null {
  if (value == null) return null;
  const meta = asRecord(value);
  if (!meta) return null;
  const out: Record<string, unknown> = {};
  const allowedKeys = new Set(['baseLocale', 'styleName', 'name', 'title']);
  for (const key of Object.keys(meta)) {
    if (!allowedKeys.has(key)) return null;
  }
  for (const key of ['baseLocale', 'styleName', 'name', 'title']) {
    const entry = meta[key];
    if (typeof entry === 'string' && entry.trim()) out[key] = entry.trim();
  }
  return out;
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
  const baseLocale = normalizeLocale(payload.baseLocale) ?? '';
  if (
    !isCompactInstanceId(id) ||
    !isCompactAccountPublicId(accountId) ||
    !isWidgetOverlayCode(widgetCode) ||
    !widgetType ||
    !config ||
    !baseLocale ||
    !createdAt ||
    !updatedAt
  )
    return null;
  const meta = normalizeInstanceMeta(payload.meta);
  if (asRecord(payload.meta) && !meta) return null;
  const publicPackageFingerprint = asTrimmedString(payload.publicPackageFingerprint);
  if (
    Object.prototype.hasOwnProperty.call(payload, 'publicPackageFingerprint') &&
    payload.publicPackageFingerprint != null &&
    !publicPackageFingerprint
  ) {
    return null;
  }
  return {
    id,
    accountId,
    widgetCode,
    widgetType,
    displayName,
    meta,
    config,
    baseLocale,
    ...(publicPackageFingerprint ? { publicPackageFingerprint } : {}),
    createdAt,
    updatedAt,
  };
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
