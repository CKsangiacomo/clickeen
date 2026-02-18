'use client';

import { useEffect, useMemo, useState } from 'react';
import { fetchParisJson } from './paris-http';
import { resolveDefaultRomaContext, useRomaMe } from './use-roma-me';

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

export function BillingDomain() {
  const me = useRomaMe();
  const context = useMemo(() => resolveDefaultRomaContext(me.data), [me.data]);
  const accountId = context.accountId;

  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<BillingSummaryResponse | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<null | 'checkout' | 'portal'>(null);

  useEffect(() => {
    if (!accountId) {
      setSummary(null);
      setError(null);
      return;
    }
    const snapshot = me.data?.domains?.billing ?? null;
    if (!snapshot || snapshot.accountId !== accountId) {
      setSummary(null);
      setError('Bootstrap billing snapshot unavailable.');
      return;
    }
    setSummary(snapshot);
    setError(null);
  }, [accountId, me.data?.domains?.billing]);

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
  if (!accountId) {
    return <section className="roma-module-surface">No account membership found for billing controls.</section>;
  }

  return (
    <section className="roma-module-surface">
      <p>Account: {accountId}</p>

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
          className="diet-btn-txt"
          data-size="md"
          data-variant="primary"
          type="button"
          onClick={() => void callBillingAction('checkout')}
          disabled={actionLoading !== null}
        >
          <span className="diet-btn-txt__label">{actionLoading === 'checkout' ? 'Opening checkout...' : 'Start checkout'}</span>
        </button>
        <button
          className="diet-btn-txt"
          data-size="md"
          data-variant="line2"
          type="button"
          onClick={() => void callBillingAction('portal')}
          disabled={actionLoading !== null}
        >
          <span className="diet-btn-txt__label">{actionLoading === 'portal' ? 'Opening portal...' : 'Open billing portal'}</span>
        </button>
      </div>
    </section>
  );
}
