'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { normalizeCanonicalLocalesFile, normalizeLocaleToken, resolveLocaleLabel } from '@clickeen/l10n';
import localesJson from '@clickeen/l10n/locales.json';
import { resolveAccountShellErrorCopy } from '../lib/account-shell-copy';
import { useRomaAccountApi } from './account-api';
import { useRomaAccountContext } from './roma-account-context';
import {
  buildBuilderRoute,
  DEFAULT_INSTANCE_DISPLAY_NAME,
  loadRomaWidgetsForAccount,
  readRomaWidgetsCache,
  type RomaWidgetsResponse,
  type WidgetInstance,
} from './use-roma-widgets';
import {
  buildPagesRoute,
  loadRomaPagesForAccount,
  normalizeRomaPageOpenResponse,
  readRomaPagesCache,
  writeRomaPagesCache,
  type AccountPageSource,
  type AccountPageSummary,
  type PagePublishStatus,
  type PageRobots,
  type RomaPagesResponse,
} from './use-roma-pages';

const CANONICAL_LOCALES = normalizeCanonicalLocalesFile(localesJson);

function resolveLocaleUiLabel(code: string): string {
  const normalized = normalizeLocaleToken(code) ?? code;
  const label = resolveLocaleLabel({
    locales: CANONICAL_LOCALES,
    uiLocale: 'en',
    targetLocale: normalized,
  });
  return `${label} (${normalized})`;
}

function reorderPlacement<T>(placements: T[], index: number, direction: -1 | 1): T[] {
  const nextIndex = index + direction;
  if (nextIndex < 0 || nextIndex >= placements.length) return placements;
  const next = placements.slice();
  const [placement] = next.splice(index, 1);
  next.splice(nextIndex, 0, placement);
  return next;
}

function updatePageSummaryInCache(accountId: string, summary: AccountPageSummary) {
  const current = readRomaPagesCache(accountId);
  if (!current) return;
  writeRomaPagesCache({
    ...current.data,
    pages: [
      summary,
      ...current.data.pages.filter((page) => page.pageId !== summary.pageId),
    ].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt) || left.pageId.localeCompare(right.pageId)),
  });
}

function createPlacementId(existingCount: number): string {
  return `P${String(existingCount + 1).padStart(3, '0')}`;
}

function pageSavePayload(source: AccountPageSource) {
  return {
    source,
  };
}

function resolveClkLiveBaseUrl(): string {
  return String(process.env.NEXT_PUBLIC_CLK_LIVE_URL || process.env.PUBLIC_CLK_LIVE_URL || 'https://clk.live').replace(/\/+$/, '');
}

function buildPagePublicUrl(accountPublicId: string, pageId: string): string {
  return `${resolveClkLiveBaseUrl()}/${encodeURIComponent(accountPublicId)}/pages/${encodeURIComponent(pageId)}`;
}

function buildPageIframeSnippet(publicUrl: string): string {
  return `<iframe
  src="${publicUrl}"
  title="Clickeen page"
  loading="lazy"
  referrerpolicy="no-referrer"
  sandbox="allow-scripts allow-same-origin allow-forms"
  style="width:100%;border:0;min-height:720px;"
></iframe>`;
}

async function copyToClipboard(text: string): Promise<boolean> {
  if (!text) return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {}

  try {
    const el = document.createElement('textarea');
    el.value = text;
    el.setAttribute('readonly', 'true');
    el.style.position = 'fixed';
    el.style.top = '-1000px';
    el.style.left = '-1000px';
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(el);
    return ok;
  } catch {
    return false;
  }
}

