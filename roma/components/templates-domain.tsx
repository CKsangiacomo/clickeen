'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { resolveBootstrapDomainState } from './bootstrap-domain-state';
import { prefetchCompiledWidget } from './compiled-widget-cache';
import { fetchParisJson } from './paris-http';
import { resolveDefaultRomaContext, useRomaMe } from './use-roma-me';
import {
  buildBuilderRoute,
  DEFAULT_INSTANCE_DISPLAY_NAME,
} from './use-roma-widgets';
import { normalizeRomaTemplatesSnapshot, type TemplateInstance } from './use-roma-templates';

export function TemplatesDomain() {
  const router = useRouter();
  const me = useRomaMe();
  const context = useMemo(() => resolveDefaultRomaContext(me.data), [me.data]);
  const [activeActionKey, setActiveActionKey] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [templateInstances, setTemplateInstances] = useState<TemplateInstance[]>([]);
  const [accountIdFromSnapshot, setAccountIdFromSnapshot] = useState('');
  const [dataError, setDataError] = useState<string | null>(null);

  const workspaceId = context.workspaceId;
  const accountId = context.accountId;
  const activeAccountId = accountId || accountIdFromSnapshot;

  useEffect(() => {
    if (!workspaceId) {
      setTemplateInstances([]);
      setAccountIdFromSnapshot('');
      setDataError(null);
      return;
    }
    const snapshot = normalizeRomaTemplatesSnapshot(me.data?.domains?.templates ?? null);
    const hasDomainPayload = Boolean(snapshot && snapshot.workspaceId === workspaceId);
    const domainState = resolveBootstrapDomainState({
      data: me.data,
      domainKey: 'templates',
      hasDomainPayload,
    });
    if (!hasDomainPayload || domainState.kind !== 'ok') {
      setTemplateInstances([]);
      setAccountIdFromSnapshot('');
      setDataError(domainState.reasonKey);
      return;
    }
    const safeSnapshot = snapshot as NonNullable<typeof snapshot>;
    setTemplateInstances(safeSnapshot.instances);
    setAccountIdFromSnapshot(safeSnapshot.accountId);
    setDataError(null);
  }, [workspaceId, me.data]);

  const groupedTemplates = useMemo(() => {
    const groups = new Map<string, TemplateInstance[]>();
    templateInstances.forEach((instance) => {
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
  }, [templateInstances]);

  useEffect(() => {
    const widgetTypes = groupedTemplates.map((group) => group.widgetType).filter((widgetType) => widgetType !== 'unknown');
    widgetTypes.slice(0, 8).forEach((widgetType) => {
      void prefetchCompiledWidget(widgetType);
    });
  }, [groupedTemplates]);

  const handleUseTemplate = useCallback(
    async (instance: TemplateInstance) => {
      if (!workspaceId) return;
      const actionKey = `template:${instance.publicId}`;
      setActiveActionKey(actionKey);
      setActionError(null);
      try {
        const payload = await fetchParisJson<{ publicId?: string }>(`/api/paris/roma/widgets/duplicate`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            workspaceId,
            sourcePublicId: instance.publicId,
          }),
        });

        const createdPublicId =
          payload && typeof payload.publicId === 'string' && payload.publicId.trim() ? payload.publicId.trim() : '';
        if (!createdPublicId) {
          throw new Error('Duplicate response missing publicId.');
        }

        router.push(
          buildBuilderRoute({
            publicId: createdPublicId,
            workspaceId,
            accountId: activeAccountId,
            widgetType: instance.widgetType,
          }),
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setActionError(message);
      } finally {
        setActiveActionKey((current) => (current === actionKey ? null : current));
      }
    },
    [activeAccountId, router, workspaceId],
  );

  if (me.loading) return <section className="rd-canvas-module body-m">Loading workspace context...</section>;
  if (me.error || !me.data) {
    return <section className="rd-canvas-module body-m">Failed to load workspace context: {me.error ?? 'unknown_error'}</section>;
  }
  if (!workspaceId) {
    return <section className="rd-canvas-module body-m">No workspace membership found for current user.</section>;
  }

  return (
    <>
      <section className="rd-canvas-module">
        <p className="body-m">
          Workspace: {context.workspaceName || workspaceId}
          {context.workspaceSlug ? ` (${context.workspaceSlug})` : ''}
        </p>
        <p className="body-m">Showing all curated templates available.</p>

        {dataError ? (
          <div className="roma-inline-stack">
            <p className="body-m">roma.errors.bootstrap.domain_unavailable</p>
            <p className="body-m">{dataError}</p>
            <button className="diet-btn-txt" data-size="md" data-variant="line2" type="button" onClick={() => void me.reload()}>
              <span className="diet-btn-txt__label body-m">Retry</span>
            </button>
          </div>
        ) : null}
        {actionError ? <p className="body-m">Failed to use template: {actionError}</p> : null}
        {groupedTemplates.length === 0 ? <p className="body-m">No curated templates available yet.</p> : null}
      </section>

      {groupedTemplates.length > 0 ? (
        <section className="rd-canvas-module">
          <div className="roma-grid">
            {groupedTemplates.map((group) => (
              <article className="roma-card" key={group.widgetType}>
                <div className="roma-toolbar">
                  <h2 className="heading-4">{group.widgetType}</h2>
                  <p className="body-s">
                    {group.instances.length} {group.instances.length === 1 ? 'template' : 'templates'}
                  </p>
                </div>

                <table className="roma-table">
                  <thead>
                    <tr>
                      <th className="table-header label-s">Template</th>
                      <th className="table-header label-s">Public ID</th>
                      <th className="table-header label-s">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.instances.map((instance) => {
                      const actionKey = `template:${instance.publicId}`;
                      return (
                        <tr key={instance.publicId}>
                          <td className="body-s">{instance.displayName || DEFAULT_INSTANCE_DISPLAY_NAME}</td>
                          <td className="body-s">{instance.publicId}</td>
                          <td className="roma-cell-actions">
                            <button
                              className="diet-btn-txt"
                              data-size="md"
                              data-variant="primary"
                              type="button"
                              onClick={() => handleUseTemplate(instance)}
                              disabled={Boolean(activeActionKey)}
                            >
                              <span className="diet-btn-txt__label body-m">
                                {activeActionKey === actionKey ? 'Creating...' : 'Use template'}
                              </span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}
