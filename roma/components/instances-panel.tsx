'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRomaMe } from './use-roma-me';

type ParisInstance = {
  publicId: string;
  widgetname?: string;
  displayName?: string;
  config?: Record<string, unknown>;
};

type ParisInstancesPayload = {
  instances: ParisInstance[];
};

type ParisWidgetsPayload = {
  widgets: Array<{
    type: string | null;
    name: string | null;
  }>;
};

function parseReason(payload: unknown, status: number): string {
  if (!payload || typeof payload !== 'object') return `HTTP_${status}`;
  const withError = payload as { error?: unknown };
  if (typeof withError.error === 'string') return withError.error;
  if (withError.error && typeof withError.error === 'object') {
    const reasonKey = (withError.error as { reasonKey?: unknown }).reasonKey;
    if (typeof reasonKey === 'string') return reasonKey;
  }
  return `HTTP_${status}`;
}

function createUserInstancePublicId(widgetType: string): string {
  const normalized = widgetType
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  const stem = normalized || 'instance';
  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  return `wgt_${stem}_u_${suffix}`;
}

export function InstancesPanel() {
  const me = useRomaMe();
  const [workspaceId, setWorkspaceId] = useState<string>('');
  const [instances, setInstances] = useState<ParisInstance[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [widgetTypes, setWidgetTypes] = useState<string[]>([]);
  const [widgetType, setWidgetType] = useState<string>('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const selectedWorkspace = useMemo(() => {
    return me.data?.workspaces.find((workspace) => workspace.workspaceId === workspaceId) ?? null;
  }, [me.data?.workspaces, workspaceId]);

  const loadInstances = useCallback(async (targetWorkspaceId: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/paris/workspaces/${encodeURIComponent(targetWorkspaceId)}/instances`, {
        cache: 'no-store',
      });
      const payload = (await response.json().catch(() => null)) as ParisInstancesPayload | { error?: unknown } | null;
      if (!response.ok) {
        throw new Error(parseReason(payload, response.status));
      }
      const items =
        payload && typeof payload === 'object' && Array.isArray((payload as { instances?: unknown }).instances)
          ? ((payload as { instances: ParisInstance[] }).instances ?? [])
          : [];
      setInstances(items);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      setInstances([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!me.data) return;
    const preferred = me.data.defaults.workspaceId ?? me.data.workspaces[0]?.workspaceId ?? '';
    setWorkspaceId((current) => current || preferred);
  }, [me.data]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const response = await fetch('/api/paris/widgets', { cache: 'no-store' });
        const payload = (await response.json().catch(() => null)) as ParisWidgetsPayload | { error?: unknown } | null;
        if (!response.ok) throw new Error(parseReason(payload, response.status));
        if (cancelled) return;
        const widgets =
          payload && typeof payload === 'object' && Array.isArray((payload as { widgets?: unknown }).widgets)
            ? ((payload as { widgets: ParisWidgetsPayload['widgets'] }).widgets ?? [])
            : [];
        const types = Array.from(
          new Set(
            widgets
              .map((item) => (typeof item.type === 'string' ? item.type.trim() : ''))
              .filter((item) => Boolean(item)),
          ),
        );
        setWidgetTypes(types);
        setWidgetType((current) => current || types[0] || '');
      } catch {
        if (cancelled) return;
        setWidgetTypes([]);
        setWidgetType('');
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!workspaceId) return;
    void loadInstances(workspaceId);
  }, [workspaceId, loadInstances]);

  const handleCreateDraft = useCallback(async () => {
    if (!workspaceId || !widgetType) return;
    setCreating(true);
    setCreateError(null);
    try {
      const publicId = createUserInstancePublicId(widgetType);
      const response = await fetch(`/api/paris/workspaces/${encodeURIComponent(workspaceId)}/instances`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          publicId,
          widgetType,
          status: 'unpublished',
          config: {},
        }),
      });
      const payload = (await response.json().catch(() => null)) as { error?: unknown } | null;
      if (!response.ok) throw new Error(parseReason(payload, response.status));
      await loadInstances(workspaceId);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setCreateError(message);
    } finally {
      setCreating(false);
    }
  }, [workspaceId, widgetType, loadInstances]);

  if (me.loading) return <section className="roma-module-surface">Loading workspace context...</section>;
  if (me.error || !me.data) {
    return <section className="roma-module-surface">Failed to load workspace context: {me.error ?? 'unknown_error'}</section>;
  }
  if (me.data.workspaces.length === 0) {
    return <section className="roma-module-surface">No workspace membership found for current user.</section>;
  }

  return (
    <section className="roma-module-surface">
      <div className="roma-toolbar">
        <label className="roma-label" htmlFor="workspace-select">
          Workspace
        </label>
        <select
          id="workspace-select"
          className="roma-select"
          value={workspaceId}
          onChange={(event) => setWorkspaceId(event.target.value)}
        >
          {me.data.workspaces.map((workspace) => (
            <option key={workspace.workspaceId} value={workspace.workspaceId}>
              {workspace.name} ({workspace.slug})
            </option>
          ))}
        </select>

        <label className="roma-label" htmlFor="widget-type-select">
          Widget
        </label>
        <select
          id="widget-type-select"
          className="roma-select"
          value={widgetType}
          onChange={(event) => setWidgetType(event.target.value)}
          disabled={widgetTypes.length === 0}
        >
          {widgetTypes.length === 0 ? <option value="">No widget types available</option> : null}
          {widgetTypes.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>

        <button
          className="roma-btn roma-btn--inline"
          type="button"
          onClick={() => void handleCreateDraft()}
          disabled={!workspaceId || !widgetType || creating}
        >
          {creating ? 'Creating...' : 'Create draft instance'}
        </button>
      </div>

      {loading ? <p>Loading instances...</p> : null}
      {error ? <p>Failed to load instances: {error}</p> : null}
      {createError ? <p>Failed to create draft: {createError}</p> : null}

      <table className="roma-table">
        <thead>
          <tr>
            <th>Public ID</th>
            <th>Widget</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {instances.map((instance) => (
            <tr key={instance.publicId}>
              <td>{instance.publicId}</td>
              <td>{instance.widgetname ?? 'unknown'}</td>
              <td className="roma-cell-actions">
                <Link
                  href={`/builder/${encodeURIComponent(instance.publicId)}?workspaceId=${encodeURIComponent(
                    workspaceId,
                  )}&accountId=${encodeURIComponent(selectedWorkspace?.accountId ?? '')}&subject=workspace`}
                  className="roma-btn roma-btn--ghost roma-btn--inline"
                >
                  Open builder
                </Link>
              </td>
            </tr>
          ))}
          {!loading && instances.length === 0 ? (
            <tr>
              <td colSpan={3}>No instances found.</td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </section>
  );
}
