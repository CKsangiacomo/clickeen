'use client';

import { useState } from 'react';
import { useRomaMe } from './use-roma-me';

function resolveErrorReason(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return fallback;
  const error = (payload as { error?: unknown }).error;
  if (!error || typeof error !== 'object' || Array.isArray(error)) return fallback;
  return String((error as { reasonKey?: unknown }).reasonKey || fallback);
}

const ACCOUNT_SWITCH_REASON_COPY: Record<string, string> = {
  'coreui.errors.auth.required': 'You need to sign in again to switch accounts.',
  'coreui.errors.auth.contextUnavailable': 'Account switching is unavailable right now. Please try again.',
  'coreui.errors.auth.forbidden': 'You do not have permission to switch to that account.',
  'coreui.errors.account.notFound': 'That account could not be found.',
  'coreui.errors.network.timeout': 'The request timed out. Please try again.',
};

function resolveAccountSwitchErrorCopy(reason: unknown, fallback: string): string {
  const normalized = String(reason || '').trim();
  if (!normalized) return fallback;
  const mapped = ACCOUNT_SWITCH_REASON_COPY[normalized];
  if (mapped) return mapped;
  if (normalized.startsWith('HTTP_') || normalized.startsWith('coreui.')) return fallback;
  return normalized;
}

export function RomaAccountSwitcher() {
  const me = useRomaMe();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accounts = me.data?.accounts ?? [];
  const activeAccountId = me.data?.activeAccount?.accountId ?? '';

  if (me.loading || !me.data || accounts.length <= 1) return null;

  const switchAccount = async (accountId: string) => {
    if (!accountId || accountId === activeAccountId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/accounts/${encodeURIComponent(accountId)}/switch`, {
        method: 'POST',
      });
      const payload = (await response.json().catch(() => null)) as { error?: unknown } | null;
      if (!response.ok) {
        throw new Error(resolveErrorReason(payload, `HTTP_${response.status}`));
      }
      await me.reload();
      window.location.reload();
    } catch (nextError) {
      setError(
        resolveAccountSwitchErrorCopy(
          nextError instanceof Error ? nextError.message : nextError,
          'Switching accounts failed. Please try again.',
        ),
      );
      setLoading(false);
    }
  };

  return (
    <div className="roma-inline-stack" style={{ alignItems: 'center', gap: '8px' }}>
      <label className="label-s" htmlFor="roma-account-switcher">
        Account
      </label>
      <select
        id="roma-account-switcher"
        className="roma-select"
        value={activeAccountId}
        onChange={(event) => void switchAccount(event.target.value)}
        disabled={loading}
        aria-label="Switch active account"
      >
        {accounts.map((account) => (
          <option key={account.accountId} value={account.accountId}>
            {account.name}
          </option>
        ))}
      </select>
      {error ? <span className="body-s">{error}</span> : null}
    </div>
  );
}
