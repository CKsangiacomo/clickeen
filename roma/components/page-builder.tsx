'use client';

import { parseAccountLocaleListStrict, parseAccountLocalePolicyStrict } from '@clickeen/ck-contracts';
import type { AccountPage, AccountPageSource, AccountPageTemplate, PageLocaleOverlay } from '@clickeen/ck-contracts/pages';
import { createCompactPageId } from '@clickeen/ck-contracts/overlay-identity';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createDialogLifecycle, type DialogLifecycle } from '../../dieter/components/shared/dialog-lifecycle';
import { parseAccountAssetRecord, parseResolvedAccountAsset } from '../lib/account-asset-record';
import { parseAccountPageSource } from '../lib/account-page-contract';
import { copyToClipboard } from '../lib/copy-to-clipboard';
import { buildPagePublicActions, type PublicActions } from '../lib/public-actions';
import {
  collectPageCatalogAssetRefs,
  copyCatalogAssetsInPageSource,
  discardCatalogAssetsInPageSource,
  parseCatalogAssetMappings,
} from '../lib/catalog-asset-choice';
import { useRomaAccountApi } from './account-api';
import { BuilderDomain } from './builder-domain';
import { CatalogAssetChoiceDialog } from './catalog-asset-choice-dialog';
import { PageBuilderContent } from './page-builder-content';
import { PageBuilderSeo } from './page-builder-seo';
import { DieterTextfield } from './dieter-textfield';
import { createBlankPageDraft, generatePageDraft, loadPagePlacement, type PageDraftSource, type PagePlacementDraft } from './page-builder-model';
import { PageWorkspace } from './page-workspace';
import { PublicCodeDialog } from './public-code-dialog';
import { RomaUnsavedChangesDialog } from './roma-unsaved-changes-dialog';
import { RomaUpsellDialog } from './roma-upsell-dialog';
import { useRomaAccountContext } from './roma-account-context';
import { useRomaShellActions } from './roma-shell';
import { clearRomaPagesCache, loadRomaPages } from './use-roma-pages';
import type { WidgetInstance } from './use-roma-widgets';

type WebFiles = { indexHtml: string; stylesCss: string; runtimeJs: string };
type PageDetail = {
  source: AccountPageSource;
  files: WebFiles;
  overlaysJson?: Record<string, unknown>;
  serveState?: { published: boolean; needsUpdate: boolean };
};

function parseDetail(raw: unknown): PageDetail {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('coreui.errors.payload.invalid');
  const value = raw as Record<string, unknown>;
  const source = parseAccountPageSource(value.source);
  const files = value.files as WebFiles | null;
  const state = value.serveState as PageDetail['serveState'] | null;
  const overlaysJson = value.overlaysJson;
  if (!source || !files || typeof files.indexHtml !== 'string' || typeof files.stylesCss !== 'string' || typeof files.runtimeJs !== 'string') {
    throw new Error('coreui.errors.payload.invalid');
  }
  if (source.isTemplate) return { source, files };
  if (!overlaysJson || typeof overlaysJson !== 'object' || Array.isArray(overlaysJson) || !state || typeof state.published !== 'boolean' || typeof state.needsUpdate !== 'boolean') {
    throw new Error('coreui.errors.payload.invalid');
  }
  return { source, files, overlaysJson: overlaysJson as Record<string, unknown>, serveState: state };
}

type PageTemplateDraft = { kind: 'account' | 'catalog'; pageId: string };

function parseCatalogTemplate(raw: unknown): { source: AccountPageTemplate; files: WebFiles } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('coreui.errors.payload.invalid');
  const template = (raw as { template?: unknown }).template;
  if (!template || typeof template !== 'object' || Array.isArray(template)) throw new Error('coreui.errors.payload.invalid');
  const value = template as { source?: unknown; files?: unknown };
  const source = parseAccountPageSource(value.source);
  const files = value.files as WebFiles | null;
  if (!source?.isTemplate || !files || typeof files.indexHtml !== 'string' || typeof files.stylesCss !== 'string' || typeof files.runtimeJs !== 'string') throw new Error('coreui.errors.payload.invalid');
  return { source, files };
}

async function readPageOverlay(fetchRaw: ReturnType<typeof useRomaAccountApi>['fetchRaw'], pageId: string, locale: string): Promise<PageLocaleOverlay | null> {
  const response = await fetchRaw(`/api/account/pages/${encodeURIComponent(pageId)}/translations/${encodeURIComponent(locale)}`, { method: 'GET' });
  if (response.status === 404) return null;
  const payload = await response.json().catch(() => null) as { overlay?: { values?: unknown } } | null;
  const rawValues = payload?.overlay?.values;
  if (!response.ok || !rawValues || typeof rawValues !== 'object' || Array.isArray(rawValues)) throw new Error('coreui.errors.payload.invalid');
  const values = rawValues as PageLocaleOverlay['values'];
  if (typeof values.title !== 'string') throw new Error('coreui.errors.payload.invalid');
  return { values };
}

function isNotFoundError(error: unknown): boolean {
  return error instanceof Error && (error as Error & { status?: number }).status === 404;
}

