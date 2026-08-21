'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import widgetsCopy from '../l10n/widgets/en.json';
import ROMA_DIALOGS_UI_COPY from '../l10n/dialogs/en.json';
import { useRomaAccountApi } from './account-api';
import { DieterDropdownActions } from './dieter-dropdown-actions';
import { DieterTextfield } from './dieter-textfield';
import { prefetchWidgetEditorArtifact } from './widget-editor-artifact';
import { RomaAccountNoticeModal } from './roma-account-notice-modal';
import { RomaCommandConfirmationDialog } from './roma-command-confirmation-dialog';
import { useRomaAccountContext } from './roma-account-context';
import { RomaDomainErrorBoundary } from './roma-domain-error-boundary';
import { RomaShell } from './roma-shell';
import { RomaEmptyState, RomaLoadingState } from './roma-system-state';
import { WidgetPublicationControls } from './widget-publication-controls';
import {
  buildBuilderRoute,
  buildNewBuilderRoute,
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

export function WidgetsPage({ view }: { view: WidgetsView }) {
  const [statusFilter, setStatusFilter] = useState<WidgetStatusFilter>('all');

  return (
    <RomaShell
      activeDomain={view === 'catalog' ? 'widgetCatalog' : 'widgets'}
      title={widgetsCopy.title}
      headerControls={view === 'your-widgets' ? (
        <DieterDropdownActions
          className="roma-header-filter"
          ariaLabel={widgetsCopy.filter}
          triggerStyle="button"
          value={statusFilter}
          options={[
            { value: 'all', label: widgetsCopy.filters.all },
            { value: 'published', label: widgetsCopy.filters.published },
            { value: 'unpublished', label: widgetsCopy.filters.unpublished },
          ]}
          onChange={(value) => setStatusFilter(value as WidgetStatusFilter)}
        />
      ) : null}
    >
      <RomaAccountNoticeModal />
      <Suspense fallback={<RomaLoadingState className="rd-canvas-module" />}>
        <RomaDomainErrorBoundary domainLabel={widgetsCopy.title} resetKey="widgets">
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
  const [widgetInstances, setWidgetInstances] = useState<WidgetInstance[]>(() => cachedWidgets?.data.instances ?? []);
  const [catalog, setCatalog] = useState<WidgetCatalogOption[]>(() => cachedWidgets?.data.catalog ?? []);
  const [domainLoading, setDomainLoading] = useState(() => !cachedWidgets);
  const [domainRefreshing, setDomainRefreshing] = useState(false);
  const [dataFailed, setDataFailed] = useState(false);
  const [renamingInstanceId, setRenamingInstanceId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [deleteConfirmationInstance, setDeleteConfirmationInstance] = useState<WidgetInstance | null>(null);
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

  const refreshWidgets = useCallback(async (args?: { force?: boolean; command?: boolean }) => {
    const force = args?.force === true;
    const command = args?.command === true;
    const cached = readRomaWidgetsCache(productAccountId);

    if (command) {
      setDomainRefreshing(true);
    } else if (!force && cached) {
      applyWidgets(cached.data);
      setDomainLoading(false);
      setDataFailed(false);
      if (isRomaWidgetsCacheFresh(cached)) return;
      setDomainRefreshing(true);
    } else {
      setDomainLoading(true);
    }
    if (!command) setDataFailed(false);
    try {
      const normalized = await loadRomaWidgetsForAccount({
        accountId: productAccountId,
        fetchJson: accountApi.fetchJson,
        force,
      });
      applyWidgets(normalized);
      setDataFailed(false);
    } catch {
      if (!cached) setWidgetInstances([]);
      setDataFailed(true);
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
  const canRenderWidgetData = !dataFailed || catalog.length > 0 || widgetInstances.length > 0;
  const initialDataLoading = domainLoading && catalog.length === 0 && widgetInstances.length === 0 && !dataFailed;
  const showingInitialWidgetsLoading = view === 'your-widgets' && initialDataLoading;

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
        const nameOrder = left.displayName === right.displayName
          ? 0
          : left.displayName === null
            ? 1
            : right.displayName === null
              ? -1
              : left.displayName.localeCompare(right.displayName);
        const primary = sort.key === 'widget'
          ? catalogByWidgetType.get(left.widgetType)!.displayName.localeCompare(
              catalogByWidgetType.get(right.widgetType)!.displayName,
            )
          : sort.key === 'name'
            ? nameOrder
            : left.status.localeCompare(right.status);
        if (primary !== 0) return sort.direction === 'ascending' ? primary : -primary;
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
      if (!canMutateWidgets) return;
      router.push(buildNewBuilderRoute(widgetType));
    },
    [canMutateWidgets, router],
  );

  const handleDuplicateInstance = useCallback(
    async (instance: WidgetInstance) => {
      if (!canMutateWidgets) return false;
      const actionKey = `duplicate:${instance.instanceId}`;
      setActiveActionKey(actionKey);
      try {
        const { instanceId: duplicatedInstanceId } = await accountApi.fetchJson<{ instanceId: string }>(`/api/account/instances/${encodeURIComponent(instance.instanceId)}/duplicate`, {
          method: 'POST',
        });
        void refreshWidgets({ force: true });
        router.push(buildBuilderRoute({ instanceId: duplicatedInstanceId }));
      } catch {
      } finally {
        setActiveActionKey((current) => (current === actionKey ? null : current));
      }
    },
    [accountApi, canMutateWidgets, refreshWidgets, router],
  );

  const handleDeleteInstance = useCallback(
    async (instance: WidgetInstance) => {
      if (!canMutateWidgets) return;
      const actionKey = `delete:${instance.instanceId}`;
      setActiveActionKey(actionKey);
      try {
        await accountApi.fetchJson<{ deleted?: boolean }>(`/api/account/instances/${encodeURIComponent(instance.instanceId)}`, {
          method: 'DELETE',
        });
        setDeleteConfirmationInstance(null);
        void refreshWidgets({ force: true });
        return true;
      } catch {
        return false;
      } finally {
        setActiveActionKey((current) => (current === actionKey ? null : current));
      }
    },
    [accountApi, canMutateWidgets, refreshWidgets],
  );

  const startRename = useCallback((instance: WidgetInstance) => {
    if (!canMutateWidgets) return;
    setRenamingInstanceId(instance.instanceId);
    setRenameDraft(instance.displayName ?? '');
  }, [canMutateWidgets]);

  const cancelRename = useCallback(() => {
    setRenamingInstanceId(null);
    setRenameDraft('');
  }, []);

  const handleRenameInstance = useCallback(
    async (instance: WidgetInstance) => {
      if (!canMutateWidgets) return;
      if (renameDraft === instance.displayName) {
        cancelRename();
        return;
      }
      const actionKey = `rename:${instance.instanceId}`;
      setActiveActionKey(actionKey);
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
          body: JSON.stringify({ displayName: renameDraft }),
        });
        const resolvedDisplayName = payload.displayName;
        setWidgetInstances((prev) => prev.map((entry) => (entry.instanceId === instance.instanceId ? { ...entry, displayName: resolvedDisplayName, updatedAt: payload.updatedAt } : entry)));
        updateRomaWidgetsCache(productAccountId, (current) => ({
          ...current,
          instances: current.instances.map((entry) => (entry.instanceId === instance.instanceId ? { ...entry, displayName: resolvedDisplayName, updatedAt: payload.updatedAt } : entry)),
        }));
        cancelRename();
      } catch {
      } finally {
        setActiveActionKey((current) => (current === actionKey ? null : current));
      }
    },
    [accountApi, canMutateWidgets, productAccountId, cancelRename, renameDraft],
  );

  return (
    <>
      {dataFailed ? (
        <section className="rd-canvas-module" role="alert">
            <div className="roma-inline-stack">
              <button
                className="diet-button"
                data-size="medium"
                data-type="tertiary"
                data-loading={domainRefreshing || undefined}
                type="button"
                aria-busy={domainRefreshing || undefined}
                onClick={() => void refreshWidgets({ force: true, command: true })}
                disabled={domainRefreshing}
              >
                {domainRefreshing ? <span className="diet-spinner" aria-hidden="true" /> : null}
                <span className="diet-button__label">{ROMA_DIALOGS_UI_COPY.retry}</span>
              </button>
            </div>
        </section>
      ) : null}

      {view === 'catalog' && initialDataLoading ? <RomaLoadingState className="rd-canvas-module" /> : null}

      {view === 'your-widgets' ? (
          <>
            {!domainLoading && canRenderWidgetData && widgetInstances.length === 0 ? (
              <RomaEmptyState className="rd-canvas-module">
                {widgetsCopy.empty}
              </RomaEmptyState>
            ) : null}

            {!domainLoading && canRenderWidgetData && statusFilter !== 'all' && widgetInstances.length > 0 && displayedInstances.length === 0 ? (
              <RomaEmptyState className="rd-canvas-module">
                {widgetsCopy.filteredEmpty}
              </RomaEmptyState>
            ) : null}

            {showingInitialWidgetsLoading || (displayedInstances.length > 0 && canRenderWidgetData) ? (
              <div className="diet-table">
                <table className="diet-table__table">
                <caption className="sr-only">{widgetsCopy.table}</caption>
                <thead>
                  <tr>
                    <th className="label-s" scope="col" aria-sort={sort.key === 'widget' ? sort.direction : 'none'}>
                      <span>{widgetsCopy.columns.widget}</span>{' '}
                      <button
                        className="diet-button"
                        data-size="small"
                        data-type="quaternary"
                        type="button"
                        aria-label={widgetsCopy.sort.widget}
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
                      <span>{widgetsCopy.columns.instanceName}</span>{' '}
                      <button
                        className="diet-button"
                        data-size="small"
                        data-type="quaternary"
                        type="button"
                        aria-label={widgetsCopy.sort.instanceName}
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
                      <span>{widgetsCopy.columns.published}</span>{' '}
                      <button
                        className="diet-button"
                        data-size="small"
                        data-type="quaternary"
                        type="button"
                        aria-label={widgetsCopy.sort.published}
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
                    <th className="label-s" scope="col">{widgetsCopy.columns.instanceId}</th>
                    <th className="label-s diet-table__cell--action" scope="col">{widgetsCopy.columns.actions}</th>
                  </tr>
                </thead>
                <tbody>
                  {showingInitialWidgetsLoading ? (
                    <tr>
                      <td className="diet-data-table__state-cell" colSpan={5}>
                        <RomaLoadingState />
                      </td>
                    </tr>
                  ) : displayedInstances.map((instance) => {
                    const instanceName = instance.displayName;
                    const widgetDisplayName = catalogByWidgetType.get(instance.widgetType)!.displayName;
                    const isSelected = selectedInstanceId === instance.instanceId;
                    const renameActionKey = `rename:${instance.instanceId}`;
                    const publicationActionKey = `publication:${instance.instanceId}`;
                    const isRenaming = renamingInstanceId === instance.instanceId;
                    const rowActionsDisabled = Boolean(activeActionKey) || isRenaming;
                    const actionsOpen = openWidgetActions?.instanceId === instance.instanceId;
                    const secondaryActionPending = activeActionKey === `duplicate:${instance.instanceId}`;
                    return (
                      <tr key={instance.instanceId} data-selected={isSelected ? 'true' : undefined} aria-current={isSelected ? 'true' : undefined}>
                        <td className="body-s">{widgetDisplayName}</td>
                        <th className="body-s" scope="row">
                          {isRenaming ? (
                            <div className="roma-instance-rename">
                              <DieterTextfield
                                className="roma-instance-rename__input"
                                type="text"
                                aria-label={widgetsCopy.columns.instanceName}
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
                                  <span className="diet-button__label">{widgetsCopy.cancel}</span>
                                </button>
                                <button
                                  className="diet-button"
                                  data-size="medium"
                                  data-type="primary"
                                  data-loading={activeActionKey === renameActionKey || undefined}
                                  type="button"
                                  aria-busy={activeActionKey === renameActionKey || undefined}
                                  onClick={() => void handleRenameInstance(instance)}
                                  disabled={Boolean(activeActionKey)}
                                >
                                  {activeActionKey === renameActionKey ? <span className="diet-spinner" aria-hidden="true" /> : null}
                                  <span className="diet-button__label">{activeActionKey === renameActionKey ? widgetsCopy.renaming : widgetsCopy.rename}</span>
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              {instanceName ?? null}
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
                                  <span className="diet-button__label">{widgetsCopy.edit}</span>
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
                                  <span className="diet-button__label">{widgetsCopy.edit}</span>
                                </Link>
                              )}
                              <button
                                className="diet-button"
                                data-size="medium"
                                data-type="quaternary"
                                data-loading={secondaryActionPending || undefined}
                                type="button"
                                aria-label={instanceName ? widgetsCopy.moreActionsFor.replace('{name}', instanceName) : widgetsCopy.moreActions}
                                aria-busy={secondaryActionPending || undefined}
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
                                {secondaryActionPending ? (
                                  <span className="diet-spinner" aria-hidden="true" />
                                ) : (
                                  <Image className="diet-icon" src="/dieter/icons/svg/ellipsis.svg" alt="" width={16} height={16} aria-hidden="true" />
                                )}
                              </button>
                            </div>
                          ) : (
                            <span className="body-s">{widgetsCopy.viewOnly}</span>
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
                              {widgetsCopy.create}
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
            <RomaEmptyState className="rd-canvas-module">
              {widgetsCopy.catalogEmpty}
            </RomaEmptyState>
          )
        ) : null}

      {view === 'your-widgets' && openWidgetActions && openWidgetActionsInstance && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={widgetActionsPopoverRef}
              id="roma-widget-actions-menu"
              className="diet-popover roma-widget-actions-popover"
              role="menu"
              aria-label={openWidgetActionsInstance.displayName
                ? widgetsCopy.actionsFor.replace('{name}', openWidgetActionsInstance.displayName)
                : widgetsCopy.widgetActions}
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
                <span className="diet-btn-menuactions__label">{widgetsCopy.rename}</span>
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
                <span className="diet-btn-menuactions__label">{widgetsCopy.duplicate}</span>
              </button>
              <button
                className="diet-btn-menuactions"
                data-size="md"
                type="button"
                role="menuitem"
                onClick={() => {
                  closeWidgetActions();
                  setDeleteConfirmationInstance(openWidgetActionsInstance);
                }}
              >
                <span className="diet-btn-menuactions__label">{widgetsCopy.delete}</span>
              </button>
            </div>,
            document.body,
          )
        : null}
      <RomaCommandConfirmationDialog
        open={Boolean(deleteConfirmationInstance)}
        title={widgetsCopy.deleteWidget}
        body={deleteConfirmationInstance?.displayName}
        confirmLabel={widgetsCopy.deleteWidget}
        pending={Boolean(deleteConfirmationInstance && activeActionKey === `delete:${deleteConfirmationInstance.instanceId}`)}
        onCancel={() => setDeleteConfirmationInstance(null)}
        onConfirm={() => {
          const instance = deleteConfirmationInstance;
          if (instance) void handleDeleteInstance(instance);
        }}
      />
    </>
  );
}
