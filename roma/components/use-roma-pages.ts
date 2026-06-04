'use client';

export type PageRobots = 'index,follow' | 'noindex,nofollow';
export type PagePublishStatus = 'published' | 'unpublished';

export type PageHead = {
  title: string;
  description: string;
  robots: PageRobots;
};

export type PagePlacement = {
  instanceId: string;
};

export type AccountPageSource = {
  v: 1;
  id: string;
  head: PageHead;
  placements: PagePlacement[];
};

export type AccountPageSummary = {
  id: string;
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
  const id = typeof record.id === 'string' ? record.id.trim() : '';
  const title = typeof record.title === 'string' ? record.title.trim() : '';
  const description = typeof record.description === 'string' ? record.description.trim() : '';
  const robots = normalizeRobots(record.robots);
  const placementCount =
    typeof record.placementCount === 'number' && Number.isFinite(record.placementCount)
      ? Math.max(0, Math.floor(record.placementCount))
      : null;
  const createdAt = typeof record.createdAt === 'string' ? record.createdAt.trim() : '';
  const updatedAt = typeof record.updatedAt === 'string' ? record.updatedAt.trim() : '';
  if (!id || !title || !robots || placementCount == null || !createdAt || !updatedAt) return null;
  return { id, title, description, robots, placementCount, createdAt, updatedAt };
}

function normalizePlacement(raw: unknown): PagePlacement | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  const instanceId = typeof record.instanceId === 'string' ? record.instanceId.trim() : '';
  if (!instanceId) return null;
  return { instanceId };
}

function normalizePageSource(raw: unknown): AccountPageSource | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  if (record.v !== 1) return null;
  const id = typeof record.id === 'string' ? record.id.trim() : '';
  const headRaw = record.head;
  if (!headRaw || typeof headRaw !== 'object' || Array.isArray(headRaw)) return null;
  const headRecord = headRaw as Record<string, unknown>;
  const title = typeof headRecord.title === 'string' ? headRecord.title.trim() : '';
  const description = typeof headRecord.description === 'string' ? headRecord.description.trim() : '';
  const robots = normalizeRobots(headRecord.robots);
  const placements = Array.isArray(record.placements)
    ? record.placements.map(normalizePlacement).filter((placement): placement is PagePlacement => Boolean(placement))
    : null;
  if (!id || !title || !robots || !placements) return null;
  return { v: 1, id, head: { title, description, robots }, placements };
}

export function normalizeRomaPagesResponse(raw: unknown): RomaPagesResponse | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  const accountId = typeof record.accountId === 'string' ? record.accountId.trim() : '';
  if (!accountId || !Array.isArray(record.pages)) return null;
  return {
    accountId,
    pages: record.pages
      .map(normalizePageSummary)
      .filter((page): page is AccountPageSummary => Boolean(page)),
  };
}

export function normalizeRomaPageOpenResponse(raw: unknown): RomaPageOpenResponse | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  const source = normalizePageSource(record.source);
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
