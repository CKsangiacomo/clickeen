'use client';

import { getEntitlementsMatrix, type AccountTier, type Policy } from '@clickeen/ck-policy';
import { useEffect, useRef } from 'react';
import { createDialogLifecycle, type DialogLifecycle } from '../../dieter/components/shared/dialog-lifecycle';
import ROMA_PLANS_UI_COPY from '../l10n/plans/en.json';

export type PublicationCapacityUpgrade = {
  gate: 'instances.published.max';
  action: 'publish_instance';
  current: number;
  limit: number;
};

export type UpsellPresentation = {
  body?: string;
  upgradeAvailable: boolean;
};

export function resolveTargetPlan(
  policy: Policy,
  capability: string,
  required: boolean | number,
): AccountTier | null {
  const matrix = getEntitlementsMatrix();
  const entitlement = matrix.entitlements[capability]!;
  const currentIndex = matrix.tiers.indexOf(policy.profile);
  return matrix.tiers.slice(currentIndex + 1).find((tier) => {
    const candidate = entitlement.values[tier];
    if (entitlement.kind === 'flag') return required === true && candidate === true;
    const limit = candidate as number | null;
    return limit === null || (typeof required === 'number' && limit >= required);
  }) ?? null;
}

export function buildPublicationCapacityUpsell(
  upgrade: PublicationCapacityUpgrade,
  policy: Policy,
): UpsellPresentation {
  const targetPlan = resolveTargetPlan(policy, upgrade.gate, upgrade.current + 1);
  return targetPlan
    ? {
        upgradeAvailable: true,
      }
    : {
        upgradeAvailable: false,
      };
}

export function RomaUpsellDialog({
  open,
  reason,
  upgradeAvailable = true,
  onClose,
}: {
  open: boolean;
  reason?: string;
  upgradeAvailable?: boolean;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const lifecycleRef = useRef<DialogLifecycle | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const lifecycle = createDialogLifecycle({
      dialog,
      initialFocus: () => closeButtonRef.current,
      requestDismiss: () => onCloseRef.current(),
    });
    lifecycleRef.current = lifecycle;
    return () => {
      lifecycle.destroy();
      lifecycleRef.current = null;
    };
  }, []);

  useEffect(() => {
    const lifecycle = lifecycleRef.current;
    if (!lifecycle) return;
    if (open) lifecycle.open();
    else lifecycle.close();
  }, [open]);

  return (
    <dialog ref={dialogRef} className="diet-popup" data-size="medium" aria-labelledby="roma-upsell-title">
      <header className="diet-popup__header">
        <h2 id="roma-upsell-title" className="heading-4">
          {upgradeAvailable ? ROMA_PLANS_UI_COPY.upsell.upgradeTitle : ROMA_PLANS_UI_COPY.upsell.limitTitle}
        </h2>
        <button
          className="diet-button diet-popup__dismiss"
          data-size="medium"
          data-type="quaternary"
          type="button"
          aria-label={ROMA_PLANS_UI_COPY.upsell.close}
          onClick={onClose}
        >
          <span className="diet-icon" data-icon="multiply" aria-hidden="true" />
        </button>
      </header>
      <div className="diet-popup__body">
        {reason ? <p className="body-m">{reason}</p> : null}
        <div className="roma-upsell-dialog__content" data-upsell-content />
      </div>
      <footer className="diet-popup__footer">
        <div className="diet-popup__actions">
          <button
            ref={closeButtonRef}
            className="diet-button"
            data-size="medium"
            data-type="primary"
            type="button"
            onClick={onClose}
          >
            <span className="diet-button__label">{upgradeAvailable ? ROMA_PLANS_UI_COPY.upsell.upgrade : ROMA_PLANS_UI_COPY.upsell.close}</span>
          </button>
          {upgradeAvailable ? (
            <button
              className="diet-button"
              data-size="medium"
              data-type="quaternary"
              type="button"
              onClick={onClose}
            >
              <span className="diet-button__label">{ROMA_PLANS_UI_COPY.upsell.notNow}</span>
            </button>
          ) : null}
        </div>
      </footer>
    </dialog>
  );
}
