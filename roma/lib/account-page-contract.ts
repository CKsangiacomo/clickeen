import { isRecord } from '@clickeen/ck-contracts';
import type {
  AccountPageSource,
  PagePlacement,
  PageValues,
} from '@clickeen/ck-contracts/pages';
import {
  isCompactInstanceId,
  isCompactPageId,
} from '@clickeen/ck-contracts/overlay-identity';
import { isAccountAssetRef } from './account-asset-record';

const LOCALE_RE = /^[a-z]{2}(?:-[A-Za-z0-9]{2,8})?$/;

function hasExactKeys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  const expected = new Set(allowed);
  return Object.keys(value).every((key) => expected.has(key)) &&
    allowed.every((key) => Object.prototype.hasOwnProperty.call(value, key));
}

function isNonEmptyExactString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value === value.trim();
}

function parseValues(raw: unknown): PageValues | null {
  if (!isRecord(raw)) return null;
  const allowed = ['title', 'description', 'socialTitle', 'socialDescription', 'socialImageAssetRef'] as const;
  if (Object.keys(raw).some((key) => !allowed.includes(key as typeof allowed[number]))) return null;
  if (!isNonEmptyExactString(raw.title)) return null;
  for (const key of ['description', 'socialTitle', 'socialDescription'] as const) {
    if (Object.prototype.hasOwnProperty.call(raw, key) && typeof raw[key] !== 'string') return null;
  }
  if (
    Object.prototype.hasOwnProperty.call(raw, 'socialImageAssetRef') &&
    !isAccountAssetRef(raw.socialImageAssetRef)
  ) return null;
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
    if (!hasExactKeys(raw, ['pageId', 'displayName', 'isTemplate', 'values', 'robots', 'placements'])) return null;
    return {
      pageId: raw.pageId,
      displayName: raw.displayName,
      isTemplate: true,
      values,
      robots: raw.robots,
      placements: exactPlacements,
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

export function pageIdsPlacingInstance(args: {
  sources: AccountPageSource[];
  instanceId: string;
}): string[] {
  return args.sources
    .filter((source) => source.placements.some((placement) => placement.instanceId === args.instanceId))
    .map((source) => source.pageId);
}
