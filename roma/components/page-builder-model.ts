'use client';

import { collectConfigMediaAssetRefs, type ResolvedAccountAsset } from '@clickeen/ck-contracts';
import type { AccountPage, AccountPageTemplate, PageLocaleOverlay } from '@clickeen/ck-contracts/pages';
import { generatePage, type ExactLocaleOverlays, type GeneratePageOutput } from '@clickeen/ck-web-code-generator';
import type { AccountFontLibrary } from '@clickeen/widget-shell';
import { buildRuntimeTypographyData, collectFontAssetRefs } from '@clickeen/bob/web-code-context';
import { parseResolvedAccountAsset } from '@roma/lib/account-asset-record';

export type PageDraftSource = Omit<AccountPage, 'pageId'> | Omit<AccountPageTemplate, 'pageId'>;

export type PagePlacementDraft = {
  placementId: string;
  instanceId: string;
  displayName: string;
  widgetType: string;
  source: Record<string, unknown>;
  files: { indexHtml: string; stylesCss: string; runtimeJs: string };
  overlays: ExactLocaleOverlays | null;
  fontLibrary: AccountFontLibrary;
  unavailable?: boolean;
};

type FetchJson = <T = unknown>(url: string, init?: RequestInit & { timeoutMs?: number }) => Promise<T>;

function requireRecord(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('coreui.errors.payload.invalid');
  return raw as Record<string, unknown>;
}

export function createBlankPageDraft(baseLocale: string): PageDraftSource {
  return {
    displayName: 'Untitled page',
    isTemplate: false,
    baseLocale,
    values: { title: '' },
    robots: 'index-follow',
    placements: [],
  };
}

export async function loadPagePlacement(args: {
  instanceId: string;
  settingsLocales: string[];
  fetchJson: FetchJson;
}): Promise<PagePlacementDraft> {
  const opened = requireRecord(await args.fetchJson(`/api/builder/${encodeURIComponent(args.instanceId)}/open`));
  const widgetType = typeof opened.widgetType === 'string' ? opened.widgetType : '';
  const displayName = typeof opened.displayName === 'string' ? opened.displayName : '';
  const config = requireRecord(opened.config);
  const files = requireRecord(opened.publicPackage);
  const fontLibrary = opened.fontLibrary as AccountFontLibrary;
  if (!widgetType || !displayName || typeof files.indexHtml !== 'string' || typeof files.stylesCss !== 'string' || typeof files.runtimeJs !== 'string' || !fontLibrary) {
    throw new Error('coreui.errors.payload.invalid');
  }

  const translations = requireRecord(await args.fetchJson(`/api/account/instances/${encodeURIComponent(args.instanceId)}/translations`));
  const summaries = Array.isArray(translations.translations) ? translations.translations : [];
  const translated = new Set(summaries.map((entry) => requireRecord(entry).locale).filter((locale): locale is string => typeof locale === 'string'));
  const overlayEntries = await Promise.all(args.settingsLocales.filter((locale) => translated.has(locale)).map(async (locale) => {
    const payload = requireRecord(await args.fetchJson(`/api/account/instances/${encodeURIComponent(args.instanceId)}/translations/${encodeURIComponent(locale)}`));
    const values = requireRecord(payload.values);
    if (Object.values(values).some((value) => typeof value !== 'string')) throw new Error('coreui.errors.payload.invalid');
    return [locale, { values: values as Record<string, string> }] as const;
  }));
  return {
    placementId: crypto.randomUUID(),
    instanceId: args.instanceId,
    displayName,
    widgetType,
    source: { ...config, widgetType },
    files: { indexHtml: files.indexHtml, stylesCss: files.stylesCss, runtimeJs: files.runtimeJs },
    overlays: overlayEntries.length ? Object.fromEntries(overlayEntries) : null,
    fontLibrary,
  };
}

export async function generatePageDraft(args: {
  source: PageDraftSource;
  settingsLocales: string[];
  pageOverlays: Record<string, PageLocaleOverlay>;
  placements: PagePlacementDraft[];
  fetchJson: FetchJson;
}): Promise<GeneratePageOutput> {
  if (!args.source.values.title) throw new Error('Page title is required.');
  const fontLibrary = args.placements[0]?.fontLibrary ?? { version: 1, fonts: {} } as AccountFontLibrary;
  const assetRefs = new Set<string>([
    ...args.placements.flatMap((placement) => collectConfigMediaAssetRefs(placement.source)),
    ...collectFontAssetRefs(fontLibrary),
    ...(args.source.values.socialImageAssetRef ? [args.source.values.socialImageAssetRef] : []),
  ]);
  const resolvedAssets = new Map<string, ResolvedAccountAsset>();
  if (assetRefs.size) {
    const payload = requireRecord(await args.fetchJson('/api/account/assets/resolve', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ assetRefs: Array.from(assetRefs) }),
    }));
    if (!Array.isArray(payload.assets)) throw new Error('coreui.errors.payload.invalid');
    payload.assets.forEach((raw) => {
      const asset = parseResolvedAccountAsset(raw);
      if (!asset) throw new Error('coreui.errors.payload.invalid');
      resolvedAssets.set(asset.assetRef, asset);
    });
  }
  const typography = buildRuntimeTypographyData({ fontLibrary, resolvedAssets });
  if (!typography.ok) throw new Error(typography.error ?? 'coreui.errors.typography.fontLibrary.invalid');
  return generatePage({
    source: args.source,
    settingsLocales: args.settingsLocales,
    pageOverlays: args.pageOverlays,
    placements: args.placements.map((placement) => ({
      placementId: placement.placementId,
      instanceId: placement.instanceId,
      source: placement.source,
      files: placement.files,
      overlays: placement.overlays,
    })),
    context: { assetsByRef: Object.fromEntries(resolvedAssets), typography: typography.data },
  });
}
