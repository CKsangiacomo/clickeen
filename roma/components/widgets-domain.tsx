'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import {
  resolveAccountShellErrorCopy,
  resolveAccountShellReason,
} from '../lib/account-shell-copy';
import { useRomaAccountApi } from './account-api';
import { DieterDropdownActions } from './dieter-dropdown-actions';
import { DieterTextfield } from './dieter-textfield';
import { prefetchWidgetEditorArtifact } from './widget-editor-artifact';
import { RomaAccountNoticeModal } from './roma-account-notice-modal';
import { useRomaAccountContext } from './roma-account-context';
import { RomaDomainErrorBoundary } from './roma-domain-error-boundary';
import { RomaShell } from './roma-shell';
import { WidgetPublicationControls } from './widget-publication-controls';
import {
  buildBuilderRoute,
  buildNewBuilderRoute,
  DEFAULT_INSTANCE_DISPLAY_NAME,
  isRomaWidgetsCacheFresh,
  loadRomaWidgetsForAccount,
  readRomaWidgetsCache,
  updateRomaWidgetsCache,
  type RomaWidgetsResponse,
  type WidgetCatalogOption,
  type WidgetInstance,
} from './use-roma-widgets';

type WidgetsView = 'your-widgets' | 'catalog';
type WidgetStatusFilter = 'all' | 'published' | 'unpublished';
type WidgetSortKey = 'widget' | 'name' | 'status';
type WidgetSortDirection = 'ascending' | 'descending';
type WidgetSort = { key: WidgetSortKey; direction: WidgetSortDirection };

const DEFAULT_WIDGET_SORT: WidgetSort = { key: 'name', direction: 'ascending' };

