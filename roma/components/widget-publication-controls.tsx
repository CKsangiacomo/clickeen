'use client';

import { useMemo, useState } from 'react';
import { resolveAccountShellErrorCopy } from '../lib/account-shell-copy';
import { buildWidgetPublicActions } from '../lib/public-widget-actions';
import { useRomaAccountApi } from './account-api';
import { useRomaAccountContext } from './roma-account-context';
import {
  buildPublicationCapacityUpsell,
  RomaUpsellDialog,
  type PublicationCapacityUpgrade,
  type UpsellPresentation,
} from './roma-upsell-dialog';
import {
  invalidateRomaWidgetsCache,
  loadRomaWidgetsForAccount,
  upsertRomaWidgetInstanceCache,
  type WidgetInstance,
} from './use-roma-widgets';
import { WidgetCopyCodeDialog } from './widget-copy-code-dialog';

export function WidgetPublicationControls({
  instance,
  dirty = false,
  disabled = false,
  showReceipt = false,
  onInstanceChange,
  onPendingChange,
}: {
  instance: WidgetInstance;
  dirty?: boolean;
  disabled?: boolean;
  showReceipt?: boolean;
  onInstanceChange: (instance: WidgetInstance) => void;
  onPendingChange?: (pending: boolean) => void;
}) {
  const accountApi = useRomaAccountApi();
  const { accountContext, accountPolicy } = useRomaAccountContext();
  const canMutate = accountPolicy.role !== 'viewer';
  const [pendingStatus, setPendingStatus] = useState<'published' | 'unpublished' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [upsell, setUpsell] = useState<UpsellPresentation | null>(null);
  const [copyCodeOpen, setCopyCodeOpen] = useState(false);

  const published = instance.status === 'published';
  const savedChangesNotLive = published
    && instance.publishedAt !== null
    && instance.updatedAt > instance.publishedAt;
  const publishBlocked = dirty && !published;
  const publicActions = useMemo(
    () => published
      ? buildWidgetPublicActions({
          accountPublicId: accountContext.accountPublicId,
          instanceId: instance.instanceId,
        })
      : null,
    [accountContext.accountPublicId, instance.instanceId, published],
  );

  const changeStatus = async (nextStatus: 'published' | 'unpublished') => {
    if (!canMutate || disabled || pendingStatus) return;
    if (nextStatus === 'published' && dirty) return;

    setPendingStatus(nextStatus);
    onPendingChange?.(true);
    setError(null);
    setUpsell(null);
    try {
      const response = await accountApi.fetchRaw(
        `/api/account/instances/${encodeURIComponent(instance.instanceId)}/${nextStatus === 'published' ? 'publish' : 'unpublish'}`,
        { method: 'POST' },
      );
      if (response.status === 402) {
        const denied = await response.json() as { upgrade: PublicationCapacityUpgrade };
        setUpsell(buildPublicationCapacityUpsell(denied.upgrade, accountPolicy));
        return;
      }
      if (!response.ok) {
        const failed = await response.json() as { error: { reasonKey: string } };
        throw new Error(failed.error.reasonKey);
      }

      const transitionedInstance = { ...instance, status: nextStatus };
      upsertRomaWidgetInstanceCache(accountContext.accountPublicId, transitionedInstance);
      onInstanceChange(transitionedInstance);
      try {
        const widgets = await loadRomaWidgetsForAccount({
          accountId: accountContext.accountPublicId,
          fetchJson: accountApi.fetchJson,
          force: true,
        });
        const refreshed = widgets.instances.find(
          (candidate) => candidate.instanceId === instance.instanceId,
        );
        if (!refreshed) throw new Error('coreui.errors.instance.notFound');
        onInstanceChange(refreshed);
      } catch (refreshError) {
        invalidateRomaWidgetsCache(accountContext.accountPublicId);
        const message = refreshError instanceof Error
          ? refreshError.message
          : String(refreshError);
        setError(resolveAccountShellErrorCopy(
          message,
          'The publication state changed, but its latest status could not be refreshed.',
        ));
      }
    } catch (statusError) {
      const message = statusError instanceof Error ? statusError.message : String(statusError);
      setError(resolveAccountShellErrorCopy(
        message,
        'Updating widget status failed. Please try again.',
      ));
    } finally {
      setPendingStatus(null);
      onPendingChange?.(false);
    }
  };

  return (
    <div className="roma-widget-publication">
      {showReceipt ? (
        <span className="body-xs roma-widget-publication__receipt">
          {published
            ? instance.publishedAt
              ? `Published · ${new Date(instance.publishedAt).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}`
              : 'Published'
            : 'Unpublished'}
        </span>
      ) : null}
      <div className="roma-widget-publish-actions">
        <label
          className="diet-toggle roma-widget-status-toggle"
          data-size="sm"
          aria-busy={Boolean(pendingStatus) || undefined}
          title={publishBlocked ? 'Save first' : undefined}
        >
          <span className="diet-toggle__label sr-only">
            Published: {instance.displayName}
            {pendingStatus ? ', updating' : ''}
          </span>
          <input
            className="diet-toggle__input sr-only"
            type="checkbox"
            role="switch"
            checked={published}
            disabled={!canMutate || disabled || Boolean(pendingStatus) || publishBlocked}
            onChange={(event) => void changeStatus(event.target.checked ? 'published' : 'unpublished')}
          />
          <span className="diet-toggle__switch" aria-hidden="true">
            <span className="diet-toggle__knob" />
          </span>
        </label>
        {savedChangesNotLive ? (
          <button
            className="diet-button"
            data-size="small"
            data-type="primary"
            type="button"
            disabled={!canMutate || disabled || Boolean(pendingStatus) || dirty}
            aria-busy={pendingStatus === 'published' || undefined}
            title={dirty ? 'Save first' : undefined}
            onClick={() => void changeStatus('published')}
          >
            {pendingStatus === 'published' ? (
              <span className="diet-spinner" aria-hidden="true" />
            ) : null}
            <span className="diet-button__label">Republish</span>
          </button>
        ) : null}
        {dirty ? <span className="body-xs">Save first</span> : null}
        {publicActions ? (
          <>
            <a
              className="diet-button"
              data-size="small"
              data-type="tertiary"
              href={publicActions.publicUrl}
              target="_blank"
              rel="noreferrer"
            >
              <span className="diet-button__label">Open public widget</span>
            </a>
            <button
              className="diet-button"
              data-size="small"
              data-type="tertiary"
              type="button"
              onClick={() => setCopyCodeOpen(true)}
            >
              <span className="diet-button__label">Copy code</span>
            </button>
          </>
        ) : null}
      </div>
      {error ? <span className="body-xs" role="alert">{error}</span> : null}
      <RomaUpsellDialog
        open={Boolean(upsell)}
        reason={upsell?.body}
        upgradeAvailable={upsell?.upgradeAvailable}
        onClose={() => setUpsell(null)}
      />
      <WidgetCopyCodeDialog
        open={copyCodeOpen}
        instanceName={instance.displayName}
        actions={publicActions}
        onClose={() => setCopyCodeOpen(false)}
      />
    </div>
  );
}
