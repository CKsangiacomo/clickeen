'use client';

import { useMemo, useState } from 'react';
import { resolveAccountShellErrorCopy } from '../lib/account-shell-copy';
import { buildWidgetPublicActions } from '../lib/public-widget-actions';
import { useRomaAccountApi } from './account-api';
import { useRomaAccountContext } from './roma-account-context';
import { RomaCommandConfirmationDialog } from './roma-command-confirmation-dialog';
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

type PublicationStatusArgs = {
  instance: WidgetInstance;
  dirty: boolean;
  disabled: boolean;
  onInstanceChange: (instance: WidgetInstance) => void;
  onPendingChange?: (pending: boolean) => void;
};

function useWidgetPublicationStatus({
  instance,
  dirty,
  disabled,
  onInstanceChange,
  onPendingChange,
}: PublicationStatusArgs) {
  const accountApi = useRomaAccountApi();
  const { accountContext, accountPolicy } = useRomaAccountContext();
  const canMutate = accountPolicy.role !== 'viewer';
  const [pendingStatus, setPendingStatus] = useState<'published' | 'unpublished' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [upsell, setUpsell] = useState<UpsellPresentation | null>(null);
  const [unpublishConfirmationOpen, setUnpublishConfirmationOpen] = useState(false);

  const published = instance.status === 'published';
  const savedChangesNotLive = published
    && instance.publishedAt !== null
    && instance.updatedAt > instance.publishedAt;
  const publishBlocked = dirty && !published;

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

  const requestStatusChange = (nextStatus: 'published' | 'unpublished') => {
    if (!canMutate || disabled || pendingStatus) return;
    if (nextStatus === 'published') {
      void changeStatus(nextStatus);
      return;
    }
    setUnpublishConfirmationOpen(true);
  };

  return {
    canMutate,
    published,
    savedChangesNotLive,
    publishBlocked,
    pendingStatus,
    error,
    upsell,
    setUpsell,
    changeStatus,
    requestStatusChange,
    unpublishConfirmationOpen,
    cancelUnpublish: () => setUnpublishConfirmationOpen(false),
    confirmUnpublish: () => {
      setUnpublishConfirmationOpen(false);
      void changeStatus('unpublished');
    },
  };
}

export function WidgetPublicationState({
  instance,
  dirty = false,
  disabled = false,
  onInstanceChange,
  onPendingChange,
}: {
  instance: WidgetInstance;
  dirty?: boolean;
  disabled?: boolean;
  onInstanceChange: (instance: WidgetInstance) => void;
  onPendingChange?: (pending: boolean) => void;
}) {
  const status = useWidgetPublicationStatus({
    instance,
    dirty,
    disabled,
    onInstanceChange,
    onPendingChange,
  });

  return (
    <div className="roma-widget-publication">
      <span className="diet-badge label-xs" data-tone="neutral">
        <span className="diet-badge__label">
          {status.published
            ? (status.savedChangesNotLive ? 'Published · changes not live' : 'Published')
            : 'Unpublished'}
        </span>
      </span>
      <label
        className="diet-toggle roma-widget-status-toggle"
        data-size="md"
        aria-busy={Boolean(status.pendingStatus) || undefined}
        title={status.publishBlocked ? 'Save first' : undefined}
      >
        <span className="diet-toggle__label sr-only">
          Published: {instance.displayName}
          {status.pendingStatus ? ', updating' : ''}
        </span>
        <input
          className="diet-toggle__input sr-only"
          type="checkbox"
          role="switch"
          checked={status.published}
          disabled={!status.canMutate || disabled || Boolean(status.pendingStatus) || status.publishBlocked}
          onChange={(event) => status.requestStatusChange(event.target.checked ? 'published' : 'unpublished')}
        />
        <span className="diet-toggle__switch" aria-hidden="true">
          <span className="diet-toggle__knob" />
        </span>
      </label>
      {status.error ? <span className="body-xs" role="alert">{status.error}</span> : null}
      <RomaUpsellDialog
        open={Boolean(status.upsell)}
        reason={status.upsell?.body}
        upgradeAvailable={status.upsell?.upgradeAvailable}
        onClose={() => status.setUpsell(null)}
      />
      <RomaCommandConfirmationDialog
        open={status.unpublishConfirmationOpen}
        title="Take this widget offline?"
        body={`“${instance.displayName}” will be taken offline. Its saved source remains, and it can be published again.`}
        confirmLabel="Unpublish"
        onCancel={status.cancelUnpublish}
        onConfirm={status.confirmUnpublish}
      />
    </div>
  );
}

