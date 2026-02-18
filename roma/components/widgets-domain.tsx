'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { prefetchCompiledWidget } from './compiled-widget-cache';
import { fetchParisJson } from './paris-http';
import { resolveDefaultRomaContext, useRomaMe } from './use-roma-me';
import {
  buildBuilderRoute,
  createUserInstancePublicId,
  DEFAULT_INSTANCE_DISPLAY_NAME,
  normalizeWidgetType,
  normalizeRomaWidgetsSnapshot,
  type WidgetInstance,
} from './use-roma-widgets';

type CreateInstanceArgs = {
  widgetType: string;
  openBuilder?: boolean;
  actionKey: string;
};

export function WidgetsDomain() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const me = useRomaMe();
  const context = useMemo(() => resolveDefaultRomaContext(me.data), [me.data]);
  const autoCreateStartedRef = useRef(false);

  const [activeActionKey, setActiveActionKey] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [widgetInstances, setWidgetInstances] = useState<WidgetInstance[]>([]);
  const [widgetTypes, setWidgetTypes] = useState<string[]>([]);
  const [accountIdFromSnapshot, setAccountIdFromSnapshot] = useState('');
  const [dataError, setDataError] = useState<string | null>(null);

  const workspaceId = context.workspaceId;
  const accountId = context.accountId;
  const searchIntent = useMemo(() => (searchParams.get('intent') || '').trim().toLowerCase(), [searchParams]);
  const searchWidgetType = useMemo(() => normalizeWidgetType(searchParams.get('widgetType')), [searchParams]);
  const activeAccountId = accountId || accountIdFromSnapshot;

  useEffect(() => {
    if (!workspaceId) {
      setWidgetInstances([]);
      setWidgetTypes([]);
      setAccountIdFromSnapshot('');
      setDataError(null);
      return;
    }
    const snapshot = normalizeRomaWidgetsSnapshot(me.data?.domains?.widgets ?? null);
    if (!snapshot || snapshot.workspaceId !== workspaceId) {
      setWidgetInstances([]);
      setWidgetTypes([]);
      setAccountIdFromSnapshot('');
      setDataError('Bootstrap widgets snapshot unavailable.');
      return;
    }
    setWidgetInstances(snapshot.instances);
    setWidgetTypes(snapshot.widgetTypes);
    setAccountIdFromSnapshot(snapshot.accountId);
    setDataError(null);
  }, [workspaceId, me.data?.domains?.widgets]);

  const availableWidgetTypes = useMemo(() => {
    const values = new Set<string>();
    widgetTypes.forEach((type) => {
      const normalized = normalizeWidgetType(type);
      if (normalized !== 'unknown') values.add(normalized);
    });
    widgetInstances.forEach((instance) => {
      if (instance.widgetType !== 'unknown') values.add(instance.widgetType);
    });
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [widgetInstances, widgetTypes]);

  const groupedInstances = useMemo(() => {
    const groups = new Map<string, WidgetInstance[]>();
    availableWidgetTypes.forEach((widgetType) => groups.set(widgetType, []));

    widgetInstances.forEach((instance) => {
      const widgetType = instance.widgetType;
      if (!groups.has(widgetType)) groups.set(widgetType, []);
      groups.get(widgetType)?.push(instance);
    });

    return Array.from(groups.entries())
      .map(([widgetType, instances]) => ({
        widgetType,
        instances: instances.slice().sort((a, b) => a.publicId.localeCompare(b.publicId)),
      }))
      .sort((a, b) => a.widgetType.localeCompare(b.widgetType));
  }, [availableWidgetTypes, widgetInstances]);

  useEffect(() => {
    const candidates = availableWidgetTypes.filter((widgetType) => widgetType !== 'unknown').slice(0, 8);
    candidates.forEach((widgetType) => {
      void prefetchCompiledWidget(widgetType);
    });
  }, [availableWidgetTypes]);

  const createInstance = useCallback(
    async ({ widgetType, openBuilder, actionKey }: CreateInstanceArgs) => {
      if (!workspaceId) return;
      const normalizedWidgetType = normalizeWidgetType(widgetType);
      if (normalizedWidgetType === 'unknown') {
        setCreateError('Widget type is required for this action.');
        return;
      }
      setActiveActionKey(actionKey);
      setCreateError(null);
      try {
        const publicId = createUserInstancePublicId(normalizedWidgetType);
        const payload = await fetchParisJson<{ publicId?: string }>(
          `/api/paris/workspaces/${encodeURIComponent(workspaceId)}/instances?subject=workspace`,
          {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
            },
            body: JSON.stringify({
              publicId,
              widgetType: normalizedWidgetType,
              displayName: DEFAULT_INSTANCE_DISPLAY_NAME,
              status: 'unpublished',
              config: {},
            }),
          },
        );
        const createdPublicId =
          payload && typeof payload.publicId === 'string' && payload.publicId.trim() ? payload.publicId.trim() : publicId;
        setWidgetInstances((prev) => {
          if (prev.some((instance) => instance.publicId === createdPublicId)) return prev;
          return [
            {
              publicId: createdPublicId,
              widgetType: normalizedWidgetType,
              displayName: DEFAULT_INSTANCE_DISPLAY_NAME,
              workspaceId,
              source: 'workspace',
              actions: { edit: true, duplicate: true, delete: true },
            },
            ...prev,
          ];
        });
        setWidgetTypes((prev) => {
          if (prev.includes(normalizedWidgetType)) return prev;
          return [...prev, normalizedWidgetType].sort((a, b) => a.localeCompare(b));
        });
        if (openBuilder) {
          router.push(
            buildBuilderRoute({
              publicId: createdPublicId,
              workspaceId,
              accountId: activeAccountId,
              widgetType: normalizedWidgetType,
            }),
          );
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setCreateError(message);
      } finally {
        setActiveActionKey((current) => (current === actionKey ? null : current));
      }
    },
    [activeAccountId, router, workspaceId],
  );

  const handleDuplicateInstance = useCallback(
    async (instance: WidgetInstance) => {
      const actionWorkspaceId = instance.workspaceId || workspaceId;
      if (!actionWorkspaceId) return;
      const actionKey = `duplicate:${instance.publicId}`;
      setActiveActionKey(actionKey);
      setCreateError(null);
      try {
        const payload = await fetchParisJson<{ publicId?: string; widgetType?: string }>(`/api/paris/roma/widgets/duplicate`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            workspaceId: actionWorkspaceId,
            sourcePublicId: instance.publicId,
          }),
        });
        const duplicatedPublicId =
          payload && typeof payload.publicId === 'string' && payload.publicId.trim() ? payload.publicId.trim() : '';
        const duplicatedType = normalizeWidgetType(
          payload && typeof payload.widgetType === 'string' ? payload.widgetType : instance.widgetType,
        );
        if (duplicatedPublicId) {
          setWidgetInstances((prev) => {
            if (prev.some((item) => item.publicId === duplicatedPublicId)) return prev;
            return [
              {
                publicId: duplicatedPublicId,
                widgetType: duplicatedType,
                displayName: DEFAULT_INSTANCE_DISPLAY_NAME,
                workspaceId: actionWorkspaceId,
                source: 'workspace',
                actions: { edit: true, duplicate: true, delete: true },
              },
              ...prev,
            ];
          });
          setWidgetTypes((prev) => {
            if (duplicatedType === 'unknown' || prev.includes(duplicatedType)) return prev;
            return [...prev, duplicatedType].sort((a, b) => a.localeCompare(b));
          });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setCreateError(message);
      } finally {
        setActiveActionKey((current) => (current === actionKey ? null : current));
      }
    },
    [workspaceId],
  );

  const handleDeleteInstance = useCallback(
    async (instance: WidgetInstance) => {
      const actionWorkspaceId = instance.workspaceId || workspaceId;
      if (!actionWorkspaceId) return;
      const actionKey = `delete:${instance.publicId}`;
      setActiveActionKey(actionKey);
      setCreateError(null);
      try {
        await fetchParisJson<{ deleted?: boolean }>(
          `/api/paris/roma/instances/${encodeURIComponent(instance.publicId)}?workspaceId=${encodeURIComponent(actionWorkspaceId)}`,
          {
            method: 'DELETE',
          },
        );
        setWidgetInstances((prev) => prev.filter((item) => item.publicId !== instance.publicId));
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setCreateError(message);
      } finally {
        setActiveActionKey((current) => (current === actionKey ? null : current));
      }
    },
    [workspaceId],
  );

  useEffect(() => {
    if (searchIntent !== 'create') return;
    if (autoCreateStartedRef.current) return;
    if (!workspaceId || activeActionKey) return;
    const targetWidgetType = searchWidgetType !== 'unknown' ? searchWidgetType : availableWidgetTypes[0];
    if (!targetWidgetType) return;
    autoCreateStartedRef.current = true;
    void createInstance({
      widgetType: targetWidgetType,
      openBuilder: true,
      actionKey: `intent:create:${targetWidgetType}`,
    });
  }, [activeActionKey, availableWidgetTypes, createInstance, searchIntent, searchWidgetType, workspaceId]);

  const handleCreateFromWidget = useCallback(
    (widgetType: string) => {
      void createInstance({
        widgetType,
        actionKey: `create:${widgetType}`,
      });
    },
    [createInstance],
  );

  if (me.loading) return <section className="roma-module-surface">Loading workspace context...</section>;
  if (me.error || !me.data) {
    return <section className="roma-module-surface">Failed to load workspace context: {me.error ?? 'unknown_error'}</section>;
  }
  if (!workspaceId) {
    return <section className="roma-module-surface">No workspace membership found for current user.</section>;
  }

  return (
    <section className="roma-module-surface">
      <p>
        Workspace: {context.workspaceName || workspaceId}
        {context.workspaceSlug ? ` (${context.workspaceSlug})` : ''}
      </p>
      <p>Showing workspace widgets grouped by widget. Account-owned curated/main instances are included.</p>

      {dataError ? <p>Failed to load widget instances: {dataError}</p> : null}
      {createError ? <p>Failed to update widgets: {createError}</p> : null}

      {groupedInstances.length === 0 ? (
        <div className="roma-module-surface__actions">
          <p>No editable instances yet. Use Templates to start from curated.</p>
          <Link className="diet-btn-txt" data-size="md" data-variant="line2" href="/templates">
            <span className="diet-btn-txt__label">Open templates</span>
          </Link>
        </div>
      ) : null}

      <div className="roma-grid">
        {groupedInstances.map((group) => {
          const createActionKey = `create:${group.widgetType}`;
          const canCreate = group.widgetType !== 'unknown';
          return (
            <article className="roma-card" key={group.widgetType}>
              <div className="roma-toolbar">
                <h2>{group.widgetType}</h2>
                <p>
                  {group.instances.length} {group.instances.length === 1 ? 'instance' : 'instances'}
                </p>
                {canCreate ? (
                  <button
                    className="diet-btn-txt"
                    data-size="md"
                    data-variant="primary"
                    type="button"
                    onClick={() => handleCreateFromWidget(group.widgetType)}
                    disabled={Boolean(activeActionKey)}
                  >
                    <span className="diet-btn-txt__label">
                      {activeActionKey === createActionKey ? 'Creating...' : 'Create instance'}
                    </span>
                  </button>
                ) : null}
              </div>

              <table className="roma-table">
                <thead>
                  <tr>
                    <th>Instance</th>
                    <th>Public ID</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {group.instances.map((instance) => {
                    const duplicateActionKey = `duplicate:${instance.publicId}`;
                    const deleteActionKey = `delete:${instance.publicId}`;
                    const canEdit = instance.actions.edit;
                    const canDuplicate = instance.actions.duplicate;
                    const canDelete = instance.actions.delete;
                    return (
                      <tr key={instance.publicId}>
                        <td>{instance.displayName || DEFAULT_INSTANCE_DISPLAY_NAME}</td>
                        <td>{instance.publicId}</td>
                        <td className="roma-cell-actions">
                          {canEdit ? (
                            <Link
                              href={buildBuilderRoute({
                                publicId: instance.publicId,
                                workspaceId: instance.workspaceId || workspaceId,
                                accountId: activeAccountId,
                                widgetType: instance.widgetType,
                              })}
                              className="diet-btn-txt"
                              data-size="md"
                              data-variant="line2"
                            >
                              <span className="diet-btn-txt__label">Edit</span>
                            </Link>
                          ) : (
                            <button className="diet-btn-txt" data-size="md" data-variant="line2" type="button" disabled>
                              <span className="diet-btn-txt__label">Edit</span>
                            </button>
                          )}
                          <button
                            className="diet-btn-txt"
                            data-size="md"
                            data-variant="secondary"
                            type="button"
                            onClick={() => handleDuplicateInstance(instance)}
                            disabled={Boolean(activeActionKey) || !canDuplicate}
                          >
                            <span className="diet-btn-txt__label">
                              {activeActionKey === duplicateActionKey ? 'Duplicating...' : 'Duplicate'}
                            </span>
                          </button>
                          <button
                            className="diet-btn-txt"
                            data-size="md"
                            data-variant="line2"
                            type="button"
                            onClick={() => handleDeleteInstance(instance)}
                            disabled={Boolean(activeActionKey) || !canDelete}
                          >
                            <span className="diet-btn-txt__label">
                              {activeActionKey === deleteActionKey ? 'Deleting...' : 'Delete'}
                            </span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {group.instances.length === 0 ? (
                    <tr>
                      <td colSpan={3}>No instances yet.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </article>
          );
        })}
      </div>
    </section>
  );
}
