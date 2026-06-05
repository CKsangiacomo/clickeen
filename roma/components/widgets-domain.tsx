'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { resolveAccountShellErrorCopy } from '../lib/account-shell-copy';
import { useRomaAccountApi } from './account-api';
import { prefetchCompiledWidget } from './compiled-widget-cache';
import { useRomaAccountContext } from './roma-account-context';
import {
  buildBuilderRoute,
  DEFAULT_INSTANCE_DISPLAY_NAME,
  isRomaWidgetsCacheFresh,
  loadRomaWidgetsForAccount,
  readRomaWidgetsCache,
  updateRomaWidgetsCache,
  type RomaWidgetsResponse,
  type SystemWidgetOption,
  type WidgetInstance,
} from './use-roma-widgets';

type WidgetInstanceGroup = SystemWidgetOption & {
  instances: WidgetInstance[];
};

export function WidgetsDomain() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { accountContext } = useRomaAccountContext();
  const accountApi = useRomaAccountApi();
  const productAccountId = accountContext.accountPublicId;
  const cachedWidgets = readRomaWidgetsCache(productAccountId);

  const [activeActionKey, setActiveActionKey] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [widgetInstances, setWidgetInstances] = useState<WidgetInstance[]>(() => cachedWidgets?.data.instances ?? []);
  const [systemWidgets, setSystemWidgets] = useState<SystemWidgetOption[]>(() => cachedWidgets?.data.systemWidgets ?? []);
  const [domainLoading, setDomainLoading] = useState(() => !cachedWidgets);
  const [domainRefreshing, setDomainRefreshing] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [renamingInstanceId, setRenamingInstanceId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [renameError, setRenameError] = useState<string | null>(null);

  const selectedInstanceId = useMemo(() => (searchParams.get('selected') || '').trim(), [searchParams]);

  const applyWidgets = useCallback((widgets: RomaWidgetsResponse) => {
    setWidgetInstances(widgets.instances);
    setSystemWidgets(widgets.systemWidgets);
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
      setSystemWidgets([]);
      setDomainLoading(true);
    }
    void refreshWidgets();
  }, [productAccountId, applyWidgets, refreshWidgets]);

  const instanceWidgetTypes = useMemo(
    () => Array.from(new Set(widgetInstances.map((instance) => instance.widgetType))).sort((a, b) => a.localeCompare(b)),
    [widgetInstances],
  );
  const missingSystemWidgetTypes = useMemo(() => {
    const systemWidgetTypeSet = new Set(systemWidgets.map((option) => option.widgetType));
    return instanceWidgetTypes.filter((widgetType) => !systemWidgetTypeSet.has(widgetType));
  }, [instanceWidgetTypes, systemWidgets]);
  const widgetDataError = missingSystemWidgetTypes.length
    ? `Widget data is invalid: account instances reference unavailable system widgets (${missingSystemWidgetTypes.join(', ')}).`
    : dataError;

  const groupedInstances = useMemo<WidgetInstanceGroup[]>(() => {
    const groups = new Map<string, WidgetInstanceGroup>();

    systemWidgets.forEach((option) => {
      groups.set(option.widgetType, {
        ...option,
        instances: [],
      });
    });

    widgetInstances.forEach((instance) => {
      const widgetType = instance.widgetType;
      const group = groups.get(widgetType);
      if (group) {
        group.instances.push(instance);
      }
    });

    return Array.from(groups.values())
      .map((group) => ({
        ...group,
        instances: group.instances.slice().sort((a, b) => a.instanceId.localeCompare(b.instanceId)),
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [systemWidgets, widgetInstances]);

  useEffect(() => {
    const candidates = instanceWidgetTypes.slice(0, 8);
    candidates.forEach((widgetType) => {
      void prefetchCompiledWidget(widgetType);
    });
  }, [instanceWidgetTypes]);

  const handleCreateInstance = useCallback(
    async (widgetType: string) => {
      if (!productAccountId) return;
      const actionKey = `create:${widgetType}`;
      setActiveActionKey(actionKey);
      setMutationError(null);
      try {
        const payload = await accountApi.fetchJson<{
          instanceId?: string;
          widgetType?: string;
        }>('/api/account/instances', {
          method: 'POST',
          headers: accountApi.buildHeaders({ contentType: 'application/json' }),
          body: JSON.stringify({ widgetType }),
        });
        const createdInstanceId = typeof payload.instanceId === 'string' ? payload.instanceId.trim() : '';
        if (!createdInstanceId) {
          throw new Error('coreui.errors.payload.invalid');
        }
        await refreshWidgets({ force: true });
        router.push(buildBuilderRoute({ instanceId: createdInstanceId, widgetType }));
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setMutationError(resolveAccountShellErrorCopy(message, 'Creating the widget failed. Please try again.'));
      } finally {
        setActiveActionKey((current) => (current === actionKey ? null : current));
      }
    },
    [accountApi, productAccountId, refreshWidgets, router],
  );

  const handleDuplicateInstance = useCallback(
    async (instance: WidgetInstance) => {
      if (!productAccountId) return;
      const actionKey = `duplicate:${instance.instanceId}`;
      setActiveActionKey(actionKey);
      setMutationError(null);
      try {
        const payload = await accountApi.fetchJson<{
          instanceId?: string;
          widgetType?: string;
        }>(`/api/account/instances/${encodeURIComponent(instance.instanceId)}/duplicate`, {
          method: 'POST',
        });
        const duplicatedInstanceId = payload && typeof payload.instanceId === 'string' && payload.instanceId.trim() ? payload.instanceId.trim() : '';
        if (!duplicatedInstanceId) {
          throw new Error('coreui.errors.payload.invalid');
        }
        await refreshWidgets({ force: true });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setMutationError(resolveAccountShellErrorCopy(message, 'Duplicating the widget failed. Please try again.'));
      } finally {
        setActiveActionKey((current) => (current === actionKey ? null : current));
      }
    },
    [accountApi, productAccountId, refreshWidgets],
  );

  const handleDeleteInstance = useCallback(
    async (instance: WidgetInstance) => {
      if (!productAccountId) return;
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
    [accountApi, productAccountId, refreshWidgets],
  );

  const handleStatusChange = useCallback(
    async (instance: WidgetInstance, nextStatus: 'published' | 'unpublished') => {
      if (!productAccountId) return;
      const actionKey = `${nextStatus}:${instance.instanceId}`;
      setActiveActionKey(actionKey);
      setMutationError(null);
      try {
        await accountApi.fetchJson<{ status?: 'published' | 'unpublished' }>(
          `/api/account/instances/${encodeURIComponent(instance.instanceId)}/${nextStatus === 'published' ? 'publish' : 'unpublish'}`,
          {
            method: 'POST',
          },
        );
        await refreshWidgets({ force: true });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setMutationError(resolveAccountShellErrorCopy(message, 'Updating widget status failed. Please try again.'));
      } finally {
        setActiveActionKey((current) => (current === actionKey ? null : current));
      }
    },
    [accountApi, productAccountId, refreshWidgets],
  );

  const startRename = useCallback((instance: WidgetInstance) => {
    if (!instance.actions.rename) return;
    setMutationError(null);
    setRenameError(null);
    setRenamingInstanceId(instance.instanceId);
    setRenameDraft(instance.displayName || DEFAULT_INSTANCE_DISPLAY_NAME);
  }, []);

  const cancelRename = useCallback(() => {
    setRenamingInstanceId(null);
    setRenameDraft('');
    setRenameError(null);
  }, []);

  const handleRenameInstance = useCallback(
    async (instance: WidgetInstance) => {
      if (!productAccountId || !instance.actions.rename) return;
      const nextDisplayName = renameDraft.trim();
      if (!nextDisplayName) {
        setRenameError('Instance name cannot be empty.');
        return;
      }
      if (nextDisplayName === instance.displayName.trim()) {
        cancelRename();
        return;
      }
      const actionKey = `rename:${instance.instanceId}`;
      setActiveActionKey(actionKey);
      setMutationError(null);
      setRenameError(null);
      try {
        const payload = await accountApi.fetchJson<{
          instanceId?: string;
          displayName?: string;
        }>(`/api/account/instances/${encodeURIComponent(instance.instanceId)}/rename`, {
          method: 'POST',
          headers: accountApi.buildHeaders({
            contentType: 'application/json',
          }),
          body: JSON.stringify({ displayName: nextDisplayName }),
        });
        const resolvedDisplayName = typeof payload.displayName === 'string' && payload.displayName.trim() ? payload.displayName.trim() : nextDisplayName;
        setWidgetInstances((prev) => prev.map((entry) => (entry.instanceId === instance.instanceId ? { ...entry, displayName: resolvedDisplayName } : entry)));
        updateRomaWidgetsCache(productAccountId, (current) => ({
          ...current,
          instances: current.instances.map((entry) => (entry.instanceId === instance.instanceId ? { ...entry, displayName: resolvedDisplayName } : entry)),
        }));
        cancelRename();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setRenameError(resolveAccountShellErrorCopy(message, 'Renaming the widget failed. Please try again.'));
      } finally {
        setActiveActionKey((current) => (current === actionKey ? null : current));
      }
    },
    [accountApi, productAccountId, cancelRename, renameDraft],
  );

  return (
    <>
      {widgetDataError || mutationError || renameError || (domainLoading && groupedInstances.length === 0) ? (
        <section className="rd-canvas-module">
          {widgetDataError ? (
            <div className="roma-inline-stack">
              <p className="body-m">{widgetDataError}</p>
              <button className="diet-btn-txt" data-size="md" data-variant="line2" type="button" onClick={() => void refreshWidgets({ force: true })} disabled={domainLoading || domainRefreshing}>
                <span className="diet-btn-txt__label body-m">Retry</span>
              </button>
            </div>
          ) : null}
          {mutationError ? <p className="body-m">{mutationError}</p> : null}
          {renameError ? <p className="body-m">{renameError}</p> : null}

          {domainLoading && groupedInstances.length === 0 && !widgetDataError ? <p className="body-m">Loading widgets...</p> : null}
        </section>
      ) : null}

      {!domainLoading && !widgetDataError && groupedInstances.length === 0 ? (
        <section className="rd-canvas-module">
          <p className="body-m">No widget types available.</p>
        </section>
      ) : null}

      {groupedInstances.map((group) => {
        const createActionKey = `create:${group.widgetType}`;
        const createTitle = group.disabledReasonKey
          ? resolveAccountShellErrorCopy(group.disabledReasonKey, 'This widget is not available on the current account plan.')
          : group.description || undefined;
        return (
          <section className="rd-canvas-module" key={group.widgetType}>
            <div className="roma-toolbar">
              <h2 className="heading-4">{group.label}</h2>
              <p className="body-m roma-toolbar-count">
                {group.instances.length} {group.instances.length === 1 ? 'instance' : 'instances'}
              </p>
            </div>

            <table className="roma-table">
              <thead>
                <tr>
                  <th className="table-header label-s">Instance</th>
                  <th className="table-header label-s">Instance ID</th>
                  <th className="table-header label-s">Status</th>
                  <th className="table-header label-s">Actions</th>
                </tr>
              </thead>
              <tbody>
                {group.instances.map((instance) => {
                  const duplicateActionKey = `duplicate:${instance.instanceId}`;
                  const deleteActionKey = `delete:${instance.instanceId}`;
                  const publishActionKey = `published:${instance.instanceId}`;
                  const unpublishActionKey = `unpublished:${instance.instanceId}`;
                  const canEdit = instance.actions.edit;
                  const canDuplicate = instance.actions.duplicate;
                  const canDelete = instance.actions.delete;
                  const canRename = instance.actions.rename;
                  const canPublish = instance.actions.publish;
                  const canUnpublish = instance.actions.unpublish;
                  const isSelected = selectedInstanceId === instance.instanceId;
                  const renameActionKey = `rename:${instance.instanceId}`;
                  const isRenaming = renamingInstanceId === instance.instanceId;
                  return (
                    <tr key={instance.instanceId} data-selected={isSelected ? 'true' : undefined}>
                      <td className="body-s">
                        {isRenaming ? (
                          <div className="roma-instance-rename">
                            <input
                              className="roma-instance-rename__input body-s"
                              type="text"
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
                                className="diet-btn-txt"
                                data-size="md"
                                data-variant="neutral"
                                type="button"
                                onClick={() => cancelRename()}
                                disabled={Boolean(activeActionKey)}
                              >
                                <span className="diet-btn-txt__label body-m">Cancel</span>
                              </button>
                              <button
                                className="diet-btn-txt"
                                data-size="md"
                                data-variant="primary"
                                type="button"
                                onClick={() => void handleRenameInstance(instance)}
                                disabled={Boolean(activeActionKey)}
                              >
                                <span className="diet-btn-txt__label body-m">{activeActionKey === renameActionKey ? 'Renaming...' : 'Rename'}</span>
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            {instance.displayName || DEFAULT_INSTANCE_DISPLAY_NAME}
                            {isSelected ? ' (selected)' : ''}
                          </>
                        )}
                      </td>
                      <td className="body-s">{instance.instanceId}</td>
                      <td className="body-s">{instance.status === 'published' ? 'Published' : 'Unpublished'}</td>
                      <td className="roma-cell-actions">
                        {canEdit ? (
                          <Link
                            href={buildBuilderRoute({
                              instanceId: instance.instanceId,
                              widgetType: instance.widgetType,
                            })}
                            className="diet-btn-txt"
                            data-size="md"
                            data-variant="line2"
                          >
                            <span className="diet-btn-txt__label body-m">Edit</span>
                          </Link>
                        ) : (
                          <button className="diet-btn-txt" data-size="md" data-variant="line2" type="button" disabled>
                            <span className="diet-btn-txt__label body-m">Edit</span>
                          </button>
                        )}
                        {instance.status === 'published' && canUnpublish ? (
                          <button
                            className="diet-btn-txt"
                            data-size="md"
                            data-variant="secondary"
                            type="button"
                            onClick={() => void handleStatusChange(instance, 'unpublished')}
                            disabled={Boolean(activeActionKey) || !canUnpublish}
                          >
                            <span className="diet-btn-txt__label body-m">{activeActionKey === unpublishActionKey ? 'Unpublishing...' : 'Unpublish'}</span>
                          </button>
                        ) : null}
                        {instance.status === 'unpublished' && canPublish ? (
                          <button
                            className="diet-btn-txt"
                            data-size="md"
                            data-variant="primary"
                            type="button"
                            onClick={() => void handleStatusChange(instance, 'published')}
                            disabled={Boolean(activeActionKey) || !canPublish}
                          >
                            <span className="diet-btn-txt__label body-m">{activeActionKey === publishActionKey ? 'Publishing...' : 'Publish'}</span>
                          </button>
                        ) : null}
                        {canRename ? (
                          <button
                            className="diet-btn-txt"
                            data-size="md"
                            data-variant="secondary"
                            type="button"
                            onClick={() => startRename(instance)}
                            disabled={Boolean(activeActionKey) || isRenaming}
                          >
                            <span className="diet-btn-txt__label body-m">Rename</span>
                          </button>
                        ) : null}
                        <button
                          className="diet-btn-txt"
                          data-size="md"
                          data-variant="secondary"
                          type="button"
                          onClick={() => handleDuplicateInstance(instance)}
                          disabled={Boolean(activeActionKey) || !canDuplicate}
                        >
                          <span className="diet-btn-txt__label body-m">{activeActionKey === duplicateActionKey ? 'Duplicating...' : 'Duplicate'}</span>
                        </button>
                        <button
                          className="diet-btn-txt"
                          data-size="md"
                          data-variant="line2"
                          type="button"
                          onClick={() => handleDeleteInstance(instance)}
                          disabled={Boolean(activeActionKey) || !canDelete}
                        >
                          <span className="diet-btn-txt__label body-m">{activeActionKey === deleteActionKey ? 'Deleting...' : 'Delete'}</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {group.instances.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="body-s">
                      <div className="roma-cell-actions">
                        <span>No instances yet.</span>
                        <button
                          className="diet-btn-txt"
                          data-size="md"
                          data-variant="line2"
                          type="button"
                          onClick={() => void handleCreateInstance(group.widgetType)}
                          disabled={Boolean(activeActionKey) || !group.canCreate}
                          title={createTitle}
                        >
                          <span className="diet-btn-txt__label body-m">{activeActionKey === createActionKey ? 'Creating...' : 'Create instance'}</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </section>
        );
      })}
    </>
  );
}
