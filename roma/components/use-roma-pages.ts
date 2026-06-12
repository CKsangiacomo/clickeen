'use client';

export type PageRobots = 'index,follow' | 'noindex,nofollow';
export type PagePublishStatus = 'published' | 'unpublished';

export type PageMetadata = {
  title: string;
  description: string;
  robots: PageRobots;
  canonicalUrl?: string;
};

export type PageLocalization = {
  defaultLocale: string;
  ipLocalizationEnabled: boolean;
  countryLocaleRules: Array<{ country: string; locale: string }>;
  languageSwitcherEnabled: boolean;
  missingLocaleBehavior: 'block_publish';
};

export type PagePlacement = {
  placementId: string;
  instanceId: string;
};

export type AccountPageSource = {
  schemaVersion: 1;
  pageId: string;
  accountPublicId: string;
  displayName: string;
  metadata: PageMetadata;
  localization: PageLocalization;
  placements: PagePlacement[];
  version: number;
  updatedAt: string;
};

export type AccountPageSummary = {
  pageId: string;
  title: string;
  description: string;
  robots: PageRobots;
  placementCount: number;
  createdAt: string;
  updatedAt: string;
};

export type RomaPagesResponse = {
  accountId: string;
  pages: AccountPageSummary[];
};

export type RomaPageOpenResponse = {
  source: AccountPageSource;
  publishStatus: PagePublishStatus;
};

type RomaPagesFetchJson = <T = unknown>(url: string, init?: RequestInit & { timeoutMs?: number }) => Promise<T>;

const ROMA_PAGES_CACHE_TTL_MS = 2 * 60 * 1000;
const romaPagesCache = new Map<string, { data: RomaPagesResponse; fetchedAt: number }>();
const romaPagesInflight = new Map<string, Promise<RomaPagesResponse>>();

function normalizeRobots(value: unknown): PageRobots | null {
  return value === 'index,follow' || value === 'noindex,nofollow' ? value : null;
}

function normalizePublishStatus(value: unknown): PagePublishStatus | null {
  return value === 'published' || value === 'unpublished' ? value : null;
}

function normalizePageSummary(raw: unknown): AccountPageSummary | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  const pageId = typeof record.pageId === 'string' ? record.pageId.trim() : '';
  const title = typeof record.title === 'string' ? record.title.trim() : '';
  const description = typeof record.description === 'string' ? record.description.trim() : '';
  const robots = normalizeRobots(record.robots);
  const placementCount =
    typeof record.placementCount === 'number' && Number.isFinite(record.placementCount)
      ? Math.max(0, Math.floor(record.placementCount))
      : null;
  const createdAt = typeof record.createdAt === 'string' ? record.createdAt.trim() : '';
  const updatedAt = typeof record.updatedAt === 'string' ? record.updatedAt.trim() : '';
  if (!pageId || !title || !robots || placementCount == null || !createdAt || !updatedAt) return null;
  return { pageId, title, description, robots, placementCount, createdAt, updatedAt };
}

export function normalizeRomaPagesResponse(raw: unknown): RomaPagesResponse | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  const accountId = typeof record.accountId === 'string' ? record.accountId.trim() : '';
  if (!accountId || !Array.isArray(record.pages)) return null;
  const pages = record.pages.map(normalizePageSummary);
  if (pages.some((page) => page === null)) return null;
  return {
    accountId,
    pages: pages as AccountPageSummary[],
  };
}

export function normalizeRomaPageOpenResponse(raw: unknown): RomaPageOpenResponse | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  const source = record.source && typeof record.source === 'object' && !Array.isArray(record.source)
    ? record.source as AccountPageSource
    : null;
  const publishStatus = normalizePublishStatus(record.publishStatus);
  if (!source || !publishStatus) return null;
  return { source, publishStatus };
}

export function readRomaPagesCache(accountId: string): { data: RomaPagesResponse; fetchedAt: number } | null {
  const normalizedAccountId = String(accountId || '').trim();
  if (!normalizedAccountId) return null;
  return romaPagesCache.get(normalizedAccountId) ?? null;
}

export function isRomaPagesCacheFresh(entry: { fetchedAt: number } | null): boolean {
  if (!entry) return false;
  return Date.now() - entry.fetchedAt < ROMA_PAGES_CACHE_TTL_MS;
}

export function writeRomaPagesCache(data: RomaPagesResponse) {
  const entry = { data, fetchedAt: Date.now() };
  romaPagesCache.set(data.accountId, entry);
  return entry;
}

export async function loadRomaPagesForAccount(args: {
  accountId: string;
  fetchJson: RomaPagesFetchJson;
  force?: boolean;
}): Promise<RomaPagesResponse> {
  const accountId = String(args.accountId || '').trim();
  if (!accountId) throw new Error('coreui.errors.auth.contextUnavailable');

  const cached = readRomaPagesCache(accountId);
  if (!args.force && cached && isRomaPagesCacheFresh(cached)) return cached.data;

  const existing = romaPagesInflight.get(accountId);
  if (!args.force && existing) return existing;

  const request = args.fetchJson<unknown>('/api/account/pages', { method: 'GET' }).then((payload) => {
    const normalized = normalizeRomaPagesResponse(payload);
    if (!normalized || normalized.accountId !== accountId) throw new Error('coreui.errors.payload.invalid');
    writeRomaPagesCache(normalized);
    return normalized;
  });
  romaPagesInflight.set(accountId, request);
  try {
    return await request;
  } finally {
    if (romaPagesInflight.get(accountId) === request) romaPagesInflight.delete(accountId);
  }
}

export function buildPagesRoute(pageId?: string | null): string {
  const normalizedPageId = String(pageId || '').trim();
  return normalizedPageId ? `/pages?page=${encodeURIComponent(normalizedPageId)}` : '/pages';
}
