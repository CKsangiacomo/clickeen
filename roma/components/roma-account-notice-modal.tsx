'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRomaAccountApi } from './account-api';
import { useRomaAccountContext } from './roma-account-context';

type AccountTier = 'free' | 'tier1' | 'tier2' | 'tier3';

function normalizeTier(value: unknown): AccountTier | null {
  switch (value) {
    case 'free':
    case 'tier1':
    case 'tier2':
    case 'tier3':
      return value;
    default:
      return null;
  }
}

function tierRank(tier: AccountTier): number {
  switch (tier) {
    case 'tier3':
      return 4;
    case 'tier2':
      return 3;
    case 'tier1':
      return 2;
    case 'free':
      return 1;
    default:
      return 0;
  }
}

function summarizeTierDrop(fromTier: AccountTier, toTier: AccountTier): { title: string; lines: string[] } {
  return {
    title: 'Plan update',
    lines: [`Your plan changed from ${fromTier} -> ${toTier}.`, 'Review your account to see what stays live.'],
  };
}

export function RomaAccountNoticeModal() {
  const { accountContext, data, reload } = useRomaAccountContext();
  const accountApi = useRomaAccountApi();
  const accountId = accountContext.accountId;

  const account = Array.isArray(data.accounts) ? (data.accounts.find((entry) => entry?.accountId === accountId) ?? null) : null;
  const lifecycle = account?.lifecycleNotice ?? null;

  const changedAt = typeof lifecycle?.tierChangedAt === 'string' ? lifecycle.tierChangedAt : null;
  const fromTier = normalizeTier(lifecycle?.tierChangedFrom);
  const toTier = normalizeTier(lifecycle?.tierChangedTo);
  const dismissedAt = typeof lifecycle?.tierDropDismissedAt === 'string' ? lifecycle.tierDropDismissedAt : null;
  const isTierDrop = Boolean(fromTier && toTier && tierRank(toTier) < tierRank(fromTier));
  const noticeOpen = Boolean(changedAt && isTierDrop && !dismissedAt);

  const [dismissError, setDismissError] = useState<string | null>(null);
  const [dismissLoading, setDismissLoading] = useState(false);

  const dismiss = async () => {
    if (!accountId || !noticeOpen) return;
    setDismissLoading(true);
    setDismissError(null);
    try {
      await accountApi.fetchJson(`/api/account/lifecycle/tier-drop/dismiss`, {
        method: 'POST',
      });
      await reload();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setDismissError(message);
    } finally {
      setDismissLoading(false);
    }
  };

  if (!noticeOpen || !fromTier || !toTier) return null;

  const summary = summarizeTierDrop(fromTier, toTier);

  return (
    <div className="roma-modal-backdrop" role="presentation">
      <div className="roma-modal" role="dialog" aria-modal="true" aria-labelledby="roma-notice-title">
        <h2 className="heading-5" id="roma-notice-title">
          {summary.title}
        </h2>
        <div className="roma-inline-stack">
          {summary.lines.map((line) => (
            <p className="body-m" key={line}>
              {line}
            </p>
          ))}
        </div>
        {dismissError ? <p className="body-m">Notice action failed: {dismissError}</p> : null}
        <div className="roma-modal__actions">
          <Link className="diet-btn-txt" data-size="md" data-variant="line2" href="/settings">
            <span className="diet-btn-txt__label body-m">Open settings</span>
          </Link>
          <button className="diet-btn-txt" data-size="md" data-variant="primary" type="button" onClick={() => void dismiss()} disabled={dismissLoading}>
            <span className="diet-btn-txt__label body-m">{dismissLoading ? 'Dismissing...' : 'Dismiss'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