export function WidgetPublicationControls({
  instance,
  dirty = false,
  disabled = false,
  showToggle = true,
  controlSize = 'small',
  onInstanceChange,
  onPendingChange,
}: {
  instance: WidgetInstance;
  dirty?: boolean;
  disabled?: boolean;
  showToggle?: boolean;
  controlSize?: 'small' | 'medium' | 'large';
  onInstanceChange: (instance: WidgetInstance) => void;
  onPendingChange?: (pending: boolean) => void;
}) {
  const { accountContext } = useRomaAccountContext();
  const status = useWidgetPublicationStatus({
    instance,
    dirty,
    disabled,
    onInstanceChange,
    onPendingChange,
  });
  const [copyCodeOpen, setCopyCodeOpen] = useState(false);

  const publicActions = useMemo(
    () => status.published
      ? buildWidgetPublicActions({
          accountPublicId: accountContext.accountPublicId,
          instanceId: instance.instanceId,
        })
      : null,
    [accountContext.accountPublicId, instance.instanceId, status.published],
  );

  return (
    <div className="roma-widget-publication">
      <div className="roma-widget-publish-actions">
        {showToggle ? (
        <label
          className="diet-toggle roma-widget-status-toggle"
          data-size="sm"
          aria-busy={Boolean(status.pendingStatus) || undefined}
          title={status.publishBlocked ? 'Save first' : undefined}
        >
          <span className="diet-toggle__label sr-only">
            Published: {instance.displayName}
            {status.pendingStatus ? ', updating' : ''}
          </span>
          <input
            className="diet-toggle__input sr-only"
            type="checkbox"
            role="switch"
            checked={status.published}
            disabled={!status.canMutate || disabled || Boolean(status.pendingStatus) || status.publishBlocked}
            onChange={(event) => status.requestStatusChange(event.target.checked ? 'published' : 'unpublished')}
          />
          <span className="diet-toggle__switch" aria-hidden="true">
            <span className="diet-toggle__knob" />
          </span>
        </label>
        ) : null}
        {status.savedChangesNotLive ? (
          <button
            className="diet-button"
            data-size={controlSize}
            data-type="primary"
            type="button"
            disabled={!status.canMutate || disabled || Boolean(status.pendingStatus) || dirty}
            aria-busy={status.pendingStatus === 'published' || undefined}
            title={dirty ? 'Save first' : undefined}
            onClick={() => void status.changeStatus('published')}
          >
            {status.pendingStatus === 'published' ? (
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
              data-size={controlSize}
              data-type="tertiary"
              href={publicActions.publicUrl}
              target="_blank"
              rel="noreferrer"
            >
              <span className="diet-button__label">Open public widget</span>
            </a>
            <button
              className="diet-button"
              data-size={controlSize}
              data-type="tertiary"
              type="button"
              onClick={() => setCopyCodeOpen(true)}
            >
              <span className="diet-button__label">Copy code</span>
            </button>
          </>
        ) : null}
      </div>
      {status.error ? <span className="body-xs" role="alert">{status.error}</span> : null}
      <RomaUpsellDialog
        open={Boolean(status.upsell)}
        reason={status.upsell?.body}
        upgradeAvailable={status.upsell?.upgradeAvailable}
        onClose={() => status.setUpsell(null)}
      />
      <WidgetCopyCodeDialog
        open={copyCodeOpen}
        instanceName={instance.displayName}
        actions={publicActions}
        onClose={() => setCopyCodeOpen(false)}
      />
      <RomaCommandConfirmationDialog
        open={status.unpublishConfirmationOpen}
        title="Take this widget offline?"
        body={`“${instance.displayName}” will be taken offline. Its saved source remains, and it can be published again.`}
        confirmLabel="Unpublish"
        onCancel={status.cancelUnpublish}
        onConfirm={status.confirmUnpublish}
      />
    </div>
  );
}