export function PagesDomain() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { accountContext } = useRomaAccountContext();
  const accountApi = useRomaAccountApi();
  const productAccountId = accountContext.accountPublicId;
  const cachedPages = readRomaPagesCache(productAccountId);
  const cachedWidgets = readRomaWidgetsCache(productAccountId);

  const [pages, setPages] = useState<AccountPageSummary[]>(() => cachedPages?.data.pages ?? []);
  const [pageSource, setPageSource] = useState<AccountPageSource | null>(null);
  const [pagePublishStatus, setPagePublishStatus] = useState<PagePublishStatus>('unpublished');
  const [widgetInstances, setWidgetInstances] = useState<WidgetInstance[]>(() => cachedWidgets?.data.instances ?? []);
  const [accountLocaleOptions, setAccountLocaleOptions] = useState<string[]>(['en']);
  const [addInstancesOpen, setAddInstancesOpen] = useState(false);
  const [checkedInstanceIds, setCheckedInstanceIds] = useState<string[]>([]);
  const [pickerVisibleLimit, setPickerVisibleLimit] = useState(50);
  const [domainLoading, setDomainLoading] = useState(() => !cachedPages);
  const [domainRefreshing, setDomainRefreshing] = useState(false);
  const [sourceLoading, setSourceLoading] = useState(false);
  const [activeActionKey, setActiveActionKey] = useState<string | null>(null);
  const [dataError, setDataError] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);

  const selectedPageId = useMemo(() => (searchParams.get('page') || '').trim(), [searchParams]);
  const activePageId = selectedPageId || pages[0]?.pageId || '';
  const hostedPageUrl = pageSource ? buildPagePublicUrl(productAccountId, pageSource.pageId) : '';
  const pageIframeSnippet = hostedPageUrl ? buildPageIframeSnippet(hostedPageUrl) : '';

  const applyPages = useCallback((payload: RomaPagesResponse) => {
    setPages(payload.pages);
  }, []);

  const applyWidgets = useCallback((widgets: RomaWidgetsResponse) => {
    setWidgetInstances(widgets.instances);
  }, []);

  const refreshPages = useCallback(async (args?: { force?: boolean }) => {
    const force = args?.force === true;
    const cached = readRomaPagesCache(productAccountId);
    if (!force && cached) {
      applyPages(cached.data);
      setDomainLoading(false);
      setDataError(null);
    } else {
      setDomainLoading(true);
    }
    setDomainRefreshing(true);
    try {
      const payload = await loadRomaPagesForAccount({
        accountId: productAccountId,
        fetchJson: accountApi.fetchJson,
        force,
      });
      applyPages(payload);
      setDataError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setDataError(resolveAccountShellErrorCopy(message, 'Failed to load pages. Please try again.'));
    } finally {
      setDomainLoading(false);
      setDomainRefreshing(false);
    }
  }, [accountApi.fetchJson, applyPages, productAccountId]);

  const refreshWidgets = useCallback(async (args?: { force?: boolean }) => {
    try {
      const widgets = await loadRomaWidgetsForAccount({
        accountId: productAccountId,
        fetchJson: accountApi.fetchJson,
        force: args?.force,
      });
      applyWidgets(widgets);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setDataError(resolveAccountShellErrorCopy(message, 'Failed to load widgets. Please try again.'));
    }
  }, [accountApi.fetchJson, applyWidgets, productAccountId]);

  const refreshAccountLocales = useCallback(async () => {
    try {
      const payload = await accountApi.fetchJson<{
        selectedTargetLocales?: unknown;
        localePolicy?: { baseLocale?: unknown } | null;
      }>('/api/account/locales', { method: 'GET' });
      const baseLocale = normalizeLocaleToken(payload.localePolicy?.baseLocale) ?? 'en';
      const selectedTargetLocales = Array.isArray(payload.selectedTargetLocales)
        ? payload.selectedTargetLocales
            .map((entry) => normalizeLocaleToken(entry))
            .filter((entry): entry is string => Boolean(entry))
        : [];
      setAccountLocaleOptions(Array.from(new Set([baseLocale, ...selectedTargetLocales])));
    } catch {
      setAccountLocaleOptions(['en']);
    }
  }, [accountApi]);

  const loadPageSource = useCallback(async (pageId: string) => {
    if (!pageId) {
      setPageSource(null);
      setPagePublishStatus('unpublished');
      return;
    }
    setSourceLoading(true);
    setMutationError(null);
    try {
      const payload = await accountApi.fetchJson<unknown>(`/api/account/pages/${encodeURIComponent(pageId)}`, {
        method: 'GET',
      });
      const opened = normalizeRomaPageOpenResponse(payload);
      if (!opened) throw new Error('coreui.errors.payload.invalid');
      setPageSource(opened.source);
      setPagePublishStatus(opened.publishStatus);
      setCheckedInstanceIds([]);
      setAddInstancesOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setMutationError(resolveAccountShellErrorCopy(message, 'Failed to open this page. Please try again.'));
      setPageSource(null);
      setPagePublishStatus('unpublished');
    } finally {
      setSourceLoading(false);
    }
  }, [accountApi]);

  useEffect(() => {
    const cached = readRomaPagesCache(productAccountId);
    if (cached) {
      applyPages(cached.data);
      setDomainLoading(false);
    } else {
      setPages([]);
      setDomainLoading(true);
    }
    void refreshPages();
    void refreshWidgets();
    void refreshAccountLocales();
  }, [applyPages, productAccountId, refreshAccountLocales, refreshPages, refreshWidgets]);

  useEffect(() => {
    if (!activePageId) {
      setPageSource(null);
      setPagePublishStatus('unpublished');
      return;
    }
    if (pageSource?.pageId === activePageId) return;
    void loadPageSource(activePageId);
  }, [activePageId, loadPageSource, pageSource?.pageId]);

  const instanceById = useMemo(() => {
    const map = new Map<string, WidgetInstance>();
    widgetInstances.forEach((instance) => map.set(instance.instanceId, instance));
    return map;
  }, [widgetInstances]);

  const placedInstanceIds = useMemo(() => {
    const ids = new Set<string>();
    pageSource?.placements.forEach((placement) => ids.add(placement.instanceId));
    return ids;
  }, [pageSource?.placements]);

  const visiblePickerInstances = useMemo(
    () => widgetInstances.slice(0, pickerVisibleLimit),
    [pickerVisibleLimit, widgetInstances],
  );

  const publishBlockers = useMemo(() => {
    if (!pageSource) return [];
    return Array.from(
      new Set(
        pageSource.placements.flatMap((placement) => {
          const instance = instanceById.get(placement.instanceId);
          if (!instance) return [placement.instanceId];
          return instance.status === 'published' ? [] : [placement.instanceId];
        }),
      ),
    );
  }, [instanceById, pageSource]);

  const ipLocalizationBlocksPublish = pageSource?.localization.ipLocalizationEnabled === true;
  const canPublishPage = Boolean(
    pageSource &&
    pageSource.placements.length > 0 &&
    publishBlockers.length === 0 &&
    !ipLocalizationBlocksPublish,
  );
  const pageLocaleOptions = useMemo(() => {
    return Array.from(new Set([
      ...accountLocaleOptions,
      ...(pageSource ? [
        pageSource.localization.defaultLocale,
        ...pageSource.localization.countryLocaleRules.map((rule) => rule.locale),
      ] : []),
    ].map((locale) => normalizeLocaleToken(locale)).filter((locale): locale is string => Boolean(locale))));
  }, [accountLocaleOptions, pageSource]);

  const saveSource = useCallback(async (source: AccountPageSource, actionKey: string) => {
    setActiveActionKey(actionKey);
    setMutationError(null);
    try {
      const payload = await accountApi.fetchJson<{
        source?: AccountPageSource;
        summary?: AccountPageSummary;
      }>(`/api/account/pages/${encodeURIComponent(source.pageId)}`, {
        method: 'PUT',
        headers: accountApi.buildHeaders({ contentType: 'application/json' }),
        body: JSON.stringify(pageSavePayload(source)),
      });
      if (!payload.source || !payload.summary) throw new Error('coreui.errors.payload.invalid');
      setPageSource(payload.source);
      updatePageSummaryInCache(productAccountId, payload.summary);
      await refreshPages({ force: true });
      return payload.source;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setMutationError(resolveAccountShellErrorCopy(message, 'Saving the page failed. Please try again.'));
      return null;
    } finally {
      setActiveActionKey((current) => (current === actionKey ? null : current));
    }
  }, [accountApi, productAccountId, refreshPages]);

  const handleCreatePage = useCallback(async () => {
    const actionKey = 'create-page';
    setActiveActionKey(actionKey);
    setMutationError(null);
    try {
      const payload = await accountApi.fetchJson<{
        pageId?: string;
        source?: AccountPageSource;
      }>('/api/account/pages', {
        method: 'POST',
        headers: accountApi.buildHeaders({ contentType: 'application/json' }),
        body: JSON.stringify({
          metadata: {
            title: 'Untitled page',
            description: '',
            robots: 'index,follow',
          },
          displayName: 'Untitled page',
        }),
      });
      const pageId = typeof payload.pageId === 'string' ? payload.pageId.trim() : '';
      if (!pageId || !payload.source) throw new Error('coreui.errors.payload.invalid');
      await refreshPages({ force: true });
      setPageSource(payload.source);
      setPagePublishStatus('unpublished');
      router.push(buildPagesRoute(pageId));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setMutationError(resolveAccountShellErrorCopy(message, 'Creating the page failed. Please try again.'));
    } finally {
      setActiveActionKey((current) => (current === actionKey ? null : current));
    }
  }, [accountApi, refreshPages, router]);

  const handleDeletePage = useCallback(async (pageId: string) => {
    const actionKey = `delete-page:${pageId}`;
    setActiveActionKey(actionKey);
    setMutationError(null);
    try {
      await accountApi.fetchJson(`/api/account/pages/${encodeURIComponent(pageId)}`, { method: 'DELETE' });
      await refreshPages({ force: true });
      if (pageSource?.pageId === pageId) {
        setPageSource(null);
        setPagePublishStatus('unpublished');
        router.push('/pages');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setMutationError(resolveAccountShellErrorCopy(message, 'Deleting the page failed. Please try again.'));
    } finally {
      setActiveActionKey((current) => (current === actionKey ? null : current));
    }
  }, [accountApi, pageSource?.pageId, refreshPages, router]);

  const updateMetadata = useCallback((patch: Partial<AccountPageSource['metadata']>) => {
    setPageSource((current) => current ? { ...current, metadata: { ...current.metadata, ...patch } } : current);
  }, []);

  const updateLocalization = useCallback((patch: Partial<AccountPageSource['localization']>) => {
    setPageSource((current) => current ? {
      ...current,
      localization: {
        ...current.localization,
        ...patch,
        ipLocalizationEnabled: false,
        countryLocaleRules: current.localization.countryLocaleRules,
        missingLocaleBehavior: 'block_publish',
      },
    } : current);
  }, []);

  const updateCountryLocaleRule = useCallback((index: number, patch: Partial<{ country: string; locale: string }>) => {
    setPageSource((current) => {
      if (!current) return current;
      const countryLocaleRules = current.localization.countryLocaleRules.map((rule, ruleIndex) => {
        if (ruleIndex !== index) return rule;
        return {
          country: typeof patch.country === 'string' ? patch.country.trim().toUpperCase().slice(0, 2) : rule.country,
          locale: typeof patch.locale === 'string' ? normalizeLocaleToken(patch.locale) ?? rule.locale : rule.locale,
        };
      });
      return {
        ...current,
        localization: {
          ...current.localization,
          ipLocalizationEnabled: false,
          countryLocaleRules,
          missingLocaleBehavior: 'block_publish',
        },
      };
    });
  }, []);

  const addCountryLocaleRule = useCallback(() => {
    setPageSource((current) => current ? {
      ...current,
      localization: {
        ...current.localization,
        ipLocalizationEnabled: false,
        countryLocaleRules: [
          ...current.localization.countryLocaleRules,
          { country: 'US', locale: current.localization.defaultLocale },
        ],
        missingLocaleBehavior: 'block_publish',
      },
    } : current);
  }, []);

  const removeCountryLocaleRule = useCallback((index: number) => {
    setPageSource((current) => current ? {
      ...current,
      localization: {
        ...current.localization,
        ipLocalizationEnabled: false,
        countryLocaleRules: current.localization.countryLocaleRules.filter((_, ruleIndex) => ruleIndex !== index),
        missingLocaleBehavior: 'block_publish',
      },
    } : current);
  }, []);

  const handleSaveMetadata = useCallback(async () => {
    if (!pageSource) return;
    await saveSource(pageSource, `save-metadata:${pageSource.pageId}`);
  }, [pageSource, saveSource]);

  const handleSavePageSettings = useCallback(async () => {
    if (!pageSource) return;
    await saveSource({
      ...pageSource,
      localization: {
        ...pageSource.localization,
        ipLocalizationEnabled: false,
        countryLocaleRules: pageSource.localization.countryLocaleRules,
        missingLocaleBehavior: 'block_publish',
      },
    }, `save-settings:${pageSource.pageId}`);
  }, [pageSource, saveSource]);

  const handlePagePublishState = useCallback(async (nextStatus: PagePublishStatus) => {
    if (!pageSource) return;
    const action = nextStatus === 'published' ? 'publish' : 'unpublish';
    const actionKey = `${action}-page:${pageSource.pageId}`;
    setActiveActionKey(actionKey);
    setMutationError(null);
    try {
      const payload = await accountApi.fetchJson<{ publishStatus?: PagePublishStatus }>(
        `/api/account/pages/${encodeURIComponent(pageSource.pageId)}/${action}`,
        { method: 'POST' },
      );
      if (payload.publishStatus !== 'published' && payload.publishStatus !== 'unpublished') {
        throw new Error('coreui.errors.payload.invalid');
      }
      setPagePublishStatus(payload.publishStatus);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setMutationError(resolveAccountShellErrorCopy(message, nextStatus === 'published' ? 'Publishing the page failed. Please try again.' : 'Unpublishing the page failed. Please try again.'));
    } finally {
      setActiveActionKey((current) => (current === actionKey ? null : current));
    }
  }, [accountApi, pageSource]);

  const handleCopyPageArtifact = useCallback(async (label: string, value: string) => {
    setCopyStatus(null);
    const ok = await copyToClipboard(value);
    setCopyStatus(ok ? `Copied: ${label}` : `Copy failed: ${label}`);
    window.setTimeout(() => setCopyStatus(null), 1800);
  }, []);

  const openAddInstances = useCallback(() => {
    setCheckedInstanceIds([]);
    setPickerVisibleLimit(50);
    setAddInstancesOpen(true);
  }, []);

  const toggleCheckedInstance = useCallback((instanceId: string) => {
    setCheckedInstanceIds((current) => (
      current.includes(instanceId)
        ? current.filter((id) => id !== instanceId)
        : [...current, instanceId]
    ));
  }, []);

  const handleAddSelectedInstances = useCallback(async () => {
    if (!pageSource || checkedInstanceIds.length === 0) return;
    const checked = new Set(checkedInstanceIds);
    const instancesToAdd = widgetInstances.filter(
      (instance) => checked.has(instance.instanceId) && !placedInstanceIds.has(instance.instanceId),
    );
    if (instancesToAdd.length === 0) {
      setCheckedInstanceIds([]);
      return;
    }
    const nextSource: AccountPageSource = {
      ...pageSource,
      placements: [
        ...pageSource.placements,
        ...instancesToAdd.map((instance, index) => ({
          placementId: createPlacementId(pageSource.placements.length + index),
          instanceId: instance.instanceId,
        })),
      ],
    };
    const saved = await saveSource(nextSource, `bulk-place:${pageSource.pageId}`);
    if (saved) {
      setCheckedInstanceIds([]);
      setAddInstancesOpen(false);
    }
  }, [checkedInstanceIds, pageSource, placedInstanceIds, saveSource, widgetInstances]);

  const handleMovePlacement = useCallback(async (index: number, direction: -1 | 1) => {
    if (!pageSource) return;
    await saveSource({
      ...pageSource,
      placements: reorderPlacement(pageSource.placements, index, direction),
    }, `move:${index}:${direction}`);
  }, [pageSource, saveSource]);

  const handleRemovePlacement = useCallback(async (index: number) => {
    if (!pageSource) return;
    await saveSource({
      ...pageSource,
      placements: pageSource.placements.filter((_, placementIndex) => placementIndex !== index),
    }, `remove:${index}`);
  }, [pageSource, saveSource]);

  return (
    <>
      <section className="rd-canvas-module">
        <div className="roma-toolbar">
          <h2 className="heading-4">Pages</h2>
          <p className="body-m roma-toolbar-count">
            {pages.length} {pages.length === 1 ? 'page' : 'pages'}
          </p>
          {domainRefreshing ? <p className="body-m roma-toolbar-count">Refreshing...</p> : null}
        </div>
        <div className="rd-canvas-module__actions">
          <button
            className="diet-btn-txt"
            data-size="md"
            data-variant="primary"
            type="button"
            onClick={() => void handleCreatePage()}
            disabled={Boolean(activeActionKey)}
          >
            <span className="diet-btn-txt__label body-m">{activeActionKey === 'create-page' ? 'Creating...' : 'Create page'}</span>
          </button>
          <button
            className="diet-btn-txt"
            data-size="md"
            data-variant="line2"
            type="button"
            onClick={() => void refreshPages({ force: true })}
            disabled={domainLoading || domainRefreshing}
          >
            <span className="diet-btn-txt__label body-m">Refresh</span>
          </button>
        </div>
        {dataError ? <p className="body-m">{dataError}</p> : null}
        {mutationError ? <p className="body-m">{mutationError}</p> : null}
        {domainLoading && pages.length === 0 ? <p className="body-m">Loading pages...</p> : null}
        {!domainLoading && pages.length === 0 ? <p className="body-m">No pages yet.</p> : null}
        {pages.length ? (
          <table className="roma-table">
            <thead>
              <tr>
                <th className="table-header label-s">Page</th>
                <th className="table-header label-s">Page ID</th>
                <th className="table-header label-s">Placements</th>
                <th className="table-header label-s">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pages.map((page) => {
                const isActive = page.pageId === activePageId;
                const deleteActionKey = `delete-page:${page.pageId}`;
                return (
                  <tr key={page.pageId} data-selected={isActive ? 'true' : undefined}>
                    <td className="body-s">{page.title}</td>
                    <td className="body-s">{page.pageId}</td>
                    <td className="body-s">{page.placementCount}</td>
                    <td className="roma-cell-actions">
                      <Link className="diet-btn-txt" data-size="md" data-variant={isActive ? 'primary' : 'line2'} href={buildPagesRoute(page.pageId)}>
                        <span className="diet-btn-txt__label body-m">{isActive ? 'Open' : 'Select'}</span>
                      </Link>
                      <button
                        className="diet-btn-txt"
                        data-size="md"
                        data-variant="line2"
                        type="button"
                        onClick={() => void handleDeletePage(page.pageId)}
                        disabled={Boolean(activeActionKey)}
                      >
                        <span className="diet-btn-txt__label body-m">{activeActionKey === deleteActionKey ? 'Deleting...' : 'Delete'}</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : null}
      </section>

      {sourceLoading ? <section className="rd-canvas-module body-m">Loading page source...</section> : null}

      {pageSource ? (
        <section className="rd-canvas-module">
          <div className="roma-toolbar">
            <h2 className="heading-4">Page source</h2>
            <p className="body-m roma-toolbar-count">{pageSource.pageId}</p>
            <p className="body-m roma-toolbar-count">{pagePublishStatus === 'published' ? 'Published' : 'Unpublished'}</p>
          </div>
          <div className="roma-form-grid">
            <label className="roma-field">
              <span className="label-s">Title</span>
              <input
                className="roma-input"
                type="text"
                value={pageSource.metadata.title}
                maxLength={160}
                onChange={(event) => updateMetadata({ title: event.target.value })}
              />
            </label>
            <label className="roma-field">
              <span className="label-s">Description</span>
              <input
                className="roma-input"
                type="text"
                value={pageSource.metadata.description}
                maxLength={300}
                onChange={(event) => updateMetadata({ description: event.target.value })}
              />
            </label>
            <label className="roma-field">
              <span className="label-s">Robots</span>
              <select
                className="roma-input"
                value={pageSource.metadata.robots}
                onChange={(event) => updateMetadata({ robots: event.target.value as PageRobots })}
              >
                <option value="index,follow">index,follow</option>
                <option value="noindex,nofollow">noindex,nofollow</option>
              </select>
            </label>
            <label className="roma-field">
              <span className="label-s">Hosted URL</span>
              <input
                className="roma-input"
                type="text"
                value={hostedPageUrl}
                readOnly
              />
            </label>
          </div>
          <div className="rd-canvas-module__actions">
            <button
              className="diet-btn-txt"
              data-size="md"
              data-variant="primary"
              type="button"
              onClick={() => void handleSaveMetadata()}
              disabled={Boolean(activeActionKey)}
            >
              <span className="diet-btn-txt__label body-m">{activeActionKey === `save-metadata:${pageSource.pageId}` ? 'Saving...' : 'Save metadata'}</span>
            </button>
            <button
              className="diet-btn-txt"
              data-size="md"
              data-variant="primary"
              type="button"
              onClick={() => void handlePagePublishState('published')}
              disabled={Boolean(activeActionKey) || !canPublishPage}
            >
              <span className="diet-btn-txt__label body-m">{activeActionKey === `publish-page:${pageSource.pageId}` ? 'Publishing...' : 'Publish'}</span>
            </button>
            <button
              className="diet-btn-txt"
              data-size="md"
              data-variant="line2"
              type="button"
              onClick={() => void handlePagePublishState('unpublished')}
              disabled={Boolean(activeActionKey)}
            >
              <span className="diet-btn-txt__label body-m">{activeActionKey === `unpublish-page:${pageSource.pageId}` ? 'Unpublishing...' : 'Unpublish'}</span>
            </button>
            <button
              className="diet-btn-txt"
              data-size="md"
              data-variant="secondary"
              type="button"
              onClick={() => void handleCopyPageArtifact('page URL', hostedPageUrl)}
              disabled={Boolean(activeActionKey) || pagePublishStatus !== 'published'}
            >
              <span className="diet-btn-txt__label body-m">Copy URL</span>
            </button>
            <button
              className="diet-btn-txt"
              data-size="md"
              data-variant="secondary"
              type="button"
              onClick={() => void handleCopyPageArtifact('page embed', pageIframeSnippet)}
              disabled={Boolean(activeActionKey) || pagePublishStatus !== 'published'}
            >
              <span className="diet-btn-txt__label body-m">Copy embed</span>
            </button>
            {pagePublishStatus === 'published' ? (
              <a
                className="diet-btn-txt"
                data-size="md"
                data-variant="secondary"
                href={hostedPageUrl}
                target="_blank"
                rel="noreferrer"
              >
                <span className="diet-btn-txt__label body-m">Open public page</span>
              </a>
            ) : null}
          </div>
          {copyStatus ? <p className="body-s">{copyStatus}</p> : null}
          {pageSource.placements.length === 0 ? <p className="body-s">Add at least one instance before publishing this page.</p> : null}
          {publishBlockers.length > 0 ? (
            <p className="body-s">
              Publish is blocked by unpublished or unavailable instances: {publishBlockers.join(', ')}.
            </p>
          ) : null}
          {ipLocalizationBlocksPublish ? <p className="body-s">Publish is blocked while IP localization is unavailable.</p> : null}
          {pagePublishStatus !== 'published' ? <p className="body-s">Publish this page before copying public code.</p> : null}
        </section>
      ) : null}

      {pageSource ? (
        <section className="rd-canvas-module">
          <div className="roma-toolbar">
            <h2 className="heading-4">Page settings</h2>
          </div>
          <div className="roma-form-grid">
            <label className="roma-field">
              <span className="label-s">Default locale</span>
              <select
                className="roma-input"
                value={pageSource.localization.defaultLocale}
                onChange={(event) => {
                  const locale = normalizeLocaleToken(event.target.value);
                  if (locale) updateLocalization({ defaultLocale: locale });
                }}
              >
                {pageLocaleOptions.map((locale) => (
                  <option key={locale} value={locale}>
                    {resolveLocaleUiLabel(locale)}
                  </option>
                ))}
              </select>
            </label>
            <label className="roma-field">
              <span className="label-s">Language switcher</span>
              <input
                type="checkbox"
                checked={pageSource.localization.languageSwitcherEnabled}
                onChange={(event) => updateLocalization({ languageSwitcherEnabled: event.target.checked })}
              />
            </label>
            <label className="roma-field">
              <span className="label-s">IP localization</span>
              <input
                type="checkbox"
                checked={false}
                disabled
                readOnly
              />
            </label>
          </div>
          <div className="roma-toolbar">
            <h3 className="heading-6">Country rules</h3>
          </div>
          {pageSource.localization.countryLocaleRules.length ? (
            <table className="roma-table">
              <thead>
                <tr>
                  <th className="table-header label-s">Country</th>
                  <th className="table-header label-s">Locale</th>
                  <th className="table-header label-s">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageSource.localization.countryLocaleRules.map((rule, index) => (
                  <tr key={`${rule.country}:${index}`}>
                    <td className="body-s">
                      <input
                        className="roma-input"
                        type="text"
                        value={rule.country}
                        maxLength={2}
                        onChange={(event) => updateCountryLocaleRule(index, { country: event.target.value })}
                      />
                    </td>
                    <td className="body-s">
                      <select
                        className="roma-input"
                        value={rule.locale}
                        onChange={(event) => updateCountryLocaleRule(index, { locale: event.target.value })}
                      >
                        {pageLocaleOptions.map((locale) => (
                          <option key={locale} value={locale}>
                            {resolveLocaleUiLabel(locale)}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="roma-cell-actions">
                      <button
                        className="diet-btn-txt"
                        data-size="md"
                        data-variant="line2"
                        type="button"
                        onClick={() => removeCountryLocaleRule(index)}
                        disabled={Boolean(activeActionKey)}
                      >
                        <span className="diet-btn-txt__label body-m">Remove</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
          <div className="rd-canvas-module__actions">
            <button
              className="diet-btn-txt"
              data-size="md"
              data-variant="line2"
              type="button"
              onClick={addCountryLocaleRule}
              disabled={Boolean(activeActionKey)}
            >
              <span className="diet-btn-txt__label body-m">Add country rule</span>
            </button>
          </div>
          <div className="rd-canvas-module__actions">
            <button
              className="diet-btn-txt"
              data-size="md"
              data-variant="primary"
              type="button"
              onClick={() => void handleSavePageSettings()}
              disabled={Boolean(activeActionKey)}
            >
              <span className="diet-btn-txt__label body-m">{activeActionKey === `save-settings:${pageSource.pageId}` ? 'Saving...' : 'Save settings'}</span>
            </button>
          </div>
          {ipLocalizationBlocksPublish ? <p className="body-s">IP localization is unavailable for publishing.</p> : null}
        </section>
      ) : null}

      {pageSource ? (
        <section className="rd-canvas-module">
          <div className="roma-toolbar">
            <h2 className="heading-4">Placements</h2>
            <p className="body-m roma-toolbar-count">
              {pageSource.placements.length} {pageSource.placements.length === 1 ? 'widget' : 'widgets'}
            </p>
          </div>
          <div className="rd-canvas-module__actions">
            <button
              className="diet-btn-txt"
              data-size="md"
              data-variant="primary"
              type="button"
              onClick={openAddInstances}
              disabled={Boolean(activeActionKey)}
            >
              <span className="diet-btn-txt__label body-m">Add instances</span>
            </button>
          </div>

          {addInstancesOpen ? (
            <div className="roma-modal-backdrop" role="presentation">
              <div className="roma-modal" role="dialog" aria-modal="true" aria-labelledby="roma-pages-add-instances-title">
                <h2 id="roma-pages-add-instances-title" className="heading-6">
                  Add instances
                </h2>
                <p className="body-s">
                  {checkedInstanceIds.length} selected
                </p>
                {widgetInstances.length ? (
                  <table className="roma-table">
                    <thead>
                      <tr>
                        <th className="table-header label-s">Select</th>
                        <th className="table-header label-s">Instance</th>
                        <th className="table-header label-s">Widget</th>
                        <th className="table-header label-s">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visiblePickerInstances.map((instance) => {
                        const alreadyPlaced = placedInstanceIds.has(instance.instanceId);
                        const checked = checkedInstanceIds.includes(instance.instanceId);
                        return (
                          <tr key={instance.instanceId}>
                            <td className="body-s">
                              <input
                                type="checkbox"
                                checked={alreadyPlaced || checked}
                                disabled={alreadyPlaced || Boolean(activeActionKey)}
                                aria-label={`Select ${instance.displayName || DEFAULT_INSTANCE_DISPLAY_NAME}`}
                                onChange={() => toggleCheckedInstance(instance.instanceId)}
                              />
                            </td>
                            <td className="body-s">{instance.displayName || DEFAULT_INSTANCE_DISPLAY_NAME}</td>
                            <td className="body-s">{instance.widgetType}</td>
                            <td className="body-s">
                              {alreadyPlaced ? 'Already placed' : instance.status === 'published' ? 'Published' : 'Unpublished, blocks publish'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : (
                  <p className="body-m">No saved instances yet.</p>
                )}
                {pickerVisibleLimit < widgetInstances.length ? (
                  <div className="rd-canvas-module__actions">
                    <button
                      className="diet-btn-txt"
                      data-size="md"
                      data-variant="line2"
                      type="button"
                      onClick={() => setPickerVisibleLimit((current) => current + 50)}
                      disabled={Boolean(activeActionKey)}
                    >
                      <span className="diet-btn-txt__label body-m">Show more</span>
                    </button>
                  </div>
                ) : null}
                <div className="roma-modal__actions">
                  <button
                    className="diet-btn-txt"
                    data-size="md"
                    data-variant="line2"
                    type="button"
                    onClick={() => setAddInstancesOpen(false)}
                    disabled={Boolean(activeActionKey)}
                  >
                    <span className="diet-btn-txt__label body-m">Cancel</span>
                  </button>
                  <button
                    className="diet-btn-txt"
                    data-size="md"
                    data-variant="primary"
                    type="button"
                    onClick={() => void handleAddSelectedInstances()}
                    disabled={Boolean(activeActionKey) || checkedInstanceIds.length === 0}
                  >
                    <span className="diet-btn-txt__label body-m">
                      {activeActionKey === `bulk-place:${pageSource.pageId}` ? 'Adding...' : 'Add selected'}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {pageSource.placements.length ? (
            <table className="roma-table">
              <thead>
                <tr>
                  <th className="table-header label-s">Order</th>
                  <th className="table-header label-s">Widget</th>
                  <th className="table-header label-s">Instance ID</th>
                  <th className="table-header label-s">Status</th>
                  <th className="table-header label-s">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageSource.placements.map((placement, index) => {
                  const instance = instanceById.get(placement.instanceId);
                  return (
                    <tr key={placement.placementId}>
                      <td className="body-s">{index + 1}</td>
                      <td className="body-s">
                        {instance?.displayName || DEFAULT_INSTANCE_DISPLAY_NAME}
                        {instance?.widgetType ? ` · ${instance.widgetType}` : ''}
                      </td>
                      <td className="body-s">{placement.instanceId}</td>
                      <td className="body-s">
                        {!instance ? 'Unavailable, blocks publish' : instance.status === 'published' ? 'Published' : 'Unpublished, blocks publish'}
                      </td>
                      <td className="roma-cell-actions">
                        <button
                          className="diet-btn-txt"
                          data-size="md"
                          data-variant="line2"
                          type="button"
                          onClick={() => void handleMovePlacement(index, -1)}
                          disabled={Boolean(activeActionKey) || index === 0}
                        >
                          <span className="diet-btn-txt__label body-m">Up</span>
                        </button>
                        <button
                          className="diet-btn-txt"
                          data-size="md"
                          data-variant="line2"
                          type="button"
                          onClick={() => void handleMovePlacement(index, 1)}
                          disabled={Boolean(activeActionKey) || index === pageSource.placements.length - 1}
                        >
                          <span className="diet-btn-txt__label body-m">Down</span>
                        </button>
                        <Link
                          className="diet-btn-txt"
                          data-size="md"
                          data-variant="secondary"
                          href={`${buildBuilderRoute({ instanceId: placement.instanceId })}?returnTo=${encodeURIComponent(buildPagesRoute(pageSource.pageId))}`}
                        >
                          <span className="diet-btn-txt__label body-m">Edit</span>
                        </Link>
                        <button
                          className="diet-btn-txt"
                          data-size="md"
                          data-variant="line2"
                          type="button"
                          onClick={() => void handleRemovePlacement(index)}
                          disabled={Boolean(activeActionKey)}
                        >
                          <span className="diet-btn-txt__label body-m">Remove</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <p className="body-m">No widgets placed yet.</p>
          )}
        </section>
      ) : null}
    </>
  );
}
