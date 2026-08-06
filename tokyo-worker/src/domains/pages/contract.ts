import { isRecord } from '@clickeen/ck-contracts';
import { parseCatalogPresentation } from '@clickeen/ck-contracts/catalog';
import type {
  AccountPageSource,
  PageLocaleOverlay,
  PagePlacement,
  PageValues,
} from '@clickeen/ck-contracts/pages';
import {
  isCompactInstanceId,
  isCompactPageId,
} from '@clickeen/ck-contracts/overlay-identity';
import type { PageGeneratedFiles, PageServeState, PageServingOverlays } from './types';

const LOCALE_RE = /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})?$/;
const ASSET_REF_SEGMENT_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/;

function hasExactKeys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  const expected = new Set(allowed);
  return Object.keys(value).every((key) => expected.has(key)) &&
    allowed.every((key) => Object.prototype.hasOwnProperty.call(value, key));
}

function isNonEmptyExactString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value === value.trim();
}

function isAccountAssetRef(value: unknown): value is string {
  if (typeof value !== 'string' || !value || value.length > 240) return false;
  if (value.trim() !== value || value.startsWith('/') || value.includes('\\') || /[\u0000-\u001f\u007f]/.test(value)) return false;
  return value.split('/').every((segment) => segment && segment !== '.' && segment !== '..' && ASSET_REF_SEGMENT_RE.test(segment));
}

function parseValues(raw: unknown): PageValues | null {
  if (!isRecord(raw)) return null;
  const allowed = ['title', 'description', 'socialTitle', 'socialDescription', 'socialImageAssetRef'] as const;
  if (Object.keys(raw).some((key) => !allowed.includes(key as typeof allowed[number]))) return null;
  if (!isNonEmptyExactString(raw.title)) return null;
  for (const key of ['description', 'socialTitle', 'socialDescription'] as const) {
    if (Object.prototype.hasOwnProperty.call(raw, key) && typeof raw[key] !== 'string') return null;
  }
  if (Object.prototype.hasOwnProperty.call(raw, 'socialImageAssetRef') && !isAccountAssetRef(raw.socialImageAssetRef)) return null;
  return {
    title: raw.title,
    ...(typeof raw.description === 'string' ? { description: raw.description } : {}),
    ...(typeof raw.socialTitle === 'string' ? { socialTitle: raw.socialTitle } : {}),
    ...(typeof raw.socialDescription === 'string' ? { socialDescription: raw.socialDescription } : {}),
    ...(typeof raw.socialImageAssetRef === 'string' ? { socialImageAssetRef: raw.socialImageAssetRef } : {}),
  };
}

function parsePlacement(raw: unknown): PagePlacement | null {
  if (!isRecord(raw) || !hasExactKeys(raw, ['placementId', 'instanceId'])) return null;
  if (!isNonEmptyExactString(raw.placementId) || !isCompactInstanceId(raw.instanceId)) return null;
  return { placementId: raw.placementId, instanceId: raw.instanceId };
}

export function parseAccountPageSource(raw: unknown, expectedPageId?: string): AccountPageSource | null {
  if (!isRecord(raw) || !isCompactPageId(raw.pageId)) return null;
  if (expectedPageId && raw.pageId !== expectedPageId) return null;
  if (!isNonEmptyExactString(raw.displayName)) return null;
  if (raw.isTemplate !== true && raw.isTemplate !== false) return null;
  if (raw.robots !== 'index-follow' && raw.robots !== 'noindex-follow') return null;
  const values = parseValues(raw.values);
  if (!values || !Array.isArray(raw.placements)) return null;
  const placements = raw.placements.map(parsePlacement);
  if (placements.some((placement) => !placement)) return null;
  const exactPlacements = placements as PagePlacement[];
  if (new Set(exactPlacements.map((entry) => entry.placementId)).size !== exactPlacements.length) return null;
  if (new Set(exactPlacements.map((entry) => entry.instanceId)).size !== exactPlacements.length) return null;

  if (raw.isTemplate) {
    const hasPresentation = Object.prototype.hasOwnProperty.call(raw, 'catalogPresentation');
    if (!hasExactKeys(raw, [
      'pageId', 'displayName', 'isTemplate', 'values', 'robots', 'placements',
      ...(hasPresentation ? ['catalogPresentation'] : []),
    ])) return null;
    const catalogPresentation = hasPresentation ? parseCatalogPresentation(raw.catalogPresentation) : null;
    if (hasPresentation && !catalogPresentation) return null;
    return {
      pageId: raw.pageId,
      displayName: raw.displayName,
      isTemplate: true,
      values,
      robots: raw.robots,
      placements: exactPlacements,
      ...(catalogPresentation ? { catalogPresentation } : {}),
    };
  }
  if (!hasExactKeys(raw, ['pageId', 'displayName', 'isTemplate', 'baseLocale', 'values', 'robots', 'placements'])) return null;
  if (typeof raw.baseLocale !== 'string' || !LOCALE_RE.test(raw.baseLocale)) return null;
  return {
    pageId: raw.pageId,
    displayName: raw.displayName,
    isTemplate: false,
    baseLocale: raw.baseLocale,
    values,
    robots: raw.robots,
    placements: exactPlacements,
  };
}

