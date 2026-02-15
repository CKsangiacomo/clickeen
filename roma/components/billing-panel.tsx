'use client';

import { useEffect, useState } from 'react';
import { fetchParisJson } from './paris-http';
import { useRomaMe } from './use-roma-me';

type BillingSummaryResponse = {
  accountId: string;
  role: string;
  provider: string;
  status: string;
  reasonKey: string;
  plan: {
    inferredTier: string;
    workspaceCount: number;
  };
  checkoutAvailable: boolean;
  portalAvailable: boolean;
};

export function BillingPanel() {
  const me = useRomaMe();
  const [accountId, setAccountId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<BillingSummaryResponse | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<null | 'checkout' | 'portal'>(null);

  useEffect(() => {
    if (!me.data) return;
    const preferred = me.data.defaults.accountId ?? me.data.accounts[0]?.accountId ?? '';
    setAccountId((current) => current || preferred);
  }, [me.data]);

  useEffect(() => {
    if (!accountId) return;
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const payload = await fetchParisJson<BillingSummaryResponse>(
          `/api/paris/accounts/${encodeURIComponent(accountId)}/billing/summary`,
        );
        if (cancelled) return;
        setSummary(payload);
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        setSummary(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [accountId]);

  const callBillingAction = async (kind: 'checkout' | 'portal') => {
    if (!accountId) return;
    setActionLoading(kind);
    setActionError(null);
    try {
      const endpoint =
        kind === 'checkout'
          ? `/api/paris/accounts/${encodeURIComponent(accountId)}/billing/checkout-session`
          : `/api/paris/accounts/${encodeURIComponent(accountId)}/billing/portal-session`;
      await fetchParisJson(endpoint, { method: 'POST' });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setActionError(message);
    } finally {
      setActionLoading(null);
    }
  };

  if (me.loading) return <section className="roma-module-surface">Loading billing context...</section>;
  if (me.error || !me.data) {
    return <section className="roma-module-surface">Failed to load identity context: {me.error ?? 'unknown_error'}</section>;
  }
  if (me.data.accounts.length === 0) {
    return <section className="roma-module-surface">No account membership found for billing controls.</section>;
  }

  return (
    <section className="roma-module-surface">
      <div className="roma-toolbar">
        <label className="roma-label" htmlFor="billing-account-select">
          Account
        </label>
        <select
          id="billing-account-select"
          className="roma-select"
          value={accountId}
          onChange={(event) => setAccountId(event.target.value)}
        >
          {me.data.accounts.map((account) => (
            <option key={account.accountId} value={account.accountId}>
              {account.accountId}
            </option>
          ))}
        </select>
      </div>

      {loading ? <p>Loading billing summary...</p> : null}
      {error ? <p>Failed to load billing summary: {error}</p> : null}
      {actionError ? <p>Billing action failed: {actionError}</p> : null}

      {summary ? (
        <div className="roma-grid roma-grid--three">
          <article className="roma-card">
            <h2>Plan Tier</h2>
            <p>{summary.plan.inferredTier}</p>
          </article>
          <article className="roma-card">
            <h2>Status</h2>
            <p>{summary.status}</p>
          </article>
          <article className="roma-card">
            <h2>Provider</h2>
            <p>{summary.provider}</p>
          </article>
        </div>
      ) : null}

      <div className="roma-module-surface__actions">
        <button
          className="roma-btn roma-btn--inline"
          type="button"
          onClick={() => void callBillingAction('checkout')}
          disabled={actionLoading !== null}
        >
          {actionLoading === 'checkout' ? 'Opening checkout...' : 'Start checkout'}
        </button>
        <button
          className="roma-btn roma-btn--ghost roma-btn--inline"
          type="button"
          onClick={() => void callBillingAction('portal')}
          disabled={actionLoading !== null}
        >
          {actionLoading === 'portal' ? 'Opening portal...' : 'Open billing portal'}
        </button>
      </div>
    </section>
  );
}
