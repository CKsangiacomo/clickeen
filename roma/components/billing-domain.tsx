'use client';

import { useEffect, useMemo, useState } from 'react';
import { resolveBootstrapDomainState } from './bootstrap-domain-state';
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
    const hasDomainPayload = Boolean(snapshot && snapshot.accountId === accountId);
    const domainState = resolveBootstrapDomainState({
      data: me.data,
      domainKey: 'billing',
      hasDomainPayload,
    });
    if (!hasDomainPayload || domainState.kind !== 'ok') {
      setSummary(null);
      setError(domainState.reasonKey);
      return;
    }
    const safeSnapshot = snapshot as NonNullable<typeof snapshot>;
    setSummary(safeSnapshot);
    setError(null);
  }, [accountId, me.data]);

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

  if (me.loading) return <section className="rd-canvas-module body-m">Loading billing context...</section>;
  if (me.error || !me.data) {
    return <section className="rd-canvas-module body-m">Failed to load identity context: {me.error ?? 'unknown_error'}</section>;
  }
  if (!accountId) {
    return <section className="rd-canvas-module body-m">No account membership found for billing controls.</section>;
  }

  return (
    <>
      <section className="rd-canvas-module">
        <p className="body-m">Account: {accountId}</p>

        {error ? (
          <div className="roma-inline-stack">
            <p className="body-m">roma.errors.bootstrap.domain_unavailable</p>
            <p className="body-m">{error}</p>
            <button className="diet-btn-txt" data-size="md" data-variant="line2" type="button" onClick={() => void me.reload()}>
              <span className="diet-btn-txt__label body-m">Retry</span>
            </button>
          </div>
        ) : null}
        {actionError ? <p className="body-m">Billing action failed: {actionError}</p> : null}
      </section>

      {summary ? (
        <section className="rd-canvas-module">
          <div className="roma-grid roma-grid--three">
            <article className="roma-card">
              <h2 className="heading-6">Plan Tier</h2>
              <p className="body-s">{summary.plan.inferredTier}</p>
            </article>
            <article className="roma-card">
              <h2 className="heading-6">Status</h2>
              <p className="body-s">{summary.status}</p>
            </article>
            <article className="roma-card">
              <h2 className="heading-6">Provider</h2>
              <p className="body-s">{summary.provider}</p>
            </article>
          </div>
        </section>
      ) : null}

      <section className="rd-canvas-module">
        <div className="rd-canvas-module__actions">
          <button
            className="diet-btn-txt"
            data-size="md"
            data-variant="primary"
            type="button"
            onClick={() => void callBillingAction('checkout')}
            disabled={actionLoading !== null}
          >
            <span className="diet-btn-txt__label body-m">{actionLoading === 'checkout' ? 'Opening checkout...' : 'Start checkout'}</span>
          </button>
          <button
            className="diet-btn-txt"
            data-size="md"
            data-variant="line2"
            type="button"
            onClick={() => void callBillingAction('portal')}
            disabled={actionLoading !== null}
          >
            <span className="diet-btn-txt__label body-m">{actionLoading === 'portal' ? 'Opening portal...' : 'Open billing portal'}</span>
          </button>
        </div>
      </section>
    </>
  );
}