export function parsePageLocaleOverlay(raw: unknown, source: AccountPageSource): PageLocaleOverlay | null {
  if (source.isTemplate || !isRecord(raw) || !hasExactKeys(raw, ['values']) || !isRecord(raw.values)) return null;
  const expectedKeys = ['title', ...(['description', 'socialTitle', 'socialDescription'] as const)
    .filter((key) => Object.prototype.hasOwnProperty.call(source.values, key))];
  if (!hasExactKeys(raw.values, expectedKeys)) return null;
  if (!isNonEmptyExactString(raw.values.title)) return null;
  for (const key of expectedKeys.slice(1)) {
    if (typeof raw.values[key] !== 'string') return null;
  }
  return {
    values: {
      title: raw.values.title,
      ...(typeof raw.values.description === 'string' ? { description: raw.values.description } : {}),
      ...(typeof raw.values.socialTitle === 'string' ? { socialTitle: raw.values.socialTitle } : {}),
      ...(typeof raw.values.socialDescription === 'string' ? { socialDescription: raw.values.socialDescription } : {}),
    },
  };
}

export function isPageLocale(value: unknown): value is string {
  return typeof value === 'string' && LOCALE_RE.test(value);
}

export function parsePageGeneratedFiles(raw: unknown): PageGeneratedFiles | null {
  if (!isRecord(raw) || !hasExactKeys(raw, ['indexHtml', 'stylesCss', 'runtimeJs'])) return null;
  if (
    typeof raw.indexHtml !== 'string' ||
    typeof raw.stylesCss !== 'string' ||
    typeof raw.runtimeJs !== 'string'
  ) return null;
  return { indexHtml: raw.indexHtml, stylesCss: raw.stylesCss, runtimeJs: raw.runtimeJs };
}

export function parsePageServingOverlays(raw: unknown, source: AccountPageSource): PageServingOverlays | null {
  if (source.isTemplate || !isRecord(raw)) return null;
  const placementIds = source.placements.map((placement) => placement.placementId);
  const expectedPlacements = new Set(placementIds);
  const output: PageServingOverlays = {};
  for (const [locale, entry] of Object.entries(raw)) {
    if (!isPageLocale(locale) || locale === source.baseLocale || !isRecord(entry) || !hasExactKeys(entry, ['page', 'placements'])) return null;
    const pageOverlay = parsePageLocaleOverlay({ values: entry.page }, source);
    if (!pageOverlay || !isRecord(entry.placements)) return null;
    if (
      Object.keys(entry.placements).length !== placementIds.length ||
      Object.keys(entry.placements).some((placementId) => !expectedPlacements.has(placementId))
    ) return null;
    const placements: Record<string, Record<string, string>> = {};
    for (const placementId of placementIds) {
      const values = entry.placements[placementId];
      if (!isRecord(values)) return null;
      const exactValues: Record<string, string> = {};
      for (const [path, value] of Object.entries(values)) {
        if (!path || path.includes('[]') || path.includes('*') || typeof value !== 'string') return null;
        exactValues[path] = value;
      }
      placements[placementId] = exactValues;
    }
    output[locale] = { page: pageOverlay.values, placements };
  }
  return output;
}

export function parsePageServeState(raw: unknown): PageServeState | null {
  return isRecord(raw) &&
    hasExactKeys(raw, ['published', 'needsUpdate']) &&
    typeof raw.published === 'boolean' &&
    typeof raw.needsUpdate === 'boolean'
    ? { published: raw.published, needsUpdate: raw.needsUpdate }
    : null;
}
