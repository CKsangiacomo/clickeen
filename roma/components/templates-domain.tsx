'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { resolveAccountShellErrorCopy } from '../lib/account-shell-copy';
import { useRomaAccountApi } from './account-api';
import { prefetchCompiledWidget } from './compiled-widget-cache';
import { resolveActiveRomaContext, useRomaMe } from './use-roma-me';
import { buildBuilderRoute, DEFAULT_INSTANCE_DISPLAY_NAME } from './use-roma-widgets';
import { normalizeRomaTemplatesSnapshot, type TemplateInstance } from './use-roma-templates';

export function TemplatesDomain() {
  const router = useRouter();
  const me = useRomaMe();
  const accountApi = useRomaAccountApi(me.data);
  const [activeActionKey, setActiveActionKey] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [templateInstances, setTemplateInstances] = useState<TemplateInstance[]>([]);
  const [domainLoading, setDomainLoading] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);

  const context = useMemo(() => resolveActiveRomaContext(me.data), [me.data]);
  const accountId = context.accountId;
  const activeAccountId = accountId;

  const refreshTemplates = useCallback(async () => {
    if (!accountId) return;
    setDomainLoading(true);
    setDataError(null);
    try {
      const payload = await accountApi.fetchJson<unknown>(
        `/api/roma/templates?accountId=${encodeURIComponent(accountId)}`,
        { method: 'GET' },
      );
      const normalized = normalizeRomaTemplatesSnapshot(payload);
      if (!normalized || normalized.accountId !== accountId) {
        throw new Error('coreui.errors.payload.invalid');
      }
      setTemplateInstances(normalized.instances);
      setDataError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setTemplateInstances([]);
      setDataError(resolveAccountShellErrorCopy(message, 'Failed to load templates. Please try again.'));
    } finally {
      setDomainLoading(false);
    }
  }, [accountApi, accountId]);

  useEffect(() => {
    void refreshTemplates();
  }, [refreshTemplates]);

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
    const widgetTypes = groupedTemplates
      .map((group) => group.widgetType)
      .filter((widgetType) => widgetType !== 'unknown');
    widgetTypes.slice(0, 8).forEach((widgetType) => {
      void prefetchCompiledWidget(widgetType);
    });
  }, [groupedTemplates]);

  const handleUseTemplate = useCallback(
    async (instance: TemplateInstance) => {
      if (!accountId) return;
      const actionKey = `template:${instance.publicId}`;
      setActiveActionKey(actionKey);
      setActionError(null);
      try {
        const payload = await accountApi.fetchJson<{ publicId?: string }>(`/api/roma/widgets/duplicate`, {
          method: 'POST',
          headers: accountApi.buildHeaders({ contentType: 'application/json' }),
          body: JSON.stringify({
            accountId,
            sourcePublicId: instance.publicId,
          }),
        });

        const createdPublicId =
          payload && typeof payload.publicId === 'string' && payload.publicId.trim()
            ? payload.publicId.trim()
            : '';
        if (!createdPublicId) {
          throw new Error('coreui.errors.payload.invalid');
        }

        router.push(
          buildBuilderRoute({
            publicId: createdPublicId,
            accountId: activeAccountId,
            widgetType: instance.widgetType,
          }),
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setActionError(resolveAccountShellErrorCopy(message, 'Using the template failed. Please try again.'));
      } finally {
        setActiveActionKey((current) => (current === actionKey ? null : current));
      }
    },
    [accountApi, accountId, activeAccountId, router],
  );

  if (me.loading)
    return <section className="rd-canvas-module body-m">Loading account context...</section>;
  if (me.error || !me.data) {
    return (
      <section className="rd-canvas-module body-m">
        {resolveAccountShellErrorCopy(
          me.error ?? 'coreui.errors.auth.contextUnavailable',
          'Templates are unavailable right now. Please try again.',
        )}
      </section>
    );
  }
  if (!accountId) {
    return (
      <section className="rd-canvas-module body-m">
        No account is available for templates right now.
      </section>
    );
  }

  return (
    <>
      <section className="rd-canvas-module">
        <p className="body-m">Account: {context.accountName || 'Current account'}</p>
        {context.accountSlug ? <p className="body-s">Slug: {context.accountSlug}</p> : null}
        <p className="body-m">Showing all curated templates available.</p>

        {dataError ? (
          <div className="roma-inline-stack">
            <p className="body-m">{dataError}</p>
            <button
              className="diet-btn-txt"
              data-size="md"
              data-variant="line2"
              type="button"
              onClick={() => void refreshTemplates()}
              disabled={domainLoading}
            >
              <span className="diet-btn-txt__label body-m">Retry</span>
            </button>
          </div>
        ) : null}
        {actionError ? <p className="body-m">{actionError}</p> : null}
        {groupedTemplates.length === 0 ? (
          <p className="body-m">No curated templates available yet.</p>
        ) : null}
      </section>

      {groupedTemplates.length > 0 ? (
        <section className="rd-canvas-module">
          <div className="roma-grid">
            {groupedTemplates.map((group) => (
              <article className="roma-card" key={group.widgetType}>
                <div className="roma-toolbar">
                  <h2 className="heading-4">{group.widgetType}</h2>
                  <p className="body-s">
                    {group.instances.length}{' '}
                    {group.instances.length === 1 ? 'template' : 'templates'}
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
                          <td className="body-s">
                            {instance.displayName || DEFAULT_INSTANCE_DISPLAY_NAME}
                          </td>
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
