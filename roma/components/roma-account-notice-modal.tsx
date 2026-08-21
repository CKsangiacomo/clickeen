'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { PolicyProfile } from '@clickeen/ck-policy';
import { createDialogLifecycle } from '../../dieter/components/shared/dialog-lifecycle';
import accountNoticeCopy from '../l10n/account-notices/en.json';
import { useRomaAccountApi } from './account-api';
import { useRomaAccountContext } from './roma-account-context';

const TIER_RANK: Record<PolicyProfile, number> = {
  free: 1,
  tier1: 2,
  tier2: 3,
  tier3: 4,
  tier4: 5,
};

export function RomaAccountNoticeModal() {
  const { activeAccount, reload } = useRomaAccountContext();
  const accountApi = useRomaAccountApi();

  const lifecycle = activeAccount.lifecycleNotice;
  const fromTier = lifecycle?.tierChangedFrom ?? null;
  const toTier = lifecycle?.tierChangedTo ?? null;
  const noticeOpen = Boolean(
    lifecycle?.tierChangedAt !== null &&
    fromTier !== null &&
    toTier !== null &&
    TIER_RANK[toTier] < TIER_RANK[fromTier] &&
    lifecycle?.tierDropDismissedAt === null,
  );

  const [dismissLoading, setDismissLoading] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (!noticeOpen) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const dialogLifecycle = createDialogLifecycle({
      dialog,
      initialFocus: '[href="/settings"]',
      requestDismiss: () => {},
    });
    dialogLifecycle.open();
    return () => dialogLifecycle.destroy();
  }, [noticeOpen]);

  const dismiss = async () => {
    if (!noticeOpen) return;
    setDismissLoading(true);
    try {
      await accountApi.fetchJson(`/api/account/lifecycle/tier-drop/dismiss`, {
        method: 'POST',
      });
      await reload();
    } catch {
      // The unchanged Dismiss control remains the retry boundary.
    } finally {
      setDismissLoading(false);
    }
  };

  if (!noticeOpen || !fromTier || !toTier) return null;

  return (
    <dialog ref={dialogRef} className="diet-popup" data-size="medium" aria-labelledby="roma-notice-title">
      <header className="diet-popup__header">
        <h2 className="heading-4" id="roma-notice-title">
          {accountNoticeCopy.planUpdate}
        </h2>
      </header>
      <footer className="diet-popup__footer">
        <div className="diet-popup__actions">
          <Link className="diet-button" data-size="medium" data-type="tertiary" href="/settings">
            <span className="diet-button__label">{accountNoticeCopy.openSettings}</span>
          </Link>
          <button
            className="diet-button"
            data-size="medium"
            data-type="primary"
            data-loading={dismissLoading || undefined}
            type="button"
            aria-busy={dismissLoading || undefined}
            onClick={() => void dismiss()}
            disabled={dismissLoading}
          >
            {dismissLoading ? <span className="diet-spinner" aria-hidden="true" /> : null}
            <span className="diet-button__label">
              {dismissLoading ? accountNoticeCopy.dismissing : accountNoticeCopy.dismiss}
            </span>
          </button>
        </div>
      </footer>
    </dialog>
  );
}
