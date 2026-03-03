'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { fetchParisJson } from './paris-http';
import { resolveDefaultRomaContext, useRomaMe } from './use-roma-me';

type AccountNotice = {
  noticeId: string;
  kind: string;
  payload: Record<string, unknown>;
  createdAt: string;
  emailPending: boolean;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown): string | null {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  return trimmed || null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return null;
}

function summarizeTierDropNotice(notice: AccountNotice): { title: string; lines: string[] } {
  const payload = notice.payload ?? {};
  const fromTier = asString(payload.fromTier);
  const toTier = asString(payload.toTier);
  const enforcement = asRecord(payload.enforcement);

  const unpublishedCount = asNumber(enforcement?.unpublishedCount);
  const assetsPurged = enforcement?.assetsPurged === true;

  const lines: string[] = [];
  if (fromTier && toTier) {
    lines.push(`Your plan changed from ${fromTier} → ${toTier}.`);
  } else {
    lines.push('Your plan changed.');
  }

  if (unpublishedCount != null && unpublishedCount > 0) {
    lines.push(`We turned off ${unpublishedCount} instance${unpublishedCount === 1 ? '' : 's'} to match the new plan.`);
  }
  if (assetsPurged) {
    lines.push('We deleted your uploaded assets to keep storage costs aligned with the new plan.');
  }
  lines.push('Review your workspace to choose what stays live.');

  return { title: 'Plan update', lines };
}

export function RomaAccountNoticeModal() {
  const me = useRomaMe();
  const context = useMemo(() => resolveDefaultRomaContext(me.data), [me.data]);
  const accountId = context.accountId;

  const notice = useMemo(() => {
    const notices = (me.data?.domains?.settings?.notices ?? []) as AccountNotice[];
    return notices.find((entry) => entry.kind === 'tier_drop') ?? null;
  }, [me.data]);

  const [dismissError, setDismissError] = useState<string | null>(null);
  const [dismissLoading, setDismissLoading] = useState(false);

  const dismiss = async () => {
    if (!accountId || !notice) return;
    setDismissLoading(true);
    setDismissError(null);
    try {
      await fetchParisJson(
        `/api/paris/accounts/${encodeURIComponent(accountId)}/notices/${encodeURIComponent(notice.noticeId)}/dismiss`,
        { method: 'POST' },
      );
      await me.reload();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setDismissError(message);
    } finally {
      setDismissLoading(false);
    }
  };

  if (me.loading || me.error || !me.data) return null;
  if (!accountId || !notice) return null;

  const summary = summarizeTierDropNotice(notice);

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
          <button
            className="diet-btn-txt"
            data-size="md"
            data-variant="primary"
            type="button"
            onClick={() => void dismiss()}
            disabled={dismissLoading}
          >
            <span className="diet-btn-txt__label body-m">{dismissLoading ? 'Dismissing...' : 'Dismiss'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

