'use client';

import type { AccountPageSource } from '@clickeen/ck-contracts/pages';
import { parseAccountPageSource } from '../lib/account-page-contract';

export type RomaPageInventoryItem = {
  source: Extract<AccountPageSource, { isTemplate: false }>;
  serveState: {
    published: boolean;
    needsUpdate: boolean;
  };
  savedLocales: string[];
};

export type RomaPagesResponse = {
  accountId: string;
  pages: RomaPageInventoryItem[];
};

type FetchJson = <T = unknown>(url: string, init?: RequestInit & { timeoutMs?: number }) => Promise<T>;

const cache = new Map<string, RomaPagesResponse>();

function normalizeInventoryItem(raw: unknown): RomaPageInventoryItem | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const item = raw as Record<string, unknown>;
  const source = parseAccountPageSource(item.source);
  const serveState = item.serveState;
  if (!source || source.isTemplate || !serveState || typeof serveState !== 'object' || Array.isArray(serveState)) {
    return null;
  }
  const state = serveState as Record<string, unknown>;
  if (typeof state.published !== 'boolean' || typeof state.needsUpdate !== 'boolean') return null;
  if (!Array.isArray(item.savedLocales) || item.savedLocales.some((locale) => typeof locale !== 'string' || !locale)) {
    return null;
  }
  return {
    source,
    serveState: { published: state.published, needsUpdate: state.needsUpdate },
    savedLocales: item.savedLocales as string[],
  };
}

export function normalizeRomaPagesResponse(raw: unknown): RomaPagesResponse | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const response = raw as Record<string, unknown>;
  const accountId = typeof response.accountId === 'string' ? response.accountId.trim() : '';
  if (!accountId || !Array.isArray(response.pages)) return null;
  const pages = response.pages.map(normalizeInventoryItem);
  if (pages.some((page) => !page)) return null;
  return { accountId, pages: pages as RomaPageInventoryItem[] };
}

export async function loadRomaPages(args: {
  accountId: string;
  fetchJson: FetchJson;
  force?: boolean;
}): Promise<RomaPagesResponse> {
  const accountId = args.accountId.trim();
  if (!accountId) throw new Error('coreui.errors.auth.contextUnavailable');
  if (!args.force) {
    const cached = cache.get(accountId);
    if (cached) return cached;
  }
  const payload = await args.fetchJson('/api/account/pages', { method: 'GET' });
  const normalized = normalizeRomaPagesResponse(payload);
  if (!normalized || normalized.accountId !== accountId) throw new Error('coreui.errors.payload.invalid');
  cache.set(accountId, normalized);
  return normalized;
}

export function writeRomaPagesCache(response: RomaPagesResponse): void {
  cache.set(response.accountId, response);
}

export function clearRomaPagesCache(accountId: string): void {
  cache.delete(accountId.trim());
}