function readTranslationResult(raw: unknown): { accepted: boolean; translatedLocales: string[]; failedLocales: string[] } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('coreui.errors.payload.invalid');
  const translation = (raw as { translation?: unknown }).translation;
  if (!translation || typeof translation !== 'object' || Array.isArray(translation)) throw new Error('coreui.errors.payload.invalid');
  const value = translation as { accepted?: unknown; translatedLocales?: unknown; failedLocales?: unknown };
  if (typeof value.accepted !== 'boolean') throw new Error('coreui.errors.payload.invalid');
  if (!Array.isArray(value.translatedLocales) || !value.translatedLocales.every((locale) => typeof locale === 'string')) throw new Error('coreui.errors.payload.invalid');
  if (!Array.isArray(value.failedLocales) || !value.failedLocales.every((failure) => failure && typeof failure === 'object' && typeof (failure as { locale?: unknown }).locale === 'string')) throw new Error('coreui.errors.payload.invalid');
  return {
    accepted: value.accepted,
    translatedLocales: value.translatedLocales,
    failedLocales: value.failedLocales.map((failure) => (failure as { locale: string }).locale),
  };
}

function readMissingPublishLocales(raw: unknown): string[] {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return [];
  const error = (raw as { error?: unknown }).error;
  if (!error || typeof error !== 'object' || Array.isArray(error)) return [];
  const value = error as { reasonKey?: unknown; paths?: unknown };
  if (value.reasonKey !== 'coreui.errors.page.localesIncomplete' || !Array.isArray(value.paths)) return [];
  return value.paths.flatMap((path) => typeof path === 'string' && path.startsWith('locales.') ? [path.slice('locales.'.length)] : []);
}

function nextPaint(): Promise<void> {
  return new Promise((resolve) => window.requestAnimationFrame(() => resolve()));
}

function unavailablePlacement(coordinate: AccountPage['placements'][number]): PagePlacementDraft {
  return {
    ...coordinate,
    displayName: coordinate.instanceId,
    widgetType: 'Unavailable',
    source: { widgetType: 'unavailable' },
    files: { indexHtml: '', stylesCss: '', runtimeJs: '' },
    overlays: null,
    fontLibrary: { version: 1, fonts: {} },
    unavailable: true,
  };
}

