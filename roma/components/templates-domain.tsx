'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { prefetchCompiledWidget } from './compiled-widget-cache';
import { prefetchWorkspaceInstance } from './workspace-instance-cache';
import { fetchParisJson } from './paris-http';
import { resolveDefaultRomaContext, useRomaMe } from './use-roma-me';
import {
  buildBuilderRoute,
  DEFAULT_INSTANCE_DISPLAY_NAME,
} from './use-roma-widgets';
import { useRomaTemplates, type TemplateInstance } from './use-roma-templates';

export function TemplatesDomain() {
  const router = useRouter();
  const me = useRomaMe();
  const context = useMemo(() => resolveDefaultRomaContext(me.data), [me.data]);
  const [activeActionKey, setActiveActionKey] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const workspaceId = context.workspaceId;
  const accountId = context.accountId;

  const { templateInstances, accountIdFromApi, loading, dataError, loadTemplatesData } = useRomaTemplates(workspaceId);
  const activeAccountId = accountId || accountIdFromApi;

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

  useEffect(() => {
    if (!workspaceId) return;
    templateInstances.slice(0, 6).forEach((instance) => {
      void prefetchWorkspaceInstance(workspaceId, instance.publicId);
    });
  }, [templateInstances, workspaceId]);

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

        await loadTemplatesData(true);
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
    [activeAccountId, loadTemplatesData, router, workspaceId],
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
      <p>Showing all curated templates available.</p>

      {loading ? <p>Loading templates...</p> : null}
      {dataError ? <p>Failed to load templates: {dataError}</p> : null}
      {actionError ? <p>Failed to use template: {actionError}</p> : null}

      {!loading && groupedTemplates.length === 0 ? <p>No curated templates available yet.</p> : null}

      <div className="roma-grid">
        {groupedTemplates.map((group) => (
          <article className="roma-card" key={group.widgetType}>
            <div className="roma-toolbar">
              <h2>{group.widgetType}</h2>
              <p>
                {group.instances.length} {group.instances.length === 1 ? 'template' : 'templates'}
              </p>
            </div>

            <table className="roma-table">
              <thead>
                <tr>
                  <th>Template</th>
                  <th>Public ID</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {group.instances.map((instance) => {
                  const actionKey = `template:${instance.publicId}`;
                  return (
                    <tr key={instance.publicId}>
                      <td>{instance.displayName || DEFAULT_INSTANCE_DISPLAY_NAME}</td>
                      <td>{instance.publicId}</td>
                      <td className="roma-cell-actions">
                        <button
                          className="diet-btn-txt"
                          data-size="md"
                          data-variant="primary"
                          type="button"
                          onClick={() => handleUseTemplate(instance)}
                          disabled={Boolean(activeActionKey)}
                        >
                          <span className="diet-btn-txt__label">
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
  );
}
