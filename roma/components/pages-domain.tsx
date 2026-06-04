'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { resolveAccountShellErrorCopy } from '../lib/account-shell-copy';
import { useRomaAccountApi } from './account-api';
import { useRomaAccountContext } from './roma-account-context';
import {
  buildBuilderRoute,
  DEFAULT_INSTANCE_DISPLAY_NAME,
  loadRomaWidgetsForAccount,
  readRomaWidgetsCache,
  type RomaWidgetsResponse,
  type SystemWidgetOption,
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
      ...current.data.pages.filter((page) => page.id !== summary.id),
    ].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt) || left.id.localeCompare(right.id)),
  });
}

function pageSavePayload(source: AccountPageSource) {
  return {
    source: {
      v: 1,
      id: source.id,
      head: source.head,
      placements: source.placements,
    },
  };
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
  const [systemWidgets, setSystemWidgets] = useState<SystemWidgetOption[]>(() => cachedWidgets?.data.systemWidgets ?? []);
  const [selectedExistingInstanceId, setSelectedExistingInstanceId] = useState('');
  const [selectedCreateWidgetType, setSelectedCreateWidgetType] = useState('');
  const [domainLoading, setDomainLoading] = useState(() => !cachedPages);
  const [domainRefreshing, setDomainRefreshing] = useState(false);
  const [sourceLoading, setSourceLoading] = useState(false);
  const [activeActionKey, setActiveActionKey] = useState<string | null>(null);
  const [dataError, setDataError] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);

  const selectedPageId = useMemo(() => (searchParams.get('page') || '').trim(), [searchParams]);
  const activePageId = selectedPageId || pages[0]?.id || '';
  const hostedPageUrl = pageSource ? `https://clk.live/${productAccountId}/pages/${pageSource.id}` : '';

  const applyPages = useCallback((payload: RomaPagesResponse) => {
    setPages(payload.pages);
  }, []);

  const applyWidgets = useCallback((widgets: RomaWidgetsResponse) => {
    setWidgetInstances(widgets.instances);
    setSystemWidgets(widgets.systemWidgets);
    if (!selectedCreateWidgetType) {
      setSelectedCreateWidgetType(widgets.systemWidgets.find((option) => option.canCreate)?.widgetType ?? '');
    }
  }, [selectedCreateWidgetType]);

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
      setSelectedExistingInstanceId('');
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
  }, [applyPages, productAccountId, refreshPages, refreshWidgets]);

  useEffect(() => {
    if (!activePageId) {
      setPageSource(null);
      setPagePublishStatus('unpublished');
      return;
    }
    if (pageSource?.id === activePageId) return;
    void loadPageSource(activePageId);
  }, [activePageId, loadPageSource, pageSource?.id]);

  const instanceById = useMemo(() => {
    const map = new Map<string, WidgetInstance>();
    widgetInstances.forEach((instance) => map.set(instance.instanceId, instance));
    return map;
  }, [widgetInstances]);

  const saveSource = useCallback(async (source: AccountPageSource, actionKey: string) => {
    setActiveActionKey(actionKey);
    setMutationError(null);
    try {
      const payload = await accountApi.fetchJson<{
        source?: AccountPageSource;
        summary?: AccountPageSummary;
      }>(`/api/account/pages/${encodeURIComponent(source.id)}`, {
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
          head: {
            title: 'Untitled page',
            description: '',
            robots: 'index,follow',
          },
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
      if (pageSource?.id === pageId) {
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
  }, [accountApi, pageSource?.id, refreshPages, router]);

  const updateHead = useCallback((patch: Partial<AccountPageSource['head']>) => {
    setPageSource((current) => current ? { ...current, head: { ...current.head, ...patch } } : current);
  }, []);

  const handleSaveMetadata = useCallback(async () => {
    if (!pageSource) return;
    await saveSource(pageSource, `save-head:${pageSource.id}`);
  }, [pageSource, saveSource]);

  const handlePagePublishState = useCallback(async (nextStatus: PagePublishStatus) => {
    if (!pageSource) return;
    const action = nextStatus === 'published' ? 'publish' : 'unpublish';
    const actionKey = `${action}-page:${pageSource.id}`;
    setActiveActionKey(actionKey);
    setMutationError(null);
    try {
      const payload = await accountApi.fetchJson<{ publishStatus?: PagePublishStatus }>(
        `/api/account/pages/${encodeURIComponent(pageSource.id)}/${action}`,
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

  const handleAddExisting = useCallback(async () => {
    if (!pageSource || !selectedExistingInstanceId) return;
    const nextSource: AccountPageSource = {
      ...pageSource,
      placements: [
        ...pageSource.placements,
        { instanceId: selectedExistingInstanceId },
      ],
    };
    const saved = await saveSource(nextSource, `place-existing:${selectedExistingInstanceId}`);
    if (saved) setSelectedExistingInstanceId('');
  }, [pageSource, saveSource, selectedExistingInstanceId]);

  const handleCreateAndPlace = useCallback(async () => {
    if (!pageSource || !selectedCreateWidgetType) return;
    const actionKey = `create-place:${selectedCreateWidgetType}`;
    setActiveActionKey(actionKey);
    setMutationError(null);
    try {
      const created = await accountApi.fetchJson<{ instanceId?: string; widgetType?: string }>('/api/account/instances', {
        method: 'POST',
        headers: accountApi.buildHeaders({ contentType: 'application/json' }),
        body: JSON.stringify({ widgetType: selectedCreateWidgetType }),
      });
      const instanceId = typeof created.instanceId === 'string' ? created.instanceId.trim() : '';
      if (!instanceId) throw new Error('coreui.errors.payload.invalid');
      await refreshWidgets({ force: true });
      const nextSource: AccountPageSource = {
        ...pageSource,
        placements: [
          ...pageSource.placements,
          { instanceId },
        ],
      };
      await saveSource(nextSource, actionKey);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setMutationError(resolveAccountShellErrorCopy(message, 'Creating and placing the widget failed. The widget may still exist in Widgets.'));
    } finally {
      setActiveActionKey((current) => (current === actionKey ? null : current));
    }
  }, [accountApi, pageSource, refreshWidgets, saveSource, selectedCreateWidgetType]);

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
                const isActive = page.id === activePageId;
                const deleteActionKey = `delete-page:${page.id}`;
                return (
                  <tr key={page.id} data-selected={isActive ? 'true' : undefined}>
                    <td className="body-s">{page.title}</td>
                    <td className="body-s">{page.id}</td>
                    <td className="body-s">{page.placementCount}</td>
                    <td className="roma-cell-actions">
                      <Link className="diet-btn-txt" data-size="md" data-variant={isActive ? 'primary' : 'line2'} href={buildPagesRoute(page.id)}>
                        <span className="diet-btn-txt__label body-m">{isActive ? 'Open' : 'Select'}</span>
                      </Link>
                      <button
                        className="diet-btn-txt"
                        data-size="md"
                        data-variant="line2"
                        type="button"
                        onClick={() => void handleDeletePage(page.id)}
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
            <p className="body-m roma-toolbar-count">{pageSource.id}</p>
            <p className="body-m roma-toolbar-count">{pagePublishStatus === 'published' ? 'Published' : 'Unpublished'}</p>
          </div>
          <div className="roma-form-grid">
            <label className="roma-field">
              <span className="label-s">Title</span>
              <input
                className="roma-input"
                type="text"
                value={pageSource.head.title}
                maxLength={160}
                onChange={(event) => updateHead({ title: event.target.value })}
              />
            </label>
            <label className="roma-field">
              <span className="label-s">Description</span>
              <input
                className="roma-input"
                type="text"
                value={pageSource.head.description}
                maxLength={300}
                onChange={(event) => updateHead({ description: event.target.value })}
              />
            </label>
            <label className="roma-field">
              <span className="label-s">Robots</span>
              <select
                className="roma-input"
                value={pageSource.head.robots}
                onChange={(event) => updateHead({ robots: event.target.value as PageRobots })}
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
              <span className="diet-btn-txt__label body-m">{activeActionKey === `save-head:${pageSource.id}` ? 'Saving...' : 'Save metadata'}</span>
            </button>
            <button
              className="diet-btn-txt"
              data-size="md"
              data-variant="primary"
              type="button"
              onClick={() => void handlePagePublishState('published')}
              disabled={Boolean(activeActionKey)}
            >
              <span className="diet-btn-txt__label body-m">{activeActionKey === `publish-page:${pageSource.id}` ? 'Publishing...' : 'Publish'}</span>
            </button>
            <button
              className="diet-btn-txt"
              data-size="md"
              data-variant="line2"
              type="button"
              onClick={() => void handlePagePublishState('unpublished')}
              disabled={Boolean(activeActionKey)}
            >
              <span className="diet-btn-txt__label body-m">{activeActionKey === `unpublish-page:${pageSource.id}` ? 'Unpublishing...' : 'Unpublish'}</span>
            </button>
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
          </div>
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
          <div className="roma-form-grid">
            <label className="roma-field">
              <span className="label-s">Add existing widget</span>
              <select
                className="roma-input"
                value={selectedExistingInstanceId}
                onChange={(event) => setSelectedExistingInstanceId(event.target.value)}
              >
                <option value="">Select widget</option>
                {widgetInstances.map((instance) => (
                  <option key={instance.instanceId} value={instance.instanceId}>
                    {instance.displayName || DEFAULT_INSTANCE_DISPLAY_NAME} · {instance.widgetType}
                  </option>
                ))}
              </select>
            </label>
            <label className="roma-field">
              <span className="label-s">Create new widget</span>
              <select
                className="roma-input"
                value={selectedCreateWidgetType}
                onChange={(event) => setSelectedCreateWidgetType(event.target.value)}
              >
                <option value="">Select type</option>
                {systemWidgets.map((option) => (
                  <option key={option.widgetType} value={option.widgetType} disabled={!option.canCreate}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="rd-canvas-module__actions">
            <button
              className="diet-btn-txt"
              data-size="md"
              data-variant="secondary"
              type="button"
              onClick={() => void handleAddExisting()}
              disabled={Boolean(activeActionKey) || !selectedExistingInstanceId}
            >
              <span className="diet-btn-txt__label body-m">Add existing</span>
            </button>
            <button
              className="diet-btn-txt"
              data-size="md"
              data-variant="primary"
              type="button"
              onClick={() => void handleCreateAndPlace()}
              disabled={Boolean(activeActionKey) || !selectedCreateWidgetType}
            >
              <span className="diet-btn-txt__label body-m">
                {activeActionKey?.startsWith('create-place:') ? 'Creating...' : 'Create and place'}
              </span>
            </button>
          </div>

          {pageSource.placements.length ? (
            <table className="roma-table">
              <thead>
                <tr>
                  <th className="table-header label-s">Order</th>
                  <th className="table-header label-s">Widget</th>
                  <th className="table-header label-s">Instance ID</th>
                  <th className="table-header label-s">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageSource.placements.map((placement, index) => {
                  const instance = instanceById.get(placement.instanceId);
                  return (
                    <tr key={`${placement.instanceId}-${index}`}>
                      <td className="body-s">{index + 1}</td>
                      <td className="body-s">
                        {instance?.displayName || DEFAULT_INSTANCE_DISPLAY_NAME}
                        {instance?.widgetType ? ` · ${instance.widgetType}` : ''}
                      </td>
                      <td className="body-s">{placement.instanceId}</td>
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
                          href={`${buildBuilderRoute({ instanceId: placement.instanceId })}?returnTo=${encodeURIComponent(buildPagesRoute(pageSource.id))}`}
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