export function PageBuilder({ pageId = '', templateDraft = null }: { pageId?: string; templateDraft?: PageTemplateDraft | null }) {
  const router = useRouter();
  const { activeAccount, accountContext, accountPolicy } = useRomaAccountContext();
  const accountApi = useRomaAccountApi();
  const { openNavigation } = useRomaShellActions();
  const baseLocale = parseAccountLocalePolicyStrict(activeAccount.localePolicy).baseLocale;
  const settingsLocales = useMemo(() => Array.from(new Set([baseLocale, ...parseAccountLocaleListStrict(activeAccount.activeLocales)])), [activeAccount.activeLocales, baseLocale]);
  const canUsePages = accountPolicy.limits['pages.max'] !== 0;
  const canEditPages = accountPolicy.role !== 'viewer';
  const [currentPageId, setCurrentPageId] = useState(pageId);
  const [source, setSourceState] = useState<PageDraftSource>(() => createBlankPageDraft(baseLocale));
  const [placements, setPlacementsState] = useState<PagePlacementDraft[]>([]);
  const [pageOverlays, setPageOverlaysState] = useState<Record<string, PageLocaleOverlay>>({});
  const [savedFiles, setSavedFiles] = useState<WebFiles | null>(null);
  const [published, setPublished] = useState(false);
  const [needsUpdate, setNeedsUpdate] = useState(false);
  const [freshEntryBlocked, setFreshEntryBlocked] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(Boolean(pageId || templateDraft));
  const [loadFailed, setLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewingGenerated, setPreviewingGenerated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedPlacementId, setSelectedPlacementId] = useState('');
  const [activePanel, setActivePanel] = useState<'content' | 'seo'>('content');
  const [activeLocale, setActiveLocale] = useState(baseLocale);
  const [widgetPickerOpen, setWidgetPickerOpen] = useState(false);
  const [translationBusy, setTranslationBusy] = useState(false);
  const [bobInstanceId, setBobInstanceId] = useState('');
  const [moreOpen, setMoreOpen] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateSaving, setTemplateSaving] = useState(false);
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [templateCount, setTemplateCount] = useState<number | null>(null);
  const [createdTemplate, setCreatedTemplate] = useState<{ templateId: string; templateName: string } | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [upsellOpen, setUpsellOpen] = useState(!canUsePages);
  const [upsellReason, setUpsellReason] = useState('Pages are available on Tier 2 and above.');
  const [catalogAssetChoice, setCatalogAssetChoice] = useState<{
    source: AccountPageTemplate;
    assetRefs: string[];
  } | null>(null);
  const [catalogAssetCopying, setCatalogAssetCopying] = useState(false);
  const [catalogAssetError, setCatalogAssetError] = useState<string | null>(null);
  const pendingLeaveRef = useRef<(() => void) | null>(null);
  const catalogAssetChoiceResolverRef = useRef<{
    resolve: (source: AccountPageTemplate) => void;
    reject: (error: Error) => void;
  } | null>(null);
  const moreRef = useRef<HTMLDivElement>(null);
  const updateDialogRef = useRef<HTMLDialogElement>(null);
  const saveTemplateDialogRef = useRef<HTMLDialogElement>(null);
  const deleteDialogRef = useRef<HTMLDialogElement>(null);
  const updateLifecycleRef = useRef<DialogLifecycle | null>(null);
  const publicActions: PublicActions | null = currentPageId && !source.isTemplate && published ? buildPagePublicActions({ accountPublicId: accountContext.accountPublicId, pageId: currentPageId }) : null;
  const pageLimit = accountPolicy.limits['pages.max'];
  const canSaveAsTemplate = canEditPages && accountContext.accountPublicId !== 'CLICKEEN' && Boolean(currentPageId) && !source.isTemplate && pageCount !== null && templateCount !== null && (
    pageLimit === null || (typeof pageLimit === 'number' && pageCount + templateCount < pageLimit)
  );

  const readPageCapacityCounts = useCallback(async () => {
    const [pages, templates] = await Promise.all([
      loadRomaPages({ accountId: accountContext.accountPublicId, fetchJson: accountApi.fetchJson }),
      accountApi.fetchJson('/api/account/page-templates'),
    ]);
    const templateRecord = templates && typeof templates === 'object' && !Array.isArray(templates)
      ? templates as { templates?: unknown }
      : null;
    if (!Array.isArray(templateRecord?.templates)) throw new Error('coreui.errors.payload.invalid');
    return { pages: pages.pages.length, templates: templateRecord.templates.length };
  }, [accountApi, accountContext.accountPublicId]);

  const setSource = useCallback((next: PageDraftSource) => { setSourceState(next); setDirty(true); }, []);
  const setPlacements = useCallback((next: PagePlacementDraft[]) => {
    setPlacementsState(next);
    setSourceState((current) => ({ ...current, placements: next.map(({ placementId, instanceId }) => ({ placementId, instanceId })) }));
    setDirty(true);
  }, []);
  const setPageOverlays = useCallback((next: Record<string, PageLocaleOverlay>) => { setPageOverlaysState(next); setDirty(true); }, []);

  const requestCatalogAssetChoice = useCallback((args: {
    source: AccountPageTemplate;
    assetRefs: string[];
  }): Promise<AccountPageTemplate> => {
    catalogAssetChoiceResolverRef.current?.reject(new Error('coreui.errors.page.open.invalidRequest'));
    setCatalogAssetError(null);
    setCatalogAssetChoice(args);
    return new Promise((resolve, reject) => {
      catalogAssetChoiceResolverRef.current = { resolve, reject };
    });
  }, []);

  const finishCatalogAssetChoice = useCallback((source: AccountPageTemplate) => {
    const resolver = catalogAssetChoiceResolverRef.current;
    catalogAssetChoiceResolverRef.current = null;
    setCatalogAssetChoice(null);
    setCatalogAssetError(null);
    resolver?.resolve(source);
  }, []);

  const copyCatalogAssets = useCallback(async () => {
    if (!catalogAssetChoice || catalogAssetCopying) return;
    setCatalogAssetCopying(true);
    setCatalogAssetError(null);
    try {
      const payload = await accountApi.fetchJson('/api/account/catalog-assets/copy', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ assetRefs: catalogAssetChoice.assetRefs }),
      });
      const mappings = parseCatalogAssetMappings(payload, catalogAssetChoice.assetRefs);
      finishCatalogAssetChoice(copyCatalogAssetsInPageSource(catalogAssetChoice.source, mappings));
    } catch {
      setCatalogAssetError('Assets could not be copied. Try again or discard them.');
    } finally {
      setCatalogAssetCopying(false);
    }
  }, [accountApi, catalogAssetChoice, catalogAssetCopying, finishCatalogAssetChoice]);

  const discardCatalogAssets = useCallback(() => {
    if (!catalogAssetChoice || catalogAssetCopying) return;
    finishCatalogAssetChoice(discardCatalogAssetsInPageSource(
      catalogAssetChoice.source,
      catalogAssetChoice.assetRefs,
    ));
  }, [catalogAssetChoice, catalogAssetCopying, finishCatalogAssetChoice]);

  const loadSavedPage = useCallback(async (id: string) => {
    setLoading(true);
    setLoadFailed(false);
    setError(null);
    try {
      const detail = parseDetail(await accountApi.fetchJson(`/api/account/pages/${encodeURIComponent(id)}`));
      const loadedPlacements = await Promise.all(detail.source.placements.map(async (coordinate) => {
        try {
          const placement = await loadPagePlacement({ instanceId: coordinate.instanceId, settingsLocales, fetchJson: accountApi.fetchJson });
          return { ...placement, placementId: coordinate.placementId };
        } catch (placementError) {
          if (isNotFoundError(placementError)) return unavailablePlacement(coordinate);
          throw placementError;
        }
      }));
      const overlays = detail.source.isTemplate
        ? {}
        : Object.fromEntries((await Promise.all(settingsLocales.filter((locale) => locale !== baseLocale).map(async (locale) => [locale, await readPageOverlay(accountApi.fetchRaw, id, locale)] as const))).filter((entry): entry is readonly [string, PageLocaleOverlay] => Boolean(entry[1])));
      if (detail.source.isTemplate) {
        const { pageId: ignoredPageId, ...templateSource } = detail.source;
        void ignoredPageId;
        setSourceState(templateSource);
      } else {
        const { pageId: ignoredPageId, ...pageSource } = detail.source;
        void ignoredPageId;
        setSourceState({ ...pageSource, baseLocale });
      }
      setPlacementsState(loadedPlacements);
      setPageOverlaysState(overlays);
      setSavedFiles(detail.files);
      setPublished(detail.serveState?.published ?? false);
      setNeedsUpdate(detail.serveState?.needsUpdate ?? false);
      setFreshEntryBlocked(detail.serveState?.needsUpdate ?? false);
      setSelectedPlacementId(loadedPlacements[0]?.placementId ?? '');
      setActiveLocale(baseLocale);
      setDirty(false);
      setLoadFailed(false);
    } catch {
      setLoadFailed(true);
      setError('This Page could not be loaded. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [accountApi, baseLocale, settingsLocales]);

  const loadTemplateDraft = useCallback(async (draft: PageTemplateDraft) => {
    setLoading(true);
    setLoadFailed(false);
    setError(null);
    try {
      if (typeof pageLimit === 'number') {
        const counts = await readPageCapacityCounts();
        setPageCount(counts.pages);
        setTemplateCount(counts.templates);
        if (counts.pages + counts.templates >= pageLimit) {
          setUpsellReason("You've reached your Page limit.");
          setUpsellOpen(true);
          return;
        }
      }
      const template = draft.kind === 'catalog'
        ? parseCatalogTemplate(await accountApi.fetchJson(`/api/account/page-catalog/${encodeURIComponent(draft.pageId)}`))
        : await accountApi.fetchJson(`/api/account/pages/${encodeURIComponent(draft.pageId)}`).then(parseDetail).then((saved) => {
            if (!saved.source.isTemplate) throw new Error('coreui.errors.payload.invalid');
            return { source: saved.source, files: saved.files };
          });
      const loadedPlacements = await Promise.all(template.source.placements.map(async (coordinate) => {
        try {
          const placement = await loadPagePlacement({ instanceId: coordinate.instanceId, settingsLocales, fetchJson: accountApi.fetchJson });
          return { ...placement, placementId: coordinate.placementId };
        } catch (placementError) {
          if (isNotFoundError(placementError)) return unavailablePlacement(coordinate);
          throw placementError;
        }
      }));
      let preparedSource = template.source;
      if (draft.kind === 'catalog') {
        const assetRefs = collectPageCatalogAssetRefs(preparedSource);
        if (assetRefs.length) {
          preparedSource = await requestCatalogAssetChoice({
            source: preparedSource,
            assetRefs,
          });
        }
      }
      const { pageId: ignoredPageId, catalogPresentation: ignoredPresentation, ...templateSource } = preparedSource;
      void ignoredPageId;
      void ignoredPresentation;
      setSourceState({ ...templateSource, isTemplate: false, baseLocale });
      setPlacementsState(loadedPlacements);
      setPageOverlaysState({});
      setSavedFiles(template.files);
      setPublished(false);
      setNeedsUpdate(false);
      setFreshEntryBlocked(false);
      setSelectedPlacementId(loadedPlacements[0]?.placementId ?? '');
      setActiveLocale(baseLocale);
      setDirty(true);
    } catch {
      setLoadFailed(true);
      setError('This Page template could not be loaded. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [accountApi, baseLocale, pageLimit, readPageCapacityCounts, requestCatalogAssetChoice, settingsLocales]);

  useEffect(() => { if (pageId && canUsePages && canEditPages) void loadSavedPage(pageId); }, [canEditPages, canUsePages, loadSavedPage, pageId]);
  useEffect(() => { if (!pageId && templateDraft && canUsePages && canEditPages) void loadTemplateDraft(templateDraft); }, [canEditPages, canUsePages, loadTemplateDraft, pageId, templateDraft]);
  useEffect(() => {
    if (!canEditPages || accountContext.accountPublicId === 'CLICKEEN') return;
    void readPageCapacityCounts().then((counts) => {
      setPageCount(counts.pages);
      setTemplateCount(counts.templates);
    }).catch(() => {
      setPageCount(null);
      setTemplateCount(null);
    });
  }, [accountContext.accountPublicId, canEditPages, readPageCapacityCounts]);
  useEffect(() => {
    if (!moreOpen) return;
    const close = (event: PointerEvent) => { if (event.target instanceof Node && !moreRef.current?.contains(event.target)) setMoreOpen(false); };
    document.addEventListener('pointerdown', close, true);
    return () => document.removeEventListener('pointerdown', close, true);
  }, [moreOpen]);
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => { if (dirty) { event.preventDefault(); event.returnValue = ''; } };
    const click = (event: MouseEvent) => {
      if (!dirty || bobInstanceId) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest('a[href]') as HTMLAnchorElement | null;
      if (!anchor || anchor.target === '_blank') return;
      event.preventDefault();
      pendingLeaveRef.current = () => window.location.assign(anchor.href);
      setLeaveOpen(true);
    };
    window.addEventListener('beforeunload', beforeUnload);
    document.addEventListener('click', click, true);
    return () => { window.removeEventListener('beforeunload', beforeUnload); document.removeEventListener('click', click, true); };
  }, [bobInstanceId, dirty]);
  useEffect(() => {
    const dialog = updateDialogRef.current;
    if (!dialog) return;
    const lifecycle = createDialogLifecycle({ dialog, initialFocus: () => dialog.querySelector('button'), requestDismiss: () => router.push('/pages') });
    updateLifecycleRef.current = lifecycle;
    return () => lifecycle.destroy();
  }, [loading, router]);
  useEffect(() => {
    if (freshEntryBlocked && needsUpdate && currentPageId && !dirty && !bobInstanceId) updateLifecycleRef.current?.open();
    else updateLifecycleRef.current?.close();
  }, [bobInstanceId, currentPageId, dirty, freshEntryBlocked, needsUpdate]);
  useEffect(() => {
    const dialog = saveTemplateDialogRef.current;
    if (!dialog) return;
    const lifecycle = createDialogLifecycle({ dialog, initialFocus: () => dialog.querySelector('input'), requestDismiss: () => setSaveTemplateOpen(false) });
    if (saveTemplateOpen) lifecycle.open();
    return () => lifecycle.destroy();
  }, [saveTemplateOpen]);
  useEffect(() => {
    const dialog = deleteDialogRef.current;
    if (!dialog) return;
    const lifecycle = createDialogLifecycle({ dialog, initialFocus: () => dialog.querySelector('button'), requestDismiss: () => setDeleteOpen(false) });
    if (deleteOpen) lifecycle.open();
    return () => lifecycle.destroy();
  }, [deleteOpen]);

  const persistOverlays = useCallback(async (id: string) => {
    await Promise.all(Object.entries(pageOverlays).map(([locale, overlay]) => accountApi.fetchJson(`/api/account/pages/${encodeURIComponent(id)}/translations/${encodeURIComponent(locale)}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(overlay) })));
  }, [accountApi, pageOverlays]);

  const save = useCallback(async (forceUpdate = false) => {
    if (!canEditPages) return;
    setNotice(null);
    if (!canUsePages) { setUpsellReason('Pages are available on Tier 2 and above.'); setUpsellOpen(true); return; }
    if (!source.values.title.trim()) { setError('Page title is required.'); setActivePanel('seo'); return; }
    if (placements.some((placement) => placement.unavailable)) { setError('Remove unavailable widgets before saving this Page.'); return; }
    setSaving(true);
    setError(null);
    try {
      const id = currentPageId || createCompactPageId();
      const sourceForSave: PageDraftSource = source.isTemplate ? source : { ...source, baseLocale };
      const generated = await generatePageDraft({
        source: sourceForSave,
        settingsLocales: sourceForSave.isTemplate ? [] : settingsLocales,
        pageOverlays: sourceForSave.isTemplate ? {} : pageOverlays,
        placements,
        fetchJson: accountApi.fetchJson,
      });
      if (!sourceForSave.isTemplate && !generated.overlaysJson) throw new Error('Page overlay output is missing.');
      setSavedFiles(generated.files);
      setPreviewingGenerated(true);
      await nextPaint();
      const completeSource: AccountPageSource = { pageId: id, ...sourceForSave };
      if (currentPageId) {
        if (!sourceForSave.isTemplate) await persistOverlays(id);
        await accountApi.fetchJson(`/api/account/pages/${encodeURIComponent(id)}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ source: completeSource, files: generated.files, ...(generated.overlaysJson ? { overlaysJson: generated.overlaysJson } : {}), operation: forceUpdate || needsUpdate ? 'update' : 'save' }), timeoutMs: 120_000 });
      } else {
        const response = await accountApi.fetchRaw('/api/account/pages', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ source: completeSource, files: generated.files, ...(generated.overlaysJson ? { overlaysJson: generated.overlaysJson } : {}) }) });
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          const kind = payload && typeof payload === 'object' && !Array.isArray(payload)
            ? (payload as { kind?: unknown; error?: { kind?: unknown } }).kind ?? (payload as { error?: { kind?: unknown } }).error?.kind
            : null;
          if (response.status === 402 && kind === 'UPGRADE_REQUIRED') {
            setUpsellReason("You've reached your Page limit.");
            setUpsellOpen(true);
            return false;
          }
          throw new Error('coreui.errors.page.save.failed');
        }
        setCurrentPageId(id);
        setPageCount((count) => count === null ? null : count + 1);
        router.replace(`/page-builder/${encodeURIComponent(id)}`);
      }
      clearRomaPagesCache(accountContext.accountPublicId);
      setSourceState(sourceForSave);
      setNeedsUpdate(false);
      setFreshEntryBlocked(false);
      setDirty(false);
      return true;
    } catch (saveError) {
      setError(saveError instanceof Error && saveError.message === 'Page title is required.'
        ? saveError.message
        : forceUpdate || needsUpdate
          ? "We couldn't update this page. Try again."
          : "We couldn't save this page. Try again.");
      return false;
    } finally {
      setPreviewingGenerated(false);
      setSaving(false);
    }
  }, [accountApi, accountContext.accountPublicId, baseLocale, canEditPages, canUsePages, currentPageId, needsUpdate, pageOverlays, persistOverlays, placements, router, settingsLocales, source]);

  const saveAsTemplate = async () => {
    const name = templateName.trim();
    if (!currentPageId || source.isTemplate || !name || name === source.displayName.trim()) return;
    setTemplateSaving(true);
    setError(null);
    setNotice(null);
    const sourceSaved = await save(false);
    if (!sourceSaved) {
      setTemplateSaving(false);
      return;
    }
    try {
      const payload = await accountApi.fetchJson(`/api/account/pages/${encodeURIComponent(currentPageId)}/save-as-template`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ templateName: name }),
      });
      const record = payload && typeof payload === 'object' && !Array.isArray(payload)
        ? payload as { templateId?: unknown; templateName?: unknown }
        : null;
      const templateId = typeof record?.templateId === 'string' ? record.templateId.trim() : '';
      const savedName = typeof record?.templateName === 'string' ? record.templateName.trim() : '';
      if (!templateId || !savedName) throw new Error('coreui.errors.payload.invalid');
      setCreatedTemplate({ templateId, templateName: savedName });
      setTemplateCount((count) => count === null ? null : count + 1);
    } catch {
      setError('Changes saved. Template was not created.');
    } finally {
      setTemplateSaving(false);
    }
  };

  const addWidget = async (instance: WidgetInstance) => {
    if (placements.some((placement) => placement.instanceId === instance.instanceId)) return;
    const placement = await loadPagePlacement({ instanceId: instance.instanceId, settingsLocales, fetchJson: accountApi.fetchJson });
    setPlacements([...placements, placement]);
    setSelectedPlacementId(placement.placementId);
  };

  const uploadSocialImage = async (file: File): Promise<string> => {
    const payload = await accountApi.fetchJson('/api/account/assets/upload', { method: 'POST', headers: { 'content-type': file.type, 'x-filename': file.name, 'x-source': 'roma-page-social-image' }, body: file });
    const asset = parseAccountAssetRecord(payload);
    if (!asset || !asset.contentType.startsWith('image/')) throw new Error('coreui.errors.assets.uploadFailed');
    return asset.assetRef;
  };

  const resolveSocialImage = useCallback(async (assetRef: string): Promise<string> => {
    const payload = await accountApi.fetchJson('/api/account/assets/resolve', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ assetRefs: [assetRef] }),
    }) as { assets?: unknown };
    if (!Array.isArray(payload.assets) || payload.assets.length !== 1) throw new Error('coreui.errors.assets.payloadInvalid');
    const asset = parseResolvedAccountAsset(payload.assets[0]);
    if (!asset || asset.assetRef !== assetRef || !asset.contentType.startsWith('image/')) throw new Error('coreui.errors.assets.payloadInvalid');
    return asset.url;
  }, [accountApi]);

  const generateTranslations = async () => {
    if (!currentPageId || source.isTemplate) return;
    setTranslationBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = readTranslationResult(await accountApi.fetchJson('/api/account/translations/generate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ target: { kind: 'page', id: currentPageId } }), timeoutMs: 120_000 }));
      if (!result.accepted) {
        setNotice('No translation languages are available for this page.');
        return;
      }
      const overlays = Object.fromEntries((await Promise.all(settingsLocales.filter((locale) => locale !== baseLocale).map(async (locale) => [locale, await readPageOverlay(accountApi.fetchRaw, currentPageId, locale)] as const))).filter((entry): entry is readonly [string, PageLocaleOverlay] => Boolean(entry[1])));
      setPageOverlaysState(overlays);
      if (result.translatedLocales.length) setDirty(true);
      if (result.failedLocales.length) {
        setError(`${result.translatedLocales.length ? 'Translations generated, but failed' : 'Translations failed'} for: ${result.failedLocales.join(', ')}.`);
      } else {
        setNotice('Translations generated. Save the Page to update its files.');
      }
    } catch {
      setError('Translations could not be generated. Please try again.');
    } finally {
      setTranslationBusy(false);
    }
  };

  const changePublished = async (next: boolean) => {
    if (!canEditPages || !currentPageId || source.isTemplate) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const response = await accountApi.fetchRaw(`/api/account/pages/${encodeURIComponent(currentPageId)}/${next ? 'publish' : 'unpublish'}`, { method: 'POST' });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        const missingLocales = next ? readMissingPublishLocales(payload) : [];
        if (missingLocales.length) throw new Error(`Generate translations for: ${missingLocales.join(', ')} before publishing.`);
        throw new Error(`${next ? 'Publishing' : 'Unpublishing'} this Page failed. Please try again.`);
      }
      clearRomaPagesCache(accountContext.accountPublicId);
      setPublished(next);
    } catch (publishError) {
      setError(publishError instanceof Error ? publishError.message : `${next ? 'Publishing' : 'Unpublishing'} this Page failed. Please try again.`);
    } finally { setSaving(false); }
  };

  const useCurrentTemplate = () => {
    if (!currentPageId || !source.isTemplate) return;
    const openDraft = () => router.push(`/page-builder/new?template=${encodeURIComponent(currentPageId)}`);
    if (dirty) {
      pendingLeaveRef.current = openDraft;
      setLeaveOpen(true);
      return;
    }
    openDraft();
  };

  if (!canUsePages) {
    return <><section className="roma-page-upgrade"><h1 className="heading-2">Pages</h1><p className="body-m">Upgrade to create, edit and publish Pages.</p><button className="diet-btn-txt" data-size="md" data-variant="primary" type="button" onClick={() => { setUpsellReason('Pages are available on Tier 2 and above.'); setUpsellOpen(true); }}><span className="diet-btn-txt__label body-m">Upgrade</span></button></section><RomaUpsellDialog open={upsellOpen} reason={upsellReason} onClose={() => setUpsellOpen(false)} /></>;
  }

  if (!canEditPages) {
    return <section className="roma-page-upgrade"><h1 className="heading-2">Pages</h1><p className="body-m">You need editor access to create or edit Pages.</p></section>;
  }

  if (loading) return <><section className="roma-account-loading" aria-label="Loading Page"><span /><span /><span /></section><CatalogAssetChoiceDialog open={Boolean(catalogAssetChoice)} product="page" copying={catalogAssetCopying} error={catalogAssetError} onCopy={() => void copyCatalogAssets()} onDiscard={discardCatalogAssets} /></>;

  if (pageId && loadFailed) {
    return <section className="roma-page-upgrade" role="alert"><h1 className="heading-2">Page could not be loaded</h1><p className="body-m">Please retry before editing this Page.</p><div className="roma-page-panel__actions"><button className="diet-btn-txt" data-size="md" data-variant="primary" type="button" onClick={() => void loadSavedPage(pageId)}><span className="diet-btn-txt__label body-m">Retry</span></button><button className="diet-btn-txt" data-size="md" data-variant="secondary" type="button" onClick={() => router.push('/pages')}><span className="diet-btn-txt__label body-m">Back to pages</span></button></div></section>;
  }

  return (
    <>
      <div className="builder-app roma-page-builder">
        <section className="topdrawer">
          <div className="topdrawer-leading"><button className="host-navigation-open diet-btn-ic" data-size="xl" data-variant="neutral" type="button" aria-label="Open Clickeen navigation" onClick={() => openNavigation()}><span className="diet-btn-ic__icon" data-icon="rectangle.portrait.and.arrow.right" /></button></div>
          <div className="topdrawer-context-wrap"><div className="topdrawer-context"><input className="roma-page-name heading-3" value={source.displayName} aria-label="Page name" onChange={(event) => setSource({ ...source, displayName: event.target.value })} /><span className="body-xs topdrawer-publish-status">{source.isTemplate ? 'Template' : needsUpdate ? 'Needs update' : currentPageId ? 'Current' : 'Unsaved'}</span></div></div>
          <div className="topdrawer-actions">
            {(dirty || !currentPageId || needsUpdate) ? <button className="diet-btn-txt" data-size="xl" data-variant="primary" type="button" disabled={saving} onClick={() => void save(needsUpdate)}><span className="diet-btn-txt__label">{saving ? 'Saving…' : needsUpdate ? 'Update page' : 'Save'}</span></button> : null}
            {canSaveAsTemplate ? <button className="diet-btn-txt" data-size="lg" data-variant="secondary" type="button" disabled={saving || templateSaving} onClick={() => { setTemplateName(''); setCreatedTemplate(null); setSaveTemplateOpen(true); }}><span className="diet-btn-txt__label body-s">Save as template</span></button> : null}
            {currentPageId && source.isTemplate ? <button className="diet-btn-txt" data-size="lg" data-variant="secondary" type="button" onClick={useCurrentTemplate}><span className="diet-btn-txt__label body-s">Use template</span></button> : null}
            {currentPageId && !source.isTemplate && !needsUpdate && !published ? <button className="diet-btn-txt" data-size="lg" data-variant="secondary" type="button" disabled={saving || dirty} onClick={() => void changePublished(true)}><span className="diet-btn-txt__label body-s">Publish</span></button> : null}
            {publicActions ? <a className="diet-btn-txt" data-size="lg" data-variant="line2" href={publicActions.publicUrl} target="_blank" rel="noreferrer"><span className="diet-btn-txt__label body-s">Open public page</span></a> : null}
            {currentPageId ? <div ref={moreRef} className="topdrawer-more diet-popover-host" data-state={moreOpen ? 'open' : 'closed'}><button className="diet-btn-txt" data-size="lg" data-variant="line2" type="button" onClick={() => setMoreOpen((open) => !open)}><span className="diet-btn-txt__label body-s">More</span></button><div className="topdrawer-more__menu diet-popover" role="menu">{published && publicActions ? <><button className="diet-btn-menuactions" data-size="md" data-variant="neutral" type="button" role="menuitem" onClick={() => { setMoreOpen(false); void copyToClipboard(publicActions.publicUrl).then((copied) => setNotice(copied ? 'Page URL copied.' : 'Page URL could not be copied.')); }}><span className="diet-btn-menuactions__label body-s">Copy URL</span></button><button className="diet-btn-menuactions" data-size="md" data-variant="neutral" type="button" role="menuitem" onClick={() => { setMoreOpen(false); setCopyOpen(true); }}><span className="diet-btn-menuactions__label body-s">Copy code</span></button><button className="diet-btn-menuactions" data-size="md" data-variant="neutral" type="button" role="menuitem" onClick={() => { setMoreOpen(false); void changePublished(false); }}><span className="diet-btn-menuactions__label body-s">Unpublish</span></button></> : <button className="diet-btn-menuactions" data-size="md" data-variant="neutral" type="button" role="menuitem" onClick={() => { setMoreOpen(false); setDeleteOpen(true); }}><span className="diet-btn-menuactions__label body-s">Delete</span></button>}</div></div> : null}
          </div>
        </section>
        {error ? <div className="roma-page-builder__error body-s" role="alert">{error}</div> : null}
        {notice ? <div className="roma-page-builder__notice body-s" role="status">{notice}</div> : null}
        <div className="editor-content">
          <aside className="tooldrawer" id="page-builder-tool-drawer">
            <div className="roma-page-panel-tabs" role="tablist"><button className="diet-btn-txt" data-size="sm" data-variant={activePanel === 'content' ? 'primary' : 'neutral'} type="button" role="tab" aria-selected={activePanel === 'content'} onClick={() => setActivePanel('content')}><span className="diet-btn-txt__label body-s">Content</span></button><button className="diet-btn-txt" data-size="sm" data-variant={activePanel === 'seo' ? 'primary' : 'neutral'} type="button" role="tab" aria-selected={activePanel === 'seo'} onClick={() => setActivePanel('seo')}><span className="diet-btn-txt__label body-s">SEO/GEO/AEO</span></button></div>
            <div className="roma-page-tooldrawer-body">{activePanel === 'content' ? <PageBuilderContent placements={placements} selectedPlacementId={selectedPlacementId} addOpen={widgetPickerOpen} onAddOpenChange={setWidgetPickerOpen} onSelect={setSelectedPlacementId} onAdd={addWidget} onChange={setPlacements} onEdit={setBobInstanceId} /> : <PageBuilderSeo source={source} onSourceChange={setSource} locales={source.isTemplate ? [] : currentPageId ? settingsLocales : [baseLocale]} activeLocale={activeLocale} onActiveLocaleChange={setActiveLocale} overlays={pageOverlays} onOverlaysChange={setPageOverlays} canTranslate={Boolean(currentPageId && !source.isTemplate)} translating={translationBusy} onGenerateTranslations={generateTranslations} onUploadSocialImage={uploadSocialImage} onResolveSocialImage={resolveSocialImage} onAssetUpsell={() => { setUpsellReason('This upload is not available on your current plan.'); setUpsellOpen(true); }} />}</div>
          </aside>
          <PageWorkspace placements={placements} selectedPlacementId={selectedPlacementId} savedFiles={savedFiles} showSaved={Boolean(previewingGenerated || (currentPageId && !dirty && !needsUpdate))} onSelect={setSelectedPlacementId} onAdd={() => setWidgetPickerOpen(true)} />
        </div>
      </div>

      {bobInstanceId ? <div className="roma-page-bob-slide" role="dialog" aria-label="Edit widget in Bob"><BuilderDomain initialInstanceId={bobInstanceId} embedded returnLabel="Done, go back to the page" contextMessage="You're editing the saved widget. Other pages using it will also need updating." onReturn={() => setBobInstanceId('')} onInstanceSaved={() => { void Promise.all([loadPagePlacement({ instanceId: bobInstanceId, settingsLocales, fetchJson: accountApi.fetchJson }), currentPageId ? accountApi.fetchJson(`/api/account/pages/${encodeURIComponent(currentPageId)}`).then(parseDetail) : Promise.resolve(null)]).then(([updated, detail]) => { setPlacementsState((current) => current.map((placement) => placement.instanceId === bobInstanceId ? { ...updated, placementId: placement.placementId } : placement)); if (detail?.serveState) setNeedsUpdate(detail.serveState.needsUpdate); }).catch(() => setError('This widget was saved, but the Page status could not be refreshed.')); }} /></div> : null}
      <dialog ref={saveTemplateDialogRef} className="diet-popup" data-size="medium" aria-labelledby="page-save-template-title"><header className="diet-popup__header"><h2 id="page-save-template-title" className="heading-4">Save as template</h2></header><div className="diet-popup__body">{createdTemplate ? <p className="body-m">{createdTemplate.templateName} was saved as a template.</p> : <><DieterTextfield label="Template name" value={templateName} maxLength={120} onChange={(event) => setTemplateName(event.target.value)} /><p className="body-s">Your current changes will be saved first.</p></>}</div><footer className="diet-popup__footer"><div className="diet-popup__actions">{createdTemplate ? <><button className="diet-btn-txt" data-size="md" data-variant="secondary" type="button" onClick={() => setSaveTemplateOpen(false)}><span className="diet-btn-txt__label body-m">Stay here</span></button><button className="diet-btn-txt" data-size="md" data-variant="primary" type="button" onClick={() => router.push(`/page-builder/${encodeURIComponent(createdTemplate.templateId)}`)}><span className="diet-btn-txt__label body-m">Open template</span></button></> : <><button className="diet-btn-txt" data-size="md" data-variant="secondary" type="button" disabled={templateSaving} onClick={() => setSaveTemplateOpen(false)}><span className="diet-btn-txt__label body-m">Cancel</span></button><button className="diet-btn-txt" data-size="md" data-variant="primary" type="button" disabled={templateSaving || !templateName.trim() || templateName.trim() === source.displayName.trim()} onClick={() => void saveAsTemplate()}><span className="diet-btn-txt__label body-m">{templateSaving ? 'Saving…' : 'Save as template'}</span></button></>}</div></footer></dialog>
      <dialog ref={updateDialogRef} className="diet-popup" data-size="medium" aria-labelledby="page-needs-update-title"><header className="diet-popup__header"><h2 id="page-needs-update-title" className="heading-4">Update this page to edit</h2></header><div className="diet-popup__body"><p className="body-m">One or more widgets in this page has changed. Update the page to edit.</p></div><footer className="diet-popup__footer"><div className="diet-popup__actions"><button className="diet-btn-txt" data-size="md" data-variant="secondary" type="button" onClick={() => router.push('/pages')}><span className="diet-btn-txt__label body-m">Back to pages</span></button><button className="diet-btn-txt" data-size="md" data-variant="primary" type="button" disabled={saving} onClick={() => void save(true)}><span className="diet-btn-txt__label body-m">{saving ? 'Updating…' : 'Update page'}</span></button></div></footer></dialog>
      <dialog ref={deleteDialogRef} className="diet-popup" data-size="medium" aria-label="Delete page"><header className="diet-popup__header"><h2 className="heading-4">Delete page?</h2></header><div className="diet-popup__body"><p className="body-m">This permanently deletes the saved Page.</p></div><footer className="diet-popup__footer"><div className="diet-popup__actions"><button className="diet-btn-txt" data-size="md" data-variant="secondary" type="button" onClick={() => setDeleteOpen(false)}><span className="diet-btn-txt__label body-m">Cancel</span></button><button className="diet-btn-txt" data-size="md" data-variant="primary" type="button" disabled={saving} onClick={() => { if (!currentPageId) return; setSaving(true); void accountApi.fetchJson(`/api/account/pages/${encodeURIComponent(currentPageId)}`, { method: 'DELETE' }).then(() => { clearRomaPagesCache(accountContext.accountPublicId); router.push('/pages'); }).catch(() => { setError('Deleting this Page failed. Please try again.'); setDeleteOpen(false); }).finally(() => setSaving(false)); }}><span className="diet-btn-txt__label body-m">Delete</span></button></div></footer></dialog>
      <PublicCodeDialog open={copyOpen} productName={source.displayName} actions={publicActions} onClose={() => setCopyOpen(false)} />
      <RomaUnsavedChangesDialog open={leaveOpen} message="This Page has unsaved changes." onKeepEditing={() => { pendingLeaveRef.current = null; setLeaveOpen(false); }} onDiscard={() => { const leave = pendingLeaveRef.current; pendingLeaveRef.current = null; setDirty(false); setLeaveOpen(false); leave?.(); }} />
      <RomaUpsellDialog open={upsellOpen} reason={upsellReason} onClose={() => setUpsellOpen(false)} />
      <CatalogAssetChoiceDialog open={Boolean(catalogAssetChoice)} product="page" copying={catalogAssetCopying} error={catalogAssetError} onCopy={() => void copyCatalogAssets()} onDiscard={discardCatalogAssets} />
    </>
  );
}
