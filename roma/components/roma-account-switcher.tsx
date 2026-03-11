'use client';

import { useState } from 'react';
import { useRomaMe } from './use-roma-me';

function resolveErrorReason(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return fallback;
  const error = (payload as { error?: unknown }).error;
  if (!error || typeof error !== 'object' || Array.isArray(error)) return fallback;
  return String((error as { reasonKey?: unknown }).reasonKey || fallback);
}

export function RomaAccountSwitcher() {
  const me = useRomaMe();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accounts = me.data?.accounts ?? [];
  const activeAccountId = me.data?.defaults?.accountId ?? '';

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
      window.location.reload();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
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