async function readJsonOrNull(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export function WidgetsPage({ view }: { view: WidgetsView }) {
  const [statusFilter, setStatusFilter] = useState<WidgetStatusFilter>('all');

  return (
    <RomaShell
      activeDomain={view === 'catalog' ? 'widgetCatalog' : 'widgets'}
      title="Widgets"
      headerControls={view === 'your-widgets' ? (
        <DieterDropdownActions
          className="roma-header-filter"
          ariaLabel="Filter your widgets by publish status"
          triggerStyle="button"
          value={statusFilter}
          options={[
            { value: 'all', label: 'Show all' },
            { value: 'published', label: 'Show published' },
            { value: 'unpublished', label: 'Show unpublished' },
          ]}
          onChange={(value) => setStatusFilter(value as WidgetStatusFilter)}
        />
      ) : null}
    >
      <RomaAccountNoticeModal />
      <Suspense fallback={null}>
        <RomaDomainErrorBoundary domainLabel="Widgets" resetKey="widgets">
          <WidgetsDomain
            view={view}
            statusFilter={statusFilter}
          />
        </RomaDomainErrorBoundary>
      </Suspense>
    </RomaShell>
  );
}

export function WidgetsDomain({
  view,
  statusFilter,
}: {
  view: WidgetsView;
  statusFilter: WidgetStatusFilter;
}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { accountContext, accountPolicy } = useRomaAccountContext();
  const accountApi = useRomaAccountApi();
  const productAccountId = accountContext.accountPublicId;
  const canMutateWidgets = accountPolicy.role !== 'viewer';
  const cachedWidgets = readRomaWidgetsCache(productAccountId);

  const [activeActionKey, setActiveActionKey] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [widgetInstances, setWidgetInstances] = useState<WidgetInstance[]>(() => cachedWidgets?.data.instances ?? []);
  const [catalog, setCatalog] = useState<WidgetCatalogOption[]>(() => cachedWidgets?.data.catalog ?? []);
  const [domainLoading, setDomainLoading] = useState(() => !cachedWidgets);
  const [domainRefreshing, setDomainRefreshing] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [renamingInstanceId, setRenamingInstanceId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [renameError, setRenameError] = useState<string | null>(null);
  const [sort, setSort] = useState<WidgetSort>(DEFAULT_WIDGET_SORT);
  const [openWidgetActions, setOpenWidgetActions] = useState<{
    instanceId: string;
    position: { top: number; left: number } | null;
  } | null>(null);
  const widgetActionsTriggerRef = useRef<HTMLButtonElement | null>(null);
  const widgetActionsPopoverRef = useRef<HTMLDivElement>(null);

  const selectedInstanceId = useMemo(() => (searchParams.get('selected') || '').trim(), [searchParams]);
  const openWidgetActionsInstance = useMemo(
    () => openWidgetActions
      ? widgetInstances.find((instance) => instance.instanceId === openWidgetActions.instanceId) ?? null
      : null,
    [openWidgetActions, widgetInstances],
  );
  const applyWidgets = useCallback((widgets: RomaWidgetsResponse) => {
    setWidgetInstances(widgets.instances);
    setCatalog(widgets.catalog);
  }, []);

  const refreshWidgets = useCallback(async (args?: { force?: boolean }) => {
    const force = args?.force === true;
    const cached = readRomaWidgetsCache(productAccountId);

    if (!force && cached) {
      applyWidgets(cached.data);
      setDomainLoading(false);
      setDataError(null);
      if (isRomaWidgetsCacheFresh(cached)) return;
      setDomainRefreshing(true);
    } else {
      setDomainLoading(true);
    }
    setDataError(null);
    try {
      const normalized = await loadRomaWidgetsForAccount({
        accountId: productAccountId,
        fetchJson: accountApi.fetchJson,
        force,
      });
      applyWidgets(normalized);
      setDataError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (!cached) {
        setWidgetInstances([]);
      }
      setDataError(resolveAccountShellErrorCopy(message, 'Failed to load widgets. Please try again.'));
    } finally {
      setDomainLoading(false);
      setDomainRefreshing(false);
    }
  }, [accountApi.fetchJson, productAccountId, applyWidgets]);

  useEffect(() => {
    const cached = readRomaWidgetsCache(productAccountId);
    if (cached) {
      applyWidgets(cached.data);
      setDomainLoading(false);
    } else {
      setWidgetInstances([]);
      setCatalog([]);
      setDomainLoading(true);
    }
    void refreshWidgets();
  }, [productAccountId, applyWidgets, refreshWidgets]);

  const instanceWidgetTypes = useMemo(
    () => Array.from(new Set(widgetInstances.map((instance) => instance.widgetType))).sort((a, b) => a.localeCompare(b)),
    [widgetInstances],
  );
  const widgetDataError = dataError;
  const canRenderWidgetData = !dataError || catalog.length > 0 || widgetInstances.length > 0;

  const catalogByWidgetType = useMemo(
    () => new Map(catalog.map((option) => [option.widgetType, option])),
    [catalog],
  );

  const displayedCatalog = useMemo(
    () => catalog.slice().sort((left, right) => left.displayName.localeCompare(right.displayName)),
    [catalog],
  );

  const displayedInstances = useMemo(() => {
    if (!canRenderWidgetData) return [];
    return widgetInstances
      .filter((instance) => statusFilter === 'all' || instance.status === statusFilter)
      .slice()
      .sort((left, right) => {
        const leftName = left.displayName || DEFAULT_INSTANCE_DISPLAY_NAME;
        const rightName = right.displayName || DEFAULT_INSTANCE_DISPLAY_NAME;
        const primary = sort.key === 'widget'
          ? catalogByWidgetType.get(left.widgetType)!.displayName.localeCompare(
              catalogByWidgetType.get(right.widgetType)!.displayName,
            )
          : sort.key === 'name'
            ? leftName.localeCompare(rightName)
            : left.status.localeCompare(right.status);
        if (primary !== 0) return sort.direction === 'ascending' ? primary : -primary;
        const nameOrder = leftName.localeCompare(rightName);
        if (nameOrder !== 0) return nameOrder;
        return left.instanceId.localeCompare(right.instanceId);
      });
  }, [canRenderWidgetData, catalogByWidgetType, sort, statusFilter, widgetInstances]);

  const changeSort = useCallback((key: WidgetSortKey) => {
    setSort((current) => current.key === key
      ? {
          key,
          direction: current.direction === 'ascending' ? 'descending' : 'ascending',
        }
      : { key, direction: 'ascending' });
  }, []);

  const closeWidgetActions = useCallback((returnFocus = false) => {
    const trigger = widgetActionsTriggerRef.current;
    setOpenWidgetActions(null);
    widgetActionsTriggerRef.current = null;
    if (returnFocus) requestAnimationFrame(() => trigger?.focus());
  }, []);

  useEffect(() => {
    if (!openWidgetActions || openWidgetActions.position) return undefined;
    const frame = requestAnimationFrame(() => {
      const trigger = widgetActionsTriggerRef.current;
      const popover = widgetActionsPopoverRef.current;
      if (!trigger || !popover) return;
      const triggerRect = trigger.getBoundingClientRect();
      const popoverStyles = getComputedStyle(popover);
      const gap = Number.parseFloat(popoverStyles.rowGap) || 0;
      const edge = Number.parseFloat(popoverStyles.paddingInlineStart) || 0;
      const top = triggerRect.bottom + gap + popover.offsetHeight <= window.innerHeight - edge
        ? triggerRect.bottom + gap
        : Math.max(edge, triggerRect.top - popover.offsetHeight - gap);
      const left = Math.min(
        window.innerWidth - popover.offsetWidth - edge,
        Math.max(edge, triggerRect.right - popover.offsetWidth),
      );
      setOpenWidgetActions((current) => current
        ? { ...current, position: { top, left } }
        : null);
      requestAnimationFrame(() => {
        popover.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [openWidgetActions]);

  useEffect(() => {
    if (!openWidgetActions) return undefined;
    const closeOnPointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) return;
      if (widgetActionsTriggerRef.current?.contains(event.target) || widgetActionsPopoverRef.current?.contains(event.target)) return;
      closeWidgetActions();
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeWidgetActions(true);
        return;
      }
      if (event.key === 'Tab') {
        closeWidgetActions();
        return;
      }
      if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
      const items = Array.from(
        widgetActionsPopoverRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [],
      );
      if (items.length === 0) return;
      event.preventDefault();
      const currentIndex = items.indexOf(document.activeElement as HTMLButtonElement);
      if (event.key === 'Home') items[0]?.focus();
      else if (event.key === 'End') items.at(-1)?.focus();
      else if (event.key === 'ArrowDown') items[(currentIndex + 1 + items.length) % items.length]?.focus();
      else items[(currentIndex - 1 + items.length) % items.length]?.focus();
    };
    const closeOnViewportChange = () => closeWidgetActions();
    document.addEventListener('pointerdown', closeOnPointerDown);
    document.addEventListener('keydown', closeOnEscape);
    window.addEventListener('resize', closeOnViewportChange);
    window.addEventListener('scroll', closeOnViewportChange, true);
    return () => {
      document.removeEventListener('pointerdown', closeOnPointerDown);
      document.removeEventListener('keydown', closeOnEscape);
      window.removeEventListener('resize', closeOnViewportChange);
      window.removeEventListener('scroll', closeOnViewportChange, true);
    };
  }, [closeWidgetActions, openWidgetActions]);

  useEffect(() => {
    if (activeActionKey && openWidgetActions) closeWidgetActions();
  }, [activeActionKey, closeWidgetActions, openWidgetActions]);

  useEffect(() => {
    if (openWidgetActions && !openWidgetActionsInstance) closeWidgetActions();
  }, [closeWidgetActions, openWidgetActions, openWidgetActionsInstance]);

  useEffect(() => {
    if (view !== 'your-widgets') return;
    const candidates = instanceWidgetTypes.slice(0, 8);
    candidates.forEach((widgetType) => {
      void prefetchWidgetEditorArtifact(widgetType);
    });
  }, [instanceWidgetTypes, view]);

  const handleCreateInstance = useCallback(
    (widgetType: string) => {
      if (!productAccountId || !canMutateWidgets) return;
      setMutationError(null);
      router.push(buildNewBuilderRoute(widgetType));
    },
    [canMutateWidgets, productAccountId, router],
  );

  const handleDuplicateInstance = useCallback(
    async (instance: WidgetInstance) => {
      if (!productAccountId || !canMutateWidgets) return;
      const actionKey = `duplicate:${instance.instanceId}`;
      setActiveActionKey(actionKey);
      setMutationError(null);
      try {
        const response = await accountApi.fetchRaw(`/api/account/instances/${encodeURIComponent(instance.instanceId)}/duplicate`, {
          method: 'POST',
        });
        if (!response.ok) {
          const payload = await readJsonOrNull(response);
          throw new Error(resolveAccountShellReason(payload, 'Duplicating the widget failed. Please try again.'));
        }
        const { instanceId: duplicatedInstanceId } = await response.json() as { instanceId: string };
        void refreshWidgets({ force: true });
        router.push(buildBuilderRoute({ instanceId: duplicatedInstanceId }));
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setMutationError(resolveAccountShellErrorCopy(message, 'Duplicating the widget failed. Please try again.'));
      } finally {
        setActiveActionKey((current) => (current === actionKey ? null : current));
      }
    },
    [accountApi, canMutateWidgets, productAccountId, refreshWidgets, router],
  );

  const handleDeleteInstance = useCallback(
    async (instance: WidgetInstance) => {
      if (!productAccountId || !canMutateWidgets) return;
      const actionKey = `delete:${instance.instanceId}`;
      setActiveActionKey(actionKey);
      setMutationError(null);
      try {
        await accountApi.fetchJson<{ deleted?: boolean }>(`/api/account/instances/${encodeURIComponent(instance.instanceId)}`, {
          method: 'DELETE',
        });
        await refreshWidgets({ force: true });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setMutationError(resolveAccountShellErrorCopy(message, 'Deleting the widget failed. Please try again.'));
      } finally {
        setActiveActionKey((current) => (current === actionKey ? null : current));
      }
    },
    [accountApi, canMutateWidgets, productAccountId, refreshWidgets],
  );

  const startRename = useCallback((instance: WidgetInstance) => {
    if (!canMutateWidgets) return;
    setMutationError(null);
    setRenameError(null);
    setRenamingInstanceId(instance.instanceId);
    setRenameDraft(instance.displayName || DEFAULT_INSTANCE_DISPLAY_NAME);
  }, [canMutateWidgets]);

  const cancelRename = useCallback(() => {
    setRenamingInstanceId(null);
    setRenameDraft('');
    setRenameError(null);
  }, []);

  const handleRenameInstance = useCallback(
    async (instance: WidgetInstance) => {
      if (!productAccountId || !canMutateWidgets) return;
      const nextDisplayName = renameDraft.trim();
      if (!nextDisplayName) {
        setRenameError('Instance name cannot be empty.');
        return;
      }
      if (nextDisplayName === instance.displayName) {
        cancelRename();
        return;
      }
      const actionKey = `rename:${instance.instanceId}`;
      setActiveActionKey(actionKey);
      setMutationError(null);
      setRenameError(null);
      try {
        const payload = await accountApi.fetchJson<{
          instanceId: string;
          displayName: string;
          updatedAt: string;
        }>(`/api/account/instances/${encodeURIComponent(instance.instanceId)}/rename`, {
          method: 'POST',
          headers: accountApi.buildHeaders({
            contentType: 'application/json',
          }),
          body: JSON.stringify({ displayName: nextDisplayName }),
        });
        const resolvedDisplayName = payload.displayName;
        setWidgetInstances((prev) => prev.map((entry) => (entry.instanceId === instance.instanceId ? { ...entry, displayName: resolvedDisplayName, updatedAt: payload.updatedAt } : entry)));
        updateRomaWidgetsCache(productAccountId, (current) => ({
          ...current,
          instances: current.instances.map((entry) => (entry.instanceId === instance.instanceId ? { ...entry, displayName: resolvedDisplayName, updatedAt: payload.updatedAt } : entry)),
        }));
        cancelRename();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setRenameError(resolveAccountShellErrorCopy(message, 'Renaming the widget failed. Please try again.'));
      } finally {
        setActiveActionKey((current) => (current === actionKey ? null : current));
      }
    },
    [accountApi, canMutateWidgets, productAccountId, cancelRename, renameDraft],
  );

  return (
    <>
      {widgetDataError || mutationError || renameError || (domainLoading && catalog.length === 0 && widgetInstances.length === 0) ? (
        <section className="rd-canvas-module" role={widgetDataError || mutationError || renameError ? 'alert' : 'status'}>
          {widgetDataError ? (
            <div className="roma-inline-stack">
              <p className="body-m">{widgetDataError}</p>
              <button className="diet-button" data-size="medium" data-type="tertiary" type="button" onClick={() => void refreshWidgets({ force: true })} disabled={domainLoading || domainRefreshing}>
                <span className="diet-button__label">Retry</span>
              </button>
            </div>
          ) : null}
          {mutationError ? (
            <div className="roma-inline-stack">
              <p className="body-m">{mutationError}</p>
            </div>
          ) : null}
          {renameError ? <p className="body-m">{renameError}</p> : null}

          {domainLoading && catalog.length === 0 && widgetInstances.length === 0 && !widgetDataError ? <p className="body-m">Loading widgets...</p> : null}
        </section>
      ) : null}

      {view === 'your-widgets' ? (
          <>
            {!domainLoading && canRenderWidgetData && widgetInstances.length === 0 ? (
              <section className="rd-canvas-module">
                <p className="body-m">No widgets yet.</p>
                {canMutateWidgets && catalog.length > 0 ? (
                  <div className="rd-canvas-module__actions">
                    <Link
                      className="diet-button"
                      data-size="medium"
                      data-type="primary"
                      href="/widgets/catalog"
                    >
                      <span className="diet-button__label">Browse widget catalog</span>
                    </Link>
                  </div>
                ) : null}
              </section>
            ) : null}

            {!domainLoading && canRenderWidgetData && statusFilter !== 'all' && widgetInstances.length > 0 && displayedInstances.length === 0 ? (
              <section className="rd-canvas-module">
                <p className="body-m">No {statusFilter} widgets.</p>
              </section>
            ) : null}

            {displayedInstances.length > 0 && canRenderWidgetData ? (
              <div className="diet-table">
                <table className="diet-table__table">
                <caption className="sr-only">Your widgets</caption>
                <thead>
                  <tr>
                    <th className="label-s" scope="col" aria-sort={sort.key === 'widget' ? sort.direction : 'none'}>
                      <span>Widget</span>{' '}
                      <button
                        className="diet-button"
                        data-size="small"
                        data-type="quaternary"
                        type="button"
                        aria-label="Sort by widget"
                        onClick={() => changeSort('widget')}
                      >
                        <span
                          className="diet-icon diet-icon-mask"
                          data-size="12"
                          style={{
                            '--diet-icon-source': `url("/dieter/icons/svg/${sort.key === 'widget'
                              ? sort.direction === 'ascending' ? 'chevron.up.2.svg' : 'chevron.down.2.svg'
                              : 'chevron.down.dotted.2.svg'}")`,
                          } as CSSProperties}
                          aria-hidden="true"
                        />
                      </button>
                    </th>
                    <th className="label-s" scope="col" aria-sort={sort.key === 'name' ? sort.direction : 'none'}>
                      <span>Instance name</span>{' '}
                      <button
                        className="diet-button"
                        data-size="small"
                        data-type="quaternary"
                        type="button"
                        aria-label="Sort by instance name"
                        onClick={() => changeSort('name')}
                      >
                        <span
                          className="diet-icon diet-icon-mask"
                          data-size="12"
                          style={{
                            '--diet-icon-source': `url("/dieter/icons/svg/${sort.key === 'name'
                              ? sort.direction === 'ascending' ? 'chevron.up.2.svg' : 'chevron.down.2.svg'
                              : 'chevron.down.dotted.2.svg'}")`,
                          } as CSSProperties}
                          aria-hidden="true"
                        />
                      </button>
                    </th>
                    <th className="label-s" scope="col" aria-sort={sort.key === 'status' ? sort.direction : 'none'}>
                      <span>Published</span>{' '}
                      <button
                        className="diet-button"
                        data-size="small"
                        data-type="quaternary"
                        type="button"
                        aria-label="Sort by published status"
                        onClick={() => changeSort('status')}
                      >
                        <span
                          className="diet-icon diet-icon-mask"
                          data-size="12"
                          style={{
                            '--diet-icon-source': `url("/dieter/icons/svg/${sort.key === 'status'
                              ? sort.direction === 'ascending' ? 'chevron.up.2.svg' : 'chevron.down.2.svg'
                              : 'chevron.down.dotted.2.svg'}")`,
                          } as CSSProperties}
                          aria-hidden="true"
                        />
                      </button>
                    </th>
                    <th className="label-s" scope="col">Instance ID</th>
                    <th className="label-s diet-table__cell--action" scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedInstances.map((instance) => {
                    const instanceName = instance.displayName || DEFAULT_INSTANCE_DISPLAY_NAME;
                    const widgetDisplayName = catalogByWidgetType.get(instance.widgetType)!.displayName;
                    const isSelected = selectedInstanceId === instance.instanceId;
                    const renameActionKey = `rename:${instance.instanceId}`;
                    const publicationActionKey = `publication:${instance.instanceId}`;
                    const isRenaming = renamingInstanceId === instance.instanceId;
                    const rowActionsDisabled = Boolean(activeActionKey) || isRenaming;
                    const actionsOpen = openWidgetActions?.instanceId === instance.instanceId;
                    const secondaryActionStatus = activeActionKey === `duplicate:${instance.instanceId}`
                      ? 'Duplicating…'
                      : activeActionKey === `delete:${instance.instanceId}`
                        ? 'Deleting…'
                        : null;
                    return (
                      <tr key={instance.instanceId} data-selected={isSelected ? 'true' : undefined} aria-current={isSelected ? 'true' : undefined}>
                        <td className="body-s">{widgetDisplayName}</td>
                        <th className="body-s" scope="row">
                          {isRenaming ? (
                            <div className="roma-instance-rename">
                              <DieterTextfield
                                className="roma-instance-rename__input"
                                type="text"
                                aria-label="Instance name"
                                value={renameDraft}
                                maxLength={120}
                                onChange={(event) => setRenameDraft(event.target.value)}
                                onKeyDown={(event) => {
                                  if (event.key === 'Enter') {
                                    event.preventDefault();
                                    void handleRenameInstance(instance);
                                  }
                                  if (event.key === 'Escape') {
                                    event.preventDefault();
                                    cancelRename();
                                  }
                                }}
                                autoFocus
                              />
                              <div className="roma-instance-rename__actions">
                                <button
                                  className="diet-button"
                                  data-size="medium"
                                  data-type="quaternary"
                                  type="button"
                                  onClick={cancelRename}
                                  disabled={Boolean(activeActionKey)}
                                >
                                  <span className="diet-button__label">Cancel</span>
                                </button>
                                <button
                                  className="diet-button"
                                  data-size="medium"
                                  data-type="primary"
                                  type="button"
                                  onClick={() => void handleRenameInstance(instance)}
                                  disabled={Boolean(activeActionKey)}
                                >
                                  <span className="diet-button__label">{activeActionKey === renameActionKey ? 'Renaming...' : 'Rename'}</span>
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              {instanceName}
                              {isSelected ? ' (selected)' : ''}
                            </>
                          )}
                        </th>
                        <td className="body-s">
                          <WidgetPublicationControls
                            instance={instance}
                            disabled={rowActionsDisabled}
                            onPendingChange={(pending) => {
                              setActiveActionKey((current) => pending
                                ? current ?? publicationActionKey
                                : current === publicationActionKey ? null : current);
                            }}
                            onInstanceChange={(next) => {
                              setWidgetInstances((current) => current.map((entry) =>
                                entry.instanceId === next.instanceId ? next : entry));
                            }}
                          />
                        </td>
                        <td className="body-s">
                          <span className="body-xs roma-widget-instance-id">{instance.instanceId}</span>
                        </td>
                        <td className="body-s diet-table__cell--action">
                          {canMutateWidgets ? (
                            <div className="roma-cell-actions">
                              {rowActionsDisabled ? (
                                <span
                                  className="diet-button"
                                  data-size="medium"
                                  data-type="tertiary"
                                  aria-disabled="true"
                                >
                                  <span className="diet-button__label">Edit</span>
                                </span>
                              ) : (
                                <Link
                                  href={buildBuilderRoute({
                                    instanceId: instance.instanceId,
                                  })}
                                  className="diet-button"
                                  data-size="medium"
                                  data-type="tertiary"
                                >
                                  <span className="diet-button__label">Edit</span>
                                </Link>
                              )}
                              {secondaryActionStatus ? (
                                <span className="body-xs roma-widget-action-status" role="status">{secondaryActionStatus}</span>
                              ) : null}
                              <button
                                className="diet-button"
                                data-size="medium"
                                data-type="quaternary"
                                type="button"
                                aria-label={`More actions for ${instanceName}`}
                                aria-haspopup="menu"
                                aria-controls="roma-widget-actions-menu"
                                aria-expanded={actionsOpen}
                                disabled={rowActionsDisabled}
                                onClick={(event) => {
                                  if (actionsOpen) {
                                    closeWidgetActions();
                                    return;
                                  }
                                  widgetActionsTriggerRef.current = event.currentTarget;
                                  setOpenWidgetActions({ instanceId: instance.instanceId, position: null });
                                }}
                              >
                                <Image className="diet-icon" src="/dieter/icons/svg/ellipsis.svg" alt="" width={16} height={16} aria-hidden="true" />
                              </button>
                            </div>
                          ) : (
                            <span className="body-s">View only</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                </table>
              </div>
            ) : null}
          </>
        ) : !domainLoading && canRenderWidgetData ? (
          displayedCatalog.length > 0 ? (
            <section className="rd-canvas-module">
              <div className="roma-grid roma-grid--three">
                {displayedCatalog.map((option) => {
                  return (
                    <article className="roma-card" key={option.widgetType}>
                      <h2 className="heading-4">{option.displayName}</h2>
                      {option.description ? <p className="body-s">{option.description}</p> : null}
                      {canMutateWidgets ? (
                        <div className="rd-canvas-module__actions">
                          <button
                            className="diet-button"
                            data-size="medium"
                            data-type="primary"
                            type="button"
                            onClick={() => void handleCreateInstance(option.widgetType)}
                            disabled={Boolean(activeActionKey)}
                          >
                            <span className="diet-button__label">
                              Create instance
                            </span>
                          </button>
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            </section>
          ) : (
            <section className="rd-canvas-module">
              <p className="body-m">No widget types available.</p>
            </section>
          )
        ) : null}

      {view === 'your-widgets' && openWidgetActions && openWidgetActionsInstance && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={widgetActionsPopoverRef}
              id="roma-widget-actions-menu"
              className="diet-popover roma-widget-actions-popover"
              role="menu"
              aria-label={`Actions for ${openWidgetActionsInstance.displayName || DEFAULT_INSTANCE_DISPLAY_NAME}`}
              data-positioned={openWidgetActions.position ? 'true' : 'false'}
              style={{
                top: openWidgetActions.position?.top ?? 0,
                left: openWidgetActions.position?.left ?? 0,
              }}
            >
              <button
                className="diet-btn-menuactions"
                data-size="md"
                type="button"
                role="menuitem"
                onClick={() => {
                  closeWidgetActions();
                  startRename(openWidgetActionsInstance);
                }}
              >
                <span className="diet-btn-menuactions__label">Rename</span>
              </button>
              <button
                className="diet-btn-menuactions"
                data-size="md"
                type="button"
                role="menuitem"
                onClick={() => {
                  closeWidgetActions(true);
                  void handleDuplicateInstance(openWidgetActionsInstance);
                }}
              >
                <span className="diet-btn-menuactions__label">Duplicate</span>
              </button>
              <button
                className="diet-btn-menuactions"
                data-size="md"
                type="button"
                role="menuitem"
                onClick={() => {
                  closeWidgetActions(true);
                  void handleDeleteInstance(openWidgetActionsInstance);
                }}
              >
                <span className="diet-btn-menuactions__label">Delete</span>
              </button>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
