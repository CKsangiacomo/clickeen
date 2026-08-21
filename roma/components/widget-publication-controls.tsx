'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import publicationCopy from '../l10n/publication/en.json';
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

type PublicationReceipt = {
  instanceId: string;
  sourceUpdatedAt: string;
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
  const [upsell, setUpsell] = useState<UpsellPresentation | null>(null);
  const [unpublishConfirmationOpen, setUnpublishConfirmationOpen] = useState(false);
  const [publicationReceipt, setPublicationReceipt] = useState<PublicationReceipt | null>(null);

  useEffect(() => {
    setPublicationReceipt((current) => current?.instanceId === instance.instanceId ? current : null);
  }, [instance.instanceId]);

  const published = instance.status === 'published';
  const savedChangesNotLive = published
    && instance.publishedAt !== null
    && instance.updatedAt > instance.publishedAt;
  const publishBlocked = dirty && !published;
  const liveWidgetUpdated = publicationReceipt?.instanceId === instance.instanceId
    && publicationReceipt.sourceUpdatedAt === instance.updatedAt
    && published
    && !savedChangesNotLive;

  useEffect(() => {
    if (!liveWidgetUpdated) return undefined;
    const timer = window.setTimeout(() => {
      setPublicationReceipt((current) => {
        if (
          current?.instanceId !== instance.instanceId
          || current.sourceUpdatedAt !== instance.updatedAt
        ) return current;
        return null;
      });
    }, 1_000);
    return () => window.clearTimeout(timer);
  }, [instance.instanceId, instance.updatedAt, liveWidgetUpdated]);

  const changeStatus = async (nextStatus: 'published' | 'unpublished') => {
    if (!canMutate || disabled || pendingStatus) return false;
    if (nextStatus === 'published' && dirty) return false;

    const isRepublish = nextStatus === 'published' && savedChangesNotLive;
    setPublicationReceipt(null);
    setPendingStatus(nextStatus);
    onPendingChange?.(true);
    setUpsell(null);
    try {
      const response = await accountApi.fetchRaw(
        `/api/account/instances/${encodeURIComponent(instance.instanceId)}/${nextStatus === 'published' ? 'publish' : 'unpublish'}`,
        { method: 'POST' },
      );
      if (response.status === 402) {
        const denied = await response.json() as { upgrade: PublicationCapacityUpgrade };
        setUpsell(buildPublicationCapacityUpsell(denied.upgrade, accountPolicy));
        return false;
      }
      if (!response.ok) {
        return false;
      }

      if (nextStatus === 'unpublished') setUnpublishConfirmationOpen(false);
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
        if (isRepublish) {
          setPublicationReceipt({
            instanceId: refreshed.instanceId,
            sourceUpdatedAt: refreshed.updatedAt,
          });
        }
      } catch {
        invalidateRomaWidgetsCache(accountContext.accountPublicId);
      }
      return true;
    } catch {
      return false;
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
    liveWidgetUpdated,
    publishBlocked,
    pendingStatus,
    upsell,
    setUpsell,
    changeStatus,
    requestStatusChange,
    unpublishConfirmationOpen,
    cancelUnpublish: () => setUnpublishConfirmationOpen(false),
    confirmUnpublish: async () => {
      const succeeded = await changeStatus('unpublished');
      if (succeeded) setUnpublishConfirmationOpen(false);
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
            ? (status.savedChangesNotLive ? publicationCopy.publishedChangesNotLive : publicationCopy.published)
            : publicationCopy.unpublished}
        </span>
      </span>
      <label
        className="diet-toggle roma-widget-status-toggle"
        data-size="md"
        aria-busy={status.pendingStatus === 'published' || undefined}
      >
        <span className="diet-toggle__label sr-only">
          {instance.displayName ? publicationCopy.publishedNamed.replace('{name}', instance.displayName) : publicationCopy.publishedWidget}
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
        {status.pendingStatus === 'published' ? <span className="diet-spinner" data-size="small" aria-hidden="true" /> : null}
      </label>
      <RomaUpsellDialog
        open={Boolean(status.upsell)}
        reason={status.upsell?.body}
        upgradeAvailable={status.upsell?.upgradeAvailable}
        onClose={() => status.setUpsell(null)}
      />
      <RomaCommandConfirmationDialog
        open={status.unpublishConfirmationOpen}
        title={publicationCopy.unpublish}
        body={instance.displayName}
        confirmLabel={publicationCopy.unpublish}
        pending={status.pendingStatus === 'unpublished'}
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
          aria-busy={status.pendingStatus === 'published' || undefined}
        >
          <span className="diet-toggle__label sr-only">
            {instance.displayName ? publicationCopy.publishedNamed.replace('{name}', instance.displayName) : publicationCopy.publishedWidget}
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
          {status.pendingStatus === 'published' ? <span className="diet-spinner" data-size="small" aria-hidden="true" /> : null}
        </label>
        ) : null}
        {status.liveWidgetUpdated ? (
          <button
            className="diet-button"
            data-size={controlSize}
            data-type="primary"
            data-tone="republish"
            data-state="success"
            type="button"
            disabled
          >
            <span
              className="diet-icon diet-icon-mask"
              aria-hidden="true"
              style={{
                '--diet-icon-source': 'url("/dieter/icons/svg/checkmark.svg")',
              } as CSSProperties}
            />
            <span className="diet-button__label">{publicationCopy.liveWidgetUpdated}</span>
          </button>
        ) : status.savedChangesNotLive ? (
          <button
            className="diet-button"
            data-size={controlSize}
            data-type="primary"
            data-tone="republish"
            data-loading={status.pendingStatus === 'published' ? 'true' : undefined}
            type="button"
            disabled={!status.canMutate || disabled || Boolean(status.pendingStatus) || dirty}
            aria-busy={status.pendingStatus === 'published' || undefined}
            onClick={() => void status.changeStatus('published')}
          >
            {status.pendingStatus === 'published' ? (
              <span className="diet-spinner" aria-hidden="true" />
            ) : (
              <span
                className="diet-icon diet-icon-mask"
                aria-hidden="true"
                style={{
                  '--diet-icon-source':
                    'url("/dieter/icons/svg/arrow.trianglehead.2.counterclockwise.svg")',
                } as CSSProperties}
              />
            )}
            <span className="diet-button__label">
              {status.pendingStatus === 'published'
                ? publicationCopy.republishing
                : publicationCopy.republish}
            </span>
          </button>
        ) : null}
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
              <span className="diet-button__label">{publicationCopy.openPublicWidget}</span>
            </a>
            <button
              className="diet-button"
              data-size={controlSize}
              data-type="tertiary"
              type="button"
              onClick={() => setCopyCodeOpen(true)}
            >
              <span
                className="diet-icon diet-icon-mask"
                aria-hidden="true"
                style={{
                  '--diet-icon-source': 'url("/dieter/icons/svg/square.on.square.svg")',
                } as CSSProperties}
              />
              <span className="diet-button__label">{publicationCopy.copyCode}</span>
            </button>
          </>
        ) : null}
      </div>
      <RomaUpsellDialog
        open={Boolean(status.upsell)}
        reason={status.upsell?.body}
        upgradeAvailable={status.upsell?.upgradeAvailable}
        onClose={() => status.setUpsell(null)}
      />
      <WidgetCopyCodeDialog
        open={copyCodeOpen}
        actions={publicActions}
        onClose={() => setCopyCodeOpen(false)}
      />
      <RomaCommandConfirmationDialog
        open={status.unpublishConfirmationOpen}
        title={publicationCopy.unpublish}
        body={instance.displayName}
        confirmLabel={publicationCopy.unpublish}
        pending={status.pendingStatus === 'unpublished'}
        onCancel={status.cancelUnpublish}
        onConfirm={status.confirmUnpublish}
      />
    </div>
  );
}
